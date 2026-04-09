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

    handleKeydown(e) {
        // Arrow key navigation
        if (e.key === 'ArrowLeft' && !document.getElementById('prev-card').disabled) {
            this.previousCard();
        } else if (e.key === 'ArrowRight') {
            if (this.answered) {
                this.nextCard();
            } else if (this.selectedChoice) {
                this.submitAnswer();
            }
        } else if (e.key >= '1' && e.key <= '4' && !this.answered && !this.isAnimating) {
            // Number key selection
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
        const proxyUrl = `/api/fetch-page?url=${encodeURIComponent(url)}`;
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
            this.showError('Please enter a Microsoft Learn documentation URL');
            return;
        }

        if (!url.includes('microsoft.com') && !url.includes('learn.microsoft.com')) {
            this.showError('Please enter a valid Microsoft Learn or Microsoft Docs URL');
            return;
        }

        this.animateSectionTransition('loading-section');
        this.updateLoadingSteps(1);

        try {
            // Simulate progressive loading
            setTimeout(() => this.updateLoadingSteps(2), 500);

            const html = await this.fetchDocContent(url);

            setTimeout(() => this.updateLoadingSteps(3), 1000);

            const sections = this.parseDocContent(html);

            if (sections.length === 0) {
                throw new Error('Could not extract content from the page. Try a different URL.');
            }

            this.flashCards = this.generateCardsFromContent(sections, cardCount, difficulty);

            if (this.flashCards.length === 0) {
                throw new Error('Not enough content to generate flash cards. Try a page with more text.');
            }

            setTimeout(() => {
                this.updateLoadingSteps(4);
                setTimeout(() => this.startFlashCardSession(), 500);
            }, 1500);

        } catch (error) {
            console.error('Error generating cards:', error);

            // Fallback to sample cards for demonstration
            console.log('Falling back to sample cards for demonstration...');
            this.flashCards = this.generateSampleCards(cardCount, difficulty);

            setTimeout(() => {
                this.updateLoadingSteps(4);
                setTimeout(() => this.startFlashCardSession(), 500);
            }, 1500);
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

        this.animateSectionTransition('flashcard-section');
        this.displayCurrentCard();
        this.updateProgress();
    }

    displayCurrentCard() {
        if (this.isAnimating) return;
        this.isAnimating = true;

        const card = this.flashCards[this.currentCardIndex];

        // Animate card transition
        const flashcard = document.querySelector('.flashcard');
        flashcard.style.transform = 'translateX(-20px)';
        flashcard.style.opacity = '0';

        setTimeout(() => {
            // Reset flip state so the question side is visible
            document.querySelector('.card-content').classList.remove('card-flipped');

            document.getElementById('question-text').textContent = card.question;

            // Populate choices with animation
            const letters = ['a', 'b', 'c', 'd'];
            letters.forEach((letter, i) => {
                const choiceEl = document.querySelector(`[data-choice="${letter.toUpperCase()}"]`);
                const textEl = document.getElementById(`choice-${letter}`);

                // Stagger animation
                setTimeout(() => {
                    textEl.textContent = card.choices[i] || '';
                    choiceEl.style.transform = 'translateY(0)';
                    choiceEl.style.opacity = '1';
                }, i * 100);
            });

            // Reset UI state
            document.querySelectorAll('.choice').forEach(el => {
                el.classList.remove('selected', 'correct', 'incorrect', 'disabled');
                el.style.transform = 'translateY(20px)';
                el.style.opacity = '0';
            });

            document.querySelector('.answer-side').classList.add('hidden');
            document.getElementById('submit-answer').classList.remove('hidden');
            document.getElementById('submit-answer').disabled = true;
            document.getElementById('next-question').classList.add('hidden');

            this.selectedChoice = null;
            this.answered = false;
            this.updateNavigation();

            // Animate card back in
            flashcard.style.transform = 'translateX(0)';
            flashcard.style.opacity = '1';

            setTimeout(() => {
                this.isAnimating = false;
            }, 300);
        }, 200);
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

        const card = this.flashCards[this.currentCardIndex];
        const isCorrect = this.selectedChoice === card.correctAnswer;

        if (isCorrect) {
            this.correctAnswers++;
        } else {
            this.incorrectAnswers++;
        }

        // Highlight correct / incorrect choices with animation
        document.querySelectorAll('.choice').forEach(el => {
            el.classList.add('disabled');
            if (el.dataset.choice === card.correctAnswer) {
                setTimeout(() => el.classList.add('correct'), 500);
            } else if (el.dataset.choice === this.selectedChoice) {
                setTimeout(() => el.classList.add('incorrect'), 500);
            }
        });

        // Flip to answer side
        setTimeout(() => {
            document.querySelector('.card-content').classList.add('card-flipped');
        }, 1000);

        // Show explanation
        setTimeout(() => {
            const correctIndex = ['A', 'B', 'C', 'D'].indexOf(card.correctAnswer);
            document.getElementById('correct-answer').textContent =
                `${card.correctAnswer}. ${card.choices[correctIndex]}`;
            document.getElementById('explanation-text').textContent = card.explanation;
            document.querySelector('.answer-side').classList.remove('hidden');

            document.getElementById('submit-answer').classList.add('hidden');
            document.getElementById('next-question').classList.remove('hidden');

            this.announceToScreenReader(`Answer revealed. ${isCorrect ? 'Correct!' : 'Incorrect.'} ${card.explanation}`);
        }, 1500);
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
        const progressBar = document.querySelector('.progress-bar');
        const progressFill = document.querySelector('.progress-fill');

        progressBar.setAttribute('aria-valuenow', Math.round(progress));
        progressFill.style.width = `${progress}%`;
        document.querySelector('.progress-text').textContent =
            `Card ${this.currentCardIndex + 1} of ${this.flashCards.length}`;
    }

    updateNavigation() {
        const prevBtn = document.getElementById('prev-card');
        const nextBtn = document.getElementById('next-card');

        prevBtn.disabled = this.currentCardIndex === 0;
        prevBtn.setAttribute('aria-disabled', this.currentCardIndex === 0);

        nextBtn.textContent = this.currentCardIndex === this.flashCards.length - 1 ? 'Finish' : 'Next';
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

        // Announce results
        this.announceToScreenReader(`Session complete! You got ${this.correctAnswers} out of ${total} correct for a score of ${score} percent.`);
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
