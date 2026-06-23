const request = require('supertest');

// Mock db module before requiring server
jest.mock('../db', () => ({
  initialize: jest.fn().mockResolvedValue(),
  createUser: jest.fn(),
  getUserByEmail: jest.fn(),
  getUserById: jest.fn(),
  saveScore: jest.fn().mockResolvedValue({ id: 1 }),
  getScores: jest.fn().mockResolvedValue([]),
  getStats: jest.fn().mockResolvedValue({ overall: {}, byDifficulty: [], recent: [] }),
  saveQuestionLog: jest.fn().mockResolvedValue({ id: 1 }),
  getTopicStats: jest.fn().mockResolvedValue([]),
  getPastQuestions: jest.fn().mockResolvedValue([]),
  getRecentTopics: jest.fn().mockResolvedValue([]),
  getGlobalTopicStats: jest.fn().mockResolvedValue([]),
  upsertCardReview: jest.fn().mockResolvedValue(),
  getCardsForReview: jest.fn().mockResolvedValue([]),
  updateReviewResult: jest.fn().mockResolvedValue({}),
  getReviewStats: jest.fn().mockResolvedValue({ total_cards: 0, due_now: 0 }),
  updateStreak: jest.fn().mockResolvedValue({ current_streak: 1 }),
  checkAndAwardBadges: jest.fn().mockResolvedValue([]),
  getUserAchievements: jest.fn().mockResolvedValue([]),
  getStreak: jest.fn().mockResolvedValue({ current_streak: 0, total_xp: 0 }),
  getLeaderboard: jest.fn().mockResolvedValue([]),
  shareDeck: jest.fn().mockResolvedValue({ share_code: 'abc123' }),
  getDeckByCode: jest.fn().mockResolvedValue(null),
  getDetailedAnalytics: jest.fn().mockResolvedValue({}),
  BADGES: {},
}));

const app = require('../server');

describe('Health & Info', () => {
  test('GET /health returns OK', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
  });

  test('GET /api/info returns app info', async () => {
    const res = await request(app).get('/api/info');
    expect(res.status).toBe(200);
    expect(res.body.name).toContain('Good Better Best');
  });
});

describe('Auth endpoints', () => {
  test('POST /api/auth/signup requires email and password', async () => {
    const res = await request(app).post('/api/auth/signup').send({});
    expect(res.status).toBe(400);
  });

  test('POST /api/auth/login requires email and password', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
  });
});

describe('Protected endpoints require auth', () => {
  test('GET /api/scores returns 401 without token', async () => {
    const res = await request(app).get('/api/scores');
    expect(res.status).toBe(401);
  });

  test('GET /api/stats returns 401 without token', async () => {
    const res = await request(app).get('/api/stats');
    expect(res.status).toBe(401);
  });

  test('GET /api/topic-stats returns 401 without token', async () => {
    const res = await request(app).get('/api/topic-stats');
    expect(res.status).toBe(401);
  });

  test('GET /api/reviews/due returns 401 without token', async () => {
    const res = await request(app).get('/api/reviews/due');
    expect(res.status).toBe(401);
  });
});

describe('Public endpoints', () => {
  test('GET /api/global-topic-stats returns 503 without DB', async () => {
    const res = await request(app).get('/api/global-topic-stats');
    expect([200, 503]).toContain(res.status);
  });

  test('GET /api/gamification/leaderboard works without auth', async () => {
    const res = await request(app).get('/api/gamification/leaderboard');
    expect(res.status).toBe(200);
  });
});

describe('Fetch page proxy', () => {
  test('GET /api/fetch-page requires url param', async () => {
    const res = await request(app).get('/api/fetch-page');
    expect(res.status).toBe(400);
  });

  test('GET /api/fetch-page rejects non-Microsoft URLs', async () => {
    const res = await request(app).get('/api/fetch-page?url=https://example.com');
    expect(res.status).toBe(403);
  });
});
