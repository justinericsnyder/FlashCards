const postgres = require('postgres');

let sql = null;

function getSql() {
  if (!sql && process.env.DATABASE_URL) {
    const dbUrl = process.env.DATABASE_URL;
    const sanitized = dbUrl.replace(/:[^@]+@/, ':***@');
    console.log('🔗 Connecting to DB:', sanitized);
    sql = postgres(dbUrl, {
      ssl: { rejectUnauthorized: false },
      connection: { application_name: 'flashcards' },
      max: 5, idle_timeout: 20, connect_timeout: 10,
    });
  }
  return sql;
}

async function initialize() {
  const db = getSql();
  if (!db) return;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      console.log(`⏳ DB connection attempt ${attempt}/5...`);
      await Promise.race([
        db`SELECT 1 as test`,
        new Promise((_, rej) => setTimeout(() => rej(new Error('Query timeout')), 8000)),
      ]);
      await db`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          display_name TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      await db`
        CREATE TABLE IF NOT EXISTS scores (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id),
          url TEXT, page_title TEXT,
          correct INTEGER NOT NULL, total INTEGER NOT NULL,
          score_pct INTEGER NOT NULL, difficulty TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      await db`
        CREATE TABLE IF NOT EXISTS question_logs (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id),
          url TEXT, page_title TEXT,
          question TEXT NOT NULL, correct_answer TEXT NOT NULL,
          user_answer TEXT NOT NULL, is_correct BOOLEAN NOT NULL,
          difficulty TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      // Migrations for existing tables
      await db`ALTER TABLE scores ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id)`;
      await db`ALTER TABLE question_logs ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id)`;
      await db`CREATE INDEX IF NOT EXISTS idx_scores_user ON scores (user_id)`;
      await db`CREATE INDEX IF NOT EXISTS idx_qlog_user ON question_logs (user_id)`;
      await db`CREATE INDEX IF NOT EXISTS idx_qlog_url ON question_logs (url)`;

      // Spaced repetition review cards
      await db`
        CREATE TABLE IF NOT EXISTS card_reviews (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id),
          url TEXT NOT NULL,
          page_title TEXT,
          question TEXT NOT NULL,
          correct_answer TEXT NOT NULL,
          choices JSONB,
          explanation TEXT,
          difficulty TEXT,
          ease_factor REAL DEFAULT 2.5,
          interval_days INTEGER DEFAULT 0,
          repetitions INTEGER DEFAULT 0,
          next_review TIMESTAMPTZ DEFAULT NOW(),
          last_reviewed TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(user_id, url, question)
        )
      `;
      await db`CREATE INDEX IF NOT EXISTS idx_reviews_user_next ON card_reviews (user_id, next_review)`;

      // Gamification
      await db`
        CREATE TABLE IF NOT EXISTS user_streaks (
          user_id INTEGER PRIMARY KEY REFERENCES users(id),
          current_streak INTEGER DEFAULT 0,
          longest_streak INTEGER DEFAULT 0,
          last_activity_date DATE,
          total_xp INTEGER DEFAULT 0
        )
      `;
      await db`
        CREATE TABLE IF NOT EXISTS achievements (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id),
          badge_key TEXT NOT NULL,
          earned_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(user_id, badge_key)
        )
      `;

      // Shared decks
      await db`
        CREATE TABLE IF NOT EXISTS shared_decks (
          id SERIAL PRIMARY KEY,
          share_code TEXT UNIQUE NOT NULL,
          user_id INTEGER REFERENCES users(id),
          url TEXT, page_title TEXT,
          cards JSONB NOT NULL,
          difficulty TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;

      console.log('✅ Database initialized');
      return;
    } catch (err) {
      console.log(`⏳ DB connection attempt ${attempt}/5 failed: ${err.message}`);
      if (attempt < 5) await new Promise(r => setTimeout(r, 3000));
    }
  }
  console.error('❌ Could not connect to database after 5 attempts');
}

