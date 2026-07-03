// ─── STAFF & CHARACTER CONFIG ─────────────────────────────────────────────────

export const DEFAULT_STAFF = {
  tellers:      1,
  loanOfficers: 0,
  security:     0,
};

export const DEFAULT_FACILITIES = {
  vaultLevel:   1,
  waitingSeats: 3,
};

// Hire cost and quarterly salary per role
export const STAFF_DEFINITIONS = {
  tellers:      { label: "Teller",        hireCost:  5000, salary: 2500, max: 6,
                  tooltip: "Accepts deposits at the counter. More tellers → shorter queues, fewer walk-outs." },
  // reason: max is 1 because the engine models a single loan desk — every check
  // is binary (loanOfficers > 0) against one loanDeskPos/loanDeskOccupied, so a
  // 2nd or 3rd officer would cost $8k + $4k/qtr for zero throughput. v1 is honest
  // about serving one officer; multi-desk throughput scaling is a v2 item (see
  // ROADMAP "Multi-desk loan throughput"). Restore a higher max only alongside
  // that engine work, never on its own.
  loanOfficers: { label: "Loan Officer",  hireCost:  8000, salary: 4000, max: 1,
                  tooltip: "Approves loans for borrowers. One officer staffs the loan desk; with none, no loans originate." },
  security:     { label: "Security",      hireCost:  6000, salary: 3000, max: 2,
                  tooltip: "Deters robbers and cuts theft losses. Robberies don't fire until era 2." },
};

// ─── APPEARANCE PALETTES ──────────────────────────────────────────────────────

export const SKIN_TONES = [
  "#f5c89a", "#e8a870", "#c47840", "#a05028", "#6a3018", "#d4a870",
];

export const HAIR_COLORS = [
  "#2c1810", "#1a1a2e", "#8B4513", "#d4a028", "#e8d090", "#4a2810",
];

export const STAFF_OUTFITS = {
  teller: ["#4a90d9", "#27ae60", "#e74c3c", "#9b59b6", "#e67e22", "#1abc9c"],
};

// ─── ROLE DEFAULTS ────────────────────────────────────────────────────────────

export const ROLE_DEFAULTS = {
  robber: {
    skin:         "#c47840",
    outfit:       "#111111",
    hair:         "#1a1a1a",
    entryEmotion: "angry",
    scale:        1.05,
  },
  inspector: {
    skin:         "#e8a870",
    outfit:       "#7a6020",
    hair:         "#5a3c08",
    entryEmotion: "neutral",
    scale:        0.95,
  },
  whale: {
    skin:         "#f5c89a",
    outfit:       "#1a2a4a",
    hair:         "#2c1810",
    entryEmotion: "neutral",
    depositRange: { min: 380000, max: 1000000 },
    scale:        1.12,
  },
};

// ─── MOVEMENT & PACING ────────────────────────────────────────────────────────
// Grid units per 100ms tick. Calibrated for ISO_TW=192 (see 2026-05-02/03
// speed rebalances in ROADMAP Completed).

export const SPEEDS = {
  customerEnter:   0.045, // door → queue slot
  customerWalk:    0.040, // queue → seat/lobby, leaving
  customerAdvance: 0.032, // queue → teller/loan desk (calmer pace)
  customerFlee:    0.062, // robbery panic / walkout
  robberEnter:     0.043,
  robberLeave:     0.056,
  inspector:       0.032, // all inspector movement
  // Progress-per-tick while stationary:
  serviceProgress: 0.007, // teller/loan service completion rate
  robberyProgress: 0.005, // vault-cracking rate
};

// ─── CHARACTER CHATTER ────────────────────────────────────────────────────────
// Idle speech-bubble lines. `ms` is how long the bubble stays up.

export const CHATTER = {
  idleChance:     0.003, // per-tick chance an idle character says something
  waitingAngry:   { lines: ["Come ON!", "Hurry up!", "Seriously?!", "I'm late!"], ms: 1700 },
  waitingNeutral: { lines: ["Good morning", "Need a loan...", "Hello!"],          ms: 1500 },
  greeted:        { lines: ["Thanks!", "Appreciated.", "Oh, lovely!", "Cheers!"], ms: 1600 },
  servedDeposit:  { ms: 1900 }, // line is dynamic: "+$<deposit>"
  whaleGreeted:        { lines: ["Charmed, thank you."],  ms: 1800 },
  robberDispatched:    { lines: ["Hands up!"],            ms: 1800 },
  inspectorDistracted: { lines: ["Oh! Lovely décor."],    ms: 2000 },
};

// ─── EMOTION DISPLAY ──────────────────────────────────────────────────────────

export const EMOTIONS = {
  neutral:   { eyeColor: "#2c3e50" },
  happy:     { eyeColor: "#27ae60" },
  angry:     { eyeColor: "#e74c3c" },
  worried:   { eyeColor: "#e67e22" },
  serving:   { eyeColor: "#2980b9" },
  surprised: { eyeColor: "#8e44ad" },
};

