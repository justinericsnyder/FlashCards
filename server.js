require('dotenv').config();
const express = require('express');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'flashcards-secret-change-in-production';

// Simple in-memory cache
const cache = new Map();
function cached(key, ttlMs, fn) {
  return async (req, res) => {
    const k = typeof key === 'function' ? key(req) : key;
    const entry = cache.get(k);
    if (entry && Date.now() - entry.time < ttlMs) return res.json(entry.data);
    try {
      const data = await fn(req);
      cache.set(k, { data, time: Date.now() });
      res.json(data);
    } catch (err) {
      cache.delete(k); // Don't cache errors
      res.status(500).json({ error: err.message });
    }
  };
}

// Input sanitization helper
function sanitize(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[<>]/g, '').trim().substring(0, 5000);
}

// JSON body parsing for POST requests
app.use(express.json({ limit: '1mb' }));

// Initialize Anthropic client (reads ANTHROPIC_API_KEY from env)
const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

// Initialize database
if (process.env.DATABASE_URL) {
  db.initialize().catch(err => console.error('DB init error:', err.message));
} else {
  console.warn('⚠️  DATABASE_URL not set — score tracking disabled');
}

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "https://cdn.jsdelivr.net", "https://unpkg.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
    },
  },
}));

// Enable CORS for frontend on Vercel
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin || allowedOrigins.some(o => origin.startsWith(o))) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all for now, tighten later
    }
  },
  credentials: true,
}));

// Compression middleware
app.use(compression());

// Rate limiting
const apiLimiter = rateLimit({ windowMs: 60000, max: 60, message: { error: 'Too many requests, slow down' } });
const aiLimiter = rateLimit({ windowMs: 60000, max: 10, message: { error: 'AI generation rate limited. Wait a moment.' } });
app.use('/api/', apiLimiter);
app.use('/api/generate-cards', aiLimiter);
app.use('/api/socratic', aiLimiter);
app.use('/api/teach-back', aiLimiter);
app.use('/api/weakness-report', aiLimiter);
app.use('/api/certification-readiness', aiLimiter);

// Static files served by Vercel in production
if (process.env.NODE_ENV !== 'production') {
  app.use(express.static(path.join(__dirname), {
    maxAge: '1d',
    etag: true,
    lastModified: true,
  }));
}

// ── Auth middleware ──────────────────────────────────────
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const token = header.slice(7);
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Optional auth — sets req.userId if token present, doesn't block
function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(header.slice(7), JWT_SECRET);
      req.userId = payload.userId;
    } catch {}
  }
  next();
}

// ── Auth routes ─────────────────────────────────────────
app.post('/api/auth/signup', async (req, res) => {
  const { email, password, displayName } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  try {
    const existing = await db.getUserByEmail(email);
    if (existing) return res.status(409).json({ error: 'An account with this email already exists' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await db.createUser({ email, passwordHash, displayName });
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, email: user.email, displayName: user.display_name } });
  } catch (err) {
    console.error('Signup error:', err.message);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    const user = await db.getUserByEmail(email);
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, email: user.email, displayName: user.display_name } });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = await db.getUserById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ id: user.id, email: user.email, displayName: user.display_name });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Proxy endpoint to fetch external documentation pages server-side
app.get('/api/fetch-page', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing "url" query parameter' });
  }

  // Only allow Microsoft domains
  let parsed;
  try {
    parsed = new URL(targetUrl);
    if (!parsed.hostname.endsWith('microsoft.com')) {
      return res.status(403).json({ error: 'Only Microsoft documentation URLs are allowed' });
    }
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  const fetchPage = (url, redirectsLeft = 5) => {
    return new Promise((resolve, reject) => {
      if (redirectsLeft <= 0) return reject(new Error('Too many redirects'));

      const urlObj = new URL(url);
      const mod = urlObj.protocol === 'https:' ? require('https') : require('http');

      mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' } }, (upstream) => {
        // Follow redirects — handle both absolute and relative Location headers
        if ([301, 302, 303, 307, 308].includes(upstream.statusCode) && upstream.headers.location) {
          const next = new URL(upstream.headers.location, url).href;
          return resolve(fetchPage(next, redirectsLeft - 1));
        }
        if (upstream.statusCode !== 200) {
          return reject(new Error(`Upstream returned ${upstream.statusCode}`));
        }
        const chunks = [];
        upstream.on('data', (chunk) => chunks.push(chunk));
        upstream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
        upstream.on('error', reject);
      }).on('error', reject);
    });
  };

  try {
    const html = await fetchPage(targetUrl);
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error('Proxy fetch error:', err.message);
    res.status(502).json({ error: 'Failed to fetch the requested page' });
  }
});

