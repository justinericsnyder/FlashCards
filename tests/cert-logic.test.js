const L = require("../frontend/cert-logic.js");
const CertData = require("../frontend/certs-data.js");

describe("slugify", () => {
    test("produces a stable, url-safe id", () => {
        expect(L.slugify("Create an AI agent")).toBe("create-an-ai-agent");
    });
    test("strips punctuation and collapses separators", () => {
        expect(L.slugify("Get started with classes, properties, and methods in C#"))
            .toBe("get-started-with-classes-properties-and-methods-in-c");
    });
    test("caps length at 110 chars", () => {
        expect(L.slugify("a".repeat(200)).length).toBeLessThanOrEqual(110);
    });
});

describe("todayISO", () => {
    test("formats an injected date as local YYYY-MM-DD", () => {
        // Noon UTC avoids the value landing on a different local calendar day.
        expect(L.todayISO(new Date("2026-07-03T12:00:00Z"))).toBe("2026-07-03");
    });
});

describe("normalizeMap", () => {
    test("upgrades legacy date strings to earned entries", () => {
        expect(L.normalizeMap({ "AZ-900": "2026-01-15" }))
            .toEqual({ "AZ-900": { st: "earned", date: "2026-01-15" } });
    });
    test("keeps valid status objects and backfills missing earned dates", () => {
        const out = L.normalizeMap(
            { A: { st: "target" }, B: { st: "earned" }, C: { st: "await" } },
            "2026-07-03"
        );
        expect(out).toEqual({
            A: { st: "target" },
            B: { st: "earned", date: "2026-07-03" },
            C: { st: "await" },
        });
    });
    test("drops junk values and bad status strings", () => {
        expect(L.normalizeMap({ A: "not-a-date", B: { st: "bogus" }, C: 42, D: null }))
            .toEqual({});
    });
    test("tolerates null/undefined input", () => {
        expect(L.normalizeMap(null)).toEqual({});
        expect(L.normalizeMap(undefined)).toEqual({});
    });
});

describe("mergeProgress", () => {
    test("earned beats a non-earned status regardless of side", () => {
        const { merged } = L.mergeProgress(
            { A: { st: "earned", date: "2026-02-01" } },
            { A: { st: "target" } }
        );
        expect(merged.A).toEqual({ st: "earned", date: "2026-02-01" });
    });
    test("when both earned, keeps the earlier date", () => {
        const { merged } = L.mergeProgress(
            { A: { st: "earned", date: "2026-05-01" } },
            { A: { st: "earned", date: "2026-03-01" } }
        );
        expect(merged.A).toEqual({ st: "earned", date: "2026-03-01" });
    });
    test("preserves local-only entries and flags a push-back", () => {
        const { merged, changedLocally } = L.mergeProgress(
            { A: { st: "earned", date: "2026-02-01" } },
            {}
        );
        expect(merged.A).toEqual({ st: "earned", date: "2026-02-01" });
        expect(changedLocally).toBe(true);
    });
    test("server wins when neither side is earned", () => {
        const { merged } = L.mergeProgress({ A: { st: "target" } }, { A: { st: "await" } });
        expect(merged.A).toEqual({ st: "await" });
    });
    test("identical maps report no local change", () => {
        const same = { A: { st: "earned", date: "2026-02-01" } };
        expect(L.mergeProgress(same, same).changedLocally).toBe(false);
    });
});

describe("computeMetrics", () => {
    const items = [
        { code: "A" }, { code: "B" }, { code: "C" }, { code: "D" },
    ];
    test("counts earned/targeting/awaiting and computes pct", () => {
        const m = L.computeMetrics(items, {
            A: { st: "earned", date: "2026-06-01" },
            B: { st: "target" },
            C: { st: "await" },
        }, "2026-07-03");
        expect(m.total).toBe(4);
        expect(m.earned).toBe(1);
        expect(m.targeting).toBe(1);
        expect(m.awaiting).toBe(1);
        expect(m.remaining).toBe(3);
        expect(m.pct).toBe(25);
    });
    test("velocity and ETA derive from earned dates", () => {
        const m = L.computeMetrics(items, {
            A: { st: "earned", date: "2026-01-03" },
            B: { st: "earned", date: "2026-04-03" },
        }, "2026-07-03");
        expect(m.perMonth).toBeGreaterThan(0);
        expect(m.etaText).toMatch(/mo|yr/);
    });
    test("all earned shows the done state", () => {
        const done = Object.fromEntries(items.map(i => [i.code, { st: "earned", date: "2026-06-01" }]));
        const m = L.computeMetrics(items, done, "2026-07-03");
        expect(m.remaining).toBe(0);
        expect(m.etaText).toContain("Done");
    });
    test("empty progress is safe", () => {
        const m = L.computeMetrics(items, {}, "2026-07-03");
        expect(m.pct).toBe(0);
        expect(m.perMonth).toBe(0);
        expect(m.etaText).toBe("—");
    });
});

describe("catalogue data integrity", () => {
    test("every cert has code, title, cat, level, provider", () => {
        for (const c of CertData.CERTS) {
            expect(c.code).toBeTruthy();
            expect(c.title).toBeTruthy();
            expect(CertData.CATEGORIES.some(cat => cat.key === c.cat)).toBe(true);
            expect(CertData.CERT_LEVELS).toContain(c.level);
            expect(["tech", "business", "github"]).toContain(c.provider);
        }
    });
    test("cert codes are unique", () => {
        const codes = CertData.CERTS.map(c => c.code);
        expect(new Set(codes).size).toBe(codes.length);
    });
    test("applied-skill slugs are unique", () => {
        const slugs = CertData.APPLIED_SKILLS.map(s => "as-" + L.slugify(s.title));
        expect(new Set(slugs).size).toBe(slugs.length);
    });
    test("CATALOGUE_UPDATED is an ISO date", () => {
        expect(CertData.CATALOGUE_UPDATED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
});
