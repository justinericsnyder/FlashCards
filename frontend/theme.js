/**
 * Theme loader — runs on every page, applies saved theme immediately.
 * Must be loaded early (before styles paint) to prevent flash.
 */
(function() {
    const THEMES = {
        pittsburgh: { primary: '#f5c518', primaryDark: '#d4a80e', bgBody: '#050505', bgCard: '#0e0e0e', border: '#1a1a1a', text: '#e5e5e5', textDim: '#a3a3a3', textMuted: '#5c5c5c' },
        midnight: { primary: '#60a5fa', primaryDark: '#3b82f6', bgBody: '#0a0f1a', bgCard: '#111827', border: '#1e293b', text: '#e2e8f0', textDim: '#94a3b8', textMuted: '#64748b' },
        emerald: { primary: '#34d399', primaryDark: '#10b981', bgBody: '#051a0e', bgCard: '#0a1f14', border: '#14291e', text: '#d1fae5', textDim: '#a7f3d0', textMuted: '#4ade80' },
        crimson: { primary: '#f87171', primaryDark: '#ef4444', bgBody: '#1a0505', bgCard: '#1f0a0a', border: '#2d1010', text: '#fecaca', textDim: '#fca5a5', textMuted: '#f87171' },
        violet: { primary: '#a78bfa', primaryDark: '#8b5cf6', bgBody: '#0f0520', bgCard: '#150a2e', border: '#1e1035', text: '#ede9fe', textDim: '#c4b5fd', textMuted: '#8b5cf6' },
        arctic: { primary: '#0ea5e9', primaryDark: '#0284c7', bgBody: '#f8fafc', bgCard: '#ffffff', border: '#e2e8f0', text: '#1e293b', textDim: '#475569', textMuted: '#94a3b8' },
        sunset: { primary: '#fb923c', primaryDark: '#f97316', bgBody: '#1a0a05', bgCard: '#1f100a', border: '#2d1a0a', text: '#fed7aa', textDim: '#fdba74', textMuted: '#f97316' },
        mono: { primary: '#a3a3a3', primaryDark: '#737373', bgBody: '#0a0a0a', bgCard: '#141414', border: '#1a1a1a', text: '#e5e5e5', textDim: '#a3a3a3', textMuted: '#737373' },
        gopackgo: { primary: '#ffb612', primaryDark: '#d49a00', bgBody: '#0a1208', bgCard: '#132010', border: '#1d3a1a', text: '#e8f0e4', textDim: '#b8d4a8', textMuted: '#6b8f5b' },
    };

    const saved = localStorage.getItem('fc_theme');
    if (saved && THEMES[saved]) {
        const t = THEMES[saved];
        const r = document.documentElement.style;
        r.setProperty('--primary', t.primary);
        r.setProperty('--primary-dark', t.primaryDark);
        r.setProperty('--primary-glow', t.primary + '1a'); // hex with alpha
        r.setProperty('--primary-subtle', t.primary + '0d');
        r.setProperty('--bg-body', t.bgBody);
        r.setProperty('--bg-card', t.bgCard);
        r.setProperty('--bg-card-hover', t.bgCard);
        r.setProperty('--bg-input', t.bgBody);
        r.setProperty('--bg-choice', t.bgCard);
        r.setProperty('--bg-elevated', t.bgCard);
        r.setProperty('--border', t.border);
        r.setProperty('--border-subtle', t.border);
        r.setProperty('--border-focus', t.primary);
        r.setProperty('--text', t.text);
        r.setProperty('--text-dim', t.textDim || t.text);
        r.setProperty('--text-muted', t.textMuted || t.textDim || t.text);
    }

    const fontSize = localStorage.getItem('fc_font_size');
    if (fontSize) document.documentElement.dataset.fontSize = fontSize;
})();
