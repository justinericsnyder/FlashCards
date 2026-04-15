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
        clippysrevenge: { primary: '#00a4ef', primaryDark: '#0078d4', bgBody: '#0a0a12', bgCard: '#10101e', border: '#1a1a2e', text: '#e8eaf0', textDim: '#a0a8c0', textMuted: '#5c6480' },
        clippyslight: { primary: '#0078d4', primaryDark: '#005a9e', bgBody: '#f3f6fc', bgCard: '#ffffff', border: '#d0daea', text: '#1b2a4a', textDim: '#4a5a7a', textMuted: '#8090b0' },
        bezossmile: { primary: '#ff9900', primaryDark: '#ec7211', bgBody: '#0a0a14', bgCard: '#131722', border: '#1e2230', text: '#e8e8f0', textDim: '#a8aab8', textMuted: '#6c6e7a' },
        bezoslight: { primary: '#ec7211', primaryDark: '#c45e0e', bgBody: '#faf8f5', bgCard: '#ffffff', border: '#e0d8cc', text: '#232f3e', textDim: '#545b64', textMuted: '#8c939a' },
        dontbeevil: { primary: '#4285f4', primaryDark: '#3367d6', bgBody: '#0c0c0c', bgCard: '#141414', border: '#1e1e1e', text: '#e8e8e8', textDim: '#a8a8a8', textMuted: '#5a5a5a' },
        dontbelight: { primary: '#4285f4', primaryDark: '#3367d6', bgBody: '#f8f9fa', bgCard: '#ffffff', border: '#dadce0', text: '#202124', textDim: '#5f6368', textMuted: '#9aa0a6' },
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