// AI-powered flash card generation using Claude
app.post('/api/generate-cards', optionalAuth, async (req, res) => {
  console.log('📝 /api/generate-cards called');

  if (!anthropic) {
    console.error('❌ ANTHROPIC_API_KEY not configured');
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY is not configured. Set it as an environment variable.' });
  }

  const { sections, count, difficulty, url: pageUrl } = req.body;
  if (!sections || !Array.isArray(sections) || sections.length === 0) {
    console.error('❌ No sections provided');
    return res.status(400).json({ error: 'No content sections provided' });
  }

  console.log(`📄 Generating ${count} cards at ${difficulty} difficulty from ${sections.length} sections`);

  // Fetch previously asked questions for this URL to avoid repeats
  let pastQuestions = [];
  let learningProfile = null;
  if (pageUrl && process.env.DATABASE_URL && req.userId) {
    try {
      pastQuestions = await db.getPastQuestions(pageUrl, req.userId);
      learningProfile = await db.getLearningProfile(req.userId);
      console.log(`📋 Found ${pastQuestions.length} past questions, profile: ${learningProfile?.recommended_difficulty || 'none'}`);
    } catch (err) {
      console.warn('Could not fetch past questions/profile:', err.message);
    }
  }

  // Adaptive difficulty hint
  let adaptiveHint = '';
  if (learningProfile && learningProfile.total_answers >= 10) {
    adaptiveHint = `\nADAPTIVE HINT: This user has ${learningProfile.total_answers} answers. Their accuracy: beginner=${learningProfile.beginner_acc}%, intermediate=${learningProfile.intermediate_acc}%, advanced=${learningProfile.advanced_acc}%. Recommended difficulty: ${learningProfile.recommended_difficulty}. Adjust question complexity accordingly — make questions slightly harder if they're acing the current level, or slightly easier if they're struggling.\n`;
  }

  // Build a condensed version of the page content for the prompt
  const contentText = sections
    .map(s => `## ${s.heading}\n${s.content.join('\n')}`)
    .join('\n\n')
    .substring(0, 12000);

  // Build the avoidance instruction
  let avoidInstruction = '';
  if (pastQuestions.length > 0) {
    const questionList = pastQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n');
    avoidInstruction = `
IMPORTANT — AVOID REPEATING THESE PREVIOUSLY ASKED QUESTIONS (or questions that test the same concept in a different way):
${questionList}

Generate NEW questions that test DIFFERENT concepts or facts from the content. Only if you have completely exhausted all possible unique questions from the content should you revisit previously asked topics.
`;
  }

  const prompt = `You are an expert educator creating flash cards from Microsoft documentation.

Given the following documentation content, generate exactly ${count || 10} flash cards at a "${difficulty || 'intermediate'}" difficulty level.

QUESTION TYPE MIX — use a variety of these types:
- "multiple_choice": 4 choices (A-D), 1 correct. Use for ~40% of cards.
- "true_false": A statement that is either true or false based on the content. Use for ~20% of cards.
- "fill_blank": A sentence with a key term blanked out (shown as ___). Provide 4 choices. Use for ~20% of cards.
- "scenario": A realistic workplace scenario where the user must apply knowledge. 4 choices. Use for ~20% of cards.

RULES:
- Every question and answer MUST be directly based on facts stated in the content below. Do NOT invent or assume information.
- Questions should test understanding of key concepts, not trivial details.
- Wrong answers should be plausible but clearly incorrect based on the content.
- Explanations should reference the specific content that supports the correct answer.
${avoidInstruction}
${adaptiveHint}
DOCUMENTATION CONTENT:
${contentText}

Respond with ONLY a JSON array (no markdown, no code fences). Each card MUST have a "type" field:

For multiple_choice:
{"type":"multiple_choice","question":"...","choices":["A","B","C","D"],"correctAnswer":"A","explanation":"..."}

For true_false:
{"type":"true_false","statement":"A factual statement...","isTrue":true,"explanation":"..."}

For fill_blank:
{"type":"fill_blank","sentence":"___ is used to manage...","choices":["correct","wrong1","wrong2","wrong3"],"correctAnswer":"correct","explanation":"..."}

For scenario:
{"type":"scenario","scenario":"You are an IT admin at Contoso. A user reports...","question":"What should you do first?","choices":["Action A","Action B","Action C","Action D"],"correctAnswer":"A","explanation":"..."}
`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0].text.trim();

    // Parse the JSON response — handle possible markdown fences
    let cards;
    try {
      const jsonStr = text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
      cards = JSON.parse(jsonStr);
    } catch {
      console.error('Failed to parse Claude response:', text.substring(0, 200));
      return res.status(502).json({ error: 'AI returned invalid response format' });
    }

    // Validate structure
    if (!Array.isArray(cards) || cards.length === 0) {
      return res.status(502).json({ error: 'AI returned empty or invalid cards' });
    }

    const validCards = cards.filter(c => {
      if (!c.type || !c.explanation) return false;
      if (c.type === 'multiple_choice') return c.question && Array.isArray(c.choices) && c.choices.length === 4 && c.correctAnswer;
      if (c.type === 'true_false') return c.statement && typeof c.isTrue === 'boolean';
      if (c.type === 'fill_blank') return c.sentence && Array.isArray(c.choices) && c.correctAnswer;
      if (c.type === 'scenario') return c.scenario && c.question && Array.isArray(c.choices) && c.choices.length === 4 && c.correctAnswer;
      return false;
    });

    console.log(`✅ Generated ${validCards.length} valid cards`);
    res.json({ cards: validCards });
  } catch (err) {
    console.error('Claude API error:', err.message);
    res.status(502).json({ error: 'Failed to generate cards with AI: ' + err.message });
  }
});

// Save a score
app.post('/api/scores', authMiddleware, async (req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: 'Database not configured' });
  }
  try {
    const { url, pageTitle, correct, total, scorePct, difficulty } = req.body;
    const score = await db.saveScore({ userId: req.userId, url, pageTitle, correct, total, scorePct, difficulty });

    // Gamification: update streak and check badges
    try {
      const streakResult = await db.updateStreak(req.userId);
      const newBadges = await db.checkAndAwardBadges(req.userId);
      score.streak = streakResult;
      score.newBadges = newBadges.map(k => db.BADGES[k]).filter(Boolean);
    } catch (e) { console.warn('Gamification error:', e.message); }

    res.json(score);
  } catch (err) {
    console.error('Save score error:', err.message);
    res.status(500).json({ error: 'Failed to save score' });
  }
});

// Get score history (user's own)
app.get('/api/scores', authMiddleware, async (req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: 'Database not configured' });
  }
  try {
    const scores = await db.getScores({ userId: req.userId, limit: parseInt(req.query.limit) || 50 });
    res.json(scores);
  } catch (err) {
    console.error('Get scores error:', err.message);
    res.status(500).json({ error: 'Failed to fetch scores' });
  }
});

// ── Certification tracker progress (user's own) ─────────
app.get('/api/cert-progress', authMiddleware, async (req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: 'Database not configured' });
  }
  try {
    const { data, rev } = await db.getCertProgress(req.userId);
    res.json({ data: data || {}, rev });
  } catch (err) {
    console.error('Get cert progress error:', err.message);
    res.status(500).json({ error: 'Failed to fetch cert progress' });
  }
});

