import { describe, it, expect } from "vitest";
import { STAFF_DEFINITIONS, DEFAULT_STAFF } from "../config/characters.js";

// Staffing caps must match what the engine can actually model. The loan-officer
// cap in particular guards a silent failure: the engine models a single loan
// desk (every check in engine/simulation.js is binary `loanOfficers > 0` against
// one loanDeskPos/occupancy.loanDesk spot, and the renderer only ever draws
// loanOfficerRoster[0]). With max > 1 a player could hire a 2nd or 3rd officer
// for $8k + $4k/qtr each and get zero throughput and no second chibi. v1 caps
// the role at 1 to stay honest; raising it must travel with the multi-desk
// engine work (ROADMAP "Loan officer count beyond 1"), so this test fails loudly
// if the cap is lifted on its own.

describe("staff definition caps", () => {
  it("loan officers are capped at 1 (single-desk model)", () => {
    expect(STAFF_DEFINITIONS.loanOfficers.max).toBe(1);
  });

  it("every staff role has a positive integer max", () => {
    for (const [role, def] of Object.entries(STAFF_DEFINITIONS)) {
      expect(def.max, `${role}.max`).toBeTypeOf("number");
      expect(Number.isInteger(def.max), `${role}.max is an integer`).toBe(true);
      expect(def.max, `${role}.max > 0`).toBeGreaterThan(0);
    }
  });

  // The setup screen renders def.plural directly. It used to render `label + "s"`,
  // which produced "Securitys". A role added without a plural would now render a
  // blank label instead, so require the field rather than falling back to the rule
  // that caused the bug.
  it("every staff role has a non-empty label and plural", () => {
    for (const [role, def] of Object.entries(STAFF_DEFINITIONS)) {
      expect(def.label, `${role}.label`).toBeTypeOf("string");
      expect(def.label.length, `${role}.label is non-empty`).toBeGreaterThan(0);
      expect(def.plural, `${role}.plural`).toBeTypeOf("string");
      expect(def.plural.length, `${role}.plural is non-empty`).toBeGreaterThan(0);
    }
  });

  it("every default staffing level sits within its role's cap", () => {
    for (const [role, count] of Object.entries(DEFAULT_STAFF)) {
      expect(STAFF_DEFINITIONS[role], `${role} has a definition`).toBeDefined();
      expect(count, `${role} default >= 0`).toBeGreaterThanOrEqual(0);
      expect(count, `${role} default <= max`).toBeLessThanOrEqual(STAFF_DEFINITIONS[role].max);
    }
  });
});
