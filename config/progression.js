// ─── LOSS CONDITIONS ──────────────────────────────────────────────────────────
// Evaluated each quarter after the P&L. First matching condition triggers game over.
// trigger fields mirror the fin state keys; consecutiveQuarters checks recent history.

export const LOSS_CONDITIONS = [
  {
    id:      "insolvency",
    title:   "FDIC Seizure",
    message: "Your equity turned negative. The FDIC has seized the bank.",
    trigger: { equity: { below: 0 } },
  },
  {
    id:      "liquidity",
    title:   "Liquidity Crisis",
    message: "Cash fell below 2% of deposits. The bank cannot meet withdrawal demands.",
    trigger: { cash: { belowFractionOfDeposits: 0.02 } },
  },
  {
    id:      "npl",
    title:   "NPL Crisis",
    message: "Non-performing loans exceeded 12% for two consecutive quarters. Forced receivership.",
    trigger: { nplRatio: { above: 0.12, consecutiveQuarters: 2 } },
  },
  {
    id:      "reputation",
    title:   "Depositor Flight",
    message: "Reputation fell below 20 for two consecutive quarters. Depositors have abandoned the bank.",
    trigger: { reputation: { below: 20, consecutiveQuarters: 2 } },
  },
];

// ─── QUARTER MILESTONES ───────────────────────────────────────────────────────
// Keyed by absolute quarter (year-1)*4 + quarter.
// forceInspection adds a guaranteed inspection event to that quarter's schedule.

export const QUARTER_MILESTONES = {
  5:  { forceInspection: true, inspectionProb: 0.60 },
  10: { forceInspection: true, inspectionProb: 0.80 },
  15: { forceInspection: true, inspectionProb: 0.90 },
  20: { forceInspection: true, inspectionProb: 1.00 },
};

// ─── ERA PROGRESS RULES ───────────────────────────────────────────────────────
// Evaluated after each quarter. Points accumulate in fin.eraProgress (0–100).
// gains: positive conditions; losses: negative conditions (points are negative).

export const ERA_PROGRESS_RULES = {
  gains: [
    { condition: "nim",        threshold: 1.5,  points:  3 },
    { condition: "nim",        threshold: 2.5,  points:  5 },
    { condition: "served",     threshold: 8,    points:  2 },
    { condition: "served",     threshold: 15,   points:  4 },
    { condition: "car",        threshold: 12,   points:  3 },
    { condition: "reputation", threshold: 75,   points:  2 },
    { condition: "whaleServed",                 points:  8 },
    { condition: "noWalkouts",                  points:  3 },
  ],
  losses: [
    { condition: "robbed",                      points: -6 },
    { condition: "insFine",                     points: -4 },
    { condition: "walkouts",   threshold: 3,    points: -2 },
    { condition: "car",        threshold: 9,    points: -4 },
    { condition: "nplRatio",   threshold: 0.07, points: -3 },
    { condition: "reputation", threshold: 50,   points: -3 },
  ],
};
