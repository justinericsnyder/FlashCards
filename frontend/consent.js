/**
 * Cookie Consent Manager
 * Gates all non-essential cookies/storage behind user consent.
 * Consent preference itself is stored in localStorage (strictly necessary).
 */
const CookieConsent = (() => {
    const CONSENT_KEY = 'cookie_consent';
    const CONSENT_VERSION = '1'; // bump to re-prompt users

    const categories = {
        necessary: {
            label: 'Strictly Necessary',
            description: 'Required for the site to function. Stores your consent preference only. Cannot be disabled.',
            locked: true,
            enabled: true,
        },
        functional: {
            label: 'Functional',
            description: 'Remembers your preferences like difficulty level and card count between sessions.',
            locked: false,
            enabled: false,
        },
        analytics: {
            label: 'Analytics',
            description: 'Helps us understand how you use the app so we can improve it. Tracks anonymous usage patterns like pages visited and session duration.',
            locked: false,
            enabled: false,
        },
    };

    function getConsent() {
        try {
            const raw = localStorage.getItem(CONSENT_KEY);
            if (!raw) return null;
            const data = JSON.parse(raw);
            if (data.version !== CONSENT_VERSION) return null;
            return data;
        } catch { return null; }
    }

    function saveConsent(choices) {
        const data = {
            version: CONSENT_VERSION,
            timestamp: new Date().toISOString(),
            categories: choices,
        };
        localStorage.setItem(CONSENT_KEY, JSON.stringify(data));
        applyConsent(choices);
    }

    function applyConsent(choices) {
        // Dispatch event so other scripts can react
        window.dispatchEvent(new CustomEvent('consentUpdated', { detail: choices }));

        // If analytics not accepted, clear any analytics cookies
        if (!choices.analytics) {
            clearCookiesByPrefix('_ga', '_gid', '_gat');
        }
    }

    function clearCookiesByPrefix(...prefixes) {
        document.cookie.split(';').forEach(c => {
            const name = c.split('=')[0].trim();
            if (prefixes.some(p => name.startsWith(p))) {
                document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
            }
        });
    }

    function isAllowed(category) {
        const consent = getConsent();
        if (!consent) return category === 'necessary';
        return consent.categories[category] === true;
    }

    function hasResponded() {
        return getConsent() !== null;
    }

    // ── Banner UI ──────────────────────────────────────────

    function showBanner() {
        if (hasResponded()) {
            applyConsent(getConsent().categories);
            return;
        }

        const overlay = document.createElement('div');
        overlay.id = 'consent-overlay';
        overlay.innerHTML = `
            <div class="consent-banner" role="dialog" aria-label="Cookie consent" aria-modal="true">
                <div class="consent-header">
                    <span class="consent-icon">🍪</span>
                    <h2>We value your privacy</h2>
                </div>
                <p class="consent-desc">
                    We use cookies and local storage to improve your experience. You choose what to allow.
                    No data is shared with third parties.
                </p>

                <div class="consent-categories">
                    ${Object.entries(categories).map(([key, cat]) => `
                        <label class="consent-category ${cat.locked ? 'locked' : ''}">
                            <div class="consent-cat-info">
                                <span class="consent-cat-name">${cat.label}</span>
                                <span class="consent-cat-desc">${cat.description}</span>
                            </div>
                            <div class="consent-toggle-wrap">
                                <input type="checkbox" class="consent-toggle"
                                    data-category="${key}"
                                    ${cat.enabled ? 'checked' : ''}
                                    ${cat.locked ? 'checked disabled' : ''}>
                                <span class="consent-toggle-slider"></span>
                            </div>
                        </label>
                    `).join('')}
                </div>

                <div class="consent-actions">
                    <button class="consent-btn consent-btn-accept-all" id="consent-accept-all">Accept All</button>
                    <button class="consent-btn consent-btn-save" id="consent-save">Save Preferences</button>
                    <button class="consent-btn consent-btn-reject" id="consent-reject">Reject Non-Essential</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Force reflow then animate in
        requestAnimationFrame(() => {
            requestAnimationFrame(() => overlay.classList.add('visible'));
        });

        // Event handlers
        overlay.querySelector('#consent-accept-all').addEventListener('click', () => {
            const choices = {};
            Object.keys(categories).forEach(k => choices[k] = true);
            saveConsent(choices);
            closeBanner(overlay);
        });

        overlay.querySelector('#consent-save').addEventListener('click', () => {
            const choices = {};
            overlay.querySelectorAll('.consent-toggle').forEach(toggle => {
                choices[toggle.dataset.category] = toggle.checked;
            });
            choices.necessary = true; // always on
            saveConsent(choices);
            closeBanner(overlay);
        });

        overlay.querySelector('#consent-reject').addEventListener('click', () => {
            const choices = {};
            Object.keys(categories).forEach(k => choices[k] = k === 'necessary');
            saveConsent(choices);
            closeBanner(overlay);
        });

        // Trap focus inside dialog
        const focusable = overlay.querySelectorAll('button, input:not([disabled])');
        if (focusable.length) focusable[0].focus();
    }

    function closeBanner(overlay) {
        overlay.classList.remove('visible');
        setTimeout(() => overlay.remove(), 300);
    }

    // Public API
    return { showBanner, isAllowed, hasResponded, getConsent, saveConsent, categories };
})();

// Auto-show on load
document.addEventListener('DOMContentLoaded', () => CookieConsent.showBanner());