// ── Users ──────────────────────────────────────────────
async function createUser({ email, passwordHash, displayName }) {
  const db = getSql();
  const [row] = await db`
    INSERT INTO users (email, password_hash, display_name)
    VALUES (${email.toLowerCase()}, ${passwordHash}, ${displayName || null})
    RETURNING id, email, display_name, created_at
  `;
  return row;
}

async function getUserByEmail(email) {
  const db = getSql();
  const [row] = await db`SELECT * FROM users WHERE email = ${email.toLowerCase()}`;
  return row || null;
}

async function getUserById(id) {
  const db = getSql();
  const [row] = await db`SELECT id, email, display_name, created_at FROM users WHERE id = ${id}`;
  return row || null;
}

// ── Scores (user-scoped) ───────────────────────────────
async function saveScore({ userId, url, pageTitle, correct, total, scorePct, difficulty }) {
  const db = getSql();
  const [row] = await db`
    INSERT INTO scores (user_id, url, page_title, correct, total, score_pct, difficulty)
    VALUES (${userId}, ${url}, ${pageTitle}, ${correct}, ${total}, ${scorePct}, ${difficulty})
    RETURNING *
  `;
  return row;
}

async function getScores({ userId, limit = 50 }) {
  const db = getSql();
  return await db`SELECT * FROM scores WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT ${limit}`;
}

async function getStats(userId) {
  const db = getSql();
  const [overall] = await db`
    SELECT COUNT(*) as total_sessions, COALESCE(AVG(score_pct),0) as avg_score,
      COALESCE(MAX(score_pct),0) as best_score, COALESCE(SUM(correct),0) as total_correct,
      COALESCE(SUM(total),0) as total_questions
    FROM scores WHERE user_id = ${userId}
  `;
  const byDifficulty = await db`
    SELECT difficulty, COUNT(*) as sessions, ROUND(AVG(score_pct)) as avg_score
    FROM scores WHERE user_id = ${userId} GROUP BY difficulty ORDER BY difficulty
  `;
  const recent = await db`
    SELECT score_pct, difficulty, created_at, page_title
    FROM scores WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 20
  `;
  return { overall, byDifficulty, recent };
}

// ── Question Logs (user-scoped) ────────────────────────
async function saveQuestionLog({ userId, url, pageTitle, question, correctAnswer, userAnswer, isCorrect, difficulty }) {
  const db = getSql();
  const [row] = await db`
    INSERT INTO question_logs (user_id, url, page_title, question, correct_answer, user_answer, is_correct, difficulty)
    VALUES (${userId}, ${url}, ${pageTitle}, ${question}, ${correctAnswer}, ${userAnswer}, ${isCorrect}, ${difficulty})
    RETURNING *
  `;
  return row;
}

async function getTopicStats(userId) {
  const db = getSql();
  return await db`
    SELECT page_title, url, COUNT(*) as total_questions,
      SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct_count,
      ROUND(100.0 * SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) / COUNT(*)) as accuracy_pct,
      MAX(created_at) as last_studied
    FROM question_logs WHERE user_id = ${userId} AND page_title IS NOT NULL
    GROUP BY page_title, url ORDER BY last_studied DESC
  `;
}

async function getPastQuestions(url, userId) {
  const db = getSql();
  if (!db || !url) return [];
  try {
    const rows = await db`
      SELECT DISTINCT question FROM question_logs
      WHERE url = ${url} AND user_id = ${userId} ORDER BY question
    `;
    return rows.map(r => r.question);
  } catch { return []; }
}

async function getRecentTopics(userId) {
  const db = getSql();
  return await db`
    SELECT url, page_title, MAX(created_at) as last_used,
      ROUND(AVG(score_pct)) as avg_score, COUNT(*) as sessions
    FROM scores WHERE user_id = ${userId} AND url IS NOT NULL AND page_title IS NOT NULL
    GROUP BY url, page_title ORDER BY MAX(created_at) DESC LIMIT 6
  `;
}