app.put('/api/cert-progress', authMiddleware, async (req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: 'Database not configured' });
  }
  try {
    const raw = (req.body && typeof req.body.data === 'object' && req.body.data) || {};
    // Sanitize entries, bounded to avoid abuse. Accepts the status-object shape
    // { st: 'earned'|'target'|'await', date?, since? } and the legacy
    // date-string shape ("YYYY-MM-DD" => earned), normalizing to the object form.
    const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
    const clean = {};
    let count = 0;
    for (const [code, val] of Object.entries(raw)) {
      if (count >= 300) break;
      if (typeof code !== 'string' || code.length > 120) continue;
      let entry = null;
      if (typeof val === 'string' && DATE_RE.test(val)) {
        entry = { st: 'earned', date: val };
      } else if (val && typeof val === 'object') {
        if (val.st === 'target' || val.st === 'await') {
          entry = { st: val.st };
          if (typeof val.since === 'string' && DATE_RE.test(val.since)) entry.since = val.since;
        } else if (val.st === 'earned' && typeof val.date === 'string' && DATE_RE.test(val.date)) {
          entry = { st: 'earned', date: val.date };
        }
      }
      if (!entry) continue;
      clean[code] = entry;
      count++;
    }
    // Optimistic concurrency: a client that has pulled sends the rev it based
    // this write on. If the row moved since, reject with the current server
    // state so the client can merge and retry instead of clobbering it.
    const baseRev = typeof req.body.baseRev === 'string' ? req.body.baseRev : null;
    if (baseRev !== null) {
      const current = await db.getCertProgress(req.userId);
      if (current.rev && current.rev !== baseRev) {
        return res.status(409).json({ error: 'Progress changed elsewhere', data: current.data, rev: current.rev });
      }
    }
    const saved = await db.saveCertProgress(req.userId, clean);
    res.json({ ok: true, data: clean, rev: saved.rev });
  } catch (err) {
    console.error('Save cert progress error:', err.message);
    res.status(500).json({ error: 'Failed to save cert progress' });
  }
});

// Get aggregate stats (user's own)
app.get('/api/stats', authMiddleware, async (req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: 'Database not configured' });
  }
  try {
    const stats = await db.getStats(req.userId);
    res.json(stats);
  } catch (err) {
    console.error('Get stats error:', err.message);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Log an individual question answer
app.post('/api/question-log', authMiddleware, async (req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: 'Database not configured' });
  }
  try {
    const { url, pageTitle, question, correctAnswer, userAnswer, isCorrect, difficulty, choices, explanation } = req.body;
    const log = await db.saveQuestionLog({ userId: req.userId, url, pageTitle, question, correctAnswer, userAnswer, isCorrect, difficulty });

    // Also save to spaced repetition deck
    try {
      await db.upsertCardReview({ userId: req.userId, url, pageTitle, question, correctAnswer, choices, explanation, difficulty });
    } catch (e) { console.warn('Could not upsert review card:', e.message); }

    res.json(log);
  } catch (err) {
    console.error('Save question log error:', err.message);
    res.status(500).json({ error: 'Failed to save question log' });
  }
});

// Get recent unique topics for quick-access (user's own)
app.get('/api/recent-topics', authMiddleware, async (req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: 'Database not configured' });
  }
  try {
    const topics = await db.getRecentTopics(req.userId);
    res.json(topics);
  } catch (err) {
    console.error('Get recent topics error:', err.message);
    res.status(500).json({ error: 'Failed to fetch recent topics' });
  }
});

// Get per-topic stats (user's own)
app.get('/api/topic-stats', authMiddleware, async (req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: 'Database not configured' });
  }
  try {
    const topics = await db.getTopicStats(req.userId);
    res.json(topics);
  } catch (err) {
    console.error('Get topic stats error:', err.message);
    res.status(500).json({ error: 'Failed to fetch topic stats' });
  }
});

// ── Spaced Repetition endpoints ─────────────────────────
// Get cards due for review
app.get('/api/reviews/due', authMiddleware, async (req, res) => {
  try {
    const cards = await db.getCardsForReview(req.userId, parseInt(req.query.limit) || 10);
    res.json(cards);
  } catch (err) {
    console.error('Get reviews error:', err.message);
    res.status(500).json({ error: 'Failed to fetch review cards' });
  }
});

// Get review stats
app.get('/api/reviews/stats', authMiddleware, async (req, res) => {
  try {
    const stats = await db.getReviewStats(req.userId);
    res.json(stats);
  } catch (err) {
    console.error('Get review stats error:', err.message);
    res.status(500).json({ error: 'Failed to fetch review stats' });
  }
});

// Submit a review result
app.post('/api/reviews/result', authMiddleware, async (req, res) => {
  try {
    const { cardId, quality } = req.body;
    const updated = await db.updateReviewResult(cardId, quality);
    if (!updated) return res.status(404).json({ error: 'Card not found' });
    res.json(updated);
  } catch (err) {
    console.error('Update review error:', err.message);
    res.status(500).json({ error: 'Failed to update review' });
  }
});

// ── Daily Challenges ─────────────────────────────────────
app.get('/api/daily-challenge', async (req, res) => {
  const themes = [
    { theme: 'Azure Security', topic: 'security', urls: ['https://learn.microsoft.com/en-us/training/modules/describe-azure-identity-access-security/'] },
    { theme: 'Cloud Fundamentals', topic: 'cloud', urls: ['https://learn.microsoft.com/en-us/training/modules/describe-cloud-compute/'] },
    { theme: 'AI & Machine Learning', topic: 'ai', urls: ['https://learn.microsoft.com/en-us/training/modules/get-started-ai-fundamentals/'] },
    { theme: 'Microsoft 365', topic: 'm365', urls: ['https://learn.microsoft.com/en-us/training/modules/describe-productivity-solutions-microsoft-365/'] },
    { theme: 'Azure Networking', topic: 'networking', urls: ['https://learn.microsoft.com/en-us/training/modules/describe-azure-compute-networking-services/'] },
    { theme: 'Data & Storage', topic: 'storage', urls: ['https://learn.microsoft.com/en-us/training/modules/describe-azure-storage-services/'] },
    { theme: 'Compliance & Governance', topic: 'compliance', urls: ['https://learn.microsoft.com/en-us/training/modules/describe-compliance-management-capabilities-microsoft/'] },
  ];
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const challenge = themes[dayOfYear % themes.length];
  res.json({ ...challenge, bonusXp: 25, date: new Date().toISOString().split('T')[0] });
});

