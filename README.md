# Good Better Best

AI-powered study cards for Microsoft Learn — built to turn any Microsoft documentation page into an interactive quiz session using Claude AI.

![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white)
![Claude AI](https://img.shields.io/badge/Claude-Sonnet_4-cc785c?logo=anthropic&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-4169E1?logo=postgresql&logoColor=white)
![Vercel](https://img.shields.io/badge/Frontend-Vercel-000000?logo=vercel&logoColor=white)
![Railway](https://img.shields.io/badge/API-Railway-0B0D0E?logo=railway&logoColor=white)

---

## Summary

Good Better Best is a full-stack web application that generates intelligent, adaptive flash cards from any Microsoft Learn documentation URL. Users paste a link, choose their settings, and the app fetches the page content, parses it into structured sections, and sends it to Anthropic's Claude AI to produce multiple question types — multiple choice, true/false, fill-in-the-blank, and scenario-based questions.

The platform includes user authentication, spaced repetition review (SM-2 algorithm), a gamification system with 29 unlockable badges, XP-based leaderboards, Socratic AI coaching, a full Microsoft certification catalog with 100+ certs and applied skills, daily challenges, weakness analysis, knowledge decay modeling, and a progressive web app experience with offline caching.

Built as a solo project to explore the intersection of AI-assisted learning, adaptive difficulty, and modern web architecture.

---

## Features

- **AI Question Generation** — Claude Sonnet 4 generates varied question types from parsed documentation content, with adaptive difficulty based on user performance history
- **Microsoft Certification Catalog** — Full integration with the Microsoft Learn Catalog API (100+ certifications, 37+ applied skills), filterable by area, level, and type
- **Skills Tested Extraction** — Fetches exam study guides and extracts detailed competency lists (60-90 skills per cert) for targeted study
- **Spaced Repetition** — SM-2 algorithm tracks card reviews with optimized intervals for long-term retention
- **Gamification** — 29 badges across 6 categories, XP system, streaks, Bronze/Silver/Gold/Platinum leaderboard tiers, daily challenges
- **Socratic AI Coach** — Conversational tutoring mode where Claude asks probing questions instead of giving answers
- **Teach-Back Mode** — Users explain concepts in their own words; AI evaluates understanding and identifies misconceptions
- **Certification Readiness** — AI-powered readiness scoring against a user's target certification goal
- **Weakness Reports** — AI analyzes wrong-answer patterns and generates personalized study recommendations
- **Knowledge Decay Modeling** — Estimates retention over time and surfaces topics that need refreshing
- **12 Color Themes** — Including dark/light variants for each major cloud hyperscaler (with creative names)
- **PWA** — Service worker with network-first caching, offline support, auto-update
- **Mobile Responsive** — Breakpoints from 900px down to 280px with optimized layouts at each tier

---

## Technical Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              USERS                                      │
│                    Desktop / Mobile / PWA                                │
└──────────────────────────┬──────────────────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
┌──────────────────────┐   ┌──────────────────────────────────────────────┐
│   VERCEL (Frontend)  │   │         RAILWAY (API Server)                 │
│                      │   │                                              │
│  Static HTML/CSS/JS  │   │  ┌────────────────────────────────────────┐  │
│  ┌────────────────┐  │   │  │          Express.js Server             │  │
│  │  index.html    │  │   │  │                                        │  │
│  │  app.js        │──┼───┼─▶│  /api/generate-cards    ──┐           │  │
│  │  auth.js       │  │   │  │  /api/socratic           │           │  │
│  │  nav.js        │  │   │  │  /api/teach-back         │  Claude   │  │
│  │  theme.js      │  │   │  │  /api/weakness-report    │  Sonnet 4 │  │
│  │  config.js     │  │   │  │  /api/cert-readiness   ──┘           │  │
│  │  consent.js    │  │   │  │                                        │  │
│  │  sw.js (PWA)   │  │   │  │  /api/auth/*         ─── JWT + bcrypt │  │
│  └────────────────┘  │   │  │  /api/scores          ─┐              │  │
│                      │   │  │  /api/question-log      │              │  │
│  Pages:              │   │  │  /api/reviews/*         │  PostgreSQL │  │
│  ┌────────────────┐  │   │  │  /api/gamification/*    │  (Railway)  │  │
│  │ paths.html     │  │   │  │  /api/leaderboard     ─┘              │  │
│  │ review.html    │  │   │  │                                        │  │
│  │ socratic.html  │  │   │  │  /api/learning-paths  ─── MS Catalog  │  │
│  │ profile.html   │  │   │  │  /api/cert-study-guide    API         │  │
│  │ history.html   │  │   │  │  /api/fetch-page      ─── MS Learn    │  │
│  │ topics.html    │  │   │  │                            Proxy       │  │
│  │ compare.html   │  │   │  │  /api/search-docs     ─── MS Search   │  │
│  │ leaderboard    │  │   │  │                            API         │  │
│  │ settings.html  │  │   │  └────────────────────────────────────────┘  │
│  │ changelog.html │  │   │                                              │
│  └────────────────┘  │   │  Middleware: Helmet, CORS, Compression,      │
│                      │   │  Rate Limiting, JWT Auth                     │
│  vercel.json (SPA    │   │                                              │
│  rewrites)           │   │  Dockerfile + docker-compose.yml             │
└──────────────────────┘   └──────────────┬───────────────────────────────┘
                                          │
              ┌───────────────────────────┬┴──────────────────────┐
              │                           │                       │
              ▼                           ▼                       ▼
┌──────────────────────┐   ┌──────────────────────┐   ┌────────────────────┐
│   Anthropic API      │   │  PostgreSQL (Railway) │   │  Microsoft Learn   │
│                      │   │                       │   │                    │
│  Claude Sonnet 4     │   │  users                │   │  Catalog API       │
│  - Question gen      │   │  scores               │   │  /api/catalog/     │
│  - Socratic tutor    │   │  question_logs        │   │                    │
│  - Teach-back eval   │   │  card_reviews (SM-2)  │   │  Documentation     │
│  - Weakness reports  │   │  user_streaks         │   │  Pages (proxy)     │
│  - Cert readiness    │   │  achievements         │   │                    │
│                      │   │  shared_decks         │   │  Study Guides      │
│                      │   │  question_feedback    │   │  (skill extraction)│
│                      │   │  telemetry            │   │                    │
│                      │   │  cert_goals           │   │  Search API        │
│                      │   │  study_goals          │   │  /api/search       │
└──────────────────────┘   └──────────────────────┘   └────────────────────┘
```


---

## Services & Integrations

| Service | Role | Details |
|---------|------|---------|
| **Vercel** | Frontend hosting | Static HTML/CSS/JS, SPA rewrites, auto-deploy from Git |
| **Railway** | API server + database | Node.js container, PostgreSQL addon, manual deploy via `railway up` |
| **Anthropic Claude** | AI engine | Claude Sonnet 4 (`claude-sonnet-4-20250514`) for question generation, coaching, evaluation |
| **Microsoft Learn Catalog API** | Certification data | Full catalog of certifications and applied skills at `/api/catalog/` |
| **Microsoft Learn** | Content source | Documentation pages fetched server-side, study guides parsed for skill extraction |
| **PostgreSQL** | Persistence | 10 tables: users, scores, question_logs, card_reviews, user_streaks, achievements, shared_decks, question_feedback, telemetry, cert_goals |
| **GitHub** | Source control | CI via GitHub Actions, Vercel auto-deploy on push |

---

## Tech Stack

**Backend**
- Node.js 18+ / Express 4
- `@anthropic-ai/sdk` — Claude AI integration
- `postgres` (porsager) — PostgreSQL client with tagged template queries
- `bcryptjs` + `jsonwebtoken` — Authentication (email/password, JWT)
- `helmet` — Security headers (CSP, HSTS, etc.)
- `express-rate-limit` — API and AI endpoint rate limiting
- `compression` — Gzip response compression
- `cors` — Cross-origin resource sharing
- `dotenv` — Environment variable management

**Frontend**
- Vanilla HTML/CSS/JS (no framework)
- DM Sans + JetBrains Mono (Google Fonts)
- Lucide Icons (SVG icon library)
- Chart.js (history/analytics charts)
- Service Worker (network-first caching, v6)
- PWA manifest with standalone display mode

**Infrastructure**
- Docker (Alpine Node 18, non-root user, health checks)
- docker-compose for local development
- Vercel for frontend CDN + edge
- Railway for API server + managed PostgreSQL
- GitHub Actions for CI/test pipeline

---

## Database Schema

```
users ──────────────┐
  id (PK)           │
  email (unique)    │
  password_hash     │
  display_name      │
  created_at        │
                    │
scores ◄────────────┤  question_logs ◄──────────┤
  user_id (FK) ─────┤    user_id (FK) ──────────┤
  url, page_title   │    url, page_title        │
  correct, total    │    question, answers       │
  score_pct         │    is_correct, difficulty  │
  difficulty        │                            │
                    │  card_reviews ◄────────────┤
user_streaks ◄──────┤    user_id (FK) ──────────┤
  current_streak    │    SM-2 fields (ease,      │
  longest_streak    │    interval, repetitions)  │
  total_xp          │    next_review             │
                    │                            │
achievements ◄──────┤  cert_goals ◄─────────────┘
  badge_key         │    cert_id, cert_name
  earned_at         │
                    │
shared_decks ◄──────┤  telemetry
  share_code        │    event_type, event_data
  cards (JSONB)     │
                    │  question_feedback
                    │    feedback_type
```

---

## Project Structure

```
├── server.js              # Express API server (all endpoints)
├── db.js                  # PostgreSQL queries, schema init, gamification logic
├── package.json
├── Dockerfile             # Production container (Node 18 Alpine)
├── docker-compose.yml     # Local dev orchestration
├── Procfile               # Railway/Heroku process definition
│
├── frontend/              # Static frontend (deployed to Vercel)
│   ├── index.html         # Main study session page
│   ├── app.js             # Core flash card app logic (~1600 lines)
│   ├── auth.js            # JWT auth, signup/login modal, token management
│   ├── nav.js             # Shared navigation (desktop sidebar + mobile tabs)
│   ├── theme.js           # Early-load theme applier (12 themes)
│   ├── config.js          # API base URL configuration
│   ├── consent.js         # Cookie/analytics consent
│   ├── sw.js              # Service worker (network-first, v6)
│   ├── styles.css         # Full design system (~700 lines)
│   ├── logo.svg           # App logo
│   ├── manifest.json      # PWA manifest
│   ├── vercel.json        # Vercel SPA routing config
│   │
│   ├── paths.html         # Microsoft certification catalog browser
│   ├── review.html        # Spaced repetition review queue
│   ├── socratic.html      # AI Socratic coaching mode
│   ├── profile.html       # Achievements, cert readiness, weakness reports
│   ├── history.html       # Score history with Chart.js visualizations
│   ├── topics.html        # Per-topic accuracy breakdown
│   ├── compare.html       # Global comparison stats
│   ├── leaderboard.html   # XP leaderboard with tier badges
│   ├── settings.html      # Themes, font size, goals, data export
│   └── changelog.html     # Public changelog
│
└── tests/
    └── server.test.js     # Jest + Supertest API tests
```

---

## Key API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/generate-cards` | POST | Optional | AI question generation from page content |
| `/api/generate-cards-batch` | POST | Optional | Cross-document synthesis questions |
| `/api/fetch-page` | GET | — | Server-side proxy for Microsoft Learn pages |
| `/api/learning-paths` | GET | — | Full Microsoft certification catalog (cached 1hr) |
| `/api/cert-study-guide` | GET | — | Extract skills tested + training URLs from exam study guides |
| `/api/auth/signup` | POST | — | Create account (email/password) |
| `/api/auth/login` | POST | — | JWT token issuance |
| `/api/scores` | GET/POST | Required | Score history (user-scoped) |
| `/api/question-log` | POST | Required | Individual answer logging |
| `/api/reviews/due` | GET | Required | Spaced repetition cards due for review |
| `/api/reviews/result` | POST | Required | Submit SM-2 review quality rating |
| `/api/socratic` | POST | Required | Socratic AI coaching conversation |
| `/api/teach-back` | POST | Required | AI evaluation of user explanations |
| `/api/weakness-report` | GET | Required | AI-generated personalized study report |
| `/api/certification-readiness` | GET | Required | AI cert readiness scoring |
| `/api/gamification/profile` | GET | Required | Streak, XP, badges |
| `/api/leaderboard` | GET | — | Global XP leaderboard (cached 5min) |
| `/api/daily-challenge` | GET | — | Rotating daily study challenge |
| `/api/knowledge-decay` | GET | Required | Retention estimates per topic |
| `/api/export/json` | GET | Required | Full data export |
| `/api/export/csv` | GET | Required | CSV score export |

---

## Running Locally

```bash
# Clone
git clone https://github.com/justinericsnyder/FlashCards.git
cd FlashCards

# Install dependencies
npm install

# Configure environment
cp .env.local .env
# Edit .env with your keys:
#   ANTHROPIC_API_KEY=sk-ant-...
#   DATABASE_URL=postgres://...
#   JWT_SECRET=your-secret

# Start dev server
npm run dev
# → http://localhost:3000
```

Or with Docker:

```bash
docker-compose up --build
```

---

## Deployment

**Frontend (Vercel)** — Auto-deploys from `main` branch pushes. Config in `frontend/vercel.json`.

**API (Railway)** — Manual deploy:
```bash
railway up --detach
```

Environment variables required on Railway:
- `ANTHROPIC_API_KEY`
- `DATABASE_URL` (auto-provisioned with Railway PostgreSQL addon)
- `JWT_SECRET`
- `FRONTEND_URL` (Vercel domain, for CORS)
- `NODE_ENV=production`

---

## License

MIT

---

© 2026 [JUSTINERICSNYDER.COM](https://www.justinericsnyder.com)
