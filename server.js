require('dotenv').config();
const express = require('express');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

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
      scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
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
app.post('/api/generate-cards', async (req, res) => {
  console.log('📝 /api/generate-cards called');

  if (!anthropic) {
    console.error('❌ ANTHROPIC_API_KEY not configured');
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY is not configured. Set it as an environment variable.' });
  }

  const { sections, count, difficulty } = req.body;
  if (!sections || !Array.isArray(sections) || sections.length === 0) {
    console.error('❌ No sections provided');
    return res.status(400).json({ error: 'No content sections provided' });
  }

  console.log(`📄 Generating ${count} cards at ${difficulty} difficulty from ${sections.length} sections`);

  // Build a condensed version of the page content for the prompt
  const contentText = sections
    .map(s => `## ${s.heading}\n${s.content.join('\n')}`)
    .join('\n\n')
    .substring(0, 12000); // Stay within reasonable token limits

  const prompt = `You are an expert educator creating flash cards from Microsoft documentation.

Given the following documentation content, generate exactly ${count || 10} multiple-choice flash cards at a "${difficulty || 'intermediate'}" difficulty level.

RULES:
- Every question and answer MUST be directly based on facts stated in the content below. Do NOT invent or assume information.
- Questions should test understanding of key concepts, not trivial details.
- Each question must have exactly 4 choices (A, B, C, D) with exactly 1 correct answer.
- Wrong answers should be plausible but clearly incorrect based on the content.
- Explanations should reference the specific content that supports the correct answer.
- Vary question styles: "What is...", "Which of the following...", "What is the purpose of...", "How does... work?", etc.

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
app.post('/api/scores', async (req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: 'Database not configured' });
  }
  try {
    const { url, pageTitle, correct, total, scorePct, difficulty } = req.body;
    const score = await db.saveScore({ url, pageTitle, correct, total, scorePct, difficulty });
    res.json(score);
  } catch (err) {
    console.error('Save score error:', err.message);
    res.status(500).json({ error: 'Failed to save score' });
  }
});

// Get score history
app.get('/api/scores', async (req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: 'Database not configured' });
  }
  try {
    const scores = await db.getScores({ limit: parseInt(req.query.limit) || 50 });
    res.json(scores);
  } catch (err) {
    console.error('Get scores error:', err.message);
    res.status(500).json({ error: 'Failed to fetch scores' });
  }
});

// Get aggregate stats
app.get('/api/stats', async (req, res) => {
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ error: 'Database not configured' });
  }
  try {
    const stats = await db.getStats();
    res.json(stats);
  } catch (err) {
    console.error('Get stats error:', err.message);
    res.status(500).json({ error: 'Failed to fetch stats' });
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