// ── Global aggregates (no user filter) ─────────────────
async function getGlobalTopicStats() {
  const db = getSql();
  return await db`
    SELECT page_title, url, COUNT(*) as total_answers,
      SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct_count,
      ROUND(100.0 * SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) / COUNT(*)) as global_accuracy_pct,
      COUNT(DISTINCT question) as unique_questions
    FROM question_logs WHERE page_title IS NOT NULL
    GROUP BY page_title, url ORDER BY total_answers DESC
  `;
}

module.exports = {
  initialize, createUser, getUserByEmail, getUserById,
  saveScore, getScores, getStats,
  saveQuestionLog, getTopicStats, getPastQuestions,
  getRecentTopics, getGlobalTopicStats,
  upsertCardReview, getCardsForReview, updateReviewResult, getReviewStats,
  updateStreak, checkAndAwardBadges, getUserAchievements, getStreak, getLeaderboard, BADGES,
  shareDeck, getDeckByCode,
  getDetailedAnalytics,
};

// ── Spaced Repetition (SM-2) ───────────────────────────
async function upsertCardReview({ userId, url, pageTitle, question, correctAnswer, choices, explanation, difficulty }) {
  const db = getSql();
  // Insert or ignore if already exists
  await db`
    INSERT INTO card_reviews (user_id, url, page_title, question, correct_answer, choices, explanation, difficulty)
    VALUES (${userId}, ${url}, ${pageTitle}, ${question}, ${correctAnswer}, ${JSON.stringify(choices)}, ${explanation}, ${difficulty})
    ON CONFLICT (user_id, url, question) DO NOTHING
  `;
}

async function getCardsForReview(userId, limit = 10) {
  const db = getSql();
  return await db`
    SELECT * FROM card_reviews
    WHERE user_id = ${userId} AND next_review <= NOW()
    ORDER BY next_review ASC
    LIMIT ${limit}
  `;
}

async function updateReviewResult(cardId, quality) {
  // quality: 0-5 (SM-2 scale). 0-2 = fail, 3 = hard, 4 = good, 5 = easy
  const db = getSql();
  const [card] = await db`SELECT * FROM card_reviews WHERE id = ${cardId}`;
  if (!card) return null;

  let { ease_factor, interval_days, repetitions } = card;
  ease_factor = Number(ease_factor);
  interval_days = Number(interval_days);
  repetitions = Number(repetitions);

  if (quality < 3) {
    // Failed — reset
    repetitions = 0;
    interval_days = 0;
  } else {
    // Passed
    if (repetitions === 0) {
      interval_days = 1;
    } else if (repetitions === 1) {
      interval_days = 3;
    } else {
      interval_days = Math.round(interval_days * ease_factor);
    }
    repetitions++;
  }

  // Update ease factor (SM-2 formula)
  ease_factor = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (ease_factor < 1.3) ease_factor = 1.3;

  const nextReview = new Date(Date.now() + interval_days * 24 * 60 * 60 * 1000);

  const [updated] = await db`
    UPDATE card_reviews
    SET ease_factor = ${ease_factor}, interval_days = ${interval_days},
        repetitions = ${repetitions}, next_review = ${nextReview.toISOString()},
        last_reviewed = NOW()
    WHERE id = ${cardId}
    RETURNING *
  `;
  return updated;
}

async function getReviewStats(userId) {
  const db = getSql();
  const [stats] = await db`
    SELECT
      COUNT(*) as total_cards,
      SUM(CASE WHEN next_review <= NOW() THEN 1 ELSE 0 END) as due_now,
      SUM(CASE WHEN next_review > NOW() AND next_review <= NOW() + INTERVAL '1 day' THEN 1 ELSE 0 END) as due_today,
      SUM(CASE WHEN repetitions >= 3 THEN 1 ELSE 0 END) as mastered
    FROM card_reviews WHERE user_id = ${userId}
  `;
  return stats;
}

