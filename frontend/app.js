// API base URL — set to Railway backend in production
const API_BASE = window.__API_BASE__ || '';

class FlashCardApp {
    constructor() {
        this.flashCards = [];
        this.currentCardIndex = 0;
        this.correctAnswers = 0;
        this.incorrectAnswers = 0;
        this.selectedChoice = null;
        this.answered = false;
        this.isAnimating = false;

        this.initializeEventListeners();
        this.initializeKeyboardNavigation();
        this.initializeAnimations();
        this.loadRecentTopics();
        this.loadReviewBanner();
        this.checkSavedSession();
        this.initTelemetry();
        this.handleUrlParam();
    }

    handleUrlParam() {
        const params = new URLSearchParams(window.location.search);
        const url = params.get('url');
        const deckCode = params.get('deck');

        if (deckCode) {
            window.history.replaceState({}, '', '/');
            this.loadSharedDeck(deckCode);
            return;
        }

        if (url) {
            const input = document.getElementById('doc-url');
            if (input) {
                input.value = url;
                setTimeout(() => this.generateCards(), 500);
            }
            window.history.replaceState({}, '', '/');
        }
    }

    async loadSharedDeck(code) {
        try {
            const res = await fetch(`${API_BASE}/api/decks/${code}`);
            if (!res.ok) { this.showError('Shared deck not found'); return; }
            const deck = await res.json();
            const cards = typeof deck.cards === 'string' ? JSON.parse(deck.cards) : deck.cards;
            if (!cards?.length) { this.showError('Shared deck is empty'); return; }
            this.flashCards = cards;
            this.currentPageTitle = deck.page_title || 'Shared Deck';
            if (deck.url) document.getElementById('doc-url').value = deck.url;
            this.startFlashCardSession();
        } catch { this.showError('Could not load shared deck'); }
    }

    initTelemetry() {
        this._choiceShownAt = null;
        this._clickTimes = [];

        // Track page unload during active session
        window.addEventListener('beforeunload', () => {
            if (this.flashCards.length > 0 && this.currentCardIndex < this.flashCards.length - 1) {
                this.trackEvent('session_abandon', {
                    cardIndex: this.currentCardIndex,
                    totalCards: this.flashCards.length,
                    correct: this.correctAnswers,
                    incorrect: this.incorrectAnswers,
                });
            }
        });
    }

    trackEvent(eventType, eventData) {
        const url = document.getElementById('doc-url')?.value?.trim();
        const headers = { 'Content-Type': 'application/json', ...(Auth.isLoggedIn() ? Auth.authHeaders() : {}) };
        fetch(`${API_BASE}/api/telemetry`, {
            method: 'POST', headers,
            body: JSON.stringify({ eventType, eventData, url }),
        }).catch(() => {});
    }

    saveSessionState() {
        try {
            const state = {
                flashCards: this.flashCards,
                currentCardIndex: this.currentCardIndex,
                correctAnswers: this.correctAnswers,
                incorrectAnswers: this.incorrectAnswers,
                pageTitle: this.currentPageTitle,
                url: document.getElementById('doc-url')?.value || '',
                timestamp: Date.now(),
            };
            localStorage.setItem('fc_session', JSON.stringify(state));
        } catch {}
    }

    clearSavedSession() {
        localStorage.removeItem('fc_session');
    }

    checkSavedSession() {
        try {
            const raw = localStorage.getItem('fc_session');
            if (!raw) return;
            const state = JSON.parse(raw);
            // Only offer resume if session is less than 2 hours old and has cards
            if (!state.flashCards?.length || Date.now() - state.timestamp > 7200000) {
                this.clearSavedSession();
                return;
            }
            // Show resume banner
            const container = document.getElementById('recent-topics');
            if (!container) return;
            const banner = document.createElement('div');
            banner.className = 'resume-banner';
            banner.innerHTML = `
                <div class="resume-banner-content">
                    <strong>Resume your session?</strong>
                    <span>${state.pageTitle || 'Previous session'} — Card ${state.currentCardIndex + 1} of ${state.flashCards.length}</span>
                </div>
                <div class="resume-banner-actions">
                    <button class="btn btn-primary" id="resume-yes">Resume</button>
                    <button class="btn btn-secondary" id="resume-no">Discard</button>
                </div>
            `;
            container.parentElement.insertBefore(banner, container);

            banner.querySelector('#resume-yes').addEventListener('click', () => {
                this.flashCards = state.flashCards;
                this.currentCardIndex = state.currentCardIndex;
                this.correctAnswers = state.correctAnswers;
                this.incorrectAnswers = state.incorrectAnswers;
                this.currentPageTitle = state.pageTitle;
                if (state.url) document.getElementById('doc-url').value = state.url;
                banner.remove();
                this.animateSectionTransition('flashcard-section');
                this.displayCurrentCard();
                this.updateProgress();
                const rc = document.getElementById('running-correct');
                const rw = document.getElementById('running-wrong');
                if (rc) rc.textContent = `✓ ${this.correctAnswers}`;
                if (rw) rw.textContent = `✗ ${this.incorrectAnswers}`;
            });

            banner.querySelector('#resume-no').addEventListener('click', () => {
                this.clearSavedSession();
                banner.style.opacity = '0';
                setTimeout(() => banner.remove(), 200);
            });
        } catch { this.clearSavedSession(); }
    }

