const DEFAULT_JWT = 'flashcards-secret-change-in-production';

const CONFIG = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || 3000,
  JWT_SECRET: process.env.JWT_SECRET || DEFAULT_JWT,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || null,
  DATABASE_URL: process.env.DATABASE_URL || null,
  FRONTEND_URL: process.env.FRONTEND_URL || null,
  CACHE_MAX: parseInt(process.env.CACHE_MAX || '500'),
  CACHE_TTL_MS: parseInt(process.env.CACHE_TTL_MS || String(5 * 60 * 1000)),
};

// Basic validation: in production require non-default JWT and (optionally) other secrets
if (CONFIG.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || CONFIG.JWT_SECRET === DEFAULT_JWT) {
    throw new Error('JWT_SECRET must be set in production and must not use the default value');
  }
}

module.exports = CONFIG;