// ── Study Goals ─────────────────────────────────────────
app.post('/api/goals', authMiddleware, async (req, res) => {
  try {
    const { weeklyTarget, monthlyTarget } = req.body;
    const d = db.getSql ? require('./db') : db;
    const sql = d.getSql ? d.getSql() : null;
    if (!sql) return res.status(503).json({ error: 'DB not configured' });
    await sql`CREATE TABLE IF NOT EXISTS study_goals (user_id INTEGER PRIMARY KEY REFERENCES users(id), weekly_target INTEGER DEFAULT 5, monthly_target INTEGER DEFAULT 20)`;
    await sql`INSERT INTO study_goals (user_id, weekly_target, monthly_target) VALUES (${req.userId}, ${weeklyTarget || 5}, ${monthlyTarget || 20}) ON CONFLICT (user_id) DO UPDATE SET weekly_target = ${weeklyTarget || 5}, monthly_target = ${monthlyTarget || 20}`;
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Failed to save goals' }); }
});

app.get('/api/goals', authMiddleware, async (req, res) => {
  try {
    const sql = require('./db');
    const dbConn = sql.getSql ? sql.getSql() : null;
    if (!dbConn) return res.json({ weekly_target: 5, monthly_target: 20, weekly_progress: 0, monthly_progress: 0 });
    await dbConn`CREATE TABLE IF NOT EXISTS study_goals (user_id INTEGER PRIMARY KEY REFERENCES users(id), weekly_target INTEGER DEFAULT 5, monthly_target INTEGER DEFAULT 20)`;
    const [goal] = await dbConn`SELECT * FROM study_goals WHERE user_id = ${req.userId}`;
    const [weeklyProgress] = await dbConn`SELECT COUNT(*) as c FROM scores WHERE user_id = ${req.userId} AND created_at > NOW() - INTERVAL '7 days'`;
    const [monthlyProgress] = await dbConn`SELECT COUNT(*) as c FROM scores WHERE user_id = ${req.userId} AND created_at > NOW() - INTERVAL '30 days'`;
    res.json({
      weekly_target: goal?.weekly_target || 5,
      monthly_target: goal?.monthly_target || 20,
      weekly_progress: Number(weeklyProgress.c),
      monthly_progress: Number(monthlyProgress.c),
    });
  } catch (err) { res.json({ weekly_target: 5, monthly_target: 20, weekly_progress: 0, monthly_progress: 0 }); }
});

// ── Leaderboard with Tiers ──────────────────────────────
app.get('/api/leaderboard', cached('leaderboard', 300000, async () => {
  const board = await db.getLeaderboard(50);
  return board.map(u => {
    const xp = Number(u.total_xp || 0);
    let tier = 'Bronze';
    if (xp >= 1000) tier = 'Platinum';
    else if (xp >= 500) tier = 'Gold';
    else if (xp >= 200) tier = 'Silver';
    return { ...u, tier };
  });
}));

// ── Cognitive Load Detection ────────────────────────────
app.get('/api/cognitive-load', authMiddleware, async (req, res) => {
  try {
    const sql = require('./db').getSql ? require('./db').getSql() : null;
    if (!sql) return res.json([]);
    const data = await sql`
      SELECT event_data->>'hesitationMs' as hesitation, event_data->>'isCorrect' as correct
      FROM telemetry WHERE user_id = ${req.userId} AND event_type = 'answer_submitted'
      ORDER BY created_at DESC LIMIT 100
    `;
    const avg = data.reduce((s, d) => s + Number(d.hesitation || 0), 0) / (data.length || 1);
    const confusing = data.filter(d => Number(d.hesitation) > 15000).length;
    res.json({ avgHesitationMs: Math.round(avg), confusingQuestions: confusing, totalTracked: data.length });
  } catch { res.json({ avgHesitationMs: 0, confusingQuestions: 0, totalTracked: 0 }); }
});

// ── Distractor Plausibility ─────────────────────────────
app.get('/api/distractor-stats', cached('distractors', 600000, async () => {
  const sql = require('./db').getSql ? require('./db').getSql() : null;
  if (!sql) return [];
  return await sql`
    SELECT user_answer, COUNT(*) as times_selected
    FROM question_logs WHERE is_correct = false
    GROUP BY user_answer ORDER BY times_selected DESC LIMIT 20
  `;
}));

// ── Knowledge Decay Modeling ────────────────────────────
app.get('/api/knowledge-decay', authMiddleware, async (req, res) => {
  try {
    const sql = require('./db').getSql ? require('./db').getSql() : null;
    if (!sql) return res.json([]);
    const decay = await sql`
      SELECT page_title,
        MAX(created_at) as last_studied,
        EXTRACT(DAY FROM NOW() - MAX(created_at)) as days_since,
        ROUND(100.0 * SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) / COUNT(*)) as accuracy,
        GREATEST(0, ROUND(100.0 * SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) / COUNT(*) - EXTRACT(DAY FROM NOW() - MAX(created_at)) * 2)) as estimated_retention
      FROM question_logs WHERE user_id = ${req.userId} AND page_title IS NOT NULL
      GROUP BY page_title ORDER BY estimated_retention ASC
    `;
    res.json(decay);
  } catch { res.json([]); }
});

// ── Documentation Gap Detection ─────────────────────────
app.get('/api/doc-gaps', cached('doc-gaps', 600000, async () => {
  const sql = require('./db').getSql ? require('./db').getSql() : null;
  if (!sql) return [];
  return await sql`
    SELECT page_title, url,
      COUNT(*) as total_answers,
      ROUND(100.0 * SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) / COUNT(*)) as accuracy
    FROM question_logs WHERE page_title IS NOT NULL
    GROUP BY page_title, url HAVING COUNT(*) >= 10 AND
      ROUND(100.0 * SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) / COUNT(*)) < 40
    ORDER BY accuracy ASC
  `;
}));

// ── Teach-Back Mode ──────────────────────────────────────
app.post('/api/teach-back', authMiddleware, async (req, res) => {
  if (!anthropic) return res.status(503).json({ error: 'AI not configured' });
  const { topic, userExplanation } = req.body;
  if (!topic || !userExplanation) return res.status(400).json({ error: 'Topic and explanation required' });

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      messages: [{ role: 'user', content: `A student is trying to explain "${topic}" in their own words. Evaluate their understanding.

Student's explanation: "${userExplanation}"

Respond with ONLY JSON: {"score": 0-100, "feedback": "2-3 sentences of specific feedback", "misconceptions": ["list any misconceptions"], "strengths": ["list what they got right"]}` }],
    });
    const text = message.content[0].text.trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    res.json(JSON.parse(text));
  } catch (err) {
    res.status(500).json({ error: 'Failed to evaluate explanation' });
  }
});

