# Good Better Best

AI-powered study cards for Microsoft Learn — turn any documentation page into an interactive quiz session.

---

## Summary

Good Better Best is a full-stack web application that generates intelligent, adaptive flash cards from Microsoft Learn documentation. Users paste a URL, configure their session, and the app produces multiple question types — multiple choice, true/false, fill-in-the-blank, and scenario-based — powered by generative AI.

The platform includes user authentication, spaced repetition review, a gamification system with unlockable badges and XP-based leaderboards, AI coaching modes, a full Microsoft certification catalog, daily challenges, personalized weakness analysis, knowledge decay modeling, and a progressive web app experience.

Built as a solo project to explore the intersection of AI-assisted learning, adaptive difficulty, and modern web architecture.

---

## Features

- **AI Question Generation** — Multiple question types generated from parsed documentation, with adaptive difficulty based on performance history
- **Microsoft Certification Catalog** — Integration with the Microsoft Learn Catalog API covering certifications and applied skills, filterable by area, level, and type
- **Skills Tested Extraction** — Parses exam study guides to extract detailed competency lists for targeted study
- **Spaced Repetition** — SM-2 algorithm for optimized review intervals and long-term retention
- **Gamification** — Badges, XP, streaks, tiered leaderboards, daily challenges
- **Socratic AI Coach** — Conversational tutoring that asks probing questions instead of giving answers
- **Teach-Back Mode** — Users explain concepts; AI evaluates understanding and identifies misconceptions
- **Certification Readiness** — AI-powered readiness scoring against a user's target certification
- **Weakness Reports** — AI analyzes wrong-answer patterns and generates personalized study plans
- **Knowledge Decay Modeling** — Estimates retention over time and surfaces topics needing review
- **Themeable** — 15 color themes including dark/light variants
- **PWA** — Offline-capable progressive web app with service worker caching
- **Mobile Responsive** — Optimized layouts across all device sizes

---

## Technical Architecture

### System Overview

High-level view of how the frontend, API, and external services connect.

```mermaid
graph TB
    subgraph Users
        Browser["🖥️ Desktop Browser"]
        Mobile["📱 Mobile / PWA"]
    end

    subgraph Frontend["Frontend (CDN)"]
        SPA["Static HTML / CSS / JS"]
        SW["Service Worker"]
        Pages["12 Feature Pages"]
    end

    subgraph API["API Server"]
        Express["Node.js / Express"]
        Auth["Auth Layer"]
        RL["Rate Limiter"]
        Security["Security Middleware"]
    end

    subgraph External["External Services"]
        AI["Generative AI"]
        DB[("PostgreSQL")]
        MSAPI["Microsoft Learn APIs"]
    end

    Browser --> SPA
    Mobile --> SPA
    SPA --> SW
    SPA -->|REST API calls| Express
    Express --> Auth
    Express --> RL
    Express --> Security
    Express -->|Question gen, coaching, evaluation| AI
    Express -->|User data, scores, gamification| DB
    Express -->|Catalog, docs, study guides| MSAPI

    style Frontend fill:#1a1a2e,stroke:#f5c518,color:#e5e5e5
    style API fill:#0e0e1a,stroke:#60a5fa,color:#e5e5e5
    style External fill:#0e1a0e,stroke:#34d399,color:#e5e5e5
    style Users fill:#1a0e1a,stroke:#a78bfa,color:#e5e5e5
```


### User Flow — Study Session

The core learning loop from URL input to scored results.

```mermaid
flowchart LR
    A["Paste URL"] --> B["Configure Session"]
    B --> C["Fetch & Parse Page"]
    C --> D["AI Generates Questions"]
    D --> E["Interactive Quiz"]
    E --> F{"Answer Correct?"}
    F -->|Yes| G["✓ Score + XP"]
    F -->|No| H["✗ Show Explanation"]
    G --> I{"More Cards?"}
    H --> I
    I -->|Yes| E
    I -->|No| J["Session Results"]
    J --> K["Save to DB"]
    K --> L["Check Badges"]
    L --> M["Update Streak"]
    M --> N["Add to Review Queue"]

    style A fill:#1a1a2e,stroke:#f5c518,color:#e5e5e5
    style D fill:#1a1a2e,stroke:#f5c518,color:#e5e5e5
    style J fill:#0e1a0e,stroke:#34d399,color:#e5e5e5
    style G fill:#0e1a0e,stroke:#34d399,color:#e5e5e5
    style H fill:#1a0e0e,stroke:#f87171,color:#e5e5e5
```

