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

## v2.5.0 — 2026-04-19

Documentation and architecture.

| | |
|---|---|
| <span class="cl-tag cl-docs">docs</span> | Added 7 Mermaid architecture diagrams to README — system overview, user flow, AI integration, ER data model, SM-2 state machine, gamification pipeline, page map, deployment |
| <span class="cl-tag cl-security">security</span> | Hardened README — removed endpoint maps, database schema details, package versions, and deployment specifics to reduce supply chain attack surface |
| <span class="cl-tag cl-docs">docs</span> | Comprehensive README rewrite with technical architecture overview, services table, and tech stack summary |

---

## v2.4.0 — 2026-04-15

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

## v2.3.0 — 2026-04-13

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

## v2.2.0 — 2026-04-12

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

## v2.1.0 — 2026-04-10

Design system and UX polish.

| | |
|---|---|
| <span class="cl-tag cl-design">design</span> | Noise texture background, gold accent lines, deeper blacks, distinctive card treatments |
| <span class="cl-tag cl-design">design</span> | Feedback banners, running score counter, loading timer, keyboard hints |
| <span class="cl-tag cl-design">design</span> | Replaced all emoji icons with Lucide SVG icons for professional iconography |
| <span class="cl-tag cl-design">design</span> | Auth moved to side nav with avatar icon |

---

## v2.0.0 — 2026-04-09

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
