const express = require('express');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
    },
  },
}));

// Enable CORS for API requests
app.use(cors());

// Compression middleware
app.use(compression());

// Serve static files from current directory
app.use(express.static(path.join(__dirname), {
  maxAge: '1d', // Cache static assets for 1 day
  etag: true,
  lastModified: true,
}));

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

      mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FlashCardBot/1.0)' } }, (upstream) => {
        // Follow redirects
        if ([301, 302, 303, 307, 308].includes(upstream.statusCode) && upstream.headers.location) {
          return resolve(fetchPage(upstream.headers.location, redirectsLeft - 1));
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
    description: 'Interactive flash cards for Microsoft Learn documentation',
    features: [
      'Smart content generation',
      'Customizable difficulty levels',
      'Progress tracking',
      'Mobile responsive',
      'Accessibility features',
    ],
  });
});

// Catch all handler: send back index.html for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

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