### AI Integration Architecture

How generative AI is used across five distinct learning features.

```mermaid
graph LR
    subgraph Input
        Content["Parsed Page Content"]
        History["User Performance History"]
        Profile["Learning Profile"]
    end

    subgraph AI_Engine["Generative AI Engine"]
        QGen["Question Generation"]
        Socratic["Socratic Coaching"]
        TeachBack["Teach-Back Evaluation"]
        Weakness["Weakness Analysis"]
        Readiness["Cert Readiness Scoring"]
    end

    subgraph Output
        Cards["Flash Cards"]
        Dialogue["Guided Dialogue"]
        Feedback["Understanding Score"]
        Report["Study Recommendations"]
        Score["Readiness %"]
    end

    Content --> QGen
    History --> QGen
    Profile --> QGen
    Content --> Socratic
    Content --> TeachBack
    History --> Weakness
    History --> Readiness

    QGen --> Cards
    Socratic --> Dialogue
    TeachBack --> Feedback
    Weakness --> Report
    Readiness --> Score

    style AI_Engine fill:#1a1a2e,stroke:#f5c518,color:#e5e5e5
    style Input fill:#0e0e1a,stroke:#60a5fa,color:#e5e5e5
    style Output fill:#0e1a0e,stroke:#34d399,color:#e5e5e5
```

### Data Model

Entity relationships for user data, learning progress, and gamification.

```mermaid
erDiagram
    USERS ||--o{ SCORES : "completes sessions"
    USERS ||--o{ QUESTION_LOGS : "answers questions"
    USERS ||--o{ CARD_REVIEWS : "reviews cards"
    USERS ||--|| USER_STREAKS : "tracks streaks"
    USERS ||--o{ ACHIEVEMENTS : "earns badges"
    USERS ||--o{ SHARED_DECKS : "shares decks"
    USERS ||--o| CERT_GOALS : "sets goal"

    USERS {
        int id PK
        string email UK
        string display_name
        timestamp created_at
    }

    SCORES {
        int id PK
        int user_id FK
        string page_title
        int correct
        int total
        int score_pct
        string difficulty
    }

    QUESTION_LOGS {
        int id PK
        int user_id FK
        string question
        boolean is_correct
        string difficulty
    }

    CARD_REVIEWS {
        int id PK
        int user_id FK
        string question
        float ease_factor
        int interval_days
        int repetitions
        timestamp next_review
    }

    USER_STREAKS {
        int user_id PK
        int current_streak
        int longest_streak
        int total_xp
    }

    ACHIEVEMENTS {
        int id PK
        int user_id FK
        string badge_key
        timestamp earned_at
    }

    SHARED_DECKS {
        int id PK
        string share_code UK
        int user_id FK
        json cards
    }

    CERT_GOALS {
        int user_id PK
        string cert_id
        string cert_name
    }
```

### Spaced Repetition Flow (SM-2)

How the review system schedules cards based on recall quality.

```mermaid
stateDiagram-v2
    [*] --> New: Card Created
    New --> Learning: First Review

    Learning --> Review: Quality ≥ 3
    Learning --> Learning: Quality < 3 (Reset)

    Review --> Review: Interval × Ease Factor
    Review --> Learning: Quality < 3 (Reset)

    Review --> Mastered: 3+ Successful Reviews

    state Learning {
        [*] --> Day1: interval = 1 day
        Day1 --> Day3: interval = 3 days
    }

    state Review {
        [*] --> Scheduled
        Scheduled --> Due: next_review reached
        Due --> Graded: User rates 0-5
        Graded --> Scheduled: Update ease + interval
    }
```

### Gamification System

Badge categories and XP progression through the tier system.

