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

    function daysBetween(isoA, isoB) {
        return Math.round((new Date(isoB) - new Date(isoA)) / (1000 * 60 * 60 * 24));
    }

    // Calendar-aware "same day next year" (Feb 29 clamps to Feb 28).
    function addYears(iso, n) {
        const [y, m, d] = iso.split("-").map(Number);
        const t = new Date(Date.UTC(y + n, m - 1, d));
        if (t.getUTCMonth() !== m - 1) t.setUTCDate(0);
        return t.toISOString().slice(0, 10);
    }

    // Coerce stored progress into the canonical shape:
    //   earned       → { st: "earned", date }
    //   target/await → { st, since }   (since = when the status was set — lets the
    //                                   UI age statuses and nudge stale ones, #20)
    // Accepts the legacy "YYYY-MM-DD" string form and upgrades it to earned;
    // pre-#20 statuses without `since` are stamped with today.
    function normalizeMap(m, today) {
        const t = today || todayISO();
        const out = {};
        for (const [k, v] of Object.entries(m || {})) {
            if (typeof v === "string") {
                if (DATE_RE.test(v)) out[k] = { st: "earned", date: v };
            } else if (v && typeof v === "object" && STATUSES.includes(v.st)) {
                out[k] = v.st === "earned"
                    ? { st: "earned", date: (typeof v.date === "string" && DATE_RE.test(v.date)) ? v.date : t }
                    : { st: v.st, since: (typeof v.since === "string" && DATE_RE.test(v.since)) ? v.since : t };
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
    // Returns { merged, changedLocally, changedFromLocal }:
    //   changedLocally   — merged differs from `server` (there's something to push back)
    //   changedFromLocal — how many entries differ from `local` (what a pull changed
    //                      on this device — lets the UI say "updated N items", #13)
    function sameEntry(a, b) {
        return !!a && !!b && a.st === b.st && a.date === b.date && a.since === b.since;
    }
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
                } else if (a.st === b.st) {
                    // Same status on both sides — keep the earlier "since" (true start).
                    const since = (a.since && b.since) ? (a.since <= b.since ? a.since : b.since) : (a.since || b.since);
                    merged[k] = since ? { st: b.st, since } : { st: b.st };
                } else {
                    merged[k] = b; // both non-earned, different → server wins
                }
            } else {
                merged[k] = a || b;
            }
        }
        let changedLocally = false;
        for (const k of Object.keys(merged)) {
            if (!sameEntry(s[k], merged[k])) { changedLocally = true; break; }
        }
        let changedFromLocal = 0;
        for (const k of Object.keys(merged)) {
            if (!sameEntry(l[k], merged[k])) changedFromLocal++;
        }
        return { merged, changedLocally, changedFromLocal };
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

    // Annual renewal (#16). Microsoft role-based & specialty certifications expire
    // one year after they're earned; Fundamentals, Business, and Applied Skills
    // don't. Returns null when renewal doesn't apply, else { due, daysLeft, state }
    // where state is "ok" | "due" (renewal window, ≤180 days out) | "overdue".
    function renewal(item, entry, today) {
        if (!item || item.applied) return null;
        if (item.level === "Fundamentals" || item.level === "Business") return null;
        if (!entry || entry.st !== "earned" || !entry.date) return null;
        const t = today || todayISO();
        const due = addYears(entry.date, 1);
        const daysLeft = daysBetween(t, due);
        const state = daysLeft < 0 ? "overdue" : daysLeft <= 180 ? "due" : "ok";
        return { due, daysLeft, state };
    }

    // How long a target/await status has been sitting, in days (#20). Null when
    // the entry has no aging timestamp (earned entries, or nothing set).
    function statusAgeDays(entry, today) {
        if (!entry || entry.st === "earned" || !entry.since) return null;
        return Math.max(daysBetween(entry.since, today || todayISO()), 0);
    }

    return { DATE_RE, STATUSES, slugify, todayISO, fmtDate, monthsBetween, daysBetween, addYears, normalizeMap, mergeProgress, computeMetrics, renewal, statusAgeDays };
});