// ── Batch URL / Cross-Document Generation ───────────────
app.post('/api/generate-cards-batch', optionalAuth, async (req, res) => {
  if (!anthropic) return res.status(503).json({ error: 'AI not configured' });
  const { urls, count, difficulty } = req.body;
  if (!urls || !Array.isArray(urls) || urls.length < 2) return res.status(400).json({ error: 'Provide at least 2 URLs' });

  try {
    // Fetch and parse all URLs
    const allSections = [];
    for (const url of urls.slice(0, 5)) {
      try {
        const fetchPage = require('./server-utils').fetchPage || (() => Promise.reject());
        // Use the proxy internally — simplified inline fetch
        const mod = require('https');
        const html = await new Promise((resolve, reject) => {
          const u = new URL(url);
          mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, resp => {
            if ([301,302,303,307,308].includes(resp.statusCode) && resp.headers.location) {
              const next = new URL(resp.headers.location, url).href;
              mod.get(next, { headers: { 'User-Agent': 'Mozilla/5.0' } }, r2 => {
                let d=''; r2.on('data',c=>d+=c); r2.on('end',()=>resolve(d));
              }).on('error', reject);
              return;
            }
            let d=''; resp.on('data',c=>d+=c); resp.on('end',()=>resolve(d));
          }).on('error', reject);
        });
        // Basic section extraction
        const titleMatch = html.match(/<h1[^>]*>(.*?)<\/h1>/s);
        const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : url;
        allSections.push({ heading: title, content: [html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').substring(0, 3000)] });
      } catch {}
    }

    if (allSections.length < 2) return res.status(400).json({ error: 'Could not fetch enough pages' });

    const contentText = allSections.map(s => `## ${s.heading}\n${s.content.join('\n')}`).join('\n\n').substring(0, 15000);

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{ role: 'user', content: `Generate ${count || 5} cross-document synthesis questions that require understanding concepts from MULTIPLE documents below. Questions should test how concepts from different pages relate to each other.

${contentText}

Respond with ONLY a JSON array. Each card: {"type":"multiple_choice","question":"...","choices":["A","B","C","D"],"correctAnswer":"A","explanation":"..."}` }],
    });

    const text = message.content[0].text.trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    const cards = JSON.parse(text);
    res.json({ cards: cards.filter(c => c.question && c.choices) });
  } catch (err) {
    console.error('Batch generation error:', err.message);
    res.status(500).json({ error: 'Failed to generate cross-document cards' });
  }
});

