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

        // Flag question
        document.getElementById('flag-question')?.addEventListener('click', () => this.flagQuestion());
    }

    flagQuestion() {
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

    speakText() {
        if (!('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel();
        const text = document.getElementById('question-text')?.textContent;
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
                const idx = choices.indexOf(card.correctAnswer);
                correctLetter = ['A','B','C','D'][idx >= 0 ? idx : 0];
                card._normalized = { question: questionText, choices, correctAnswer: correctLetter };
            } else if (type === 'scenario') {
                questionText = `${card.scenario}\n\n${card.question}`;
                choices = card.choices.slice(0, 4);
                correctLetter = card.correctAnswer;
                card._normalized = { question: questionText, choices, correctAnswer: correctLetter };
            } else {
                questionText = card.question;
                choices = card.choices || [];
                correctLetter = card.correctAnswer;
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
            flashcard.style.transition = 'opacity 0.3s ease, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
            flashcard.style.opacity = '1';
            flashcard.style.transform = 'translateY(0) scale(1)';

            setTimeout(() => { this.isAnimating = false; }, 400);
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
        const text = `I just scored ${score}% on Microsoft Learn Flash Cards! 📚\n\nCorrect: ${this.correctAnswers}/${total}\n\nTry it yourself: [Your App URL]`;

        if (navigator.share) {
            navigator.share({
                title: 'My Flash Cards Score',
                text: text,
            });
        } else {
            // Fallback: copy to clipboard
            navigator.clipboard.writeText(text).then(() => {
                this.showError('Results copied to clipboard!');
            });
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
