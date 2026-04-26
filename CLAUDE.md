# Banking Empire — Developer Guide

A browser-based banking simulation game built to teach real financial concepts through play.
Players manage a community bank across 20 quarters, setting interest rates, hiring staff, and
navigating crises. Built with React 18, HTML5 Canvas, and Vite. No backend — everything runs
in the browser.

## Running locally

```bash
npm install
npm run dev   # Vite dev server
```

Requires Node 18+.

---

## Architecture

The codebase is split into four layers. The rule: each layer only imports from layers to its left.

```
config/   →   engine/   →   renderer/   →   ui/
```

`BankingEmpire.jsx` is the one exception — it sits at the root and imports from all four layers
because it owns all React state.

### Architecture principles

**Config is data only.** Nothing in `config/` should contain functions, logic, or arrow functions
as values. If it calculates something, it belongs in the engine. Config exists so the game can be
rebalanced without touching code.

**Engine functions are pure.** Same input → same output. No direct state mutations.
`evaluateCharacter()` returns a command object describing what should happen. `applyCommand()` is
the only place character state actually changes. New engine functions should follow this pattern.

**The renderer only draws.** `renderFrame()` receives state and draws it. It never calls
`setState`, reads React refs, or calculates anything. If you find yourself computing a value inside
`canvas.js`, it belongs upstream.

**One smart component.** `BankingEmpire.jsx` owns all React state. Every other component in `ui/`
is dumb — it receives props and calls callbacks. UI components may use `useMemo` to derive display
values from props; they cannot own `useState` or call `useEffect` for game logic.

### `config/` — Game rules as data

Nothing in `config/` imports from anywhere else in the project. Rebalancing the game means editing
config files only.

| File | What it contains |
|---|---|
| `economy.js` | Starting financials, KPI definitions (warn/danger thresholds), policy impact rules, customer behaviour constants |
| `characters.js` | Staff roles and costs (`STAFF_DEFINITIONS`), default counts, appearance palettes |
| `events.js` | Branch event definitions (`BRANCH_EVENTS`) and UI display strings (`EVT_DISPLAY`) |
| `progression.js` | Loss conditions, quarter milestones, era progress rules |

### `engine/` — Pure functions

No React imports. No state mutations. Every function takes numbers/objects and returns
numbers/objects. Safe to unit-test in isolation.

| File | Key exports |
|---|---|
| `financials.js` | `calculateNIM`, `calculateCAR`, `calculateQuarterlyPL`, `isLiquidityBreached`, `checkLossConditions` |
| `simulation.js` | `createStaffMember`, `createCustomer`, `evaluateCharacter`, `applyCommand`, `buildEventSchedule`, `resolveEvent`, `calculateEraProgressDelta` |

**Convention:** Adding a new KPI or financial formula means a new function in `engine/financials.js`
and a new entry in `config/economy.js`. The UI renders it automatically once the prop is passed
from `BankingEmpire.jsx`.

### `renderer/` — Canvas drawing only

`renderFrame()` receives state and draws. It never calls `setState`, reads React refs, or
calculates game logic.

| File | Key exports |
|---|---|
| `canvas.js` | `renderFrame`, `drawChibi`, `drawBubble`, `toIso`, `CANVAS_W`, `CANVAS_H` |
| `particles.js` | `spawnCoins`, `tickParticles` |

**Convention:** `toIso(gx, gy)` converts isometric grid coordinates to canvas pixel coordinates.
All character positions are stored as `{gx, gy}` and converted to pixels at draw time.

### `ui/` — React components (dumb)

All components receive props and render. None own state. `SetupScreen` is the one exception that
imports engine functions (`calculateOneTimeCosts`, `calculateRecurringSalaries`) to show cost
previews — this is acceptable because those are pure functions used for display only.

| File | Props |
|---|---|
| `SetupScreen.jsx` | `fin, staff, fac, policy, committed, onStaffChange, onFacChange, onPolicyChange, onStartSim` |
| `SimScreen.jsx` | `canvasRef, activeEvent, simLog, fin, staff, dayProgress` |
| `ReportScreen.jsx` | `report, fin, onNextQuarter, onRestart` |

### `BankingEmpire.jsx` — The one smart component

Owns all game state. Runs the simulation loop via `setInterval` and the render loop via
`requestAnimationFrame`. Routes between three screens via `phase` state
(`"setup"` → `"simulating"` → `"report"` → `"setup"`).

The render loop (`renderLoop`) never calls `setState`. The simulation loop mutates
`simState.current` directly (a ref, not React state) for performance — character positions tick at
100ms but only `phase` and `dayProg` need React re-renders during simulation.

---

