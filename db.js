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

module.exports = { initialize, saveScore, getScores, getStats };