    initializeEventListeners() {
        // Form submission
        document.getElementById('generate-cards').addEventListener('click', (e) => {
            e.preventDefault();
            this.generateCards();
        });

        // Card interactions
        document.getElementById('submit-answer').addEventListener('click', () => this.submitAnswer());
        document.getElementById('next-question').addEventListener('click', () => this.nextCard());
        document.getElementById('prev-card').addEventListener('click', () => this.previousCard());
        document.getElementById('next-card').addEventListener('click', () => this.nextCard());
        document.getElementById('restart').addEventListener('click', () => this.restartSession());
        document.getElementById('new-session').addEventListener('click', () => this.newSession());
        document.getElementById('share-results').addEventListener('click', () => this.shareResults());
        document.getElementById('share-deck-btn')?.addEventListener('click', () => this.shareDeck());
        document.getElementById('export-json-btn')?.addEventListener('click', () => this.exportData());
        document.getElementById('search-btn')?.addEventListener('click', () => this.searchDocs());
        document.getElementById('doc-search')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); this.searchDocs(); } });
        document.getElementById('hint-btn')?.addEventListener('click', () => this.useHint());

        // Choice selection
        document.addEventListener('click', (e) => {
            if (e.target.closest('.choice') && !this.answered && !this.isAnimating) {
                this.selectChoice(e.target.closest('.choice'));
            }
        });

        // Keyboard navigation
        document.addEventListener('keydown', (e) => this.handleKeydown(e));

        // Text-to-speech
        document.getElementById('tts-question')?.addEventListener('click', () => this.speakText());
        document.getElementById('tts-explanation')?.addEventListener('click', () => this.speakText(document.getElementById('explanation-text')?.textContent));

        // Flag question
        document.getElementById('flag-question')?.addEventListener('click', () => this.flagQuestion());
    }

    // ── Hint System ─────────────────────────────────────────
    useHint() {
        if (this.answered || !this.flashCards.length) return;
        const card = this.flashCards[this.currentCardIndex];
        const norm = card._normalized;
        if (!norm) return;

        // Eliminate two wrong answers
        const correctLetter = norm.correctAnswer;
        const wrongChoices = document.querySelectorAll('.choice:not(.selected)');
        let eliminated = 0;
        wrongChoices.forEach(el => {
            if (el.dataset.choice !== correctLetter && eliminated < 2 && !el.classList.contains('hint-eliminated')) {
                el.classList.add('hint-eliminated');
                el.style.opacity = '0.2';
                el.style.pointerEvents = 'none';
                eliminated++;
            }
        });

        // Disable hint button after use
        const btn = document.getElementById('hint-btn');
        if (btn) { btn.disabled = true; btn.style.opacity = '0.3'; }
        this.trackEvent('hint_used', { cardIndex: this.currentCardIndex });
    }

    // ── Timer System ────────────────────────────────────────
    startTimer() {
        const timerSec = parseInt(document.getElementById('timer-mode')?.value || '0');
        if (timerSec <= 0) return;

        this._timerRemaining = timerSec;
        const timerEl = document.getElementById('session-timer');
        if (timerEl) { timerEl.classList.remove('hidden'); timerEl.textContent = `${timerSec}s`; }

        this._timerInterval = setInterval(() => {
            this._timerRemaining--;
            if (timerEl) {
                timerEl.textContent = `${this._timerRemaining}s`;
                if (this._timerRemaining <= 10) timerEl.style.color = 'var(--error)';
                else timerEl.style.color = '';
            }
            if (this._timerRemaining <= 0) {
                clearInterval(this._timerInterval);
                if (!this.answered) {
                    // Auto-submit if time runs out
                    if (this.selectedChoice) this.submitAnswer();
                    else this.nextCard(); // Skip if nothing selected
                }
            }
        }, 1000);
    }

    stopTimer() {
        if (this._timerInterval) clearInterval(this._timerInterval);
        const timerEl = document.getElementById('session-timer');
        if (timerEl) { timerEl.classList.add('hidden'); timerEl.style.color = ''; }
    }

    // ── Haptic Feedback ─────────────────────────────────────
    haptic(type) {
        if (!navigator.vibrate) return;
        if (type === 'correct') navigator.vibrate(50);
        else if (type === 'wrong') navigator.vibrate([50, 50, 50]);
        else navigator.vibrate(20);
    }

    // ── Smart Retry ─────────────────────────────────────────
    async fetchWithRetry(url, options, retries = 3) {
        for (let i = 0; i < retries; i++) {
            try {
                const res = await fetch(url, options);
                if (res.ok || res.status < 500) return res;
            } catch (err) {
                if (i === retries - 1) throw err;
            }
            await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
        }
    }

    // ── Keyboard Shortcuts Modal ────────────────────────────
    showKeyboardHelp() {
        const existing = document.getElementById('kb-help-overlay');
        if (existing) { existing.remove(); return; }

        const overlay = document.createElement('div');
        overlay.id = 'kb-help-overlay';
        overlay.className = 'kb-help-overlay';
        overlay.innerHTML = `
            <div class="kb-help-modal">
                <div class="kb-help-header">
                    <h3>Keyboard Shortcuts</h3>
                    <button class="kb-help-close">&times;</button>
                </div>
                <div class="kb-help-grid">
                    <div class="kb-row"><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd><kbd>4</kbd><span>Select answer</span></div>
                    <div class="kb-row"><kbd>Enter</kbd><span>Submit / Next</span></div>
                    <div class="kb-row"><kbd>→</kbd><span>Next card</span></div>
                    <div class="kb-row"><kbd>H</kbd><span>Use hint</span></div>
                    <div class="kb-row"><kbd>?</kbd><span>Toggle this help</span></div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('visible'));
        overlay.querySelector('.kb-help-close').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    }

    initializeKeyboardNavigation() {
        const card = this.flashCards[this.currentCardIndex];
        if (!card) return;
        const norm = card._normalized || { question: card.question };
        const url = document.getElementById('doc-url').value.trim();

        // Show flag options
        const btn = document.getElementById('flag-question');
        if (btn.classList.contains('flagged')) return;

        const types = ['Confusing wording', 'Wrong answer', 'Not relevant', 'Too easy', 'Too hard'];
        const menu = document.createElement('div');
        menu.className = 'flag-menu';
        menu.innerHTML = types.map(t => `<button class="flag-option">${t}</button>`).join('');
        btn.parentElement.appendChild(menu);
        requestAnimationFrame(() => menu.classList.add('visible'));

        menu.addEventListener('click', async (e) => {
            const opt = e.target.closest('.flag-option');
            if (!opt) return;
            menu.remove();
            btn.classList.add('flagged');
            btn.style.color = 'var(--warning)';

            try {
                await (Auth.isLoggedIn() ? Auth.apiFetch : fetch)(`${API_BASE}/api/question-feedback`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...Auth.authHeaders() },
                    body: JSON.stringify({ question: norm.question, url, feedbackType: opt.textContent }),
                });
            } catch {}
        });

        // Close on outside click
        const close = (e) => { if (!menu.contains(e.target) && e.target !== btn) { menu.remove(); document.removeEventListener('click', close); } };
        setTimeout(() => document.addEventListener('click', close), 10);
    }

    speakText(textOverride) {
        if (!('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel();
        const text = textOverride || document.getElementById('question-text')?.textContent;
        if (!text) return;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 1;
        window.speechSynthesis.speak(utterance);
    }

    initializeKeyboardNavigation() {
        // Make choices focusable and navigable
        const choices = document.querySelectorAll('.choice');
        choices.forEach((choice, index) => {
            choice.setAttribute('tabindex', '0');
            choice.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (!this.answered && !this.isAnimating) {
                        this.selectChoice(choice);
                    }
                }
            });
        });
    }

    initializeAnimations() {
        // Add intersection observer for scroll animations
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.animationDelay = '0s';
                    entry.target.style.animationPlayState = 'running';
                }
            });
        }, { threshold: 0.1 });

        // Observe sections for animation
        document.querySelectorAll('.section').forEach(section => {
            observer.observe(section);
        });
    }

    async loadRecentTopics() {
        if (!Auth.isLoggedIn()) return;
        const container = document.getElementById('recent-topics');
        if (!container) return;
        try {
            const res = await Auth.apiFetch(`${API_BASE}/api/recent-topics`);
            if (!res.ok) return;
            const topics = await res.json();
            if (!topics || topics.length === 0) return;

            const scoreClass = pct => pct >= 80 ? 'color:var(--success)' : pct >= 50 ? 'color:var(--warning)' : 'color:var(--error)';

            container.innerHTML = `
                <div class="recent-topics-title">Recent Topics</div>
                <div class="recent-topics-grid">
                    ${topics.map(t => `
                        <div class="recent-topic-card" data-url="${t.url}" title="${t.page_title}">
                            <div class="recent-topic-info">
                                <span class="recent-topic-name">${t.page_title}</span>
                                <span class="recent-topic-meta">${t.sessions} session${t.sessions > 1 ? 's' : ''}</span>
                            </div>
                            <span class="recent-topic-score" style="${scoreClass(Number(t.avg_score))}">${t.avg_score}%</span>
                        </div>
                    `).join('')}
                </div>
            `;

            // Click handler — fill the URL input
            container.addEventListener('click', e => {
                const card = e.target.closest('.recent-topic-card');
                if (!card) return;
                document.getElementById('doc-url').value = card.dataset.url;
                document.getElementById('doc-url').focus();
            });
        } catch (err) {
            console.warn('Could not load recent topics:', err);
        }
    }

    async loadReviewBanner() {
        if (!Auth.isLoggedIn()) return;
        const banner = document.getElementById('review-banner');
        if (!banner) return;
        try {
            const res = await Auth.apiFetch(`${API_BASE}/api/reviews/stats`);
            if (!res.ok) return;
            const stats = await res.json();
            const due = Number(stats.due_now || 0);
            if (due === 0) return;

            banner.classList.remove('hidden');
            banner.innerHTML = `
                <a href="/review.html" class="review-banner-link">
                    <div class="review-banner-left">
                        <i data-lucide="brain" class="review-banner-icon"></i>
                        <div>
                            <span class="review-banner-title">${due} card${due !== 1 ? 's' : ''} due for review</span>
                            <span class="review-banner-sub">Spaced repetition keeps knowledge fresh</span>
                        </div>
                    </div>
                    <span class="review-banner-action">Review now →</span>
                </a>
            `;
            if (typeof lucide !== 'undefined') lucide.createIcons();
        } catch (err) {
            console.warn('Could not load review stats:', err);
        }
    }

    handleKeydown(e) {
        if (e.key === '?' || (e.key === '/' && e.shiftKey)) { this.showKeyboardHelp(); return; }
        if (e.key === 'h' || e.key === 'H') { if (!this.answered) this.useHint(); return; }
        if (e.key === 'Enter') {
            e.preventDefault();
            if (this.answered && !this.isAnimating) {
                this.nextCard();
            } else if (this.selectedChoice && !this.answered) {
                this.submitAnswer();
            }
            return;
        }
        if (e.key === 'ArrowRight') {
            if (this.answered) {
                this.nextCard();
            } else if (this.selectedChoice) {
                this.submitAnswer();
            }
        } else if (e.key >= '1' && e.key <= '4' && !this.answered && !this.isAnimating) {
            const choices = document.querySelectorAll('.choice');
            const index = parseInt(e.key) - 1;
            if (choices[index]) {
                this.selectChoice(choices[index]);
            }
        }
    }

    // ── Fetching & Parsing ──────────────────────────────────────────────

    async fetchDocContent(url) {
        // Use our own server-side proxy to fetch the page HTML
        const proxyUrl = `${API_BASE}/api/fetch-page?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error(`Failed to fetch page (${response.status})`);
        return await response.text();
    }

    parseDocContent(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Microsoft Learn: use <main> as the content root.
        // Avoid narrower selectors like 'main .content' which may only wrap the title.
        const main = doc.querySelector('main')
            || doc.querySelector('[role="main"]')
            || doc.querySelector('#main-column')
            || doc.body;

        // Aggressively strip non-content elements
        const removeSelectors = [
            'nav', 'footer', 'aside', 'header',
            'script', 'style', 'noscript', 'iframe',
            '.metadata', '.feedback-section', '.contributors-section',
            '.breadcrumb', '.breadcrumbs', '[aria-label="Breadcrumb"]',
            '.table-of-contents', '#table-of-contents', '.toc',
            '.action-bar', '.page-actions', '.page-action-holder',
            '.content-header', '.content-header-controls',
            '.rating', '.rating-section', '.thumbs-rating',
            '.alert', '.note-title',
            '.related-content', '.recommendations', '.next-steps-section',
            '.sidebar', '.side-nav', '.left-nav',
            '.sign-in', '.profile-section',
            '.download-pdf', '.pdf-download',
            '.social-share', '.share-section',
            '.cookie-banner', '.consent-banner',
            '[role="navigation"]', '[role="banner"]', '[role="complementary"]',
            '[aria-hidden="true"]',
            '.visually-hidden', '.sr-only',
            'button', 'input', 'select', 'form',
            '#ms--additional-content', '#ms--content-well-notifications',
            '.page-metadata-container',
            '#article-header',
            '.feedback-verbatim', '.feedback-report',
        ];
        main.querySelectorAll(removeSelectors.join(', '))
            .forEach(el => el.remove());

        // Patterns that indicate UI/navigation text rather than content
        const uiPatterns = /^(sign in|log in|sign up|download|pdf|share|feedback|edit|view|copy|more|previous|next|skip|close|open|expand|collapse|show|hide|yes|no|submit|cancel|save|delete|search|filter|sort|menu|home|back|forward|print|subscribe|follow|like|dislike|report|flag|bookmark|table of contents|in this article|on this page|tip|note|important|warning|caution|try it|learn more|see also|related|additional resources|was this page helpful|choose a language|version|applies to|contributors|article|min read|\d+ minutes?|this browser is no longer|upgrade to microsoft edge|access to this page requires|need help with this topic|want to try using ask learn)/i;

        // Extract structured sections from headings and paragraphs only
        const sections = [];
        let currentSection = null;

        for (const el of main.querySelectorAll('h1, h2, h3, p, li')) {
            const tag = el.tagName.toLowerCase();
            const text = el.textContent.trim().replace(/\s+/g, ' ');
            if (!text) continue;

            if (['h1', 'h2', 'h3'].includes(tag)) {
                // Skip headings that look like UI labels
                if (text.length < 5 || text.length > 150 || uiPatterns.test(text)) continue;

                if (currentSection && currentSection.content.length > 0) {
                    sections.push(currentSection);
                }
                currentSection = { heading: text, content: [] };
            } else {
                if (!currentSection) currentSection = { heading: 'Overview', content: [] };

                // Only keep substantive content sentences
                if (text.length > 25 && text.length < 500
                    && !uiPatterns.test(text)
                    && !currentSection.content.includes(text)
                    // Must contain at least a few real words (not just code/symbols)
                    && (text.match(/[a-zA-Z]/g) || []).length > text.length * 0.4) {
                    currentSection.content.push(text);
                }
            }
        }
        if (currentSection && currentSection.content.length > 0) {
            sections.push(currentSection);
        }

        // Keep sections with real content
        return sections.filter(s => s.content.length >= 1);
    }

    // ── Card Generation from Real Content ───────────────────────────────

    generateCardsFromContent(sections, count, difficulty) {
        const cards = [];
        const usable = sections.filter(s => s.content.length >= 2);
        if (usable.length === 0) return cards;

        const shuffled = this.shuffle([...usable]);

        // First pass: fill-in-the-blank style from key sentences
        for (const section of shuffled) {
            if (cards.length >= count) break;
            const card = this.buildContentCard(section, sections, difficulty);
            if (card) cards.push(card);
        }

        // Second pass: true/false-style "which statement is true" cards
        if (cards.length < count) {
            for (const section of shuffled) {
                if (cards.length >= count) break;
                const card = this.buildTrueFalseCard(section, sections, difficulty);
                if (card && !cards.find(c => c.question === card.question)) {
                    cards.push(card);
                }
            }
        }

        return cards.slice(0, count);
    }

    buildContentCard(section, allSections, difficulty) {
        const sentences = this.extractSentences(section.content.join(' '));
        if (sentences.length < 1) return null;

        // Pick the most informative sentence (longer ones tend to have more substance)
        const ranked = [...sentences].sort((a, b) => b.length - a.length);
        const keySentence = ranked[0];

        // Extract a key fact from the sentence to blank out and use as the answer
        const correctAnswer = keySentence;

        // Build a question that references the actual topic
        const question = this.buildQuestionFromContent(section.heading, keySentence, difficulty);

        // Generate distractors from OTHER sections' content (not the same section)
        const otherSections = allSections.filter(s => s.heading !== section.heading);
        const distractors = this.generateContentDistractors(correctAnswer, otherSections, section.heading);

        const correctIndex = Math.floor(Math.random() * 4);
        const choices = [...distractors.slice(0, 3)];
        choices.splice(correctIndex, 0, correctAnswer);
        const letters = ['A', 'B', 'C', 'D'];

        return {
            question,
            choices: choices.slice(0, 4),
            correctAnswer: letters[correctIndex],
            explanation: `From the "${section.heading}" section: ${section.content.join(' ')}`
        };
    }

    buildTrueFalseCard(section, allSections, difficulty) {
        if (section.content.length < 1) return null;

        const sentences = this.extractSentences(section.content.join(' '));
        if (sentences.length < 1) return null;

        const correctSentence = sentences.length > 1 ? sentences[1] : sentences[0];
        const correctAnswer = correctSentence;

        const question = `Which of the following statements about "${section.heading}" is accurate based on the documentation?`;

        const otherSections = allSections.filter(s => s.heading !== section.heading);
        const distractors = this.generateContentDistractors(correctAnswer, otherSections, section.heading);

        const correctIndex = Math.floor(Math.random() * 4);
        const choices = [...distractors.slice(0, 3)];
        choices.splice(correctIndex, 0, correctAnswer);
        const letters = ['A', 'B', 'C', 'D'];

        return {
            question,
            choices: choices.slice(0, 4),
            correctAnswer: letters[correctIndex],
            explanation: `From the "${section.heading}" section: ${section.content.join(' ')}`
        };
    }

    buildQuestionFromContent(heading, keySentence, difficulty) {
        // Try to extract the subject/topic from the sentence for a more targeted question
        const templates = {
            beginner: [
                `Based on the documentation, what does "${heading}" describe?`,
                `Which of the following correctly explains "${heading}"?`,
                `What is the key point about "${heading}" from the documentation?`,
            ],
            intermediate: [
                `According to the documentation, which statement about "${heading}" is correct?`,
                `What does the documentation state about "${heading}"?`,
                `Which of the following accurately describes "${heading}"?`,
            ],
            advanced: [
                `Based on the documentation for "${heading}", which technical detail is accurate?`,
                `Which of the following is a documented characteristic of "${heading}"?`,
                `What specific detail does the documentation provide about "${heading}"?`,
            ]
        };
        const pool = templates[difficulty] || templates.intermediate;
        return pool[Math.floor(Math.random() * pool.length)];
    }

    generateContentDistractors(correctAnswer, otherSections, heading) {
        const distractors = [];

        // Pull real sentences from OTHER sections as plausible but wrong answers
        for (const section of this.shuffle([...otherSections])) {
            for (const line of section.content) {
                const trimmed = line;
                if (trimmed !== correctAnswer
                    && trimmed.length > 30
                    && !distractors.includes(trimmed)) {
                    distractors.push(trimmed);
                }
                if (distractors.length >= 5) break;
            }
            if (distractors.length >= 5) break;
        }

        // Only use filler as a last resort if we couldn't get enough from real content
        if (distractors.length < 3) {
            const fillers = [
                `${heading} is deprecated and no longer recommended for production use`,
                `${heading} can only be used with on-premises infrastructure`,
                `${heading} requires a separate paid license for each user`,
                `${heading} is only available in the US East region`,
                `${heading} does not support integration with third-party services`,
                `${heading} is limited to a single instance per subscription`
            ];
            this.shuffle(fillers);
            for (const f of fillers) {
                if (distractors.length >= 5) break;
                distractors.push(f);
            }
        }

        return this.shuffle(distractors).slice(0, 3);
    }

    // ── Helpers ─────────────────────────────────────────────────────────

    resolveCorrectLetter(answer, choices) {
        // If it's already a letter (A, B, C, D), use it
        const letters = ['A', 'B', 'C', 'D'];
        if (letters.includes(answer)) return answer;

        // If it's the text of a choice, find the matching letter
        const idx = choices.findIndex(c => c === answer || c.trim().toLowerCase() === String(answer).trim().toLowerCase());
        if (idx >= 0) return letters[idx];

        // If it's a number (0-3), convert to letter
        const num = parseInt(answer);
        if (num >= 0 && num <= 3) return letters[num];

        // Fallback: try partial match
        const partial = choices.findIndex(c => c && String(answer) && c.toLowerCase().includes(String(answer).toLowerCase().substring(0, 20)));
        if (partial >= 0) return letters[partial];

        return 'A'; // Last resort fallback
    }

    extractSentences(text) {
        return text
            .split(/(?<=[.!?])\s+/)
            .map(s => s.trim())
            .filter(s => s.length > 25 && s.length < 250);
    }

    trimToLength(text, max) {
        if (text.length <= max) return text;
        return text.substring(0, max - 1).replace(/\s+\S*$/, '') + '…';
    }

    shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    // ── Main Flow ───────────────────────────────────────────────────────

    async generateCards() {
        const url = document.getElementById('doc-url').value.trim();
        const cardCount = parseInt(document.getElementById('card-count').value);
        const difficulty = document.getElementById('difficulty').value;

        if (!url) {
            this.showError('Please enter a Microsoft Learn documentation URL');
            return;
        }

        if (!url.includes('microsoft.com') && !url.includes('learn.microsoft.com')) {
            this.showError('Please enter a valid Microsoft Learn or Microsoft Docs URL');
            return;
        }

        // Show loading state
        const genBtn = document.getElementById('generate-cards');
        genBtn.classList.add('is-loading');
        genBtn.textContent = 'Generating...';

        this.animateSectionTransition('loading-section');
        this.updateLoadingSteps(1);

        // Start loading timer
        let elapsed = 0;
        const timerEl = document.getElementById('loading-timer');
        const timerInterval = setInterval(() => {
            elapsed++;
            if (timerEl) timerEl.textContent = `${elapsed}s`;
        }, 1000);

        try {
            this.updateLoadingSteps(1);

            const html = await this.fetchDocContent(url);

            this.updateLoadingSteps(2);

            const sections = this.parseDocContent(html);

            const parser = new DOMParser();
            const titleDoc = parser.parseFromString(html, 'text/html');
            const h1 = titleDoc.querySelector('h1');
            this.currentPageTitle = h1 ? h1.textContent.trim() : url;

            if (sections.length === 0) {
                throw new Error('Could not extract content from the page. Try a different URL.');
            }

            // Content quality scoring
            const totalContent = sections.reduce((sum, s) => sum + s.content.join(' ').length, 0);
            const qualityScore = Math.min(100, Math.round((sections.length * 15) + (totalContent / 50)));
            if (qualityScore < 30) {
                this.showContentWarning('This page has limited content. Questions may be less varied.');
            }

            this.updateLoadingSteps(3);

            const response = await Auth.apiFetch(`${API_BASE}/api/generate-cards`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sections, count: cardCount, difficulty, url }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to generate cards');
            }

            this.flashCards = data.cards;

            if (!this.flashCards || this.flashCards.length === 0) {
                throw new Error('AI could not generate flash cards from this content. Try a different URL.');
            }

            this.updateLoadingSteps(4);
            clearInterval(timerInterval);
            setTimeout(() => this.startFlashCardSession(), 500);

        } catch (error) {
            clearInterval(timerInterval);
            console.error('Error generating cards:', error);
            this.showError(error.message || 'Failed to generate flash cards. Please try a different URL.');
            this.animateSectionTransition('setup-section');
            genBtn.classList.remove('is-loading');
            genBtn.textContent = 'Generate Flash Cards';
        }
    }

    updateLoadingSteps(step) {
        const steps = document.querySelectorAll('.step');
        steps.forEach((stepEl, index) => {
            if (index + 1 <= step) {
                stepEl.classList.add('active');
            } else {
                stepEl.classList.remove('active');
            }
        });
    }

    showContentWarning(message) {
        const toast = document.createElement('div');
        toast.className = 'content-warning';
        toast.innerHTML = `<i data-lucide="alert-triangle" style="width:14px;height:14px;stroke:var(--warning);flex-shrink:0"></i> <span>${message}</span>`;
        const loading = document.querySelector('.loading');
        if (loading) loading.appendChild(toast);
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    showError(message) {
        // Create error toast
        const toast = document.createElement('div');
        toast.className = 'error-toast';
        toast.innerHTML = `
            <div class="error-content">
                <span class="error-icon">⚠️</span>
                <span class="error-message">${message}</span>
                <button class="error-close" aria-label="Close error">&times;</button>
            </div>
        `;

        document.body.appendChild(toast);

        // Animate in
        setTimeout(() => toast.classList.add('show'), 10);

        // Auto remove after 5 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 5000);

        // Close button
        toast.querySelector('.error-close').addEventListener('click', () => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        });
    }

    // ── Session & Card Display ──────────────────────────────────────────

    startFlashCardSession() {
        this.currentCardIndex = 0;
        this.correctAnswers = 0;
        this.incorrectAnswers = 0;
        this.selectedChoice = null;
        this.answered = false;
        this.questionResults = []; // Track each question result

        // Save session to localStorage for resume
        this.saveSessionState();

        // Reset generate button
        const genBtn = document.getElementById('generate-cards');
        if (genBtn) { genBtn.classList.remove('is-loading'); genBtn.textContent = 'Generate Flash Cards'; }

        // Reset running stats
        const rc = document.getElementById('running-correct');
        const rw = document.getElementById('running-wrong');
        if (rc) rc.textContent = '✓ 0';
        if (rw) rw.textContent = '✗ 0';

        this.animateSectionTransition('flashcard-section');
        this.displayCurrentCard();
        this.updateProgress();
    }

    displayCurrentCard() {
        if (this.isAnimating) return;
        this.isAnimating = true;

        const card = this.flashCards[this.currentCardIndex];
        const flashcard = document.querySelector('.flashcard');

        // Slide out
        flashcard.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
        flashcard.style.opacity = '0';
        flashcard.style.transform = 'translateY(8px) scale(0.98)';

        setTimeout(() => {
            const card = this.flashCards[this.currentCardIndex];

            // Normalize card into question + choices format
            let questionText, choices, correctLetter;
            const type = card.type || 'multiple_choice';

            if (type === 'true_false') {
                questionText = `True or False: ${card.statement}`;
                choices = ['True', 'False', '', ''];
                correctLetter = card.isTrue ? 'A' : 'B';
                card._normalized = { question: questionText, choices: ['True', 'False'], correctAnswer: correctLetter };
            } else if (type === 'fill_blank') {
                questionText = `Fill in the blank: ${card.sentence}`;
                choices = card.choices.slice(0, 4);
                while (choices.length < 4) choices.push('');
                correctLetter = this.resolveCorrectLetter(card.correctAnswer, choices);
                card._normalized = { question: questionText, choices, correctAnswer: correctLetter };
            } else if (type === 'scenario') {
                questionText = `${card.scenario}\n\n${card.question}`;
                choices = card.choices.slice(0, 4);
                correctLetter = this.resolveCorrectLetter(card.correctAnswer, choices);
                card._normalized = { question: questionText, choices, correctAnswer: correctLetter };
            } else {
                questionText = card.question;
                choices = card.choices || [];
                correctLetter = this.resolveCorrectLetter(card.correctAnswer, choices);
                card._normalized = { question: questionText, choices, correctAnswer: correctLetter };
            }

            // Show card type badge
            const typeLabels = { multiple_choice: 'Multiple Choice', true_false: 'True / False', fill_blank: 'Fill in the Blank', scenario: 'Scenario' };
            const h3 = document.querySelector('.card-content h3');
            if (h3) h3.textContent = typeLabels[type] || 'Question';

            document.getElementById('question-text').textContent = questionText;

            const letters = ['a', 'b', 'c', 'd'];
            const visibleCount = type === 'true_false' ? 2 : 4;

            // Reset choices first
            document.querySelectorAll('.choice').forEach(el => {
                el.classList.remove('selected', 'correct', 'incorrect', 'disabled');
                el.style.opacity = '0';
                el.style.transform = 'translateY(10px)';
                el.style.display = '';
            });

            // Populate and stagger choices in
            letters.forEach((letter, i) => {
                const choiceEl = document.querySelector(`[data-choice="${letter.toUpperCase()}"]`);
                const textEl = document.getElementById(`choice-${letter}`);

                if (i >= visibleCount || !choices[i]) {
                    choiceEl.style.display = 'none';
                    return;
                }

                textEl.textContent = choices[i];
                setTimeout(() => {
                    choiceEl.style.transition = `opacity 0.25s ease ${i * 0.06}s, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 0.06}s`;
                    choiceEl.style.opacity = '1';
                    choiceEl.style.transform = 'translateY(0)';
                }, 50);
            });

            // Hide answer side and feedback
            const answerSide = document.querySelector('.answer-side');
            answerSide.classList.add('hidden');
            answerSide.style.opacity = '0';
            answerSide.style.transform = 'translateY(12px)';

            const feedback = document.getElementById('answer-feedback');
            if (feedback) feedback.classList.add('hidden');

            const hint = document.getElementById('keyboard-hint');
            if (hint) hint.textContent = 'Press 1-4 to select, Enter to submit';

            document.getElementById('submit-answer').classList.remove('hidden');
            document.getElementById('submit-answer').disabled = true;
            document.getElementById('next-question').classList.add('hidden');

            this.selectedChoice = null;
            this.answered = false;
            this.updateNavigation();

            // Slide card back in with a subtle bounce
            this._choiceShownAt = Date.now();
            flashcard.style.transition = 'opacity 0.3s ease, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
            flashcard.style.opacity = '1';
            flashcard.style.transform = 'translateY(0) scale(1)';

            setTimeout(() => {
                this.isAnimating = false;
                this.stopTimer();
                this.startTimer();
                // Reset hint button
                const hintBtn = document.getElementById('hint-btn');
                if (hintBtn) { hintBtn.disabled = false; hintBtn.style.opacity = ''; }
            }, 400);
        }, 220);
    }

    selectChoice(choiceEl) {
        if (this.answered || this.isAnimating) return;

        // Remove previous selection
        document.querySelectorAll('.choice').forEach(el => {
            el.classList.remove('selected');
            el.setAttribute('aria-checked', 'false');
        });

        // Add new selection with animation
        choiceEl.classList.add('selected');
        choiceEl.setAttribute('aria-checked', 'true');

        // Add ripple effect
        const ripple = document.createElement('div');
        ripple.className = 'ripple';
        choiceEl.appendChild(ripple);

        setTimeout(() => ripple.remove(), 600);

        this.selectedChoice = choiceEl.dataset.choice;
        document.getElementById('submit-answer').disabled = false;

        // Announce selection for screen readers
        this.announceToScreenReader(`Option ${this.selectedChoice} selected`);
    }

    submitAnswer() {
        if (!this.selectedChoice || this.answered || this.isAnimating) return;
        this.answered = true;

        // Hide submit button immediately
        document.getElementById('submit-answer').classList.add('hidden');

        const card = this.flashCards[this.currentCardIndex];
        const norm = card._normalized || { question: card.question, choices: card.choices, correctAnswer: card.correctAnswer };
        const isCorrect = this.selectedChoice === norm.correctAnswer;

        if (isCorrect) {
            this.correctAnswers++;
        } else {
            this.incorrectAnswers++;
        }

        // Track result for session summary
        const hesitationMs = this._choiceShownAt ? Date.now() - this._choiceShownAt : 0;
        this.trackEvent('answer_submitted', { isCorrect, hesitationMs, cardIndex: this.currentCardIndex });

        this.questionResults.push({
            question: norm.question,
            userAnswer: norm.choices[['A','B','C','D'].indexOf(this.selectedChoice)] || '',
            correctAnswer: norm.choices[['A','B','C','D'].indexOf(norm.correctAnswer)] || '',
            isCorrect,
        });

        // Show feedback banner
        const feedback = document.getElementById('answer-feedback');
        feedback.className = `answer-feedback ${isCorrect ? 'correct' : 'wrong'}`;
        feedback.textContent = isCorrect ? '✓ Correct!' : '✗ Incorrect';
        feedback.classList.remove('hidden');
        this.haptic(isCorrect ? 'correct' : 'wrong');
        this.stopTimer();

        // Update running stats
        const runCorrect = document.getElementById('running-correct');
        const runWrong = document.getElementById('running-wrong');
        if (runCorrect) runCorrect.textContent = `✓ ${this.correctAnswers}`;
        if (runWrong) runWrong.textContent = `✗ ${this.incorrectAnswers}`;

        // Update keyboard hint
        const hint = document.getElementById('keyboard-hint');
        if (hint) hint.textContent = 'Press Enter or → to continue';

        // Log the question answer (if logged in and functional cookies accepted)
        if (Auth.isLoggedIn() && typeof CookieConsent !== 'undefined' && CookieConsent.isAllowed('functional')) {
            const correctIndex = ['A', 'B', 'C', 'D'].indexOf(norm.correctAnswer);
            const docUrl = document.getElementById('doc-url').value.trim();
            const difficulty = document.getElementById('difficulty').value;
            Auth.apiFetch(`${API_BASE}/api/question-log`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: docUrl,
                    pageTitle: this.currentPageTitle || docUrl,
                    question: norm.question,
                    correctAnswer: norm.choices[correctIndex] || '',
                    userAnswer: norm.choices[['A','B','C','D'].indexOf(this.selectedChoice)] || '',
                    isCorrect,
                    difficulty,
                    choices: norm.choices,
                    explanation: card.explanation,
                }),
            }).catch(err => console.warn('Could not log question:', err));
        }

        // Highlight correct / incorrect choices with animation
        document.querySelectorAll('.choice').forEach(el => {
            el.classList.add('disabled');
            if (el.dataset.choice === norm.correctAnswer) {
                setTimeout(() => el.classList.add('correct'), 300);
            } else if (el.dataset.choice === this.selectedChoice) {
                setTimeout(() => el.classList.add('incorrect'), 300);
            }
        });

        // Slide in the explanation
        setTimeout(() => {
            const correctIndex = ['A', 'B', 'C', 'D'].indexOf(norm.correctAnswer);
            document.getElementById('correct-answer').textContent =
                `${norm.correctAnswer}. ${norm.choices[correctIndex] || ''}`;
            document.getElementById('explanation-text').textContent = card.explanation;

            const answerSide = document.querySelector('.answer-side');
            answerSide.classList.remove('hidden');
            answerSide.style.opacity = '0';
            answerSide.style.transform = 'translateY(12px)';
            requestAnimationFrame(() => {
                answerSide.style.transition = 'opacity 0.35s ease, transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)';
                answerSide.style.opacity = '1';
                answerSide.style.transform = 'translateY(0)';
            });

            document.getElementById('submit-answer').classList.add('hidden');
            document.getElementById('next-question').classList.remove('hidden');

            this.updateNavigation();

            this.announceToScreenReader(`Answer revealed. ${isCorrect ? 'Correct!' : 'Incorrect.'} ${card.explanation}`);
        }, 800);
    }

    // ── Navigation ──────────────────────────────────────────────────────

    nextCard() {
        if (this.currentCardIndex < this.flashCards.length - 1) {
            this.currentCardIndex++;
            this.saveSessionState();
            this.displayCurrentCard();
            this.updateProgress();
        } else {
            this.clearSavedSession();
            this.showResults();
        }
    }

    previousCard() {
        if (this.currentCardIndex > 0) {
            this.currentCardIndex--;
            this.displayCurrentCard();
            this.updateProgress();
        }
    }

    updateProgress() {
        const progress = ((this.currentCardIndex + 1) / this.flashCards.length) * 100;
        const progressBar = document.querySelector('.progress-bar');
        const progressFill = document.querySelector('.progress-fill');

        progressBar.setAttribute('aria-valuenow', Math.round(progress));
        progressFill.style.width = `${progress}%`;
        document.querySelector('.progress-text').textContent =
            `Card ${this.currentCardIndex + 1} of ${this.flashCards.length}`;
    }

    updateNavigation() {
        const nav = document.querySelector('.navigation');
        // Hide navigation until question is answered — no skipping allowed
        if (!this.answered) {
            nav.style.display = 'none';
        } else {
            nav.style.display = 'flex';
            const prevBtn = document.getElementById('prev-card');
            const nextBtn = document.getElementById('next-card');
            prevBtn.disabled = true; // no going back
            prevBtn.setAttribute('aria-disabled', 'true');
            nextBtn.textContent = this.currentCardIndex === this.flashCards.length - 1 ? 'Finish' : 'Next →';
        }
    }

    animateSectionTransition(targetSectionId) {
        const currentSection = document.querySelector('.section:not(.hidden)');
        const targetSection = document.getElementById(targetSectionId);

        if (currentSection) {
            currentSection.style.transform = 'translateY(-20px)';
            currentSection.style.opacity = '0';
            setTimeout(() => {
                this.showSection(targetSectionId);
                targetSection.style.transform = 'translateY(0)';
                targetSection.style.opacity = '1';
            }, 300);
        } else {
            this.showSection(targetSectionId);
        }
    }

    showResults() {
        const total = this.flashCards.length;
        const score = Math.round((this.correctAnswers / total) * 100);

        // Animate score counters
        this.animateCounter('correct-count', this.correctAnswers);
        this.animateCounter('incorrect-count', this.incorrectAnswers);
        this.animateCounter('final-score', score, '%');

        this.animateSectionTransition('results-section');

        // Save score — prompt sign-up if not logged in
        const saveScore = () => {
            if (typeof CookieConsent !== 'undefined' && CookieConsent.isAllowed('functional') && Auth.isLoggedIn()) {
                const url = document.getElementById('doc-url').value.trim();
                const difficulty = document.getElementById('difficulty').value;
                Auth.apiFetch(`${API_BASE}/api/scores`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        url,
                        pageTitle: this.currentPageTitle || url,
                        correct: this.correctAnswers,
                        total,
                        scorePct: score,
                        difficulty,
                    }),
                }).then(res => res?.json()).then(data => {
                    if (data?.newBadges?.length) {
                        data.newBadges.forEach((badge, i) => {
                            setTimeout(() => this.showAchievementToast(badge), i * 1500);
                        });
                    }
                }).catch(err => console.warn('Could not save score:', err));
            }
        };

        if (Auth.isLoggedIn()) {
            saveScore();
        } else {
            // Show a gentle prompt to save progress
            this.showSignUpPrompt(saveScore);
        }

        // Render question-by-question summary
        this.renderSessionSummary();

        // Announce results
        this.announceToScreenReader(`Session complete! You got ${this.correctAnswers} out of ${total} correct for a score of ${score} percent.`);
    }

    renderSessionSummary() {
        const container = document.getElementById('results-section');
        if (!container || !this.questionResults?.length) return;

        let existing = document.getElementById('session-summary');
        if (existing) existing.remove();

        const summary = document.createElement('div');
        summary.id = 'session-summary';
        summary.className = 'session-summary';
        summary.innerHTML = `
            <div class="summary-header">Question Breakdown</div>
            ${this.questionResults.map((r, i) => `
                <div class="summary-item ${r.isCorrect ? 'correct' : 'wrong'}">
                    <span class="summary-num">${i + 1}</span>
                    <div class="summary-detail">
                        <div class="summary-q">${r.question.length > 80 ? r.question.substring(0, 80) + '…' : r.question}</div>
                        <div class="summary-answer">${r.isCorrect ? '✓ Correct' : `✗ You: ${r.userAnswer.substring(0, 50)} → ${r.correctAnswer.substring(0, 50)}`}</div>
                    </div>
                </div>
            `).join('')}
        `;

        // Insert before the results-actions
        const actions = container.querySelector('.results-actions');
        if (actions) container.insertBefore(summary, actions);
        else container.appendChild(summary);
    }

    animateCounter(elementId, targetValue, suffix = '') {
        const element = document.getElementById(elementId);
        let currentValue = 0;
        const increment = targetValue / 50;
        const timer = setInterval(() => {
            currentValue += increment;
            if (currentValue >= targetValue) {
                currentValue = targetValue;
                clearInterval(timer);
            }
            element.textContent = Math.round(currentValue) + suffix;
        }, 30);
    }

    shareResults() {
        const total = this.flashCards.length;
        const score = Math.round((this.correctAnswers / total) * 100);
        const text = `I scored ${score}% on Learn Flash Cards!\nCorrect: ${this.correctAnswers}/${total}\n\nhttps://ms-learn-flashcards.vercel.app`;
        if (navigator.share) {
            navigator.share({ title: 'My Flash Cards Score', text });
        } else {
            navigator.clipboard.writeText(text).then(() => this.showError('Results copied to clipboard!'));
        }
    }

    async shareDeck() {
        if (!Auth.isLoggedIn()) { Auth.requireAuth(() => this.shareDeck()); return; }
        if (!this.flashCards.length) return;
        const url = document.getElementById('doc-url').value.trim();
        const difficulty = document.getElementById('difficulty').value;
        try {
            const res = await Auth.apiFetch(`${API_BASE}/api/decks/share`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, pageTitle: this.currentPageTitle, cards: this.flashCards, difficulty }),
            });
            const data = await res.json();
            const shareUrl = `${window.location.origin}/?deck=${data.share_code}`;
            if (navigator.clipboard) {
                await navigator.clipboard.writeText(shareUrl);
                this.showError('Share link copied to clipboard!');
            }
        } catch { this.showError('Could not share deck'); }
    }

    exportData() {
        if (!Auth.isLoggedIn()) { Auth.requireAuth(() => this.exportData()); return; }
        window.open(`${API_BASE}/api/export/json`, '_blank');
    }

    async searchDocs() {
        const query = document.getElementById('doc-search')?.value?.trim();
        if (!query || query.length < 2) return;
        const resultsEl = document.getElementById('search-results');
        resultsEl.classList.remove('hidden');
        resultsEl.innerHTML = '<div style="padding:0.5rem;color:var(--text-muted);font-size:0.75rem;">Searching...</div>';
        try {
            const res = await fetch(`${API_BASE}/api/search-docs?q=${encodeURIComponent(query)}`);
            const results = await res.json();
            if (!results.length) {
                resultsEl.innerHTML = '<div style="padding:0.5rem;color:var(--text-muted);font-size:0.75rem;">No results found</div>';
                return;
            }
            resultsEl.innerHTML = results.slice(0, 6).map(r => `
                <div class="search-result-item" data-url="${r.url}">
                    <div class="search-result-title">${r.title}</div>
                    <div class="search-result-desc">${(r.description || '').substring(0, 100)}</div>
                </div>
            `).join('');
            resultsEl.querySelectorAll('.search-result-item').forEach(item => {
                item.addEventListener('click', () => {
                    document.getElementById('doc-url').value = item.dataset.url;
                    resultsEl.classList.add('hidden');
                    document.getElementById('doc-search').value = '';
                });
            });
        } catch {
            resultsEl.innerHTML = '<div style="padding:0.5rem;color:var(--text-muted);font-size:0.75rem;">Search failed</div>';
        }
    }

    restartSession() {
        this.animateSectionTransition('flashcard-section');
        this.startFlashCardSession();
    }

    newSession() {
        this.animateSectionTransition('setup-section');
        document.getElementById('doc-url').value = '';
    }

    showSection(sectionId) {
        ['setup-section', 'loading-section', 'flashcard-section', 'results-section']
            .forEach(id => {
                const section = document.getElementById(id);
                section.classList.add('hidden');
                section.style.transform = '';
                section.style.opacity = '';
            });
        document.getElementById(sectionId).classList.remove('hidden');
    }

    showAchievementToast(badge) {
        const toast = document.createElement('div');
        toast.className = 'achievement-toast';
        toast.innerHTML = `
            <div class="achievement-toast-inner">
                <div class="achievement-toast-icon">🏆</div>
                <div class="achievement-toast-text">
                    <strong>${badge.name}</strong>
                    <span>${badge.desc}</span>
                </div>
            </div>
        `;
        document.body.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('show'));
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        }, 4000);
    }

    showSignUpPrompt(onSignUp) {
        const existing = document.getElementById('signup-prompt');
        if (existing) existing.remove();

        const prompt = document.createElement('div');
        prompt.id = 'signup-prompt';
        prompt.className = 'signup-prompt';
        prompt.innerHTML = `
            <div class="signup-prompt-content">
                <div class="signup-prompt-text">
                    <strong>Save your progress?</strong>
                    <span>Create a free account to track scores, earn badges, and review with spaced repetition.</span>
                </div>
                <div class="signup-prompt-actions">
                    <button class="btn btn-primary" id="signup-prompt-yes">Create Account</button>
                    <button class="btn btn-secondary" id="signup-prompt-skip">Skip for now</button>
                </div>
            </div>
        `;

        // Insert after the results section
        const results = document.getElementById('results-section');
        if (results) results.appendChild(prompt);

        prompt.querySelector('#signup-prompt-yes').addEventListener('click', () => {
            prompt.remove();
            Auth.showAuthModal(() => {
                onSignUp();
                Auth.updateAuthUI();
            });
        });

        prompt.querySelector('#signup-prompt-skip').addEventListener('click', () => {
            prompt.style.opacity = '0';
            setTimeout(() => prompt.remove(), 200);
        });

        // Animate in
        requestAnimationFrame(() => prompt.classList.add('visible'));
    }

    announceToScreenReader(message) {
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.setAttribute('aria-atomic', 'true');
        announcement.style.position = 'absolute';
        announcement.style.left = '-10000px';
        announcement.style.width = '1px';
        announcement.style.height = '1px';
        announcement.style.overflow = 'hidden';

        document.body.appendChild(announcement);
        announcement.textContent = message;

        setTimeout(() => {
            document.body.removeChild(announcement);
        }, 1000);
    }

    // ── Sample Data for Demonstration ───────────────────────────────────

    generateSampleCards(count, difficulty) {
        const sampleData = [
            {
                question: "What is Azure Resource Manager?",
                choices: [
                    "A deployment and management service for Azure",
                    "A database service for storing application data",
                    "A networking service for connecting virtual machines",
                    "A monitoring service for Azure resources"
                ],
                correctAnswer: "A",
                explanation: "Azure Resource Manager is the deployment and management service for Azure. It provides a management layer that enables you to create, update, and delete resources in your Azure account."
            },
            {
                question: "Which of the following is a key benefit of using Azure Virtual Machines?",
                choices: [
                    "Automatic scaling based on demand",
                    "Full control over the operating system and environment",
                    "Built-in load balancing for web applications",
                    "Serverless execution of code without managing servers"
                ],
                correctAnswer: "B",
                explanation: "Azure Virtual Machines give you full control over the operating system and computing environment. You can choose from a wide variety of operating systems, install custom software, and configure the virtual machine exactly as needed."
            },
            {
                question: "What is the primary purpose of Azure Blob Storage?",
                choices: [
                    "To store relational data in tables",
                    "To store unstructured data as objects",
                    "To provide message queuing capabilities",
                    "To cache frequently accessed data"
                ],
                correctAnswer: "B",
                explanation: "Azure Blob Storage is designed for storing large amounts of unstructured data, such as text or binary data. It's ideal for serving images, documents, streaming video, and performing big data analytics."
            },
            {
                question: "Which Azure service would you use to implement serverless functions?",
                choices: [
                    "Azure Virtual Machines",
                    "Azure Functions",
                    "Azure App Service",
                    "Azure Kubernetes Service"
                ],
                correctAnswer: "B",
                explanation: "Azure Functions is Microsoft's serverless compute service that enables you to run code on-demand without having to explicitly provision or manage infrastructure. It's ideal for event-driven scenarios."
            },
            {
                question: "What does Azure Active Directory primarily provide?",
                choices: [
                    "Database management and analytics",
                    "Identity and access management",
                    "Content delivery network services",
                    "IoT device management"
                ],
                correctAnswer: "B",
                explanation: "Azure Active Directory (Azure AD) is Microsoft's cloud-based identity and access management service. It helps employees sign in and access resources in external resources and internal resources."
            },
            {
                question: "Which Azure service is designed for big data analytics and processing?",
                choices: [
                    "Azure SQL Database",
                    "Azure Synapse Analytics",
                    "Azure Cosmos DB",
                    "Azure Table Storage"
                ],
                correctAnswer: "B",
                explanation: "Azure Synapse Analytics is an enterprise analytics service that accelerates time to insight across data warehouses and big data systems. It provides a unified experience for ingesting, preparing, managing, and serving data."
            },
            {
                question: "What is the main advantage of using Azure Front Door?",
                choices: [
                    "Global content delivery and acceleration",
                    "Advanced threat protection for web applications",
                    "Load balancing for virtual machines",
                    "Monitoring and diagnostics for applications"
                ],
                correctAnswer: "A",
                explanation: "Azure Front Door is a global, scalable entry-point that uses the Microsoft global edge network to create fast, secure, and widely scalable web applications. It provides global load balancing and accelerates content delivery."
            },
            {
                question: "Which service provides managed Kubernetes clusters in Azure?",
                choices: [
                    "Azure Container Instances",
                    "Azure Kubernetes Service (AKS)",
                    "Azure Functions",
                    "Azure App Service"
                ],
                correctAnswer: "B",
                explanation: "Azure Kubernetes Service (AKS) offers serverless Kubernetes, an integrated continuous integration and continuous delivery (CI/CD) experience, and enterprise-grade security and governance for containerized applications."
            }
        ];

        // Shuffle and return the requested number of cards
        const shuffled = this.shuffle([...sampleData]);
        return shuffled.slice(0, Math.min(count, shuffled.length));
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    new FlashCardApp();
});
