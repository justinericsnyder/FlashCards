/**
 * Pure logic for the certification tracker — no DOM, no globals.
 *
 * Split out of certifications.html so the tricky bits (legacy migration, the
 * local⇄server merge, and the velocity/ETA math) can be unit-tested in Jest
 * (Johari #26). The page wires these into the UI; the tests exercise them in
 * isolation. Every function is deterministic — callers pass "today" in rather
 * than reading the clock, so tests don't depend on the wall clock.
 *
 * Works in the browser (window.CertLogic) and Node/Jest (module.exports).
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    else root.CertLogic = api;
})(typeof self !== "undefined" ? self : this, function () {
    "use strict";

    const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
    const STATUSES = ["earned", "target", "await"];

    const slugify = s =>
        String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 110);

    // Local-timezone YYYY-MM-DD. `now` is injectable for deterministic tests.
    function todayISO(now) {
        const d = now instanceof Date ? now : new Date();
        const off = d.getTimezoneOffset();
        return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
    }

    function fmtDate(iso) {
        if (!iso || !DATE_RE.test(iso)) return "";
        const [y, m, day] = iso.split("-").map(Number);
        const d = new Date(y, m - 1, day);
        return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    }

    function monthsBetween(isoA, isoB) {
        const a = new Date(isoA), b = new Date(isoB);
        return (b - a) / (1000 * 60 * 60 * 24 * 30.44);
    }

    // Coerce stored progress into the canonical { st, date? } shape.
    // Accepts the legacy "YYYY-MM-DD" string form and upgrades it to earned.
    function normalizeMap(m, today) {
        const t = today || todayISO();
        const out = {};
        for (const [k, v] of Object.entries(m || {})) {
            if (typeof v === "string") {
                if (DATE_RE.test(v)) out[k] = { st: "earned", date: v };
            } else if (v && typeof v === "object" && STATUSES.includes(v.st)) {
                out[k] = v.st === "earned"
                    ? { st: "earned", date: (typeof v.date === "string" && DATE_RE.test(v.date)) ? v.date : t }
                    : { st: v.st };
            }
        }
        return out;
    }

    // Reconcile local and server progress WITHOUT silently dropping earned work
    // (Johari #22 — the old code let the server blindly overwrite local).
    // Rules, applied per credential code:
    //   - "earned" always beats "target"/"await" (a pass is the strongest signal).
    //   - if both sides are earned, keep the EARLIER date (the true first-earned day).
    //   - otherwise the server value wins, but local-only entries are preserved.
    // Returns { merged, changedLocally } — changedLocally flags that the merged
    // result differs from `server`, i.e. there are local additions to push back.
    function mergeProgress(local, server) {
        const l = local || {}, s = server || {};
        const merged = {};
        const keys = new Set([...Object.keys(l), ...Object.keys(s)]);
        for (const k of keys) {
            const a = l[k], b = s[k];
            if (a && b) {
                if (a.st === "earned" && b.st === "earned") {
                    const date = (a.date && b.date) ? (a.date <= b.date ? a.date : b.date) : (a.date || b.date);
                    merged[k] = { st: "earned", date };
                } else if (a.st === "earned") {
                    merged[k] = a;
                } else if (b.st === "earned") {
                    merged[k] = b;
                } else {
                    merged[k] = b; // both non-earned → server wins
                }
            } else {
                merged[k] = a || b;
            }
        }
        // Did we end up with anything the server didn't have (or a better value)?
        let changedLocally = false;
        for (const k of Object.keys(merged)) {
            const b = s[k], mv = merged[k];
            if (!b || b.st !== mv.st || b.date !== mv.date) { changedLocally = true; break; }
        }
        return { merged, changedLocally };
    }

    // Aggregate the numbers the metric cards show. Pure: pass the scoped items,
    // the progress map, and "today". Never touches the DOM or the clock.
    function computeMetrics(scopedItems, progress, today) {
        const t = today || todayISO();
        const p = progress || {};
        const statusOf = code => (p[code] ? p[code].st : null);
        const total = scopedItems.length;
        const earnedItems = scopedItems.filter(c => statusOf(c.code) === "earned");
        const earned = earnedItems.length;
        const targeting = scopedItems.filter(c => statusOf(c.code) === "target").length;
        const awaiting = scopedItems.filter(c => statusOf(c.code) === "await").length;
        const remaining = total - earned;
        const pct = total ? Math.round((earned / total) * 100) : 0;

        const dates = earnedItems.map(c => p[c.code].date).filter(Boolean).sort();
        let perMonth = 0;
        if (dates.length) {
            const span = Math.max(monthsBetween(dates[0], t), 0.5);
            perMonth = earned / span;
        }
        const last90 = dates.filter(d => monthsBetween(d, t) <= 3).length;
        const last30 = dates.filter(d => monthsBetween(d, t) <= 1).length;

        let etaText = "—", etaMonths = null;
        if (perMonth > 0 && remaining > 0) {
            etaMonths = remaining / perMonth;
            etaText = etaMonths >= 12 ? (etaMonths / 12).toFixed(1) + " yr" : Math.ceil(etaMonths) + " mo";
        } else if (remaining === 0 && earned > 0) {
            etaText = "Done! 🎉";
        }
        return { total, earned, targeting, awaiting, remaining, pct, perMonth, last90, last30, etaText, etaMonths };
    }

    return { DATE_RE, STATUSES, slugify, todayISO, fmtDate, monthsBetween, normalizeMap, mergeProgress, computeMetrics };
});
