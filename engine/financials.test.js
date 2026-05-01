import { describe, it, expect } from "vitest";
import {
  calculateNIM,
  calculateCAR,
  calculateInterestIncome,
  calculateInterestExpense,
  calculateNPLProvision,
  calculateOneTimeCosts,
  isLiquidityBreached,
  getConcentrationRisk,
  getKPIStatus,
  checkLossConditions,
} from "./financials.js";

describe("calculateNIM", () => {
  it("returns 0 when loans is zero", () => {
    expect(calculateNIM(0, 80000, 6.5, 2.0)).toBe(0);
  });

  it("computes (income - expense) / loans * 100", () => {
    // income = 100000 * 0.08 * 0.25 = 2000
    // expense = 50000 * 0.04 * 0.25 = 500
    // NIM = 1500 / 100000 * 100 = 1.5
    expect(calculateNIM(100000, 50000, 8, 4)).toBe(1.5);
  });

  it("era 1 starting state is intentionally below warn threshold", () => {
    // Math produces 1.125, but toFixed(2) rounds up to 1.13 in IEEE 754
    // Still below the 1.2% warn threshold — intentional teaching mechanic
    expect(calculateNIM(80000, 80000, 6.5, 2.0)).toBe(1.13);
  });

  it("returns negative NIM when deposit costs exceed interest income", () => {
    // income = 100000 * 0.04 * 0.25 = 1000
    // expense = 200000 * 0.08 * 0.25 = 4000
    // NIM = -3000 / 100000 * 100 = -3
    expect(calculateNIM(100000, 200000, 4, 8)).toBe(-3);
  });
});

describe("calculateCAR", () => {
  it("returns 100 when loans is zero", () => {
    expect(calculateCAR(20000, 0)).toBe(100);
  });

  it("computes equity / loans * 100", () => {
    // 20000 / 80000 * 100 = 25.0
    expect(calculateCAR(20000, 80000)).toBe(25);
  });

  it("identifies a bank below the 8% regulatory minimum", () => {
    expect(calculateCAR(7000, 100000)).toBe(7);
  });
});

describe("calculateInterestIncome", () => {
  it("returns quarterly interest income on loan book", () => {
    // 80000 * 0.065 * 0.25 = 1300
    expect(calculateInterestIncome(80000, 6.5)).toBe(1300);
  });

  it("returns 0 with no loans", () => {
    expect(calculateInterestIncome(0, 6.5)).toBe(0);
  });
});

describe("calculateInterestExpense", () => {
  it("returns quarterly cost of deposits", () => {
    // 80000 * 0.02 * 0.25 = 400
    expect(calculateInterestExpense(80000, 2.0)).toBe(400);
  });
});

describe("calculateNPLProvision", () => {
  it("provisions one quarter of annual NPL loss", () => {
    // 100000 * 0.03 * 0.25 = 750
    expect(calculateNPLProvision(100000, 0.03)).toBe(750);
  });
});

describe("isLiquidityBreached", () => {
  it("returns true when cash falls below 2% of deposits", () => {
    // floor = 80000 * 0.02 = 1600, cash = 1000
    expect(isLiquidityBreached(1000, 80000)).toBe(true);
  });

  it("returns false when cash is above the floor", () => {
    expect(isLiquidityBreached(5000, 80000)).toBe(false);
  });

  it("returns false when cash is exactly at the floor (strict less-than)", () => {
    // floor = 80000 * 0.02 = 1600; 1600 < 1600 is false
    expect(isLiquidityBreached(1600, 80000)).toBe(false);
  });
});

describe("getConcentrationRisk", () => {
  const config = { whaleThreshold: 0.20, catastrophicThreshold: 0.35 };

  it("returns none when totalDeposits is zero", () => {
    expect(getConcentrationRisk(0, 0, config)).toBe("none");
  });

  it("returns none below whale threshold", () => {
    // 100000 / 1000000 = 10%
    expect(getConcentrationRisk(100000, 1000000, config)).toBe("none");
  });

  it("returns warning between whale and catastrophic thresholds", () => {
    // 250000 / 1000000 = 25%
    expect(getConcentrationRisk(250000, 1000000, config)).toBe("warning");
  });

  it("returns critical at or above catastrophic threshold", () => {
    // 400000 / 1000000 = 40%
    expect(getConcentrationRisk(400000, 1000000, config)).toBe("critical");
  });

  it("returns critical at exactly the catastrophicThreshold (>=)", () => {
    // 350000 / 1000000 = 0.35 === catastrophicThreshold
    expect(getConcentrationRisk(350000, 1000000, config)).toBe("critical");
  });
});

describe("getKPIStatus", () => {
  it("returns healthy for an unknown KPI key", () => {
    expect(getKPIStatus("unknown", 5)).toBe("healthy");
  });

  it("NIM: danger below 0.5%", () => {
    expect(getKPIStatus("nim", 0.3)).toBe("danger");
  });

  it("NIM: warn between 0.5% and 1.2%", () => {
    expect(getKPIStatus("nim", 0.8)).toBe("warn");
  });

  it("NIM: healthy above 1.2%", () => {
    expect(getKPIStatus("nim", 2.0)).toBe("healthy");
  });

  it("NPL: danger when ratio exceeds 9% (inverted)", () => {
    expect(getKPIStatus("npl", 0.10)).toBe("danger");
  });

  it("NPL: warn between 5% and 9% (inverted)", () => {
    expect(getKPIStatus("npl", 0.06)).toBe("warn");
  });

  it("NPL: healthy below 5% (inverted)", () => {
    expect(getKPIStatus("npl", 0.03)).toBe("healthy");
  });

  it("NIM boundary: exactly 0.5 is warn, not danger (strict less-than)", () => {
    expect(getKPIStatus("nim", 0.5)).toBe("warn");
  });

  it("NIM boundary: exactly 1.2 is healthy, not warn (strict less-than)", () => {
    expect(getKPIStatus("nim", 1.2)).toBe("healthy");
  });

  it("NPL boundary: exactly 0.09 is warn, not danger (strict greater-than)", () => {
    expect(getKPIStatus("npl", 0.09)).toBe("warn");
  });

  it("NPL boundary: exactly 0.05 is healthy, not warn (strict greater-than)", () => {
    expect(getKPIStatus("npl", 0.05)).toBe("healthy");
  });
});

