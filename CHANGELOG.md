<div align="center">

# Changelog

**Good Better Best** — Release History

</div>

<style>
  /* Dark-mode ready — inherits from GitHub's native dark theme */
  .cl-entry { padding: 0.5em 0; border-bottom: 1px solid #30363d; }
  .cl-tag { display: inline-block; font-size: 0.7em; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; padding: 0.15em 0.5em; border-radius: 4px; vertical-align: middle; margin-right: 0.3em; }
  .cl-feat { background: rgba(245,197,24,0.15); color: #f5c518; }
  .cl-fix { background: rgba(52,211,153,0.15); color: #34d399; }
  .cl-design { background: rgba(129,140,248,0.15); color: #818cf8; }
  .cl-infra { background: rgba(148,163,184,0.15); color: #8b949e; }
  .cl-docs { background: rgba(14,165,233,0.15); color: #0ea5e9; }
  .cl-security { background: rgba(248,113,113,0.15); color: #f87171; }
</style>

---

## Unreleased — 2026-06-07

This changelog is now aligned with the current repository history and includes every PR-derived update available in the codebase.

| | |
|---|---|
| <span class="cl-tag cl-docs">docs</span> | Synchronized public changelog content with every repository PR and update. |
| <span class="cl-tag cl-fix">fix</span> | Added footer changelog access on the primary site for better visibility. |
| <span class="cl-tag cl-feat">feature</span> | Improved review sync messaging, due card counts, and auth token validation across sessions. |
| <span class="cl-tag cl-infra">infra</span> | Added token validation at page load to detect expired sessions and clear stale auth. |

---

## v2.5.0 — 2026-04-19

Documentation and architecture.

| | |
|---|---|
| <span class="cl-tag cl-docs">docs</span> | Added 7 Mermaid architecture diagrams to README — system overview, user flow, AI integration, ER data model, SM-2 flow, gamification pipeline, page map, deployment. |
| <span class="cl-tag cl-security">security</span> | Hardened README by removing endpoint maps, database schema details, package version lists, and deployment specifics. |
| <span class="cl-tag cl-docs">docs</span> | Rewrote README with an architecture overview, services table, and clean tech stack summary. |

---

## v2.4.0 — 2026-04-15

Certification skills extraction, hyperscaler themes, mobile hardening.

| | |
|---|---|
| <span class="cl-tag cl-feat">feature</span> | Added Skills Tested modal to extract exam code and fetch certification study guide details. |
| <span class="cl-tag cl-feat">feature</span> | Added study settings modal for card count, difficulty, and timer before starting a certification session. |
| <span class="cl-tag cl-feat">feature</span> | Included Applied Skills from Microsoft Catalog API with filtering by skill type. |
| <span class="cl-tag cl-feat">feature</span> | Added 6 hyperscaler themes with light and dark variants. |
| <span class="cl-tag cl-fix">fix</span> | Derived study guide URL from exam code pattern instead of broken href scraping. |
| <span class="cl-tag cl-fix">fix</span> | Removed sidebar max-height constraint so recent topics do not clip on desktop. |
| <span class="cl-tag cl-fix">fix</span> | Added responsive mobile layout fixes: single-column controls, fixed font scaling, stacking behavior, and a 240px narrow mode. |
| <span class="cl-tag cl-fix">fix</span> | Updated service worker auto-update logic so mobile clients refresh without manual reload. |

---

## v2.3.0 — 2026-04-13

Navigation overhaul, branding, dynamic certification catalog.

| | |
|---|---|
| <span class="cl-tag cl-feat">feature</span> | Added dynamic certification catalog with filtering by area, level, and certification type. |
| <span class="cl-tag cl-feat">feature</span> | Added certification goal system with personalized readiness scoring. |
| <span class="cl-tag cl-design">design</span> | Rebranded to "Good Better Best" with a custom logo, favicon, and new brand styling. |
| <span class="cl-tag cl-design">design</span> | Added icon-only sidebar navigation with hover popovers and grouped menu sections. |
| <span class="cl-tag cl-design">design</span> | Injected shared navigation across all pages for consistent experience. |
| <span class="cl-tag cl-design">design</span> | Implemented a mobile navigation layout with 4 primary tabs and a slide-up More menu. |
| <span class="cl-tag cl-design">design</span> | Added two-column desktop layout with pinned sidebar for recent topics. |
| <span class="cl-tag cl-design">design</span> | Added the GoPackGo theme and renamed the default theme to Hoist the Cone. |
| <span class="cl-tag cl-fix">fix</span> | Fixed achievement toasts so they only fire when new badges are earned. |
| <span class="cl-tag cl-fix">fix</span> | Fixed nav popover hover gap by adding an invisible padding bridge. |
| <span class="cl-tag cl-fix">fix</span> | Preserved theme persistence across all pages using early-load theme script. |
| <span class="cl-tag cl-fix">fix</span> | Rebuilt changelog with accurate entries and newest-first sorting. |
| <span class="cl-tag cl-fix">fix</span> | Limited recent topics display to 5 cards and normalized footer spacing. |
| <span class="cl-tag cl-infra">infra</span> | Switched service worker to network-first caching to prevent stale UI. |
| <span class="cl-tag cl-infra">infra</span> | Fixed CI builds to skip server.listen in test mode. |

---

## v2.2.0 — 2026-04-12

Gamification, AI coaching, spaced repetition, and advanced study workflows.

| | |
|---|---|
| <span class="cl-tag cl-feat">feature</span> | Added spaced repetition with the SM-2 algorithm, review page, and due card scheduling. |
| <span class="cl-tag cl-feat">feature</span> | Added 29 unlockable badges across milestones, streaks, performance, knowledge, and XP tiers. |
| <span class="cl-tag cl-feat">feature</span> | Added Socratic Mode conversational AI coaching with guided dialogue. |
| <span class="cl-tag cl-feat">feature</span> | Added AI-powered weakness reports analyzing wrong-answer patterns. |
| <span class="cl-tag cl-feat">feature</span> | Added AI certification readiness assessment and scoring. |
| <span class="cl-tag cl-feat">feature</span> | Added Teach-Back Mode for user explanations and AI evaluation. |
| <span class="cl-tag cl-feat">feature</span> | Added multiple question types: true/false, fill-in-the-blank, scenario, and multiple choice. |
| <span class="cl-tag cl-feat">feature</span> | Added streaks, XP, and tiered leaderboard rankings. |
| <span class="cl-tag cl-feat">feature</span> | Added daily challenges with themed topics and bonus XP. |
| <span class="cl-tag cl-feat">feature</span> | Added study goals for weekly and monthly session targets. |
| <span class="cl-tag cl-feat">feature</span> | Added hints system that removes two wrong answers on demand. |
| <span class="cl-tag cl-feat">feature</span> | Added timed mode for exam-style countdown practice. |
| <span class="cl-tag cl-feat">feature</span> | Added keyboard shortcuts and accessibility enhancements. |
| <span class="cl-tag cl-feat">feature</span> | Added shareable deck links and export to JSON/CSV. |
| <span class="cl-tag cl-feat">feature</span> | Added advanced analytics, weekly trends, hardest/strongest topics, and activity heatmap. |
| <span class="cl-tag cl-feat">feature</span> | Added Microsoft Learn search integration. |
| <span class="cl-tag cl-fix">fix</span> | Made answer scoring robust for letters, text, index, and partial matches from Claude responses. |
| <span class="cl-tag cl-infra">infra</span> | Added Jest tests for health, auth, protected endpoints, and proxy coverage. |
| <span class="cl-tag cl-infra">infra</span> | Added rate limiting and in-memory caching for expensive API queries. |
| <span class="cl-tag cl-design">design</span> | Added settings page with theme controls, font sizing, study goals, and daily challenge settings. |

---

## v2.1.0 — 2026-04-10

Design system and UX polish.

| | |
|---|---|
| <span class="cl-tag cl-design">design</span> | Added a noise texture background, gold accent lines, deeper blacks, and distinctive card treatments. |
| <span class="cl-tag cl-design">design</span> | Added feedback banners, running score counters, loading timers, and keyboard hints. |
| <span class="cl-tag cl-design">design</span> | Replaced emoji icons with Lucide SVG iconography. |
| <span class="cl-tag cl-design">design</span> | Moved auth to the side nav with avatar-style sign-in state. |

---

## v2.0.0 — 2026-04-09

Core platform with AI generation, auth, and score tracking.

| | |
|---|---|
| <span class="cl-tag cl-feat">feature</span> | AI-powered flash card generation from Microsoft Learn documentation. |
| <span class="cl-tag cl-feat">feature</span> | Email/password authentication with JWT sessions. |
| <span class="cl-tag cl-feat">feature</span> | Score tracking with per-topic stats and history. |
| <span class="cl-tag cl-feat">feature</span> | Question deduplication by sending past questions to AI. |
| <span class="cl-tag cl-feat">feature</span> | Compare page for user performance vs. global averages per topic. |
| <span class="cl-tag cl-feat">feature</span> | Score history page with interactive charts and filter pills. |
| <span class="cl-tag cl-feat">feature</span> | Recent topics quick access cards. |
| <span class="cl-tag cl-design">design</span> | Dark theme with Pittsburgh black and gold palette. |
| <span class="cl-tag cl-design">design</span> | DM Sans and JetBrains Mono typography. |

---

## Complete PR history

Below is the complete repository PR history pulled from repo commit summaries.

- P01: Anonymous-first flow — study without signing in, prompt account creation after first session.
- P02: Question quality feedback — flag confusing, wrong, or irrelevant questions.
- P03: AI-powered personalized weakness reports using Claude analysis of wrong-answer patterns.
- P04: AI-powered certification readiness scoring with Claude assessment.
- P05: Socratic Mode — conversational AI coaching with Claude dialogue.
- P06: Scenario-based learning — workplace scenarios included in the question mix.
- P07: Curated learning paths for AZ-900, AI-900, SC-900, MS-900 certifications.
- P08: Session persistence — save and resume interrupted sessions via local storage.
- P09: Achievement toast notifications with celebratory animations.
- P10: Session summary — question-by-question breakdown on the results page.
- P11: User friction telemetry — track hesitation, abandonment, answer timing.
- P12: Content quality scoring — warn users when source page content is too shallow.
- P13-P22: Adaptive learning, retention tracking, teach-back mode, cross-document synthesis, difficulty calibration, search UI, share/export UI.
- P23-P50: Hints, timed mode, keyboard shortcuts, haptic feedback, daily challenges, study goals, leaderboard tiers, knowledge decay, CI/CD, rate limiting, and caching.

---
