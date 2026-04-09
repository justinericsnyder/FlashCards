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
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10,
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
      const result = await Promise.race([
        db`SELECT 1 as test`,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Query timeout')), 8000)),
      ]);
      console.log(`🔗 Test query result:`, result);
      await db`
        CREATE TABLE IF NOT EXISTS scores (
          id SERIAL PRIMARY KEY,
          url TEXT,
          page_title TEXT,
          correct INTEGER NOT NULL,
          total INTEGER NOT NULL,
          score_pct INTEGER NOT NULL,
          difficulty TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      await db`
        CREATE TABLE IF NOT EXISTS question_logs (
          id SERIAL PRIMARY KEY,
          url TEXT,
          page_title TEXT,
          question TEXT NOT NULL,
          correct_answer TEXT NOT NULL,
          user_answer TEXT NOT NULL,
          is_correct BOOLEAN NOT NULL,
          difficulty TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      await db`CREATE INDEX IF NOT EXISTS idx_qlog_url ON question_logs (url)`;
      await db`CREATE INDEX IF NOT EXISTS idx_qlog_correct ON question_logs (is_correct)`;
      console.log('✅ Database initialized');
      return;
    } catch (err) {
      console.log(`⏳ DB connection attempt ${attempt}/5 failed: ${err.message}`);
      if (attempt < 5) await new Promise(r => setTimeout(r, 3000));
    }
  }
  console.error('❌ Could not connect to database after 5 attempts');
}

async function saveScore({ url, pageTitle, correct, total, scorePct, difficulty }) {
  const db = getSql();
  const [row] = await db`
    INSERT INTO scores (url, page_title, correct, total, score_pct, difficulty, created_at)
    VALUES (${url}, ${pageTitle}, ${correct}, ${total}, ${scorePct}, ${difficulty}, NOW())
    RETURNING *
  `;
  return row;
}

async function getScores({ limit = 50 } = {}) {
  const db = getSql();
  return await db`SELECT * FROM scores ORDER BY created_at DESC LIMIT ${limit}`;
}

async function getStats() {
  const db = getSql();

  const [overall] = await db`
    SELECT
      COUNT(*) as total_sessions,
      COALESCE(AVG(score_pct), 0) as avg_score,
      COALESCE(MAX(score_pct), 0) as best_score,
      COALESCE(SUM(correct), 0) as total_correct,
      COALESCE(SUM(total), 0) as total_questions
    FROM scores
  `;

  const byDifficulty = await db`
    SELECT difficulty, COUNT(*) as sessions, ROUND(AVG(score_pct)) as avg_score
    FROM scores
    GROUP BY difficulty
    ORDER BY difficulty
  `;

  const recent = await db`
    SELECT score_pct, difficulty, created_at, page_title
    FROM scores
    ORDER BY created_at DESC
    LIMIT 20
  `;

  return { overall, byDifficulty, recent };
}

async function saveQuestionLog({ url, pageTitle, question, correctAnswer, userAnswer, isCorrect, difficulty }) {
  const db = getSql();
  const [row] = await db`
    INSERT INTO question_logs (url, page_title, question, correct_answer, user_answer, is_correct, difficulty, created_at)
    VALUES (${url}, ${pageTitle}, ${question}, ${correctAnswer}, ${userAnswer}, ${isCorrect}, ${difficulty}, NOW())
    RETURNING *
  `;
  return row;
}

async function getTopicStats() {
  const db = getSql();

  const topics = await db`
    SELECT
      page_title,
      url,
      COUNT(*) as total_questions,
      SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct_count,
      ROUND(100.0 * SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) / COUNT(*)) as accuracy_pct,
      MAX(created_at) as last_studied
    FROM question_logs
    WHERE page_title IS NOT NULL
    GROUP BY page_title, url
    ORDER BY last_studied DESC
  `;

  return topics;
}

module.exports = { initialize, saveScore, getScores, getStats, saveQuestionLog, getTopicStats, getPastQuestions, getGlobalTopicStats, getRecentTopics };

async function getPastQuestions(url) {
  const db = getSql();
  if (!db || !url) return [];
  try {
    const rows = await db`
      SELECT DISTINCT question FROM question_logs
      WHERE url = ${url}
      ORDER BY question
    `;
    return rows.map(r => r.question);
  } catch {
    return [];
  }
}

async function getGlobalTopicStats() {
  const db = getSql();

  const topics = await db`
    SELECT
      page_title,
      url,
      COUNT(*) as total_answers,
      SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct_count,
      ROUND(100.0 * SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) / COUNT(*)) as global_accuracy_pct,
      COUNT(DISTINCT question) as unique_questions
    FROM question_logs
    WHERE page_title IS NOT NULL
    GROUP BY page_title, url
    ORDER BY total_answers DESC
  `;

  return topics;
}

async function getRecentTopics() {
  const db = getSql();
  const topics = await db`
    SELECT
      url, page_title,
      MAX(created_at) as last_used,
      ROUND(AVG(score_pct)) as avg_score,
      COUNT(*) as sessions
    FROM scores
    WHERE url IS NOT NULL AND page_title IS NOT NULL
    GROUP BY url, page_title
    ORDER BY MAX(created_at) DESC
    LIMIT 6
  `;
  return topics;
}