describe("calculateOneTimeCosts", () => {
  const base = { staff: { tellers: 2, loanOfficers: 1, security: 0 }, fac: { vaultLevel: 1, waitingSeats: 2 } };

  it("returns 0 when nothing changed from committed", () => {
    expect(calculateOneTimeCosts(base.staff, base.fac, base)).toBe(0);
  });

  it("charges hireCost for each net-new teller (5000 each)", () => {
    const staff = { ...base.staff, tellers: 4 };
    // 2 new tellers × $5,000 = $10,000
    expect(calculateOneTimeCosts(staff, base.fac, base)).toBe(10000);
  });

  it("charges vault upgrade cost for each level gained (level 1→2 = $8,000)", () => {
    const fac = { ...base.fac, vaultLevel: 2 };
    expect(calculateOneTimeCosts(base.staff, fac, base)).toBe(8000);
  });

  it("charges $500 per net-new waiting seat", () => {
    const fac = { ...base.fac, waitingSeats: 5 };
    // 3 new seats × $500 = $1,500
    expect(calculateOneTimeCosts(base.staff, fac, base)).toBe(1500);
  });

  it("combines staff hire and facility upgrade costs", () => {
    const staff = { ...base.staff, tellers: 3 };  // +1 teller = $5,000
    const fac   = { ...base.fac,  vaultLevel: 2 }; // level 1→2 = $8,000
    expect(calculateOneTimeCosts(staff, fac, base)).toBe(13000);
  });
});

// TODO: add calculateFrustration tests when the function is built

describe("checkLossConditions", () => {
  const INSOLVENCY = {
    id: "insolvency", title: "FDIC Seizure", message: "Equity negative.",
    trigger: { equity: { below: 0 } },
  };
  const LIQUIDITY = {
    id: "liquidity", title: "Liquidity Crisis", message: "Cash too low.",
    trigger: { cash: { belowFractionOfDeposits: 0.02 } },
  };
  const NPL = {
    id: "npl", title: "NPL Crisis", message: "Receivership.",
    trigger: { nplRatio: { above: 0.12, consecutiveQuarters: 2 } },
  };

  const healthy = { equity: 50000, cash: 10000, deposits: 100000, nplRatio: 0.03, reputation: 70 };

  it("returns null when all conditions are healthy", () => {
    expect(checkLossConditions(healthy, [healthy], [INSOLVENCY, LIQUIDITY, NPL])).toBe(null);
  });

  it("fires insolvency when equity goes negative", () => {
    const fin = { ...healthy, equity: -1 };
    expect(checkLossConditions(fin, [fin], [INSOLVENCY, LIQUIDITY, NPL])).toBe(INSOLVENCY);
  });

  it("does not fire insolvency when equity is exactly zero (strict below)", () => {
    const fin = { ...healthy, equity: 0 };
    expect(checkLossConditions(fin, [fin], [INSOLVENCY])).toBe(null);
  });

  it("fires liquidity when cash falls below 2% of deposits", () => {
    // floor = 100000 * 0.02 = 2000; cash = 1999 triggers breach
    const fin = { ...healthy, cash: 1999 };
    expect(checkLossConditions(fin, [fin], [INSOLVENCY, LIQUIDITY, NPL])).toBe(LIQUIDITY);
  });

  it("does not fire NPL after only one quarter above threshold", () => {
    const q1 = { ...healthy, nplRatio: 0.13 };
    expect(checkLossConditions(q1, [q1], [NPL])).toBe(null);
  });

  it("fires NPL after two consecutive quarters above threshold", () => {
    const q1 = { ...healthy, nplRatio: 0.13 };
    const q2 = { ...healthy, nplRatio: 0.14 };
    expect(checkLossConditions(q2, [q1, q2], [NPL])).toBe(NPL);
  });

  it("does not fire NPL when breach is non-consecutive (high, recovered, high)", () => {
    const q1 = { ...healthy, nplRatio: 0.13 };
    const q2 = { ...healthy, nplRatio: 0.09 };
    const q3 = { ...healthy, nplRatio: 0.13 };
    expect(checkLossConditions(q3, [q1, q2, q3], [NPL])).toBe(null);
  });

  it("fires NPL on the quarter that completes two consecutive breaches after a gap", () => {
    // Q1 high, Q2 recovered, Q3 high, Q4 high → fires on Q4
    const q1 = { ...healthy, nplRatio: 0.13 };
    const q2 = { ...healthy, nplRatio: 0.09 };
    const q3 = { ...healthy, nplRatio: 0.13 };
    const q4 = { ...healthy, nplRatio: 0.15 };
    expect(checkLossConditions(q4, [q1, q2, q3, q4], [NPL])).toBe(NPL);
  });

  it("does not fire NPL when exactly at the threshold (strict above)", () => {
    const q1 = { ...healthy, nplRatio: 0.12 };
    const q2 = { ...healthy, nplRatio: 0.12 };
    expect(checkLossConditions(q2, [q1, q2], [NPL])).toBe(null);
  });
});
