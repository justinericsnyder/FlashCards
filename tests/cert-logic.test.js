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
            A: { st: "target", since: "2026-07-03" },
            B: { st: "earned", date: "2026-07-03" },
            C: { st: "await", since: "2026-07-03" },
        });
    });
    test("preserves an existing since on non-earned statuses", () => {
        const out = L.normalizeMap({ A: { st: "target", since: "2026-01-10" } }, "2026-07-03");
        expect(out.A).toEqual({ st: "target", since: "2026-01-10" });
    });
    test("preserves a booked exam date on targeted entries, drops invalid ones", () => {
        const out = L.normalizeMap({
            A: { st: "target", since: "2026-01-10", exam: "2026-09-20" },
            B: { st: "target", since: "2026-01-10", exam: "soon" },
        }, "2026-07-03");
        expect(out.A).toEqual({ st: "target", since: "2026-01-10", exam: "2026-09-20" });
        expect(out.B).toEqual({ st: "target", since: "2026-01-10" });
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
    test("same non-earned status keeps the earlier since", () => {
        const { merged } = L.mergeProgress(
            { A: { st: "target", since: "2026-01-05" } },
            { A: { st: "target", since: "2026-03-01" } }
        );
        expect(merged.A).toEqual({ st: "target", since: "2026-01-05" });
    });
    test("same-status merge carries the booked exam date through", () => {
        const { merged } = L.mergeProgress(
            { A: { st: "target", since: "2026-01-05", exam: "2026-10-01" } },
            { A: { st: "target", since: "2026-03-01" } }
        );
        expect(merged.A).toEqual({ st: "target", since: "2026-01-05", exam: "2026-10-01" });
    });
    test("counts entries a pull changed on this device", () => {
        const { changedFromLocal } = L.mergeProgress(
            { A: { st: "earned", date: "2026-02-01" } },
            { A: { st: "earned", date: "2026-02-01" }, B: { st: "earned", date: "2026-03-01" }, C: { st: "target", since: "2026-04-01" } }
        );
        expect(changedFromLocal).toBe(2); // B and C are new locally; A unchanged
    });
});

describe("renewal", () => {
    const roleCert = { code: "AZ-104", level: "Role-based" };
    test("role-based certs renew one year after earning", () => {
        const r = L.renewal(roleCert, { st: "earned", date: "2026-01-15" }, "2026-06-01");
        expect(r.due).toBe("2027-01-15");
        expect(r.state).toBe("ok");
    });
    test("enters the due window at 180 days and goes overdue after the date", () => {
        expect(L.renewal(roleCert, { st: "earned", date: "2025-09-01" }, "2026-06-01").state).toBe("due");
        expect(L.renewal(roleCert, { st: "earned", date: "2025-01-01" }, "2026-06-01").state).toBe("overdue");
    });
    test("does not apply to Fundamentals, Business, Applied Skills, or unearned items", () => {
        expect(L.renewal({ level: "Fundamentals" }, { st: "earned", date: "2026-01-01" }, "2026-06-01")).toBeNull();
        expect(L.renewal({ level: "Business" }, { st: "earned", date: "2026-01-01" }, "2026-06-01")).toBeNull();
        expect(L.renewal({ level: "Role-based", applied: true }, { st: "earned", date: "2026-01-01" }, "2026-06-01")).toBeNull();
        expect(L.renewal(roleCert, { st: "target", since: "2026-01-01" }, "2026-06-01")).toBeNull();
    });
    test("addYears clamps Feb 29 to Feb 28", () => {
        expect(L.addYears("2028-02-29", 1)).toBe("2029-02-28");
    });
});

describe("date math parses local calendar dates (#6)", () => {
    test("parseISO returns local midnight, matching todayISO's calendar", () => {
        const d = L.parseISO("2026-07-03");
        expect(d.getFullYear()).toBe(2026);
        expect(d.getMonth()).toBe(6);
        expect(d.getDate()).toBe(3);
        expect(d.getHours()).toBe(0); // local, not UTC
    });
    test("daysBetween counts calendar days exactly", () => {
        expect(L.daysBetween("2026-06-30", "2026-07-03")).toBe(3);
        expect(L.daysBetween("2026-07-03", "2026-07-03")).toBe(0);
        expect(L.daysBetween("2026-07-04", "2026-07-03")).toBe(-1);
    });
});

describe("statusAgeDays", () => {
    test("ages a non-earned status from its since date", () => {
        expect(L.statusAgeDays({ st: "await", since: "2026-06-01" }, "2026-07-03")).toBe(32);
    });
    test("returns null for earned or unstamped entries", () => {
        expect(L.statusAgeDays({ st: "earned", date: "2026-06-01" }, "2026-07-03")).toBeNull();
        expect(L.statusAgeDays({ st: "target" }, "2026-07-03")).toBeNull();
        expect(L.statusAgeDays(null, "2026-07-03")).toBeNull();
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
    test("prereq references point at real, active cert codes", () => {
        const codes = new Set(CertData.CERTS.map(c => c.code));
        for (const c of CertData.CERTS) {
            (c.prereqs || []).forEach(p => expect(codes.has(p)).toBe(true));
        }
    });
    // Catalogue governance (#19): every credential code this app has EVER shipped
    // must still exist in CERTS or RETIRED. A poster refresh that deletes a code
    // without retiring it would orphan user progress invisibly — this freezes the
    // full historical roster so that mistake fails CI instead of shipping.
    // When adding a new cert: add its code here. When removing one: move it to
    // RETIRED in certs-data.js — never just delete it.
    test("no historical code may vanish without being retired", () => {
        const EVER_SHIPPED = [
            // v3.0 (June 2026 poster)
            "AZ-900", "AI-900", "AI-901", "DP-900", "AZ-104", "AZ-204", "AZ-305", "AZ-400",
            "AZ-700", "AZ-800 / AZ-801", "AI-102", "AI-103", "AI-200", "AI-300", "DP-300",
            "DP-600", "DP-700", "DP-750", "DP-800", "PL-300", "AZ-120", "AZ-140", "DP-420",
            "GH-900", "GH-100", "GH-200", "GH-300", "GH-600", "AB-900", "PL-900", "MD-102",
            "MS-102", "MS-721", "MS-700", "MB-230", "MB-240", "MB-280", "MB-310", "MB-330",
            "MB-335", "MB-500", "MB-700", "MB-800", "MB-820", "PL-200", "PL-400", "PL-500",
            "PL-600", "AB-100", "AB-620", "AB-210", "AB-250", "AB-410", "AB-730", "AB-731",
            "SC-900", "AZ-500", "SC-100", "SC-200", "SC-300", "SC-401", "SC-500", "SC-730",
            "GH-500",
            // v3.2 additions (July 2026 poster)
            "AZ-802", "AI-500", "AB-650",
        ];
        const live = new Set([
            ...CertData.CERTS.map(c => c.code),
            ...CertData.RETIRED.map(r => r.code),
        ]);
        const lost = EVER_SHIPPED.filter(code => !live.has(code));
        expect(lost).toEqual([]);
    });
    test("retired codes never collide with the active catalogue", () => {
        const codes = new Set(CertData.CERTS.map(c => c.code));
        for (const r of CertData.RETIRED) {
            expect(codes.has(r.code)).toBe(false);
            expect(r.title).toBeTruthy();
            expect(r.retired).toMatch(/^\d{4}-\d{2}$/);
        }
    });
});
