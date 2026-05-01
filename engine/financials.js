import { KPI_DEFINITIONS, POLICY_IMPACTS } from "../config/economy.js";
import { STAFF_DEFINITIONS }              from "../config/characters.js";

// ─── CORE BANKING CALCULATIONS ────────────────────────────────────────────────
// All pure functions. No state mutations. Safe to call from anywhere.

/** True NIM = (interest income - interest expense) / loans * 100 */
export function calculateNIM(loans, deposits, lendingRate, depositRate) {
  if (loans === 0) return 0;
  const income  = loans    * (lendingRate / 100) * 0.25;
  const expense = deposits * (depositRate / 100) * 0.25;
  return +((income - expense) / loans * 100).toFixed(2);
}

/** Capital Adequacy Ratio = equity / loans * 100 */
export function calculateCAR(equity, loans) {
  if (loans === 0) return 100;
  return +((equity / loans) * 100).toFixed(1);
}

/** Quarterly interest income */
export function calculateInterestIncome(loans, lendingRate) {
  return Math.round(loans * (lendingRate / 100) * 0.25);
}

/** Quarterly interest expense */
export function calculateInterestExpense(deposits, depositRate) {
  return Math.round(deposits * (depositRate / 100) * 0.25);
}

/** Quarterly NPL provision */
export function calculateNPLProvision(loans, nplRatio) {
  return Math.round(loans * nplRatio * 0.25);
}

/** Returns "danger" | "warn" | "healthy" for a KPI value */
export function getKPIStatus(kpiKey, value) {
  const def = KPI_DEFINITIONS[kpiKey];
  if (!def) return "healthy";
  if (def.invert) {
    if (value > def.danger) return "danger";
    if (value > def.warn)   return "warn";
    return "healthy";
  }
  if (value < def.danger) return "danger";
  if (value < def.warn)   return "warn";
  return "healthy";
}

// ─── COST CALCULATIONS ────────────────────────────────────────────────────────

export function calculateOneTimeCosts(staff, fac, committed) {
  let total = 0;
  Object.keys(STAFF_DEFINITIONS).forEach(role => {
    const def      = STAFF_DEFINITIONS[role];
    const newHires = Math.max(0, (staff[role] || 0) - (committed.staff[role] || 0));
    total += newHires * def.hireCost;
  });
  const vaultCosts = [0, 8000, 20000];
  for (let i = committed.fac.vaultLevel; i < fac.vaultLevel; i++) {
    total += vaultCosts[i] || 0;
  }
  total += Math.max(0, fac.waitingSeats - committed.fac.waitingSeats) * 500;
  return total;
}

export function calculateRecurringSalaries(staff) {
  return Object.keys(STAFF_DEFINITIONS).reduce((total, role) => {
    return total + (staff[role] || 0) * STAFF_DEFINITIONS[role].salary;
  }, 0);
}

// ─── QUARTERLY P&L ────────────────────────────────────────────────────────────

export function calculateQuarterlyPL(fin, policy, staff, dayResult) {
  const interestIncome  = calculateInterestIncome(fin.loans, policy.lendingRate);
  const interestExpense = calculateInterestExpense(fin.deposits, policy.depositRate);
  const nplProvision    = calculateNPLProvision(fin.loans, fin.nplRatio);
  const salaries        = calculateRecurringSalaries(staff);

  const depositGrowth  = Math.round(dayResult.deposited * 0.12);
  const loanGrowth     = dayResult.loans * 14000;
  const whaleBonus     = dayResult.whaleServed
                         ? Math.round(dayResult.deposited * 0.07) : 0;

  const netIncome = interestIncome - interestExpense - nplProvision
                  - salaries + depositGrowth + whaleBonus
                  - (dayResult.robberyLoss || 0)
                  - (dayResult.regulatoryFine || 0)
                  - (dayResult.setupCost || 0);

  const updatedFin = {
    ...fin,
    cash:       fin.cash + netIncome,
    deposits:   fin.deposits + depositGrowth,
    loans:      fin.loans + loanGrowth,
    equity:     fin.equity + Math.max(0, Math.round(netIncome * 0.55)),
    nplRatio:   Math.max(0.01, Math.min(0.15,
                  fin.nplRatio + (policy.lendingRate > 8 ? 0.005 : -0.001)
                )),
    quarter:    fin.quarter === 4 ? 1 : fin.quarter + 1,
    year:       fin.quarter === 4 ? fin.year + 1 : fin.year,
    reputation: Math.min(100, Math.max(0,
                  fin.reputation
                  + (dayResult.served > 5 ? 3 : -1)
                  - (dayResult.regulatoryFine > 0 ? 8 : 0)
                  - (dayResult.walkouts > 3 ? 4 : 0)
                  + (dayResult.whaleServed ? 5 : 0)
                )),
  };

  return {
    interestIncome, interestExpense, nplProvision, salaries,
    depositGrowth, whaleBonus,
    robberyLoss:    dayResult.robberyLoss    || 0,
    regulatoryFine: dayResult.regulatoryFine || 0,
    setupCost:      dayResult.setupCost      || 0,
    netIncome,
    updatedFin,
  };
}

// ─── CONDITION CHECKS ─────────────────────────────────────────────────────────

export function isLiquidityBreached(cash, deposits) {
  return cash < deposits * 0.02;
}

export function getConcentrationRisk(whaleDeposit, totalDeposits, config) {
  if (totalDeposits === 0) return "none";
  const ratio = whaleDeposit / totalDeposits;
  if (ratio >= config.catastrophicThreshold) return "critical";
  if (ratio >= config.whaleThreshold)        return "warning";
  return "none";
}

export function checkLossConditions(fin, history, lossConditions) {
  for (const condition of lossConditions) {
    const t = condition.trigger;
    if (t.equity?.below !== undefined && fin.equity < t.equity.below)
      return condition;
    if (t.cash?.belowFractionOfDeposits !== undefined
        && isLiquidityBreached(fin.cash, fin.deposits))
      return condition;
    if (t.nplRatio?.above !== undefined) {
      const needed = t.nplRatio.consecutiveQuarters || 1;
      const recent = history.slice(-needed);
      if (recent.length >= needed && recent.every(q => q.nplRatio > t.nplRatio.above))
        return condition;
    }
    if (t.reputation?.below !== undefined) {
      const needed = t.reputation.consecutiveQuarters || 1;
      const recent = history.slice(-needed);
      if (recent.length >= needed && recent.every(q => q.reputation < t.reputation.below))
        return condition;
    }
  }
  return null;
}
