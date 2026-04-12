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

Given the following documentation content, generate exactly ${count || 10} multiple-choice flash cards at a "${difficulty || 'intermediate'}" difficulty level.

RULES:
- Every question and answer MUST be directly based on facts stated in the content below. Do NOT invent or assume information.
- Questions should test understanding of key concepts, not trivial details.
- Each question must have exactly 4 choices (A, B, C, D) with exactly 1 correct answer.
- Wrong answers should be plausible but clearly incorrect based on the content.
- Explanations should reference the specific content that supports the correct answer.
- Vary question styles: "What is...", "Which of the following...", "What is the purpose of...", "How does... work?", etc.
${avoidInstruction}
DOCUMENTATION CONTENT:
${contentText}

Respond with ONLY a JSON array (no markdown, no code fences) in this exact format:
[
  {
    "question": "The question text",
    "choices": ["Choice A text", "Choice B text", "Choice C text", "Choice D text"],
    "correctAnswer": "A",
    "explanation": "Explanation referencing the documentation content"
  }
]`;

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

    const validCards = cards.filter(c =>
      c.question && Array.isArray(c.choices) && c.choices.length === 4
      && c.correctAnswer && c.explanation
    );

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