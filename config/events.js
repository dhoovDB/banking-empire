// ─── BRANCH EVENT DEFINITIONS ────────────────────────────────────────────────
// eraRange: [minEra, maxEra] — which eras this event can fire in
// triggerProbability: 0–1 chance of appearing in the quarter's event schedule
// timing: ms offset from sim start when the event triggers
// resolution: event-specific resolution data used by simulation.js

export const BRANCH_EVENTS = {
  robbery: {
    eraRange:           [2, 4],
    triggerProbability: 0.25,
    timing:             { earliest: 20000, latest: 55000 },
    resolution:         { baseLoss: 12000 },
  },
  inspection: {
    eraRange:           [1, 4],
    triggerProbability: 0.30,
    timing:             { earliest: 25000, latest: 60000 },
    resolution:         {},
  },
  rush: {
    eraRange:           [1, 4],
    triggerProbability: 0.35,
    timing:             { earliest: 15000, latest: 45000 },
    resolution:         {},
  },
  whale: {
    eraRange:           [2, 4],
    triggerProbability: 0.20,
    timing:             { earliest: 30000, latest: 65000 },
    resolution:         {},
  },
  outage: {
    eraRange:           [2, 4],
    triggerProbability: 0.15,
    timing:             { earliest: 20000, latest: 50000 },
    resolution:         {},
  },
};

// ─── EVENT DISPLAY ────────────────────────────────────────────────────────────
// What the UI shows when an event fires. Kept separate from BRANCH_EVENTS so
// the engine never touches display strings.

export const EVT_DISPLAY = {
  robbery: {
    title:       "Robbery!",
    description: "An armed robber has entered the branch. Security can stop them.",
    color:       "#ff6b6b",
  },
  inspection: {
    title:       "Regulatory Inspection",
    description: "Inspectors are reviewing your operations. Serve the inspector to avoid a fine.",
    color:       "#f5a623",
  },
  rush: {
    title:       "Bank Rush",
    description: "Unusually high customer volume this quarter. Manage the queue.",
    color:       "#ff8c42",
  },
  whale: {
    title:       "VIP Client",
    description: "A high-value depositor has arrived. Serve them promptly for a bonus.",
    color:       "#d4af37",
  },
  outage: {
    title:       "System Outage",
    description: "IT systems are down. Teller services suspended until resolved.",
    color:       "#9a8f7e",
  },
};
