/**
 * Auth manager — handles signup, login, token storage, and auth headers.
 */
const Auth = (() => {
    const TOKEN_KEY = 'fc_auth_token';
    const USER_KEY = 'fc_auth_user';

    function getToken() { return localStorage.getItem(TOKEN_KEY); }
    function getUser() {
        try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; }
    }
    function isLoggedIn() { return !!getToken(); }

    function save(token, user) {
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
    }

    function logout() {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        window.location.reload();
    }

    function authHeaders() {
        const token = getToken();
        return token ? { 'Authorization': `Bearer ${token}` } : {};
    }

    // Authenticated fetch helper
    async function apiFetch(url, options = {}) {
        const headers = { ...authHeaders(), ...(options.headers || {}) };
        return fetch(url, { ...options, headers });
    }

    async function signup(email, password, displayName) {
        const res = await fetch(`${window.__API_BASE__ || ''}/api/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, displayName }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Signup failed');
        save(data.token, data.user);
        return data.user;
    }

    async function login(email, password) {
        const res = await fetch(`${window.__API_BASE__ || ''}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login failed');
        save(data.token, data.user);
        return data.user;
    }

    // Show auth modal if not logged in
    function requireAuth(callback) {
        if (isLoggedIn()) { callback(); return; }
        showAuthModal(callback);
    }

    function showAuthModal(onSuccess) {
        if (document.getElementById('auth-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'auth-overlay';
        overlay.innerHTML = `
            <div class="auth-modal">
                <h2>Sign in to continue</h2>
                <p class="auth-subtitle">Your progress is saved to your account</p>
                <div id="auth-error" class="auth-error hidden"></div>
                <form id="auth-form">
                    <input type="email" id="auth-email" placeholder="Email" required autocomplete="email">
                    <input type="password" id="auth-password" placeholder="Password (min 6 chars)" required minlength="6" autocomplete="current-password">
                    <input type="text" id="auth-name" placeholder="Display name (optional)" class="hidden" autocomplete="name">
                    <button type="submit" class="btn btn-primary" style="width:100%;" id="auth-submit">Sign In</button>
                </form>
                <div class="auth-toggle">
                    <span id="auth-toggle-text">Don't have an account?</span>
                    <button id="auth-toggle-btn" class="auth-link">Sign Up</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('visible')));

        let isSignup = false;
        const form = overlay.querySelector('#auth-form');
        const errorEl = overlay.querySelector('#auth-error');
        const nameInput = overlay.querySelector('#auth-name');
        const toggleBtn = overlay.querySelector('#auth-toggle-btn');
        const toggleText = overlay.querySelector('#auth-toggle-text');
        const submitBtn = overlay.querySelector('#auth-submit');

        toggleBtn.addEventListener('click', () => {
            isSignup = !isSignup;
            nameInput.classList.toggle('hidden', !isSignup);
            submitBtn.textContent = isSignup ? 'Create Account' : 'Sign In';
            toggleText.textContent = isSignup ? 'Already have an account?' : "Don't have an account?";
            toggleBtn.textContent = isSignup ? 'Sign In' : 'Sign Up';
            errorEl.classList.add('hidden');
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            errorEl.classList.add('hidden');
            submitBtn.disabled = true;
            submitBtn.textContent = isSignup ? 'Creating...' : 'Signing in...';
            try {
                const email = overlay.querySelector('#auth-email').value;
                const password = overlay.querySelector('#auth-password').value;
                const displayName = overlay.querySelector('#auth-name').value;
                if (isSignup) {
                    await signup(email, password, displayName);
                } else {
                    await login(email, password);
                }
                overlay.classList.remove('visible');
                setTimeout(() => overlay.remove(), 300);
                if (onSuccess) onSuccess();
                updateAuthUI();
            } catch (err) {
                errorEl.textContent = err.message;
                errorEl.classList.remove('hidden');
                submitBtn.disabled = false;
                submitBtn.textContent = isSignup ? 'Create Account' : 'Sign In';
            }
        });

        overlay.querySelector('#auth-email').focus();
    }

    function updateAuthUI() {
        const el = document.getElementById('user-info');
        if (!el) return;
        const user = getUser();
        if (user) {
            el.innerHTML = `<span class="user-name">${user.displayName || user.email}</span><button id="logout-btn" class="auth-link">Sign out</button>`;
            el.querySelector('#logout-btn').addEventListener('click', logout);
        } else {
            el.innerHTML = `<button id="login-btn" class="auth-link">Sign in</button>`;
            el.querySelector('#login-btn').addEventListener('click', () => showAuthModal(() => window.location.reload()));
        }
    }

    return { getToken, getUser, isLoggedIn, authHeaders, apiFetch, signup, login, logout, requireAuth, showAuthModal, updateAuthUI };
})();

document.addEventListener('DOMContentLoaded', () => Auth.updateAuthUI());
