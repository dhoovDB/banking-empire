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

// Milestone-forced inspections fire earlier in the day than the random
// schedule (BRANCH_EVENTS.inspection.timing) so the player always sees them.
export const FORCED_INSPECTION_TRIGGER_MS = 15000;

// ─── ERA PROGRESS RULES ───────────────────────────────────────────────────────
// Evaluated after each quarter. Points accumulate in fin.eraProgress (0–100).
// gains: positive conditions; losses: negative conditions (points are negative).
//
// Pacing target (retuned 2026-07-03 from playtest feedback — "the fun stuff
// starts in era 2"): a played-well era 1 quarter (NIM fixed above 1.5, staffed
// counter, no walkouts) earns ~36 points, promoting to era 2 at the end of
// quarter 3. Q1 usually misses the NIM gain (starting NIM is intentionally
// low), so hands-off play lands a couple of quarters later.

export const ERA_PROGRESS_RULES = {
  gains: [
    { condition: "nim",        threshold: 1.5,  points:  8 },
    { condition: "nim",        threshold: 2.5,  points:  6 },
    { condition: "served",     threshold: 8,    points: 10 },
    { condition: "served",     threshold: 15,   points:  6 },
    { condition: "car",        threshold: 12,   points:  8 },
    { condition: "reputation", threshold: 75,   points:  4 },
    { condition: "whaleServed",                 points: 10 },
    { condition: "noWalkouts",                  points: 10 },
  ],
  losses: [
    { condition: "robbed",                      points: -10 },
    { condition: "insFine",                     points:  -8 },
    { condition: "walkouts",   threshold: 3,    points:  -4 },
    { condition: "car",        threshold: 9,    points:  -8 },
    { condition: "nplRatio",   threshold: 0.07, points:  -6 },
    { condition: "reputation", threshold: 50,   points:  -6 },
  ],
};

// ─── ERA TRANSITION ───────────────────────────────────────────────────────────
// eraProgress reaching advanceAt promotes the bank to the next era and resets
// the bar. cap is 2 for v1: era 2 unlocks everything already built (robbery,
// whale, outage events; security; vault upgrades; seat purchases). Eras 3–4
// stay locked until the canvas-metaphor redesign (see ROADMAP LONG TERM) —
// raising the cap without that work would promote players into empty content.

export const ERA_RULES = { advanceAt: 100, cap: 2 };