// ── Gamification ───────────────────────────────────────
const BADGES = {
  first_session: { name: 'First Steps', desc: 'Complete your first session', icon: 'footprints' },
  streak_3: { name: 'On Fire', desc: '3-day study streak', icon: 'flame' },
  streak_7: { name: 'Week Warrior', desc: '7-day study streak', icon: 'zap' },
  streak_30: { name: 'Monthly Master', desc: '30-day study streak', icon: 'crown' },
  perfect_score: { name: 'Perfectionist', desc: 'Score 100% on a session', icon: 'star' },
  ten_sessions: { name: 'Dedicated', desc: 'Complete 10 sessions', icon: 'target' },
  fifty_questions: { name: 'Scholar', desc: 'Answer 50 questions', icon: 'book-open' },
  five_topics: { name: 'Explorer', desc: 'Study 5 different topics', icon: 'compass' },
  review_master: { name: 'Review Pro', desc: 'Complete 20 spaced reviews', icon: 'brain' },
};

async function updateStreak(userId) {
  const db = getSql();
  const today = new Date().toISOString().split('T')[0];
  const [existing] = await db`SELECT * FROM user_streaks WHERE user_id = ${userId}`;

  if (!existing) {
    await db`INSERT INTO user_streaks (user_id, current_streak, longest_streak, last_activity_date, total_xp) VALUES (${userId}, 1, 1, ${today}, 10)`;
    return { current_streak: 1, longest_streak: 1, xp_earned: 10 };
  }

  const lastDate = existing.last_activity_date ? new Date(existing.last_activity_date).toISOString().split('T')[0] : null;
  if (lastDate === today) return { current_streak: existing.current_streak, longest_streak: existing.longest_streak, xp_earned: 0 };

  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  let newStreak = lastDate === yesterday ? existing.current_streak + 1 : 1;
  let longest = Math.max(existing.longest_streak, newStreak);
  let xp = 10 + (newStreak > 1 ? newStreak * 5 : 0); // bonus XP for streaks

  await db`UPDATE user_streaks SET current_streak = ${newStreak}, longest_streak = ${longest}, last_activity_date = ${today}, total_xp = total_xp + ${xp} WHERE user_id = ${userId}`;
  return { current_streak: newStreak, longest_streak: longest, xp_earned: xp };
}

async function checkAndAwardBadges(userId) {
  const db = getSql();
  const awarded = [];

  const [streak] = await db`SELECT * FROM user_streaks WHERE user_id = ${userId}`;
  const [sessionCount] = await db`SELECT COUNT(*) as c FROM scores WHERE user_id = ${userId}`;
  const [questionCount] = await db`SELECT COUNT(*) as c FROM question_logs WHERE user_id = ${userId}`;
  const [topicCount] = await db`SELECT COUNT(DISTINCT url) as c FROM scores WHERE user_id = ${userId}`;
  const [perfectCount] = await db`SELECT COUNT(*) as c FROM scores WHERE user_id = ${userId} AND score_pct = 100`;
  const [reviewCount] = await db`SELECT COUNT(*) as c FROM card_reviews WHERE user_id = ${userId} AND last_reviewed IS NOT NULL`;

  const checks = [
    [Number(sessionCount.c) >= 1, 'first_session'],
    [streak && streak.current_streak >= 3, 'streak_3'],
    [streak && streak.current_streak >= 7, 'streak_7'],
    [streak && streak.longest_streak >= 30, 'streak_30'],
    [Number(perfectCount.c) >= 1, 'perfect_score'],
    [Number(sessionCount.c) >= 10, 'ten_sessions'],
    [Number(questionCount.c) >= 50, 'fifty_questions'],
    [Number(topicCount.c) >= 5, 'five_topics'],
    [Number(reviewCount.c) >= 20, 'review_master'],
  ];

  for (const [condition, key] of checks) {
    if (condition) {
      try {
        await db`INSERT INTO achievements (user_id, badge_key) VALUES (${userId}, ${key}) ON CONFLICT DO NOTHING`;
        awarded.push(key);
      } catch {}
    }
  }
  return awarded;
}

