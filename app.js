class FlashCardApp {
    constructor() {
        this.flashCards = [];
        this.currentCardIndex = 0;
        this.correctAnswers = 0;
        this.incorrectAnswers = 0;
        this.selectedChoice = null;
        this.answered = false;

        this.initializeEventListeners();
    }

    initializeEventListeners() {
        document.getElementById('generate-cards').addEventListener('click', () => this.generateCards());
        document.getElementById('submit-answer').addEventListener('click', () => this.submitAnswer());
        document.getElementById('next-question').addEventListener('click', () => this.nextCard());
        document.getElementById('prev-card').addEventListener('click', () => this.previousCard());
        document.getElementById('next-card').addEventListener('click', () => this.nextCard());
        document.getElementById('restart').addEventListener('click', () => this.restartSession());
        document.getElementById('new-session').addEventListener('click', () => this.newSession());

        document.addEventListener('click', (e) => {
            if (e.target.closest('.choice') && !this.answered) {
                this.selectChoice(e.target.closest('.choice'));
            }
        });
    }

    // ── Fetching & Parsing ──────────────────────────────────────────────

    async fetchDocContent(url) {
        // Use allorigins as a CORS proxy to fetch the page HTML
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error(`Failed to fetch page (${response.status})`);
        return await response.text();
    }

    parseDocContent(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Microsoft Learn stores the main article content in <main> or specific content divs
        const main = doc.querySelector('main') || doc.querySelector('#main-column') || doc.body;

        // Remove nav, footer, aside, scripts, styles
        main.querySelectorAll('nav, footer, aside, script, style, .metadata, .feedback-section, .contributors-section')
            .forEach(el => el.remove());

        // Extract structured sections: heading + following paragraphs / lists
        const sections = [];
        let currentSection = null;

        for (const el of main.querySelectorAll('h1, h2, h3, h4, p, li, td, th, code, pre')) {
            const tag = el.tagName.toLowerCase();
            const text = el.textContent.trim();
            if (!text) continue;

            if (['h1', 'h2', 'h3', 'h4'].includes(tag)) {
                if (currentSection && currentSection.content.length > 0) {
                    sections.push(currentSection);
                }
                currentSection = { heading: text, content: [] };
            } else {
                if (!currentSection) currentSection = { heading: 'Overview', content: [] };
                // Avoid duplicate lines and very short fragments
                if (text.length > 20 && !currentSection.content.includes(text)) {
                    currentSection.content.push(text);
                }
            }
        }
        if (currentSection && currentSection.content.length > 0) {
            sections.push(currentSection);
        }

        return sections;
    }

    // ── Card Generation from Real Content ───────────────────────────────

    generateCardsFromContent(sections, count, difficulty) {
        const cards = [];
        // Filter sections that have enough content to form a question
        const usable = sections.filter(s => s.content.length >= 1);
        if (usable.length === 0) return cards;

        // Shuffle sections so we get variety
        const shuffled = this.shuffle([...usable]);

        for (const section of shuffled) {
            if (cards.length >= count) break;

            // Try to create a card from each section
            const card = this.buildCardFromSection(section, difficulty);
            if (card) cards.push(card);
        }

        // If we still need more cards, do a second pass pulling from content lines
        if (cards.length < count) {
            for (const section of shuffled) {
                if (cards.length >= count) break;
                const extra = this.buildDefinitionCard(section, difficulty);
                if (extra && !cards.find(c => c.question === extra.question)) {
                    cards.push(extra);
                }
            }
        }

        return cards.slice(0, count);
    }

    buildCardFromSection(section, difficulty) {
        const content = section.content.join(' ');
        if (content.length < 40) return null;

        // Pick the most informative sentence as the basis for the answer
        const sentences = this.extractSentences(content);
        if (sentences.length === 0) return null;

        const answerSentence = sentences[0];
        const correctAnswer = this.trimToLength(answerSentence, 120);

        // Build question from the section heading
        const question = this.formQuestion(section.heading, difficulty);

        // Generate plausible wrong answers by mutating the correct one
        const distractors = this.generateDistractors(correctAnswer, sentences, section.heading);

        // Place correct answer at a random position
        const correctIndex = Math.floor(Math.random() * 4);
        const choices = [...distractors.slice(0, 3)];
        choices.splice(correctIndex, 0, correctAnswer);

        const letters = ['A', 'B', 'C', 'D'];

        return {
            question,
            choices: choices.slice(0, 4),
            correctAnswer: letters[correctIndex],
            explanation: this.trimToLength(content, 300)
        };
    }

    buildDefinitionCard(section, difficulty) {
        if (section.content.length < 2) return null;
        const line = section.content[Math.min(1, section.content.length - 1)];
        if (line.length < 30) return null;

        const correctAnswer = this.trimToLength(line, 120);
        const question = `According to the documentation, which statement is true about "${section.heading}"?`;

        const distractors = this.generateDistractors(correctAnswer, section.content, section.heading);
        const correctIndex = Math.floor(Math.random() * 4);
        const choices = [...distractors.slice(0, 3)];
        choices.splice(correctIndex, 0, correctAnswer);
        const letters = ['A', 'B', 'C', 'D'];

        return {
            question,
            choices: choices.slice(0, 4),
            correctAnswer: letters[correctIndex],
            explanation: this.trimToLength(section.content.join(' '), 300)
        };
    }

    formQuestion(heading, difficulty) {
        const templates = {
            beginner: [
                `What is ${heading}?`,
                `Which of the following best describes ${heading}?`,
                `What is the purpose of ${heading}?`
            ],
            intermediate: [
                `Which statement about ${heading} is correct?`,
                `What is a key characteristic of ${heading}?`,
                `How does ${heading} work?`
            ],
            advanced: [
                `Which of the following is an accurate technical detail about ${heading}?`,
                `What is a critical consideration when working with ${heading}?`,
                `Which advanced concept applies to ${heading}?`
            ]
        };
        const pool = templates[difficulty] || templates.intermediate;
        return pool[Math.floor(Math.random() * pool.length)];
    }

    generateDistractors(correctAnswer, allSentences, heading) {
        const distractors = [];
        // Use other sentences from the section as plausible wrong answers
        for (const s of allSentences) {
            const trimmed = this.trimToLength(s, 120);
            if (trimmed !== correctAnswer && trimmed.length > 15) {
                distractors.push(trimmed);
            }
            if (distractors.length >= 5) break;
        }

        // Pad with generic plausible-sounding wrong answers if needed
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
            alert('Please enter a Microsoft Learn documentation URL');
            return;
        }

        if (!url.includes('microsoft.com') && !url.includes('learn.microsoft.com')) {
            alert('Please enter a valid Microsoft Learn or Microsoft Docs URL');
            return;
        }

        this.showSection('loading-section');

        try {
            const html = await this.fetchDocContent(url);
            const sections = this.parseDocContent(html);

            if (sections.length === 0) {
                throw new Error('Could not extract content from the page. Try a different URL.');
            }

            this.flashCards = this.generateCardsFromContent(sections, cardCount, difficulty);

            if (this.flashCards.length === 0) {
                throw new Error('Not enough content to generate flash cards. Try a page with more text.');
            }

            this.startFlashCardSession();
        } catch (error) {
            console.error('Error generating cards:', error);
            alert(error.message || 'Error generating flash cards. Please try again.');
            this.showSection('setup-section');
        }
    }

    // ── Session & Card Display ──────────────────────────────────────────

    startFlashCardSession() {
        this.currentCardIndex = 0;
        this.correctAnswers = 0;
        this.incorrectAnswers = 0;
        this.selectedChoice = null;
        this.answered = false;

        this.showSection('flashcard-section');
        this.displayCurrentCard();
        this.updateProgress();
    }

    displayCurrentCard() {
        const card = this.flashCards[this.currentCardIndex];

        document.getElementById('question-text').textContent = card.question;

        // Populate choices
        const letters = ['a', 'b', 'c', 'd'];
        letters.forEach((letter, i) => {
            document.getElementById(`choice-${letter}`).textContent = card.choices[i] || '';
        });

        // Reset UI state
        document.querySelectorAll('.choice').forEach(el => {
            el.classList.remove('selected', 'correct', 'incorrect', 'disabled');
        });
        document.querySelector('.answer-side').classList.add('hidden');
        document.getElementById('submit-answer').classList.remove('hidden');
        document.getElementById('submit-answer').disabled = true;
        document.getElementById('next-question').classList.add('hidden');

        this.selectedChoice = null;
        this.answered = false;
        this.updateNavigation();
    }

    selectChoice(choiceEl) {
        document.querySelectorAll('.choice').forEach(el => el.classList.remove('selected'));
        choiceEl.classList.add('selected');
        this.selectedChoice = choiceEl.dataset.choice;
        document.getElementById('submit-answer').disabled = false;
    }

    submitAnswer() {
        if (!this.selectedChoice || this.answered) return;
        this.answered = true;

        const card = this.flashCards[this.currentCardIndex];
        const isCorrect = this.selectedChoice === card.correctAnswer;

        if (isCorrect) {
            this.correctAnswers++;
        } else {
            this.incorrectAnswers++;
        }

        // Highlight correct / incorrect choices
        document.querySelectorAll('.choice').forEach(el => {
            el.classList.add('disabled');
            if (el.dataset.choice === card.correctAnswer) {
                el.classList.add('correct');
            } else if (el.dataset.choice === this.selectedChoice) {
                el.classList.add('incorrect');
            }
        });

        // Show explanation
        const correctIndex = ['A', 'B', 'C', 'D'].indexOf(card.correctAnswer);
        document.getElementById('correct-answer').textContent =
            `${card.correctAnswer}. ${card.choices[correctIndex]}`;
        document.getElementById('explanation-text').textContent = card.explanation;
        document.querySelector('.answer-side').classList.remove('hidden');

        document.getElementById('submit-answer').classList.add('hidden');
        document.getElementById('next-question').classList.remove('hidden');
    }

    // ── Navigation ──────────────────────────────────────────────────────

    nextCard() {
        if (this.currentCardIndex < this.flashCards.length - 1) {
            this.currentCardIndex++;
            this.displayCurrentCard();
            this.updateProgress();
        } else {
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
        document.querySelector('.progress-fill').style.width = `${progress}%`;
        document.querySelector('.progress-text').textContent =
            `Card ${this.currentCardIndex + 1} of ${this.flashCards.length}`;
    }

    updateNavigation() {
        document.getElementById('prev-card').disabled = this.currentCardIndex === 0;
        const nextBtn = document.getElementById('next-card');
        nextBtn.textContent = this.currentCardIndex === this.flashCards.length - 1 ? 'Finish' : 'Next';
    }

    showResults() {
        const total = this.flashCards.length;
        const score = Math.round((this.correctAnswers / total) * 100);

        document.getElementById('correct-count').textContent = this.correctAnswers;
        document.getElementById('incorrect-count').textContent = this.incorrectAnswers;
        document.getElementById('final-score').textContent = `${score}%`;

        this.showSection('results-section');
    }

    restartSession() {
        this.startFlashCardSession();
    }

    newSession() {
        this.showSection('setup-section');
        document.getElementById('doc-url').value = '';
    }

    showSection(sectionId) {
        ['setup-section', 'loading-section', 'flashcard-section', 'results-section']
            .forEach(id => document.getElementById(id).classList.add('hidden'));
        document.getElementById(sectionId).classList.remove('hidden');
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    new FlashCardApp();
});