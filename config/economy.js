// ─── STARTING STATE ──────────────────────────────────────────────────────────
export const DEFAULT_FINANCIALS = {
  cash:        50000,
  deposits:    80000,
  loans:       80000,
  equity:      20000,
  nplRatio:    0.03,
  nim:         0,      // calculated each quarter
  car:         0,      // calculated each quarter
  quarter:     1,
  year:        1,
  reputation:  72,
  eraProgress: 0,
  era:         1,
};

export const DEFAULT_POLICY = {
  lendingRate: 6.5,
  depositRate: 2.0,
};

// ─── KPI DEFINITIONS ─────────────────────────────────────────────────────────
// warn/danger are plain threshold values. Engine evaluates them.
// All thresholds calibrated against quarterly figures.
export const KPI_DEFINITIONS = {
  cash: {
    label:   "Cash & Reserves",
    formula: "Liquid assets",
    warn:    8000,
    danger:  2000,
    invert:  false,
    explain: "Your liquidity buffer. If cash falls below 2% of deposits the FDIC can seize the bank. Grows through profitable quarters; shrinks through losses, fines, and robberies.",
    educationalLink: "https://www.federalreserve.gov/monetarypolicy/reservereq.htm",
    tips: [
      "Widen your NIM to generate more income each quarter",
      "Grow deposits to fund more loans",
      "Cap robbery losses with vault upgrades",
      "Keep salaries proportional to income",
    ],
  },
  nim: {
    label:   "Net Interest Margin",
    formula: "(Income − Expense) / Loans",
    warn:    1.2,
    danger:  0.5,
    invert:  false,
    explain: "Your core profit spread — net interest income divided by total loans. Era 1 NIM is intentionally low: deposit costs compress income until your loan book grows. Healthy community banks run 1.5–3%.",
    educationalLink: "https://en.wikipedia.org/wiki/Net_interest_margin",
    tips: [
      "Raise lending rate carefully — demand falls at extremes",
      "Lower deposit rate cautiously — depositors flee to rivals",
      "Grow loan book via loan officers to improve the ratio",
      "Hire more tellers to serve more customers and grow deposits",
    ],
  },
  car: {
    label:   "Capital Adequacy",
    formula: "Equity / Loans × 100",
    warn:    11,
    danger:  8,
    invert:  false,
    explain: "Your regulatory capital cushion. Regulators require 8% minimum. Falls below that and you face enforcement action.",
    educationalLink: "https://www.bis.org/fsi/fsisummaries/b3_capital.pdf",
    tips: [
      "Retain earnings through consistent NIM profit",
      "Don't let loan book outpace equity growth",
      "Avoid regulatory fines that drain equity",
    ],
  },
  npl: {
    label:   "NPL Ratio",
    formula: "Bad loans / Total loans",
    warn:    0.05,
    danger:  0.09,
    invert:  true,
    explain: "Non-performing loans. Above 5% is concerning; above 9% triggers large loan-loss provisions. Rises when lending rates are too high or the economy turns.",
    educationalLink: "https://www.imf.org/en/Publications/fandd/issues/2016/06/basics",
    tips: [
      "Add loan officers to tighten underwriting",
      "Avoid aggressive lending during stressed markets",
      "Keep rates competitive — predatory rates attract risky borrowers",
    ],
  },
  reputation: {
    label:   "Reputation",
    formula: "Customer satisfaction",
    warn:    60,
    danger:  40,
    invert:  false,
    explain: "Drives walk-out rates and vulnerability to bank runs. Below 60 and customers trust rivals more. Rebuilt slowly through good service; destroyed quickly by robberies and fines.",
    tips: [
      "Add tellers to reduce wait times",
      "Offer competitive deposit rates",
      "Expand waiting area for rush events",
      "Avoid robberies, fines, and outages",
    ],
  },
};