// ── Difficulty Calibration (global) ──────────────────────
app.get('/api/difficulty-calibration', async (req, res) => {
  try {
    const data = await db.getDifficultyCalibration();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// ── Learning Outcome Validation ──────────────────────────
app.get('/api/retention', authMiddleware, async (req, res) => {
  try {
    const data = await db.getRetentionData(req.userId);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch retention data' });
  }
});

// ── Adaptive Learning Profile ────────────────────────────
app.get('/api/learning-profile', authMiddleware, async (req, res) => {
  try {
    const profile = await db.getLearningProfile(req.userId);
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch learning profile' });
  }
});

// ── Certification Study Guide Extraction ─────────────────
app.get('/api/cert-study-guide', async (req, res) => {
  const certUrl = req.query.url;
  if (!certUrl) return res.status(400).json({ error: 'URL required' });

  try {
    // Fetch the certification page
    const https = require('https');
    const fetchPage = (url, redirects = 5) => new Promise((resolve, reject) => {
      if (redirects <= 0) return reject(new Error('Too many redirects'));
      const u = new URL(url);
      const mod = u.protocol === 'https:' ? require('https') : require('http');
      mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, resp => {
        if ([301,302,303,307,308].includes(resp.statusCode) && resp.headers.location) {
          return resolve(fetchPage(new URL(resp.headers.location, url).href, redirects - 1));
        }
        let d = ''; resp.on('data', c => d += c); resp.on('end', () => resolve(d));
      }).on('error', reject);
    });

    const html = await fetchPage(certUrl);

    // Collect training module links from the cert page
    const allLinks = html.match(/href="(https:\/\/learn\.microsoft\.com\/[^"]*\/training\/[^"]*?)"/g) || [];
    const trainingUrls = [...new Set(allLinks.map(l => l.match(/href="([^"]+)"/)?.[1]).filter(Boolean))];

    // Derive the study guide URL from the exam code on the cert page
    // Cert pages contain examUid=exam.AZ-900 or similar data attributes
    let studyGuideUrl = null;
    const examUidMatch = html.match(/examUid=exam\.([A-Za-z]{2,3}-\d{3,4})/i)
      || html.match(/data-exam-pricing-type="([A-Za-z]{2,3}-\d{3,4})"/i)
      || html.match(/Exam\s+([A-Z]{2,3}-\d{3,4})/);
    if (examUidMatch) {
      const examCode = examUidMatch[1].toLowerCase();
      studyGuideUrl = `https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/${examCode}`;
    }

    // Also check for an explicit study guide href (fallback)
    if (!studyGuideUrl) {
      const sgHrefMatch = html.match(/href="([^"]*study-guide[^"]*)"/i);
      if (sgHrefMatch) {
        studyGuideUrl = sgHrefMatch[1];
        if (!studyGuideUrl.startsWith('http')) studyGuideUrl = new URL(studyGuideUrl, certUrl).href;
      }
    }

    let detailedSkills = [];

    // Fetch the study guide page for detailed skills
    if (studyGuideUrl) {
      try {
        const sgHtml = await fetchPage(studyGuideUrl);

        // Extract everything between "Skills at a glance" and "Study resources" (or next major h2)
        const skillsGlanceMatch = sgHtml.match(/Skills at a glance[\s\S]*?(?=<h2[^>]*>\s*(?:Study resources|Change log|Additional resources)|$)/i);
        if (skillsGlanceMatch) {
          const skillsBlock = skillsGlanceMatch[0];
          const liMatches = skillsBlock.match(/<li[\s\S]*?<\/li>/gi) || [];
          detailedSkills = liMatches
            .map(li => li.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
            .filter(s => s.length > 5 && s.length < 250);
        }

        // Fallback: extract between "Skills measured" and "Study resources"
        if (detailedSkills.length === 0) {
          const measuredMatch = sgHtml.match(/Skills measured[\s\S]*?(?=<h2[^>]*>\s*(?:Study resources|Change log|Additional)|$)/i);
          if (measuredMatch) {
            const liMatches = measuredMatch[0].match(/<li[\s\S]*?<\/li>/gi) || [];
            detailedSkills = liMatches
              .map(li => li.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
              .filter(s => s.length > 5 && s.length < 250);
          }
        }

        // Last fallback: h3/h4 headings from study guide
        if (detailedSkills.length === 0) {
          const sgHeadings = sgHtml.match(/<h[34][^>]*>[\s\S]*?<\/h[34]>/g) || [];
          detailedSkills = sgHeadings
            .map(h => h.replace(/<[^>]+>/g, '').trim())
            .filter(s => s.length > 5 && s.length < 150 && !s.match(/^(Note|Important|Warning|Tip|Prerequisites|In this article|Study guide|Share via|Purpose)/i));
        }

        // Collect training links from study guide too
        const sgLinks = sgHtml.match(/href="(https:\/\/learn\.microsoft\.com\/[^"]*\/training\/[^"]*?)"/g) || [];
        sgLinks.forEach(l => {
          const url = l.match(/href="([^"]+)"/)?.[1];
          if (url && !trainingUrls.includes(url)) trainingUrls.push(url);
        });
      } catch (sgErr) {
        console.warn('Study guide fetch failed:', sgErr.message);
      }
    }

    // For applied skills (no study guide), try extracting from the cert page directly
    if (detailedSkills.length === 0) {
      const mainSkillsMatch = html.match(/Skills at a glance[\s\S]*?(?=<h2|<footer|$)/i)
        || html.match(/Skills measured[\s\S]*?(?=<h2|<footer|$)/i);
      if (mainSkillsMatch) {
        const liMatches = mainSkillsMatch[0].match(/<li[\s\S]*?<\/li>/gi) || [];
        detailedSkills = liMatches
          .map(li => li.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
          .filter(s => s.length > 5 && s.length < 250);
      }
    }

    // Final fallback: grab any h3/h4 headings from the cert page itself
    if (detailedSkills.length === 0) {
      const h34 = html.match(/<h[34][^>]*>[\s\S]*?<\/h[34]>/g) || [];
      detailedSkills = h34
        .map(h => h.replace(/<[^>]+>/g, '').trim())
        .filter(s => s.length > 5 && s.length < 100 && !s.match(/^(Note|Important|Warning|Tip|Prerequisites|Skills earned)/i))
        .slice(0, 20);
    }

    res.json({
      skills: detailedSkills,
      trainingUrls: trainingUrls.slice(0, 15),
      studyGuideUrl,
      totalTrainingModules: trainingUrls.length,
    });
  } catch (err) {
    console.error('Study guide extraction error:', err.message);
    res.status(500).json({ error: 'Failed to extract study guide' });
  }
});

// ── Curated Learning Paths (dynamic from Microsoft Catalog API) ──
app.get('/api/learning-paths', cached('learning-paths', 3600000, async () => {
  // Fetch from Microsoft Learn Catalog API
  const https = require('https');
  // Fetch full catalog (includes certifications, appliedSkills, learningPaths)
  const data = await new Promise((resolve, reject) => {
    https.get('https://learn.microsoft.com/api/catalog/', { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
    }).on('error', () => resolve({}));
  });

  const mapItem = (c, credType) => {
    const title = (c.title || '').toLowerCase();
    const roles = Array.isArray(c.roles) ? c.roles.join(' ').toLowerCase() : String(c.roles || '').toLowerCase();
    let area = 'General';
    if (title.includes('azure') || title.includes('az-')) area = 'Azure';
    else if (title.includes('dynamics') || title.includes('d365') || title.includes('mb-')) area = 'Dynamics 365';
    else if (title.includes('365') || title.includes('m365') || title.includes('ms-')) area = 'Microsoft 365';
    else if (title.includes('power') || title.includes('pl-')) area = 'Power Platform';
    else if (title.includes('security') || title.includes('sc-')) area = 'Security';
    else if (title.includes('github')) area = 'GitHub';
    else if (title.includes('fabric') || title.includes('data') || title.includes('dp-')) area = 'Data & AI';
    else if (roles.includes('ai') || title.includes('ai')) area = 'Data & AI';

    return {
      id: c.uid,
      name: c.title,
      url: (c.url || '').replace('?WT.mc_id=api_CatalogApi', ''),
      level: String(c.levels || 'intermediate'),
      type: credType,
      certType: c.certification_type || credType,
      roles: Array.isArray(c.roles) ? c.roles : String(c.roles || '').split(/\s+/).filter(Boolean),
      area,
      icon: c.icon_url || '',
    };
  };

  const filterRetired = (c) => {
    const sub = String(c.subtitle || '').toLowerCase();
    return !sub.includes('retired') && !sub.includes('no longer available') && !sub.includes('has been retired');
  };

  const certs = (data.certifications || []).filter(filterRetired).map(c => mapItem(c, 'certification'));
  const skills = (data.appliedSkills || []).filter(filterRetired).map(c => mapItem(c, 'applied-skill'));
  const all = [...certs, ...skills].sort((a, b) => a.name.localeCompare(b.name));

  const areas = [...new Set(all.map(c => c.area))].sort();
  const levels = [...new Set(all.map(c => c.level))].sort();
  const types = [...new Set(all.map(c => c.type))].sort();

  return { certifications: all, areas, levels, types, total: all.length };
}));

// ── Socratic Mode (conversational AI coaching) ──────────
app.post('/api/socratic', authMiddleware, async (req, res) => {
  if (!anthropic) return res.status(503).json({ error: 'AI not configured' });
  try {
    const { topic, userMessage, history } = req.body;
    if (!topic || !userMessage) return res.status(400).json({ error: 'Topic and message required' });

    const conversationHistory = (history || []).map(h => ({
      role: h.role, content: h.content,
    }));

    conversationHistory.push({ role: 'user', content: userMessage });

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: `You are a Socratic tutor helping a student learn about "${topic}" from Microsoft documentation. 

RULES:
- Ask probing questions rather than giving direct answers
- When the student explains something correctly, acknowledge it and go deeper
- When they're wrong, guide them with hints rather than correcting directly
- Keep responses concise (2-4 sentences)
- Use encouraging language
- After 3-4 exchanges, summarize what they've demonstrated understanding of
- If they say "I don't know", give a small hint and rephrase the question`,
      messages: conversationHistory,
    });

    res.json({ reply: message.content[0].text.trim() });
  } catch (err) {
    console.error('Socratic error:', err.message);
    res.status(500).json({ error: 'Failed to generate response' });
  }
});

// ── Certification Goals ──────────────────────────────────
const CERT_CATALOG = [
  { id: 'az-900', name: 'Azure Fundamentals (AZ-900)', topics: ['cloud concepts', 'azure services', 'security', 'pricing', 'SLA'] },
  { id: 'az-104', name: 'Azure Administrator (AZ-104)', topics: ['virtual machines', 'networking', 'storage', 'identity', 'governance', 'monitoring'] },
  { id: 'az-204', name: 'Azure Developer (AZ-204)', topics: ['app service', 'functions', 'cosmos db', 'blob storage', 'authentication', 'API management'] },
  { id: 'az-305', name: 'Azure Solutions Architect (AZ-305)', topics: ['governance', 'compute', 'networking', 'storage', 'data', 'authentication', 'monitoring'] },
  { id: 'ai-900', name: 'Azure AI Fundamentals (AI-900)', topics: ['AI workloads', 'machine learning', 'computer vision', 'NLP', 'generative AI'] },
  { id: 'ai-102', name: 'Azure AI Engineer (AI-102)', topics: ['cognitive services', 'knowledge mining', 'NLP', 'conversational AI', 'computer vision'] },
  { id: 'dp-900', name: 'Azure Data Fundamentals (DP-900)', topics: ['data concepts', 'relational data', 'non-relational data', 'analytics'] },
  { id: 'sc-900', name: 'Security Fundamentals (SC-900)', topics: ['security concepts', 'identity', 'Microsoft security', 'compliance'] },
  { id: 'ms-900', name: 'Microsoft 365 Fundamentals (MS-900)', topics: ['Microsoft 365', 'collaboration', 'security', 'licensing'] },
  { id: 'pl-900', name: 'Power Platform Fundamentals (PL-900)', topics: ['Power Apps', 'Power Automate', 'Power BI', 'Power Virtual Agents'] },
];

app.get('/api/cert-catalog', (req, res) => res.json(CERT_CATALOG));

app.post('/api/cert-goal', authMiddleware, async (req, res) => {
  const { certId } = req.body;
  const cert = CERT_CATALOG.find(c => c.id === certId);
  if (!cert) return res.status(400).json({ error: 'Invalid certification' });
  try {
    await db.setCertGoal(req.userId, certId, cert.name);
    res.json({ ok: true, cert });
  } catch (err) { res.status(500).json({ error: 'Failed to set goal' }); }
});

app.get('/api/cert-goal', authMiddleware, async (req, res) => {
  try {
    const goal = await db.getCertGoal(req.userId);
    if (goal) {
      const cert = CERT_CATALOG.find(c => c.id === goal.cert_id);
      res.json({ ...goal, topics: cert?.topics || [] });
    } else {
      res.json(null);
    }
  } catch { res.json(null); }
});

// ── Certification Readiness (AI-powered, goal-aware) ────
app.get('/api/certification-readiness', authMiddleware, async (req, res) => {
  if (!anthropic) return res.status(503).json({ error: 'AI not configured' });
  try {
    const data = await db.getCertificationReadiness(req.userId);
    const goal = await db.getCertGoal(req.userId);
    const targetCert = goal ? CERT_CATALOG.find(c => c.id === goal.cert_id) : null;

    if (!data.topics.length) {
      return res.json({
        score: 0,
        targetCert: targetCert?.name || null,
        assessment: goal
          ? `You're targeting ${targetCert?.name}. Study more topics to get a readiness assessment.`
          : 'Set a certification goal in your profile to get a targeted readiness assessment.',
        data
      });
    }

    const topicList = data.topics.map(t => `${t.page_title}: ${t.accuracy}% (${t.correct}/${t.total_questions} questions)`).join('\n');
    const certContext = targetCert
      ? `The student is specifically targeting: ${targetCert.name}. Key topics for this cert: ${targetCert.topics.join(', ')}. Evaluate readiness specifically for this certification.`
      : 'Identify which Microsoft certification they are closest to being ready for.';

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      messages: [{ role: 'user', content: `Based on this student's Microsoft Learn study performance, estimate their certification readiness on a 0-100 scale.

${certContext}

Overall: ${data.overall.accuracy}% accuracy across ${data.overall.topics_covered} topics, ${data.overall.total} questions answered.

Topic breakdown:
${topicList}

Respond with ONLY JSON (no markdown): {"score": 0-100, "nearestCert": "certification name", "assessment": "2-3 sentence assessment", "gaps": ["topic gaps to study"]}` }],
    });

    const text = message.content[0].text.trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    const result = JSON.parse(text);
    res.json({ ...result, targetCert: targetCert?.name || result.nearestCert, data });
  } catch (err) {
    console.error('Cert readiness error:', err.message);
    res.status(500).json({ error: 'Failed to generate readiness score' });
  }
});

// ── Personalized Weakness Report (AI-powered) ───────────
app.get('/api/weakness-report', authMiddleware, async (req, res) => {
  if (!anthropic) return res.status(503).json({ error: 'AI not configured' });
  try {
    const data = await db.getWeaknessData(req.userId);
    if (!data.wrongAnswers.length && !data.topicAccuracy.length) {
      return res.json({ report: 'Not enough data yet. Complete a few study sessions to get personalized recommendations.' });
    }

    const wrongSummary = data.wrongAnswers.slice(0, 20).map(w =>
      `Topic: ${w.page_title} | Q: ${w.question} | Correct: ${w.correct_answer} | User answered: ${w.user_answer}`
    ).join('\n');

    const topicSummary = data.topicAccuracy.map(t =>
      `${t.page_title}: ${t.accuracy}% accuracy (${t.correct}/${t.total})`
    ).join('\n');

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: `You are a study coach analyzing a student's flash card performance. Based on their wrong answers and topic accuracy, write a brief, encouraging, actionable study report (3-5 paragraphs). Be specific about what concepts they should review.

WRONG ANSWERS (recent):
${wrongSummary}

TOPIC ACCURACY (weakest topics):
${topicSummary}

Write the report in second person ("You should..."). Be warm but direct. Focus on patterns, not individual questions.` }],
    });

    res.json({ report: message.content[0].text.trim(), data });
  } catch (err) {
    console.error('Weakness report error:', err.message);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// ── Telemetry ────────────────────────────────────────────
app.post('/api/telemetry', optionalAuth, async (req, res) => {
  try {
    const { eventType, eventData, url } = req.body;
    if (!eventType) return res.status(400).json({ error: 'eventType required' });
    await db.saveTelemetry({ userId: req.userId || null, eventType, eventData, url });
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ── Question Feedback ────────────────────────────────────
app.post('/api/question-feedback', optionalAuth, async (req, res) => {
  try {
    const { question, url, feedbackType } = req.body;
    if (!question || !feedbackType) return res.status(400).json({ error: 'Missing fields' });
    const fb = await db.saveQuestionFeedback({ userId: req.userId || null, question, url, feedbackType });
    res.json(fb);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save feedback' });
  }
});

// ── Documentation Search ─────────────────────────────────
app.get('/api/search-docs', async (req, res) => {
  const query = req.query.q;
  if (!query || query.length < 2) return res.status(400).json({ error: 'Query too short' });

  try {
    const searchUrl = `https://learn.microsoft.com/api/search?search=${encodeURIComponent(query)}&locale=en-us&$top=10`;
    const mod = require('https');
    const data = await new Promise((resolve, reject) => {
      mod.get(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, resp => {
        let d = ''; resp.on('data', c => d += c);
        resp.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({ results: [] }); } });
      }).on('error', reject);
    });

    const results = (data.results || []).map(r => ({
      title: r.title,
      url: r.url,
      description: r.description,
    }));
    res.json(results);
  } catch (err) {
    console.error('Search error:', err.message);
    res.status(500).json({ error: 'Search failed' });
  }
});

// ── Advanced Analytics ───────────────────────────────────
app.get('/api/analytics', authMiddleware, async (req, res) => {
  try {
    const data = await db.getDetailedAnalytics(req.userId);
    res.json(data);
  } catch (err) {
    console.error('Analytics error:', err.message);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// ── Export/Import ────────────────────────────────────────
app.get('/api/export/json', authMiddleware, async (req, res) => {
  try {
    const scores = await db.getScores({ userId: req.userId, limit: 1000 });
    const topics = await db.getTopicStats(req.userId);
    res.setHeader('Content-Disposition', 'attachment; filename=flashcards-export.json');
    res.json({ exportedAt: new Date().toISOString(), scores, topics });
  } catch (err) {
    res.status(500).json({ error: 'Export failed' });
  }
});

app.get('/api/export/csv', authMiddleware, async (req, res) => {
  try {
    const scores = await db.getScores({ userId: req.userId, limit: 1000 });
    const header = 'Date,Topic,URL,Correct,Total,Score%,Difficulty\n';
    const rows = scores.map(s =>
      `"${s.created_at}","${(s.page_title||'').replace(/"/g,'""')}","${s.url}",${s.correct},${s.total},${s.score_pct},"${s.difficulty}"`
    ).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=flashcards-export.csv');
    res.send(header + rows);
  } catch (err) {
    res.status(500).json({ error: 'Export failed' });
  }
});

// ── Shared Decks ────────────────────────────────────────
app.post('/api/decks/share', authMiddleware, async (req, res) => {
  try {
    const { url, pageTitle, cards, difficulty } = req.body;
    const deck = await db.shareDeck({ userId: req.userId, url, pageTitle, cards, difficulty });
    res.json(deck);
  } catch (err) {
    res.status(500).json({ error: 'Failed to share deck' });
  }
});

app.get('/api/decks/:code', async (req, res) => {
  try {
    const deck = await db.getDeckByCode(req.params.code);
    if (!deck) return res.status(404).json({ error: 'Deck not found' });
    res.json(deck);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch deck' });
  }
});

// ── Gamification endpoints ───────────────────────────────
app.get('/api/gamification/profile', authMiddleware, async (req, res) => {
  try {
    const [streak, achievements] = await Promise.all([
      db.getStreak(req.userId),
      db.getUserAchievements(req.userId),
    ]);
    res.json({ streak, achievements, badges: db.BADGES });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

app.get('/api/gamification/leaderboard', async (req, res) => {
  try {
    const board = await db.getLeaderboard(20);
    res.json(board);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Get global topic stats (all users combined)
app.get('/api/global-topic-stats', async (req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: 'Database not configured' });
  }
  try {
    const topics = await db.getGlobalTopicStats();
    res.json(topics);
  } catch (err) {
    console.error('Get global topic stats error:', err.message);
    res.status(500).json({ error: 'Failed to fetch global topic stats' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API endpoint for app info
app.get('/api/info', (req, res) => {
  res.json({
    name: 'Good Better Best',
    version: '2.0.0',
    description: 'AI-powered flash cards for Microsoft Learn documentation - powered by Claude AI',
    features: [
      'Smart content generation',
      'Customizable difficulty levels',
      'Progress tracking',
      'Mobile responsive',
      'Accessibility features',
    ],
  });
});

// Serve history page (local dev only)
if (process.env.NODE_ENV !== 'production') {
  app.get('/history.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'history.html'));
  });
}

// Catch all handler (local dev only)
if (process.env.NODE_ENV !== 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource was not found',
  });
});

// Start server (skip in test mode)
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 Microsoft Learn Flash Cards server running on port ${PORT}`);
    console.log(`📱 Local: http://localhost:${PORT}`);
    console.log(`🏥 Health check: http://localhost:${PORT}/health`);
    console.log(`📊 API info: http://localhost:${PORT}/api/info`);

    if (process.env.NODE_ENV === 'production') {
      console.log('🌐 Production mode enabled');
    }
  });
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  process.exit(0);
});

module.exports = app;