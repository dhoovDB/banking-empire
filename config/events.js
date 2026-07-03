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
    resolution:         {
      baseLoss:              12000,
      // Player clicks the robber → security dispatched → loss multiplied by this.
      dispatchedLossFactor:  0.4,
      // Per-tick catch chances while the robber works the vault.
      baseCatchChance:       0.008, // security staff on site
      dispatchedCatchChance: 0.05,  // player dispatched security
      interactWindowMs:      4000,  // how long the robber is clickable
    },
  },
  inspection: {
    eraRange:           [1, 4],
    triggerProbability: 0.30,
    timing:             { earliest: 25000, latest: 60000 },
    resolution:         {
      fine:                2500, // charged if the inspection isn't handled
      distractedFineFactor: 0.5, // player distracts the inspector → fine × this
    },
  },
  rush: {
    eraRange:           [1, 4],
    triggerProbability: 0.35,
    timing:             { earliest: 15000, latest: 45000 },
    resolution:         { pendingSpawns: 8 },
  },
  whale: {
    eraRange:           [2, 4],
    triggerProbability: 0.20,
    timing:             { earliest: 30000, latest: 65000 },
    resolution:         {
      greetDepositBoost: 1.2,  // player greets the whale → deposit × this
      interactWindowMs:  6000, // how long the whale is clickable
    },
  },
  outage: {
    eraRange:           [2, 4],
    triggerProbability: 0.15,
    timing:             { earliest: 20000, latest: 50000 },
    resolution:         {},
  },
};

// ─── EVENT DISPLAY ────────────────────────────────────────────────────────────
// Single source of truth for how a branch event reads on screen — across the
// React HUD banner (ui/SimScreen.jsx), the canvas overlay banner + border
// (renderer/canvas.js), and the after-action report (ui/ReportScreen.jsx).
// Kept separate from BRANCH_EVENTS so the engine never touches display strings.
//
// Adding a new event = one entry here + one BRANCH_EVENTS entry above. The
// renderer, HUD, and report render it automatically. A consistency test in
// engine/events.test.js asserts every BRANCH_EVENTS key has a matching entry.
//
// Fields:
//   bannerLabel — live in-game banner copy (React HUD shows as-is; canvas
//                 uppercases on render). Dramatic register per CLAUDE.md
//                 "lean into the drama".
//   reportLabel — neutral after-action label for the report screen.
//   description — optional, shown beside the React HUD banner.
//   color       — canonical accent color (React banner + canvas banner). One
//                 color per event; the canvas applies it at translucent
//                 alpha for the fill. Resolves the 2026-05-21 drift between
//                 this map and the renderer's prior local copy.
//   border      — canvas-edge border treatment while the event is active.
//                 { color, width, dash: [...] | null }, or null for none.

export const EVT_DISPLAY = {
  robbery: {
    bannerLabel: "Robbery!",
    reportLabel: "Robbery",
    description: "An armed robber has entered the branch. Security can stop them.",
    color:       "#ff6b6b",
    border:      { color: "#c84a4a", width: 3, dash: null },
  },
  inspection: {
    bannerLabel: "Regulatory Inspection",
    reportLabel: "Regulatory Inspection",
    description: "Inspectors are reviewing your operations. Serve the inspector to avoid a fine.",
    color:       "#f5a623",
    border:      { color: "#e8b25a", width: 2, dash: [8, 4] },
  },
  rush: {
    bannerLabel: "Bank Rush",
    reportLabel: "Bank Rush",
    description: "Unusually high customer volume this quarter. Manage the queue.",
    color:       "#ff8c42",
    border:      null,
  },
  whale: {
    bannerLabel: "VIP Client",
    reportLabel: "VIP Client",
    description: "A high-value depositor has arrived. Serve them promptly for a bonus.",
    color:       "#d4af37",
    border:      null,
  },
  outage: {
    bannerLabel: "System Outage",
    reportLabel: "System Outage",
    description: "IT systems are down. Teller services suspended until resolved.",
    color:       "#9a8f7e",
    border:      null,
  },
};