// ─── POLICY IMPACT RULES ─────────────────────────────────────────────────────
export const POLICY_IMPACTS = {
  frustration: {
    depositRate: [
      { below: 1.5, value: 0.3 },
      { below: 2.5, value: 0.1 },
      { default:    0.0 },
    ],
    lendingRate: [
      { above: 8.5, value: 0.2 },
      { default:   0.0 },
    ],
  },
  walkoutRisk: {
    depositRate: [
      { below: 1.5, label: "High",     retention: "65%" },
      { below: 2.5, label: "Moderate", retention: "82%" },
      { below: 3.5, label: "Low",      retention: "93%" },
      { label: "Very Low",             retention: "98%" },
    ],
  },
  loanDemand: {
    baseAppsPerDay: 8,
    rateElasticity: 1.4,
    rateBaseline:   5.0,
  },
};

// ─── CUSTOMER BEHAVIOUR ───────────────────────────────────────────────────────
export const CUSTOMER_BEHAVIOUR = {
  frustrationGrowthRate:    0.0008,
  // During an active rush event, frustration grows faster — under-staffed
  // rushes produce 1-2 walkouts; calm rushes (staffed for peak) survive intact.
  rushFrustrationMultiplier: 2.0,
  // Seated customers accumulate frustration at this fraction of the standing
  // rate. The whole point of paying for seats: a seated rush is survivable
  // where a standing rush walks out.
  seatedFrustrationMultiplier: 0.4,
  walkoutThreshold:         0.88,
  walkoutProbability:       0.006,
  angryThreshold:           0.72,
  worriedThreshold:         0.42,
  // Per-tick chance a waiting customer flees during an active robbery.
  robberyFleeChance:        0.004,
  depositRange:             { min: 1500,  max: 10000 },
  loanRange:                { min: 8000,  max: 50000 },
  loanApplicationChance:    0.4,
  // Player greet (click a waiting customer): how much one greet calms them.
  greetFrustrationRelief:   0.45,
  greetAngerRelief:         0.15,
};

// ─── SIMULATION TIMING ────────────────────────────────────────────────────────
export const SIM_TIMING = {
  dayLengthMs:     75000, // one quarter = one 75-second branch day
  tickMs:          100,
  eventBannerMs:   12000, // how long an event stays "active" (banner + effects)
  greetCooldownMs: 400,   // global click debounce on the canvas
};

// ─── CUSTOMER SPAWNING ────────────────────────────────────────────────────────
export const SPAWN_RULES = {
  baseChance:     0.042, // per-tick spawn probability, normal play
  rushChance:     0.26,  // per-tick spawn probability while a rush is active
  baseCap:        7,     // max characters in branch, normal play
  rushCap:        18,    // max characters in branch during a rush
  rushDripChance: 0.35,  // per-tick chance to release one pending rush spawn
  // Rush arrivals come in pre-annoyed.
  rushSpawn:      { frustration: 0.6, baseAnger: 0.45 },
};

// ─── QUARTERLY P&L RULES ──────────────────────────────────────────────────────
// Multipliers used by engine/financials.js calculateQuarterlyPL.
export const PL_RULES = {
  // Fraction of the day's counter deposits that becomes lasting deposit-book
  // growth (the rest is transactional flow, not new balances).
  depositGrowthRate: 0.12,
  // Loan-book growth per loan originated at the loan desk.
  loanGrowthPerLoan: 14000,
  // Serving the whale attracts follow-on deposits worth this fraction of the
  // day's deposits.
  whaleBonusRate:    0.07,
  // Fraction of positive net income retained as equity.
  equityRetention:   0.55,
  // NPL ratio drift: predatory lending rates attract riskier borrowers.
  nplDrift: { highRateThreshold: 8, up: 0.005, down: -0.001, min: 0.01, max: 0.15 },
  // Quarterly reputation deltas.
  reputation: {
    servedThreshold: 5,  servedGain: 3, servedPenalty: -1,
    finePenalty: -8,
    walkoutThreshold: 3, walkoutPenalty: -4,
    whaleGain: 5,
  },
};

// ─── CONCENTRATION RISK ───────────────────────────────────────────────────────
export const CONCENTRATION_RISK = {
  whaleThreshold:        0.20,
  catastrophicThreshold: 0.35,
  walkoutImpact: {
    belowThreshold: { depositFlight: 0.07, reputationHit: 5 },
    aboveThreshold: { depositFlight: 0.22, reputationHit: 18, triggersEvent: "bankRush" },
  },
};