async function getUserAchievements(userId) {
  const db = getSql();
  const rows = await db`SELECT badge_key, earned_at FROM achievements WHERE user_id = ${userId} ORDER BY earned_at DESC`;
  return rows.map(r => ({ ...BADGES[r.badge_key], key: r.badge_key, earnedAt: r.earned_at }));
}

async function getStreak(userId) {
  const db = getSql();
  const [row] = await db`SELECT * FROM user_streaks WHERE user_id = ${userId}`;
  return row || { current_streak: 0, longest_streak: 0, total_xp: 0 };
}

async function getLeaderboard(limit = 10) {
  const db = getSql();
  return await db`
    SELECT u.display_name, u.email, s.total_xp, s.current_streak, s.longest_streak,
      (SELECT COUNT(*) FROM achievements WHERE user_id = u.id) as badge_count
    FROM user_streaks s JOIN users u ON u.id = s.user_id
    ORDER BY s.total_xp DESC LIMIT ${limit}
  `;
}

// ── Shared Decks ───────────────────────────────────────
async function shareDeck({ userId, url, pageTitle, cards, difficulty }) {
  const db = getSql();
  const code = Math.random().toString(36).substring(2, 10);
  const [row] = await db`
    INSERT INTO shared_decks (share_code, user_id, url, page_title, cards, difficulty)
    VALUES (${code}, ${userId}, ${url}, ${pageTitle}, ${JSON.stringify(cards)}, ${difficulty})
    RETURNING share_code, page_title, created_at
  `;
  return row;
}

async function getDeckByCode(code) {
  const db = getSql();
  const [row] = await db`SELECT * FROM shared_decks WHERE share_code = ${code}`;
  return row || null;
}

// ── Advanced Analytics ─────────────────────────────────
async function getDetailedAnalytics(userId) {
  const db = getSql();

  const [overall] = await db`
    SELECT COUNT(*) as sessions, COALESCE(AVG(score_pct),0) as avg_score,
      COALESCE(MAX(score_pct),0) as best, COALESCE(MIN(score_pct),0) as worst,
      COALESCE(SUM(correct),0) as correct, COALESCE(SUM(total),0) as total
    FROM scores WHERE user_id = ${userId}
  `;

  const weeklyTrend = await db`
    SELECT DATE_TRUNC('week', created_at) as week, ROUND(AVG(score_pct)) as avg_score, COUNT(*) as sessions
    FROM scores WHERE user_id = ${userId} AND created_at > NOW() - INTERVAL '12 weeks'
    GROUP BY week ORDER BY week
  `;

  const hardestTopics = await db`
    SELECT page_title, ROUND(100.0 * SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) / COUNT(*)) as accuracy, COUNT(*) as questions
    FROM question_logs WHERE user_id = ${userId} AND page_title IS NOT NULL
    GROUP BY page_title HAVING COUNT(*) >= 3
    ORDER BY accuracy ASC LIMIT 5
  `;

  const strongestTopics = await db`
    SELECT page_title, ROUND(100.0 * SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) / COUNT(*)) as accuracy, COUNT(*) as questions
    FROM question_logs WHERE user_id = ${userId} AND page_title IS NOT NULL
    GROUP BY page_title HAVING COUNT(*) >= 3
    ORDER BY accuracy DESC LIMIT 5
  `;

  const activityHeatmap = await db`
    SELECT DATE(created_at) as day, COUNT(*) as sessions
    FROM scores WHERE user_id = ${userId} AND created_at > NOW() - INTERVAL '90 days'
    GROUP BY day ORDER BY day
  `;

  return { overall, weeklyTrend, hardestTopics, strongestTopics, activityHeatmap };
}