```mermaid
graph TB
    subgraph Triggers["Activity Triggers"]
        Sessions["Sessions Completed"]
        Streaks["Daily Streaks"]
        Accuracy["Perfect Scores"]
        Topics["Topics Explored"]
        Questions["Questions Answered"]
        Features["Feature Usage"]
        Time["Time of Day"]
    end

    subgraph Engine["Gamification Engine"]
        Check["Badge Check"]
        XP["XP Calculator"]
        Streak["Streak Tracker"]
    end

    subgraph Rewards["Rewards"]
        Badges["29 Unlockable Badges"]
        Tiers["Leaderboard Tiers"]
        Toast["Achievement Toasts"]
    end

    Sessions --> Check
    Streaks --> Check
    Accuracy --> Check
    Topics --> Check
    Questions --> Check
    Features --> Check
    Time --> Check

    Sessions --> XP
    Streaks --> XP
    Streaks --> Streak

    Check -->|New badge earned| Badges
    Check -->|New badge earned| Toast
    XP --> Tiers

    subgraph TierLevels["XP Tiers"]
        Bronze["🥉 Bronze: 0+"]
        Silver["🥈 Silver: 200+"]
        Gold["🥇 Gold: 500+"]
        Platinum["💎 Platinum: 1000+"]
    end

    Tiers --> TierLevels

    style Triggers fill:#1a1a2e,stroke:#f5c518,color:#e5e5e5
    style Engine fill:#0e0e1a,stroke:#60a5fa,color:#e5e5e5
    style Rewards fill:#0e1a0e,stroke:#34d399,color:#e5e5e5
    style TierLevels fill:#1a0e1a,stroke:#a78bfa,color:#e5e5e5
```

### Frontend Page Map

Navigation structure across the 12 feature pages.

```mermaid
graph TB
    Home["🏠 Home<br/>Study Session"]

    subgraph Learn["Learn"]
        Paths["📋 Certification Catalog"]
        Socratic["💬 AI Coach"]
        Review["🧠 Spaced Review"]
    end

    subgraph Data["Data & Analytics"]
        History["📊 Score History"]
        Topics["📚 Topic Stats"]
        Compare["⚖️ Global Compare"]
        Leaderboard["👑 Leaderboard"]
    end

    subgraph User["User"]
        Profile["🏆 Profile & Badges"]
        Settings["⚙️ Settings & Themes"]
        Changelog["📝 Changelog"]
    end

    Home --> Learn
    Home --> Data
    Home --> User

    Paths -->|"Study Skills"| Home
    Review -->|"Review Due Cards"| Home

    style Home fill:#1a1a2e,stroke:#f5c518,color:#e5e5e5
    style Learn fill:#0e0e1a,stroke:#60a5fa,color:#e5e5e5
    style Data fill:#0e1a0e,stroke:#34d399,color:#e5e5e5
    style User fill:#1a0e1a,stroke:#a78bfa,color:#e5e5e5
```

### Deployment Architecture

```mermaid
graph LR
    subgraph Dev["Development"]
        Code["Source Code"]
        Docker["Docker Compose"]
    end

    subgraph CI["CI/CD"]
        GH["GitHub"]
        Actions["Test Pipeline"]
    end

    subgraph Prod["Production"]
        CDN["CDN Edge Network<br/>Static Frontend"]
        Cloud["Cloud Platform<br/>API Server + DB"]
    end

    Code --> GH
    GH --> Actions
    Actions -->|"Auto-deploy"| CDN
    GH -->|"Manual deploy"| Cloud
    Docker -->|"Local dev"| Code

    CDN -->|"API requests"| Cloud

    style Dev fill:#1a1a2e,stroke:#f5c518,color:#e5e5e5
    style CI fill:#0e0e1a,stroke:#60a5fa,color:#e5e5e5
    style Prod fill:#0e1a0e,stroke:#34d399,color:#e5e5e5
```

---

## Services & Integrations

| Layer | Technology | Role |
|-------|-----------|------|
| Frontend | Static CDN | HTML/CSS/JS hosting with edge delivery |
| API | Node.js / Express | RESTful API server with auth and rate limiting |
| AI | Anthropic Claude | Question generation, coaching, evaluation |
| Database | PostgreSQL | User data, scores, reviews, gamification |
| Content | Microsoft Learn | Documentation content, certification catalog, study guides |
| CI/CD | GitHub Actions | Automated testing pipeline |

---

## Tech Stack

**Backend** — Node.js, Express, PostgreSQL, JWT authentication, security hardening, rate limiting

**Frontend** — Vanilla HTML/CSS/JS (no framework), Google Fonts, Lucide Icons, Chart.js, Service Worker (PWA)

**Infrastructure** — Docker, CI/CD pipeline, CDN-hosted frontend, managed database

---

## Running Locally

```bash
git clone https://github.com/justinericsnyder/FlashCards.git
cd FlashCards
npm install
cp .env.local .env
# Configure required environment variables in .env
npm run dev
```

Or with Docker:

```bash
docker-compose up --build
```

---

## License

MIT

---

© 2026 [JUSTINERICSNYDER.COM](https://www.justinericsnyder.com)
