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

      // Question feedback
      await db`
        CREATE TABLE IF NOT EXISTS question_feedback (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id),
          question TEXT NOT NULL,
          url TEXT,
          feedback_type TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;

      // Telemetry events
      await db`
        CREATE TABLE IF NOT EXISTS telemetry (
          id SERIAL PRIMARY KEY,
          user_id INTEGER,
          event_type TEXT NOT NULL,
          event_data JSONB,
          url TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;

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
    GROUP BY url, page_title ORDER BY MAX(created_at) DESC LIMIT 5
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

// module.exports moved to end of file

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
  // Milestones
  first_session: { name: 'First Steps', desc: 'Complete your first session', icon: 'footprints' },
  ten_sessions: { name: 'Dedicated', desc: 'Complete 10 sessions', icon: 'target' },
  twenty_five_sessions: { name: 'Committed', desc: 'Complete 25 sessions', icon: 'calendar-check' },
  fifty_sessions: { name: 'Veteran', desc: 'Complete 50 sessions', icon: 'award' },
  hundred_sessions: { name: 'Centurion', desc: 'Complete 100 sessions', icon: 'shield' },

  // Streaks
  streak_3: { name: 'On Fire', desc: '3-day study streak', icon: 'flame' },
  streak_7: { name: 'Week Warrior', desc: '7-day study streak', icon: 'zap' },
  streak_14: { name: 'Fortnight Force', desc: '14-day study streak', icon: 'trending-up' },
  streak_30: { name: 'Monthly Master', desc: '30-day study streak', icon: 'crown' },
  streak_100: { name: 'Unstoppable', desc: '100-day study streak', icon: 'infinity' },

  // Performance
  perfect_score: { name: 'Perfectionist', desc: 'Score 100% on a session', icon: 'star' },
  three_perfects: { name: 'Flawless', desc: 'Score 100% on 3 different sessions', icon: 'sparkles' },
  speed_demon: { name: 'Speed Demon', desc: 'Answer 10 questions in under 5 seconds each', icon: 'timer' },
  comeback_kid: { name: 'Comeback Kid', desc: 'Score 90%+ after previously scoring below 40%', icon: 'arrow-up-circle' },
  no_hints: { name: 'Unaided', desc: 'Complete 5 sessions without using any hints', icon: 'eye-off' },

  // Knowledge breadth
  five_topics: { name: 'Explorer', desc: 'Study 5 different topics', icon: 'compass' },
  ten_topics: { name: 'Cartographer', desc: 'Study 10 different topics', icon: 'map' },
  twenty_topics: { name: 'Polymath', desc: 'Study 20 different topics', icon: 'globe' },
  fifty_questions: { name: 'Scholar', desc: 'Answer 50 questions', icon: 'book-open' },
  two_hundred_questions: { name: 'Professor', desc: 'Answer 200 questions', icon: 'graduation-cap' },
  five_hundred_questions: { name: 'Sage', desc: 'Answer 500 questions', icon: 'scroll' },

  // Features
  review_master: { name: 'Review Pro', desc: 'Complete 20 spaced reviews', icon: 'brain' },
  socratic_learner: { name: 'Socratic Learner', desc: 'Complete 5 Socratic coaching sessions', icon: 'message-circle' },
  deck_sharer: { name: 'Generous Mind', desc: 'Share a deck with others', icon: 'share-2' },
  path_completer: { name: 'Path Finder', desc: 'Complete all modules in a learning path', icon: 'route' },
  night_owl: { name: 'Night Owl', desc: 'Study after midnight', icon: 'moon' },
  early_bird: { name: 'Early Bird', desc: 'Study before 7 AM', icon: 'sunrise' },
  weekend_warrior: { name: 'Weekend Warrior', desc: 'Study on both Saturday and Sunday', icon: 'calendar' },

  // XP milestones
  xp_100: { name: 'Rising Star', desc: 'Earn 100 XP', icon: 'trending-up' },
  xp_500: { name: 'Power Player', desc: 'Earn 500 XP', icon: 'battery-charging' },
  xp_1000: { name: 'Elite', desc: 'Earn 1,000 XP', icon: 'diamond' },
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
  const [sharedCount] = await db`SELECT COUNT(*) as c FROM shared_decks WHERE user_id = ${userId}`;

  const sessions = Number(sessionCount.c);
  const questions = Number(questionCount.c);
  const topics = Number(topicCount.c);
  const perfects = Number(perfectCount.c);
  const reviews = Number(reviewCount.c);
  const shares = Number(sharedCount.c);
  const currentStreak = streak ? Number(streak.current_streak) : 0;
  const longestStreak = streak ? Number(streak.longest_streak) : 0;
  const totalXp = streak ? Number(streak.total_xp) : 0;
  const hour = new Date().getHours();

  const checks = [
    // Milestones
    [sessions >= 1, 'first_session'],
    [sessions >= 10, 'ten_sessions'],
    [sessions >= 25, 'twenty_five_sessions'],
    [sessions >= 50, 'fifty_sessions'],
    [sessions >= 100, 'hundred_sessions'],

    // Streaks
    [currentStreak >= 3, 'streak_3'],
    [currentStreak >= 7, 'streak_7'],
    [currentStreak >= 14, 'streak_14'],
    [longestStreak >= 30, 'streak_30'],
    [longestStreak >= 100, 'streak_100'],

    // Performance
    [perfects >= 1, 'perfect_score'],
    [perfects >= 3, 'three_perfects'],

    // Knowledge breadth
    [topics >= 5, 'five_topics'],
    [topics >= 10, 'ten_topics'],
    [topics >= 20, 'twenty_topics'],
    [questions >= 50, 'fifty_questions'],
    [questions >= 200, 'two_hundred_questions'],
    [questions >= 500, 'five_hundred_questions'],

    // Features
    [reviews >= 20, 'review_master'],
    [shares >= 1, 'deck_sharer'],
    [hour >= 0 && hour < 5, 'night_owl'],
    [hour >= 5 && hour < 7, 'early_bird'],

    // XP milestones
    [totalXp >= 100, 'xp_100'],
    [totalXp >= 500, 'xp_500'],
    [totalXp >= 1000, 'xp_1000'],
  ];

  for (const [condition, key] of checks) {
    if (condition) {
      try {
        // Only count as newly awarded if the INSERT actually created a row
        const result = await db`
          INSERT INTO achievements (user_id, badge_key) 
          VALUES (${userId}, ${key}) 
          ON CONFLICT DO NOTHING
          RETURNING badge_key
        `;
        if (result.length > 0) {
          awarded.push(key);
        }
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

// ── Question Feedback ──────────────────────────────────
async function saveQuestionFeedback({ userId, question, url, feedbackType }) {
  const db = getSql();
  const [row] = await db`
    INSERT INTO question_feedback (user_id, question, url, feedback_type)
    VALUES (${userId}, ${question}, ${url}, ${feedbackType})
    RETURNING *
  `;
  return row;
}

// ── Weakness Analysis ──────────────────────────────────
async function getWeaknessData(userId) {
  const db = getSql();
  const wrongAnswers = await db`
    SELECT page_title, question, correct_answer, user_answer, difficulty, created_at
    FROM question_logs
    WHERE user_id = ${userId} AND is_correct = false
    ORDER BY created_at DESC LIMIT 50
  `;
  const topicAccuracy = await db`
    SELECT page_title,
      COUNT(*) as total,
      SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct,
      ROUND(100.0 * SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) / COUNT(*)) as accuracy
    FROM question_logs
    WHERE user_id = ${userId} AND page_title IS NOT NULL
    GROUP BY page_title HAVING COUNT(*) >= 3
    ORDER BY accuracy ASC LIMIT 10
  `;
  return { wrongAnswers, topicAccuracy };
}

// ── Certification Readiness ────────────────────────────
async function getCertificationReadiness(userId) {
  const db = getSql();
  const topics = await db`
    SELECT page_title, url,
      COUNT(*) as total_questions,
      SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct,
      ROUND(100.0 * SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) / COUNT(*)) as accuracy,
      MAX(created_at) as last_studied
    FROM question_logs
    WHERE user_id = ${userId} AND page_title IS NOT NULL
    GROUP BY page_title, url
    ORDER BY accuracy ASC
  `;
  const [overall] = await db`
    SELECT COUNT(*) as total, SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct,
      ROUND(100.0 * SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0)) as accuracy,
      COUNT(DISTINCT url) as topics_covered
    FROM question_logs WHERE user_id = ${userId}
  `;
  return { topics, overall };
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
  saveQuestionFeedback,
  getWeaknessData,
  getCertificationReadiness,
  saveTelemetry,
  getLearningProfile,
  getRetentionData,
  getDifficultyCalibration,
};

// ── Telemetry ──────────────────────────────────────────
async function saveTelemetry({ userId, eventType, eventData, url }) {
  const db = getSql();
  await db`INSERT INTO telemetry (user_id, event_type, event_data, url) VALUES (${userId || null}, ${eventType}, ${JSON.stringify(eventData || {})}, ${url || null})`;
}

// ── Learning Profile ───────────────────────────────────
async function getLearningProfile(userId) {
  const db = getSql();
  // Analyze user's performance patterns to build a learning profile
  const [diffStats] = await db`
    SELECT
      ROUND(AVG(CASE WHEN difficulty='beginner' AND is_correct THEN 100 WHEN difficulty='beginner' THEN 0 END)) as beginner_acc,
      ROUND(AVG(CASE WHEN difficulty='intermediate' AND is_correct THEN 100 WHEN difficulty='intermediate' THEN 0 END)) as intermediate_acc,
      ROUND(AVG(CASE WHEN difficulty='advanced' AND is_correct THEN 100 WHEN difficulty='advanced' THEN 0 END)) as advanced_acc,
      COUNT(*) as total_answers
    FROM question_logs WHERE user_id = ${userId}
  `;
  const [speedStats] = await db`
    SELECT COUNT(*) as total FROM telemetry
    WHERE user_id = ${userId} AND event_type = 'answer_submitted'
    AND (event_data->>'hesitationMs')::int < 5000
  `;
  const fastAnswerRatio = diffStats.total_answers > 0 ? Number(speedStats.total) / Number(diffStats.total_answers) : 0;

  // Determine recommended difficulty
  let recommended = 'intermediate';
  const bAcc = Number(diffStats.beginner_acc || 0);
  const iAcc = Number(diffStats.intermediate_acc || 0);
  const aAcc = Number(diffStats.advanced_acc || 0);
  if (bAcc >= 80 && iAcc >= 70) recommended = 'advanced';
  else if (bAcc >= 80 && iAcc < 50) recommended = 'intermediate';
  else if (bAcc < 60) recommended = 'beginner';

  return { beginner_acc: bAcc, intermediate_acc: iAcc, advanced_acc: aAcc, total_answers: Number(diffStats.total_answers), fast_answer_ratio: fastAnswerRatio, recommended_difficulty: recommended };
}

// ── Learning Outcome Validation ────────────────────────
async function getRetentionData(userId) {
  const db = getSql();
  // Compare first attempt vs latest attempt on same questions
  const retention = await db`
    WITH first_attempts AS (
      SELECT DISTINCT ON (question) question, is_correct as first_correct, created_at as first_at
      FROM question_logs WHERE user_id = ${userId}
      ORDER BY question, created_at ASC
    ),
    latest_attempts AS (
      SELECT DISTINCT ON (question) question, is_correct as latest_correct, created_at as latest_at
      FROM question_logs WHERE user_id = ${userId}
      ORDER BY question, created_at DESC
    )
    SELECT
      COUNT(*) as total_questions,
      SUM(CASE WHEN f.first_correct THEN 1 ELSE 0 END) as first_time_correct,
      SUM(CASE WHEN l.latest_correct THEN 1 ELSE 0 END) as latest_correct,
      SUM(CASE WHEN NOT f.first_correct AND l.latest_correct THEN 1 ELSE 0 END) as improved,
      SUM(CASE WHEN f.first_correct AND NOT l.latest_correct THEN 1 ELSE 0 END) as regressed
    FROM first_attempts f
    JOIN latest_attempts l ON f.question = l.question
    WHERE f.first_at != l.latest_at
  `;
  return retention[0] || { total_questions: 0 };
}

// ── Difficulty Calibration ─────────────────────────────
async function getDifficultyCalibration() {
  const db = getSql();
  return await db`
    SELECT page_title, difficulty,
      COUNT(*) as total_answers,
      ROUND(100.0 * SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) / COUNT(*)) as global_accuracy
    FROM question_logs
    WHERE page_title IS NOT NULL
    GROUP BY page_title, difficulty
    HAVING COUNT(*) >= 5
    ORDER BY global_accuracy ASC
    LIMIT 20
  `;
}
