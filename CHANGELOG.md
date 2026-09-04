<div align="center">

# Changelog

**Good Better Best** — Release History

</div>

<style>
  .cl-entry { padding: 0.5em 0; border-bottom: 1px solid #30363d; }
  .cl-tag { display: inline-block; font-size: 0.7em; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; padding: 0.15em 0.5em; border-radius: 4px; vertical-align: middle; margin-right: 0.3em; }
  .cl-feat { background: rgba(245,197,24,0.15); color: #f5c518; }
  .cl-fix { background: rgba(52,211,153,0.15); color: #34d399; }
  .cl-design { background: rgba(129,140,248,0.15); color: #818cf8; }
  .cl-infra { background: rgba(148,163,184,0.15); color: #8b949e; }
  .cl-docs { background: rgba(14,165,233,0.15); color: #0ea5e9; }
  .cl-security { background: rgba(248,113,113,0.15); color: #f87171; }
  .cl-a11y { background: rgba(168,85,247,0.15); color: #a855f7; }
</style>

---

## v3.3.0 — 2026-09-04

> **PR #3** — `feat/cert-tracker-johari-20`

20 more Johari-framework improvements to the credential tracker — a second pass across all four quadrants: visible polish, accessibility and edge-case fixes, hidden-capability surfacing, and latent-risk mitigation.

| | |
|---|---|
| <span class="cl-tag cl-feat">feature</span> | Dependency-aware prereq badges — name the required cert(s) and show whether they're met |
| <span class="cl-tag cl-feat">feature</span> | Status filter chips (Not started / Targeting / Awaiting / Earned) replace the "Hide completed" toggle |
| <span class="cl-tag cl-design">design</span> | `/` focuses search, Escape clears it; search matches category, level, provider, and badge terms |
| <span class="cl-tag cl-feat">feature</span> | Insights panel — chronological earned-credential timeline plus on-device activity counters |
| <span class="cl-tag cl-design">design</span> | Reset button scoped per credential family, with entry count in the tooltip |
| <span class="cl-tag cl-fix">fix</span> | Unmarking no longer destroys the earned date — remembered and restored on re-mark, with an undo toast |
| <span class="cl-tag cl-a11y">a11y</span> | Targeting / Awaiting toggles now announce to screen readers |
| <span class="cl-tag cl-a11y">a11y</span> | ARIA contracts delivered — tablist arrow-key navigation; export menu arrows + Escape |
| <span class="cl-tag cl-fix">fix</span> | `storage` event listener keeps multiple open tabs consistent |
| <span class="cl-tag cl-fix">fix</span> | Reset undo is durable — backup persisted for 24h with a recovery toast on the next visit |
| <span class="cl-tag cl-feat">feature</span> | Import JSON restores a previous export (merge-safe, undoable) |
| <span class="cl-tag cl-design">design</span> | Pull sync reports what it changed ("Updated N credentials from your account") |
| <span class="cl-tag cl-feat">feature</span> | Copy-link button — the URL now encodes level + status filters too |
| <span class="cl-tag cl-feat">feature</span> | Freshness badge opens a what's-new / recently-retired catalogue panel |
| <span class="cl-tag cl-feat">feature</span> | Annual renewal tracking for role-based & specialty certs — due dates, 180-day window, overdue states |
| <span class="cl-tag cl-fix">fix</span> | Retired credentials keep earned progress visible on the page and in exports |
| <span class="cl-tag cl-security">security</span> | Optimistic-concurrency sync — `rev` on GET/PUT, 409 + client merge-and-retry against stale-device clobbering |
| <span class="cl-tag cl-feat">feature</span> | Study links bridge each Microsoft cert to the flash-card generator via its exam study guide |
| <span class="cl-tag cl-feat">feature</span> | Statuses are timestamped; stale "awaiting results" (>30 days) visibly ages |
| <span class="cl-tag cl-infra">infra</span> | July 2026 catalogue update merged into the extracted `certs-data.js` module |
| <span class="cl-tag cl-infra">infra</span> | 11 new unit tests (44 total) + a 25-check jsdom smoke test; service-worker cache bumped to v7 |

---

## v3.2.0 — 2026-08-15

> Certification catalogue refresh — July 2026 Microsoft Certification Poster

Updated the certification tracker to reflect the latest Microsoft Certification Poster (July 2026). Retired exams removed, new certifications added, and beta/new flags updated for certs that have gone GA.

| | |
|---|---|
| <span class="cl-tag cl-feat">feature</span> | Added AZ-802 — Windows Server Administrator Associate (replaces AZ-800/AZ-801) |
| <span class="cl-tag cl-feat">feature</span> | Added AI-500 — Multi-Agent AI Solutions Expert Certification (Beta) |
| <span class="cl-tag cl-feat">feature</span> | Added AB-650 — AI Services Administrator Associate (Beta) |
| <span class="cl-tag cl-feat">feature</span> | AI-901 Azure AI Fundamentals now GA (was beta) — replaces retired AI-900 |
| <span class="cl-tag cl-feat">feature</span> | AI-103, AI-200, GH-600, AB-620, AB-210, AB-250, AB-410 — promoted from beta to GA |
| <span class="cl-tag cl-feat">feature</span> | SC-500 Cloud and AI Security Engineer Associate — promoted from beta to GA |
| <span class="cl-tag cl-fix">fix</span> | Removed retired certifications: AI-900, AZ-204, AZ-800/AZ-801, AI-102, MB-240, MB-280, MB-335, MB-700, PL-500, PL-600, SC-730 |
| <span class="cl-tag cl-infra">infra</span> | Catalogue source comment updated from June 2026 to July 2026 |

---

## v3.1.0 — 2026-07-03

> **PR #2** — `feat/cert-tracker-johari-30`

30 Johari-framework improvements to the credential tracker — architecture extraction, accessibility, hidden capability surfacing, and latent risk mitigation.

| | |
|---|---|
| <span class="cl-tag cl-infra">infra</span> | Extracted certification catalogue to `certs-data.js` (data/view split) with `CATALOGUE_UPDATED` freshness date |
| <span class="cl-tag cl-infra">infra</span> | Extracted pure logic to `cert-logic.js` — slugify, date helpers, legacy migration, non-destructive local⇄server merge, metrics math |
| <span class="cl-tag cl-infra">infra</span> | 21 unit tests for cert-logic module (`tests/cert-logic.test.js`) |
| <span class="cl-tag cl-design">design</span> | Debounced search with "no results" empty state |
| <span class="cl-tag cl-design">design</span> | Persisted UI state + shareable URL (filters, search, scroll position) |
| <span class="cl-tag cl-design">design</span> | Incremental single-card render — no full rebuild on status change |
| <span class="cl-tag cl-design">design</span> | Undoable reset toast — undo accidental progress wipes |
| <span class="cl-tag cl-design">design</span> | Sync status chip showing last-sync time |
| <span class="cl-tag cl-design">design</span> | Accessible progress bars with ARIA labels |
| <span class="cl-tag cl-a11y">a11y</span> | Focus restored after every interaction |
| <span class="cl-tag cl-a11y">a11y</span> | `aria-live` announcements for dynamic content changes |
| <span class="cl-tag cl-a11y">a11y</span> | Clearer assistive-tech semantics throughout tracker |
| <span class="cl-tag cl-a11y">a11y</span> | Higher-contrast inactive chips and hover affordance |
| <span class="cl-tag cl-a11y">a11y</span> | Larger touch targets for mobile interaction |
| <span class="cl-tag cl-feat">feature</span> | Status legend for Targeting / Awaiting states |
| <span class="cl-tag cl-feat">feature</span> | Guest → account migration notice |
| <span class="cl-tag cl-feat">feature</span> | ETA-model tooltip with estimated completion timeline |
| <span class="cl-tag cl-feat">feature</span> | Catalogue-freshness badge showing data recency |
| <span class="cl-tag cl-feat">feature</span> | "Not yet earnable" copy for upcoming certifications |
| <span class="cl-tag cl-fix">fix</span> | Non-destructive merge that never silently drops earned progress |
| <span class="cl-tag cl-security">security</span> | `keepalive` + `pagehide` sync flush — no lost writes on tab close |
| <span class="cl-tag cl-security">security</span> | Pinned Lucide to `1.23.0` with SRI hashes (was `@latest`) |
| <span class="cl-tag cl-feat">feature</span> | PWA manifest and service-worker registration for offline tracker |
| <span class="cl-tag cl-feat">feature</span> | CSV/JSON export of certification progress data |
| <span class="cl-tag cl-feat">feature</span> | Local, privacy-respecting usage counters |

---

## v3.0.0 — 2026-07-03

> **PR #1** — `feat/auth-and-review-sessions`

User auth hardening, spaced-repetition review sessions, and the new Fluent 2 certification tracker.

| | |
|---|---|
| <span class="cl-tag cl-feat">feature</span> | localStorage-backed auth — login/signup modal, token validation on load, automatic 401 handling |
| <span class="cl-tag cl-feat">feature</span> | "Review Due" spaced-repetition sessions with guest demo flow |
| <span class="cl-tag cl-feat">feature</span> | Per-user question logging on each answer |
| <span class="cl-tag cl-feat">feature</span> | Cancelable card generation — abort mid-stream AI requests |
| <span class="cl-tag cl-infra">infra</span> | `config.js` — env-driven configuration with production JWT guard |
| <span class="cl-tag cl-infra">infra</span> | `logger.js` — structured logging with Pino |
| <span class="cl-tag cl-infra">infra</span> | `validators.js` — Joi request validation schemas |

---

## v2.8.0 — 2026-06-23

> **PR #1** — `feat/auth-and-review-sessions`

Credential tracker expansion — Applied Skills, level filters, statuses, and per-user sync.

| | |
|---|---|
| <span class="cl-tag cl-feat">feature</span> | Applied Skills mode — switch between Certifications and Applied Skills views (38 items) |
| <span class="cl-tag cl-feat">feature</span> | Level filter chips — rescope rendered list and all metrics per family |
| <span class="cl-tag cl-feat">feature</span> | Per-item statuses — Targeting, Taken (awaiting results), and Earned with mutually exclusive states |
| <span class="cl-tag cl-feat">feature</span> | Per-user persistence — namespaced localStorage with legacy/guest migration |
| <span class="cl-tag cl-feat">feature</span> | Server sync — new `cert_progress` table (JSONB) with auth-protected GET/PUT endpoints |
| <span class="cl-tag cl-feat">feature</span> | Server-wins merge on load with debounced push on change |
| <span class="cl-tag cl-design">design</span> | Certification tracker palette follows active app theme |
| <span class="cl-tag cl-design">design</span> | Exam-code chip inverts for legibility on light and dark themes |
| <span class="cl-tag cl-design">design</span> | Category accents (Cloud/AI/Security) kept fixed as poster identity |
| <span class="cl-tag cl-infra">infra</span> | Fixed stale app-name test — restores CI to green (12/12) |
| <span class="cl-tag cl-infra">infra</span> | Removed broken GitHub Pages deploy workflow (redundant with Vercel + Railway) |

---

## v2.7.0 — 2026-06-23

> **PR #1** — `feat/auth-and-review-sessions`

Fluent 2 certification tracker — the initial page build.

| | |
|---|---|
| <span class="cl-tag cl-feat">feature</span> | `/certifications.html` — Microsoft & GitHub certification progress tracker in Fluent 2 design |
| <span class="cl-tag cl-feat">feature</span> | All 64 certifications across Cloud & AI, AI Business Solutions, and Security columns |
| <span class="cl-tag cl-feat">feature</span> | Click-to-earn with green earned-state and editable date picker |
| <span class="cl-tag cl-feat">feature</span> | Top metrics — overall %, earned/remaining, velocity (certs/mo), recent activity, estimated finish |
| <span class="cl-tag cl-feat">feature</span> | Per-category completion % with progress bars |
| <span class="cl-tag cl-feat">feature</span> | Search and hide-completed filters with reset control |
| <span class="cl-tag cl-feat">feature</span> | Beta/New/Expert/Prereq badges and Microsoft Learn deep links |
| <span class="cl-tag cl-design">design</span> | Wired into Learn popover and mobile More menu via `nav.js` |

---

## v2.6.0 — 2026-04-19

> Commits on `main`

Documentation and architecture diagrams.

| | |
|---|---|
| <span class="cl-tag cl-docs">docs</span> | 7 Mermaid architecture diagrams — system overview, user flow, AI integration, ER data model, SM-2 state machine, gamification pipeline, page map, deployment |
| <span class="cl-tag cl-security">security</span> | Hardened README — removed endpoint maps, database schema details, package versions, and deployment specifics |
| <span class="cl-tag cl-docs">docs</span> | Comprehensive README rewrite with technical architecture overview, services table, and tech stack summary |
| <span class="cl-tag cl-docs">docs</span> | Portfolio-ready CHANGELOG.md with versioned entries, dark-mode styling, and professional tags |

---

## v2.5.0 — 2026-04-15

Certification skills extraction, hyperscaler themes, mobile hardening.

| | |
|---|---|
| <span class="cl-tag cl-feat">feature</span> | Skills Tested modal — extracts exam code from cert pages and fetches study guides for detailed competency lists (60–90 skills per certification) |
| <span class="cl-tag cl-feat">feature</span> | Study settings modal on Learning Paths — choose card count, difficulty, and timer before starting a cert study session |
| <span class="cl-tag cl-feat">feature</span> | Applied Skills included in certification catalog from Microsoft Catalog API (37+ items) with type filter |
| <span class="cl-tag cl-feat">feature</span> | 6 new color themes — dark and light variants for each major cloud hyperscaler |
| <span class="cl-tag cl-fix">fix</span> | Study guide URL derived from exam code pattern instead of broken href scraping |
| <span class="cl-tag cl-fix">fix</span> | Sidebar max-height constraint removed — recent topics no longer clipped on desktop |
| <span class="cl-tag cl-fix">fix</span> | Mobile responsive — force single-column controls, px font sizes to prevent cascade, comprehensive stacking at all breakpoints |
| <span class="cl-tag cl-fix">fix</span> | Extreme narrow support down to 240px — min-width:0 on all flex children |
| <span class="cl-tag cl-fix">fix</span> | Recent topics grid forced to single column, overflow hidden on mobile |
| <span class="cl-tag cl-fix">fix</span> | Service worker auto-updates and reloads clients on mobile without manual refresh |
| <span class="cl-tag cl-fix">fix</span> | Mobile portrait layout — tighter padding, word-break, overflow fixes |

---

## v2.4.0 — 2026-04-13

Navigation overhaul, branding, dynamic certification catalog.

| | |
|---|---|
| <span class="cl-tag cl-feat">feature</span> | Dynamic certification catalog — fetches full Microsoft Learn Catalog API with filtering by area, level, and type |
| <span class="cl-tag cl-feat">feature</span> | Certification goal system — users set a target cert for personalized readiness scoring |
| <span class="cl-tag cl-design">design</span> | App rebranded to "Good Better Best" with custom SVG logo and favicon |
| <span class="cl-tag cl-design">design</span> | Icon-only sidebar navigation with hover popovers, grouped into Learn and Data categories |
| <span class="cl-tag cl-design">design</span> | Shared nav component injected on all pages — consistent navigation everywhere |
| <span class="cl-tag cl-design">design</span> | Mobile navigation — 4 primary tabs with slide-up More menu for secondary pages |
| <span class="cl-tag cl-design">design</span> | Two-column desktop layout — sidebar for recent topics, nav pinned to content edge |
| <span class="cl-tag cl-design">design</span> | Added "GoPackGo" theme, renamed default to "Hoist the Cone" |
| <span class="cl-tag cl-fix">fix</span> | Achievement toasts only fire for newly earned badges, not all existing ones |
| <span class="cl-tag cl-fix">fix</span> | Nav popover hover bridge — invisible padding gap so mouse can travel to submenu |
| <span class="cl-tag cl-fix">fix</span> | Theme persistence across all pages via shared early-load theme script |
| <span class="cl-tag cl-fix">fix</span> | Changelog rebuilt with 80+ accurate entries, sorted newest-first |
| <span class="cl-tag cl-fix">fix</span> | Recent topics limited to 5, footer spacing normalized |
| <span class="cl-tag cl-infra">infra</span> | Service worker switched to network-first caching to prevent stale UI |
| <span class="cl-tag cl-infra">infra</span> | CI builds fixed — test mode skips server.listen |

---

## v2.3.0 — 2026-04-12

Gamification, AI coaching, spaced repetition, and 50 prioritized improvements.

| | |
|---|---|
| <span class="cl-tag cl-feat">feature</span> | Spaced repetition with SM-2 algorithm — review page, due cards banner, quality-based scheduling |
| <span class="cl-tag cl-feat">feature</span> | 29 unlockable badges across 6 categories — milestones, streaks, performance, knowledge, features, XP tiers |
| <span class="cl-tag cl-feat">feature</span> | Socratic Mode — conversational AI coaching with guided dialogue |
| <span class="cl-tag cl-feat">feature</span> | AI-powered weakness reports — analyzes wrong-answer patterns for personalized study plans |
| <span class="cl-tag cl-feat">feature</span> | AI-powered certification readiness scoring with targeted assessment |
| <span class="cl-tag cl-feat">feature</span> | Teach-back mode — users explain concepts, AI evaluates understanding |
| <span class="cl-tag cl-feat">feature</span> | Multiple question types — true/false, fill-in-the-blank, scenario-based, multiple choice |
| <span class="cl-tag cl-feat">feature</span> | Streaks, XP system, and tiered leaderboard (Bronze/Silver/Gold/Platinum) |
| <span class="cl-tag cl-feat">feature</span> | Daily challenges with themed topics and bonus XP |
| <span class="cl-tag cl-feat">feature</span> | Study goals — weekly and monthly session targets |
| <span class="cl-tag cl-feat">feature</span> | Hints system — eliminates two wrong answers on demand |
| <span class="cl-tag cl-feat">feature</span> | Timed mode — optional countdown timer for exam simulation |
| <span class="cl-tag cl-feat">feature</span> | Keyboard shortcuts — 1-4 for answers, Enter to submit, H for hints |
| <span class="cl-tag cl-feat">feature</span> | Shareable decks with unique codes |
| <span class="cl-tag cl-feat">feature</span> | Text-to-speech for questions and explanations |
| <span class="cl-tag cl-feat">feature</span> | Data export as JSON or CSV |
| <span class="cl-tag cl-feat">feature</span> | Advanced analytics — weekly trends, hardest/strongest topics, activity heatmap |
| <span class="cl-tag cl-feat">feature</span> | Microsoft Learn documentation search integration |
| <span class="cl-tag cl-feat">feature</span> | Session persistence — save and resume interrupted sessions |
| <span class="cl-tag cl-feat">feature</span> | Achievement toast notifications with celebratory animation |
| <span class="cl-tag cl-feat">feature</span> | Session summary — question-by-question breakdown on results page |
| <span class="cl-tag cl-feat">feature</span> | Content quality scoring — warns when source page has limited content |
| <span class="cl-tag cl-feat">feature</span> | User friction telemetry — tracks hesitation and answer timing |
| <span class="cl-tag cl-feat">feature</span> | Anonymous-first flow — study without signing in, prompted after first session |
| <span class="cl-tag cl-feat">feature</span> | Question quality feedback — flag confusing or incorrect questions |
| <span class="cl-tag cl-feat">feature</span> | Profile page — achievements gallery, cert readiness, weakness reports, streak/XP display |
| <span class="cl-tag cl-feat">feature</span> | Cross-document synthesis — generate questions spanning multiple pages |
| <span class="cl-tag cl-feat">feature</span> | Knowledge decay modeling — estimates retention and surfaces stale topics |
| <span class="cl-tag cl-feat">feature</span> | Adaptive difficulty — adjusts based on per-difficulty accuracy history |
| <span class="cl-tag cl-fix">fix</span> | Robust answer resolution — handles letter, text, index, and partial match from AI responses |
| <span class="cl-tag cl-fix">fix</span> | Module exports moved to end of db.js to resolve constant hoisting error |
| <span class="cl-tag cl-fix">fix</span> | Learning path links auto-populate URL and start generating cards |
| <span class="cl-tag cl-infra">infra</span> | Test suite with Jest — health, auth, protected endpoints, proxy coverage |
| <span class="cl-tag cl-infra">infra</span> | Rate limiting on AI endpoints and general API |
| <span class="cl-tag cl-infra">infra</span> | In-memory response caching with TTL for expensive queries |
| <span class="cl-tag cl-design">design</span> | Settings page — 8 color themes, font size preference, study goals, daily challenge |
| <span class="cl-tag cl-design">design</span> | Leaderboard page with tier badges and XP rankings |

---

## v2.2.0 — 2026-04-10

Design system and UX polish.

| | |
|---|---|
| <span class="cl-tag cl-design">design</span> | Noise texture background, gold accent lines, deeper blacks, distinctive card treatments |
| <span class="cl-tag cl-design">design</span> | Feedback banners, running score counter, loading timer, keyboard hints |
| <span class="cl-tag cl-design">design</span> | Replaced all emoji icons with Lucide SVG icons for professional iconography |
| <span class="cl-tag cl-design">design</span> | Auth moved to side nav with avatar icon |

---

## v2.1.0 — 2026-04-09

Core platform with AI generation, auth, and score tracking.

| | |
|---|---|
| <span class="cl-tag cl-feat">feature</span> | AI-powered flash card generation from any Microsoft Learn URL |
| <span class="cl-tag cl-feat">feature</span> | User authentication — email/password signup and login with JWT sessions |
| <span class="cl-tag cl-feat">feature</span> | Score tracking with per-topic statistics |
| <span class="cl-tag cl-feat">feature</span> | Question deduplication — sends past questions to AI to avoid repeats |
| <span class="cl-tag cl-feat">feature</span> | Compare page — user performance vs global averages per topic |
| <span class="cl-tag cl-feat">feature</span> | Score history page with Chart.js visualizations and filter pills |
| <span class="cl-tag cl-feat">feature</span> | Recent topics quick-access cards |
| <span class="cl-tag cl-design">design</span> | Dark theme with Pittsburgh black and gold palette |
| <span class="cl-tag cl-design">design</span> | DM Sans + JetBrains Mono typography |
| <span class="cl-tag cl-design">design</span> | Slide animations replacing card flip, floating side nav |
| <span class="cl-tag cl-fix">fix</span> | Flash card generation — replaced dead CORS proxy with server-side fetch |
| <span class="cl-tag cl-fix">fix</span> | Card navigation — flipped class properly removed between cards |
| <span class="cl-tag cl-infra">infra</span> | Express server with security middleware and compression |
| <span class="cl-tag cl-infra">infra</span> | Cookie consent banner with category toggles |
| <span class="cl-tag cl-infra">infra</span> | Docker and docker-compose configuration |
| <span class="cl-tag cl-infra">infra</span> | CI/CD pipeline with GitHub Actions |

---

## v1.0.0 — 2026-04-09

Initial release.

| | |
|---|---|
| <span class="cl-tag cl-feat">feature</span> | Initial implementation — HTML, CSS, and JavaScript flash card application |
| <span class="cl-tag cl-infra">infra</span> | Repository created with base project structure |

---

<div align="center">
<sub>© 2026 JUSTINERICSNYDER.COM — Good Better Best</sub>
</div>
