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

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'flashcards-secret-change-in-production';

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
  if (pageUrl && process.env.DATABASE_URL && req.userId) {
    try {
      pastQuestions = await db.getPastQuestions(pageUrl, req.userId);
      console.log(`📋 Found ${pastQuestions.length} previously asked questions for this URL`);
    } catch (err) {
      console.warn('Could not fetch past questions:', err.message);
    }
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

// ── Certification Readiness (AI-powered) ────────────────
app.get('/api/certification-readiness', authMiddleware, async (req, res) => {
  if (!anthropic) return res.status(503).json({ error: 'AI not configured' });
  try {
    const data = await db.getCertificationReadiness(req.userId);
    if (!data.topics.length) {
      return res.json({ score: 0, assessment: 'Not enough data yet. Study more topics to get a readiness assessment.', data });
    }

    const topicList = data.topics.map(t => `${t.page_title}: ${t.accuracy}% (${t.correct}/${t.total_questions} questions)`).join('\n');

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      messages: [{ role: 'user', content: `Based on this student's Microsoft Learn study performance, estimate their certification readiness on a 0-100 scale and identify which Microsoft certification(s) they're closest to being ready for.

Overall: ${data.overall.accuracy}% accuracy across ${data.overall.topics_covered} topics, ${data.overall.total} questions answered.

Topic breakdown:
${topicList}

Respond with ONLY JSON (no markdown): {"score": 0-100, "nearestCert": "certification name", "assessment": "2-3 sentence assessment"}` }],
    });

    const text = message.content[0].text.trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    const result = JSON.parse(text);
    res.json({ ...result, data });
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
    name: 'Microsoft Learn Flash Cards',
    version: '1.0.0',
    description: 'Interactive flash cards for Microsoft Learn documentation - powered by Claude AI',
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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Microsoft Learn Flash Cards server running on port ${PORT}`);
  console.log(`📱 Local: http://localhost:${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`📊 API info: http://localhost:${PORT}/api/info`);

  if (process.env.NODE_ENV === 'production') {
    console.log('🌐 Production mode enabled');
  }
});

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