## Key design decisions

Read this before changing anything that seems "obviously wrong." It probably isn't.

**NIM uses the true formula — not rate spread.**
`NIM = (interest income − interest expense) / loans × 100`
Do not use `lendingRate − depositRate` as a proxy. That was the original prototype's approach and
was explicitly replaced. All thresholds (`warn: 1.2`, `danger: 0.5`) are quarterly figures — the
formula uses `* 0.25` to convert annual rates.

**Era 1 NIM is intentionally low (~1.1%).**
Starting below the warn threshold is the first lesson: deposits are a cost centre, loans are the
revenue engine. The player's job in era 1 is growing the loan book relative to deposits. Do not
raise starting NIM by changing rates or the deposit/loan balance. If era 1 feels too punishing,
adjust the `warn`/`danger` thresholds in `config/economy.js`.

**Robbery fires from era 2 onward — `eraRange: [2, 4]`.**
Era 1 has no security staff. A robbery in era 1 offers no player agency — it's a pure loss with
no decision to make. Era 2+ ensures the event is meaningful when it fires. Vault upgrade levels 2
and 3 are locked until era 2 for the same reason: there's nothing to protect against in era 1.

**Liquidity loss condition is dynamic.**
Game-over triggers when `cash < deposits × 0.02`, not at a fixed cash floor. A fixed floor would
be irrelevant at era 4 deposit volumes. The dynamic threshold forces proportional thinking as the
bank scales.

**Simulation state is a ref, not React state.**
`simState.current` is mutated directly inside the `setInterval` tick for performance. React state
(`fin`, `staff`, etc.) is only updated when the quarter ends. The canvas render loop reads from
`simState.current` directly.

**All randomness flows through `randomFloat()` in `simulation.js`.**
Swap `Math.random()` for a seeded PRNG there to enable reproducible replays — a planned future
feature. Do not add `Math.random()` calls elsewhere.

**Movement speeds in `evaluateCharacter` are in grid units per 100ms tick.**
The arrival threshold in `moveToward` is `0.09` grid units. All speed values must stay well below
this — the default is `0.028`. Current calibrated values: entering `0.040`, normal walk `0.035`,
robber `0.038`, robber escape `0.050`, fleeing `0.060`, inspector `0.028`. `moveToward` clamps
movement to never overshoot the target, but speeds above ~`0.08` will still produce coarse
single-step arrivals.

---

## Voice and writing

Any user-facing text — tooltips, KPI explainers, event descriptions, report copy, educational
notes — follows these principles:

- **Lead with the point.** First sentence is the conclusion, not the setup.
- **No hedging.** "This may affect" → "This reduces." State what happens.
- **Consequences face the player, not the team.** "Your NPL ratio rises" not "we increase the
  NPL ratio."
- **Brevity over completeness.** If cutting a sentence loses nothing essential, cut it. KPI
  explainers are one paragraph maximum.

The full writing principles are in the writing-kit repo. Check there before writing new in-game
copy.

---

## Product roadmap

The full feature backlog, cut decisions, and design questions are in `ROADMAP.md`. Before adding
a feature, reporting a gap, or asking "why isn't X built yet" — read `ROADMAP.md` first. The
answer is usually there, along with the reason it was made.

---

## Adding a new branch event

1. Add an entry to `BRANCH_EVENTS` in `config/events.js` with `eraRange`, `triggerProbability`,
   `timing`, and any `resolution` data.
2. Add a display entry to `EVT_DISPLAY` in `config/events.js`.
3. Add a handler in `resolveEvent()` in `engine/simulation.js` if the event spawns characters or
   sets `activeEvent`.
4. Add a command handler in `applyCommand()` in `engine/simulation.js` if the event introduces
   new character states.

The scheduler in `buildEventSchedule()` picks it up automatically.

## Adding a new KPI

1. Add an entry to `KPI_DEFINITIONS` in `config/economy.js` with `label`, `formula`, `warn`,
   `danger`, `invert`, and `explain`.
2. Add a calculation function to `engine/financials.js`.
3. Compute and attach the value in `finishDay()` inside `BankingEmpire.jsx`.
4. The UI components read from `fin` and render it automatically.

---

## What's not built yet

See `ROADMAP.md` for the full backlog. Current known gaps:

- Era advancement logic — `eraProgress` accumulates but `era` never increments
- One-time setup costs shown in UI but not deducted from cash (`calculateOneTimeCosts` not wired
  into `finishDay`)
- Condition-triggered events (e.g., `whaleExit`) — all events are currently probability-scheduled
- Win conditions beyond surviving 20 quarters
- Unit tests for engine functions
- localStorage persistence
