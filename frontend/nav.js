/**
 * Shared navigation component — injected on all pages.
 */
(function() {
    const navHTML = `
    <nav class="side-nav" aria-label="App navigation">
        <a href="/" class="side-nav-item" title="Home"><i data-lucide="home" class="side-nav-icon"></i></a>
        <a href="/review.html" class="side-nav-item" title="Review"><i data-lucide="brain" class="side-nav-icon"></i></a>
        <a href="/profile.html" class="side-nav-item" title="Profile"><i data-lucide="trophy" class="side-nav-icon"></i></a>
        <div class="side-nav-group">
            <button class="side-nav-item side-nav-trigger" title="Learn" aria-expanded="false"><i data-lucide="book-open" class="side-nav-icon"></i></button>
            <div class="side-nav-popover"><div class="popover-inner">
                <a href="/paths.html" class="popover-item"><i data-lucide="route" class="pop-icon"></i> Learning Paths</a>
                <a href="/socratic.html" class="popover-item"><i data-lucide="message-circle" class="pop-icon"></i> AI Coach</a>
                <a href="/leaderboard.html" class="popover-item"><i data-lucide="crown" class="pop-icon"></i> Leaderboard</a>
                <a href="/certifications.html" class="popover-item"><i data-lucide="award" class="pop-icon"></i> Certifications</a>
            </div></div>
        </div>
        <div class="side-nav-group">
            <button class="side-nav-item side-nav-trigger" title="Data" aria-expanded="false"><i data-lucide="bar-chart-3" class="side-nav-icon"></i></button>
            <div class="side-nav-popover"><div class="popover-inner">
                <a href="/history.html" class="popover-item"><i data-lucide="bar-chart-3" class="pop-icon"></i> History</a>
                <a href="/topics.html" class="popover-item"><i data-lucide="layers" class="pop-icon"></i> Topics</a>
                <a href="/compare.html" class="popover-item"><i data-lucide="git-compare-arrows" class="pop-icon"></i> Compare</a>
                <a href="/changelog.html" class="popover-item"><i data-lucide="file-text" class="pop-icon"></i> Changelog</a>
            </div></div>
        </div>
        <div class="side-nav-spacer"></div>
        <a href="/settings.html" class="side-nav-item" title="Settings"><i data-lucide="sliders-horizontal" class="side-nav-icon"></i></a>
        <div id="user-info" class="side-nav-item side-nav-user" title="Account"></div>
        <button class="side-nav-item mobile-only" id="more-menu-btn" title="More"><i data-lucide="menu" class="side-nav-icon"></i></button>
    </nav>
    <div id="more-menu" class="more-menu hidden">
        <div class="more-menu-inner">
            <a href="/review.html" class="more-menu-item"><i data-lucide="brain" class="icon"></i> Review</a>
            <a href="/paths.html" class="more-menu-item"><i data-lucide="route" class="icon"></i> Paths</a>
            <a href="/socratic.html" class="more-menu-item"><i data-lucide="message-circle" class="icon"></i> Coach</a>
            <a href="/profile.html" class="more-menu-item"><i data-lucide="trophy" class="icon"></i> Profile</a>
            <a href="/certifications.html" class="more-menu-item"><i data-lucide="award" class="icon"></i> Certifications</a>
            <div class="more-menu-divider"></div>
            <a href="/history.html" class="more-menu-item"><i data-lucide="bar-chart-3" class="icon"></i> History</a>
            <a href="/topics.html" class="more-menu-item"><i data-lucide="layers" class="icon"></i> Topics</a>
            <a href="/compare.html" class="more-menu-item"><i data-lucide="git-compare-arrows" class="icon"></i> Compare</a>
            <a href="/leaderboard.html" class="more-menu-item"><i data-lucide="crown" class="icon"></i> Leaderboard</a>
            <div class="more-menu-divider"></div>
            <a href="/settings.html" class="more-menu-item"><i data-lucide="sliders-horizontal" class="icon"></i> Settings</a>
            <a href="/changelog.html" class="more-menu-item"><i data-lucide="file-text" class="icon"></i> Changelog</a>
            <div class="more-menu-divider"></div>
            <div id="more-menu-user" class="more-menu-item"></div>
        </div>
    </div>`;

    // Inject nav into the page
    document.body.insertAdjacentHTML('beforeend', navHTML);

    // Initialize icons
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Mobile More menu toggle
    document.getElementById('more-menu-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const menu = document.getElementById('more-menu');
        const isOpen = menu.classList.contains('visible');
        if (isOpen) {
            menu.classList.remove('visible');
        } else {
            menu.classList.add('visible');
            menu.classList.remove('hidden');
            // Update user info in more menu
            const user = typeof Auth !== 'undefined' && Auth.getUser ? Auth.getUser() : null;
            const userEl = document.getElementById('more-menu-user');
            if (userEl) {
                if (user) {
                    userEl.innerHTML = `<i data-lucide="user" class="icon"></i> ${user.displayName || user.email} <span style="color:var(--text-muted);margin-left:auto;font-size:0.7rem;">Sign out</span>`;
                    userEl.onclick = () => { if (confirm('Sign out?')) Auth.logout(); };
                } else {
                    userEl.innerHTML = `<i data-lucide="log-in" class="icon"></i> Sign in`;
                    userEl.onclick = () => Auth.showAuthModal(() => window.location.reload());
                }
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }
        }
    });

    // Close more menu on outside click
    document.addEventListener('click', (e) => {
        const menu = document.getElementById('more-menu');
        const btn = document.getElementById('more-menu-btn');
        if (menu && menu.classList.contains('visible') && !menu.contains(e.target) && !btn?.contains(e.target)) {
            menu.classList.remove('visible');
        }
    });

    // Auth UI in nav
    if (typeof Auth !== 'undefined') Auth.updateAuthUI();

    // Align nav top and left with the first content block on the page
    function alignNav() {
        if (window.innerWidth <= 900) return;
        const nav = document.querySelector('.side-nav');
        if (!nav) return;
        const navWidth = nav.offsetWidth || 44;
        const gap = 10;

        const candidates = [
            '.section',
            '.profile-stats',
            '.settings-section',
            '.chart-card',
            '.compare-card',
            '.topic-card',
            '.review-card',
            '.lb-row',
            '.changelog-summary',
            '.metrics',
            '.path-card',
            '.chat-area',
            '[class*="-container"] > :not(header):not(.back-link):not(a)',
        ];
        for (const sel of candidates) {
            const el = document.querySelector(sel);
            if (el && el.getBoundingClientRect().top > 0) {
                const rect = el.getBoundingClientRect();
                const top = rect.top + window.scrollY;
                const left = rect.left + window.scrollX - navWidth - gap;
                document.documentElement.style.setProperty('--nav-top', top + 'px');
                document.documentElement.style.setProperty('--nav-left', Math.max(4, left) + 'px');
                return;
            }
        }
    }
    alignNav();
    window.addEventListener('resize', alignNav);
    // Re-align after content loads (async pages)
    setTimeout(alignNav, 500);
    setTimeout(alignNav, 2000);
})();
