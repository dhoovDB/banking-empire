# Banking Empire — Developer Guide

A browser-based banking simulation game built to teach real financial concepts 
through play. Players manage a community bank across 20 quarters, setting 
interest rates, hiring staff, and navigating crises. Built with React 18, 
HTML5 Canvas, and Vite. No backend — everything runs in the browser.

The game is intentionally whimsical — chibi characters, isometric branch, 
coins flying across the canvas. That whimsy is not decoration. It's what 
makes the education land. A player who is charmed sticks around long enough 
to learn. A player who is bored does not.

## Before you do anything

Run `/globalrules` for general context that applies to all repositories. 
It contains the delegation rules, approval gates, status reporting format, 
and architecture principles that govern every session. The rest of this 
file assumes those rules are active.

## Architecture

The codebase is split into four layers. Each layer only imports from 
layers to its left.

config/   →   engine/   →   renderer/   →   ui/

`BankingEmpire.jsx` is the one exception — it sits at the root and imports 
from all four layers because it owns all React state.

### Separation of concerns

| Layer | Responsibility |
|---|---|
| `config/` | Game rules as data. Rebalancing means editing config, never the engine. |
| `engine/` | Pure functions. No React. No side effects. |
| `renderer/canvas.js` | Receives state and draws. No calculations. |
| `BankingEmpire.jsx` | Only smart component. Owns state, passes callbacks down. |

**Default to consistency across similar elements.** When two visual or logical elements play the
same role (desk nameplates, character labels, KPI rows, status banners, event handlers of the
same shape), they share one rendering path with one set of defaults. Diverge only with a
`// reason:` comment at the call site explaining why this case is special. Two ad-hoc copies
become three; three become the spaghetti you have to refactor under deadline. The cost of one
unjustified copy is the cost of every future copy.

### The test

Adding a new event type = one entry in `config/events.js`. The engine and 
UI render it automatically.

Adding a new KPI = one entry in `config/economy.js`. The UI renders it 
automatically.

If adding a feature requires touching more than one layer, stop and check 
whether the logic belongs where you put it.

### What to protect when using AI tools

Lovable and Claude Code will sometimes collapse these layers into a single 
component. Do not accept those changes. Extract visual improvements only 
and apply them to the existing structure.

Specific things to watch for:
- Calculations appearing inside `canvas.js` → move upstream
- State or `useState` appearing in `ui/` components → belongs in 
  `BankingEmpire.jsx`
- Logic appearing in `config/` files → belongs in `engine/`
- Engine functions that call `setState` or read React refs → remove the 
  React dependency

### `config/` — Game rules as data

Nothing in `config/` imports from anywhere else in the project.

| File | What it contains |
|---|---|
| `economy.js` | Starting financials, KPI definitions, policy impacts, sim timing, spawn rules, P&L multipliers |
| `characters.js` | Staff roles, costs, appearance palettes, movement speeds, chatter lines |
| `events.js` | Branch event definitions (incl. per-event resolution numbers) and UI display strings |
| `progression.js` | Loss conditions, quarter milestones, era progress + transition rules |
| `layout.js` | Branch floor positions — queue, teller, seats, desks, exits |

### `engine/` — Pure functions

| File | Key exports |
|---|---|
| `financials.js` | `calculateNIM`, `calculateCAR`, `calculateQuarterlyPL`, `isLiquidityBreached`, `checkLossConditions` |
| `simulation.js` | `createDaySimState`, `tickSimulation`, `evaluateCharacter`, `applyCommand`, `interactionCommandFor`, `resolveEvent`, `resolveEraTransition`, `loanApplicationChanceFor` |

### `renderer/` — Canvas drawing only

| File | Key exports |
|---|---|
| `canvas.js` | `renderFrame`, `drawChibi`, `drawBubble`, `toIso`, `CANVAS_W`, `CANVAS_H` |
| `particles.js` | `spawnCoins`, `tickParticles` |

### `ui/` — React components (dumb)

All components receive props and render. None own state.

| File | Props |
|---|---|
| `SetupScreen.jsx` | `fin, staff, fac, policy, committed, onStaffChange, onFacChange, onPolicyChange, onStartSim` |
| `SimScreen.jsx` | `canvasRef, activeEvent, simLog, fin, staff, dayProgress` |
| `ReportScreen.jsx` | `report, fin, onNextQuarter, onRestart` |

### `BankingEmpire.jsx` — The one smart component

Owns all React state. The `setInterval` loop feeds wall-clock time to the
engine's `tickSimulation` and renders its effects; the render loop runs via
`requestAnimationFrame`. Routes between three screens via `phase` state
(`"setup"` → `"simulating"` → `"report"` → `"setup"`). Canvas clicks become
engine commands via `interactionCommandFor` + `applyCommand` — the component
never mutates characters directly.

---

## Adding a new branch event

1. Add an entry to `BRANCH_EVENTS` in `config/events.js`
2. Add a display entry to `EVT_DISPLAY` in `config/events.js`
3. Add a handler in `resolveEvent()` in `engine/simulation.js`
4. Add a command handler in `applyCommand()` if the event introduces new 
   character states

## Adding a new KPI

1. Add an entry to `KPI_DEFINITIONS` in `config/economy.js`
2. Add a calculation function to `engine/financials.js`
3. Compute and attach the value in `finishDay()` inside `BankingEmpire.jsx`
4. The UI renders it automatically

---

## Key design decisions

Read before changing anything that seems "obviously wrong."

**NIM uses the true formula — not rate spread.**
`NIM = (interest income − interest expense) / loans × 100`
Do not use `lendingRate − depositRate`. All thresholds are quarterly 
figures — the formula uses `* 0.25`.

**Era 1 NIM is intentionally low (~1.1%).**
Starting below the warn threshold is the first lesson. Do not raise it 
by changing rates or the deposit/loan balance. If era 1 feels too 
punishing, adjust `warn`/`danger` thresholds in `config/economy.js`.

**Robbery fires from era 2 onward.**
Era 1 has no security staff. A robbery in era 1 offers no player agency. 
Do not change `eraRange: [2, 4]`.

**Liquidity loss condition is dynamic.**
`cash < deposits × 0.02`, not a fixed floor. Forces proportional thinking 
as the bank scales.

**Simulation state is a ref, not React state.**
`simState.current` is mutated directly inside the `setInterval` tick for 
performance. React state is only updated when the quarter ends.

**All randomness flows through `randomFloat()` in `simulation.js`.**
Do not add `Math.random()` calls elsewhere — this keeps replays possible.

**One writer for character and day state.**
Every mutation during the day happens inside `tickSimulation` or through
`applyCommand` (canvas clicks included). Do not mutate `simState.current`
or character objects from React handlers, timeouts, or effects — that
bypass pattern is where the pre-2026-07 bug families lived.

**Layer boundaries are lint rules, not just prose.**
`eslint.config.js` encodes "layers import leftward only" and "no React in
engine/renderer" via `no-restricted-imports`. Run `npm run lint` before
committing; a Lovable or AI edit that collapses layers fails lint.

---

## In-game copy register

User-facing text — tooltips, KPI explainers, event descriptions, report 
copy — follows these rules:

- Lead with the point. First sentence is the conclusion, not the setup.
- No hedging. "This may affect" → "This reduces."
- Consequences face the player. "Your NPL ratio rises" not "we increase 
  the NPL ratio."
- Match the register of the sim. Warm, direct, slightly irreverent — 
  a knowledgeable friend, not a compliance manual.
- Lean into the drama. A robbery is terrifying. Write it that way.

This is not the user's personal writing voice. It governs in-game UI 
copy only. The user's writing system prompt lives in 
`writing-kit/VOICE.md` and is invoked separately.

---

## Commit voice

Commit messages are narrative and slightly whimsical — match the existing 
log. PR bodies get full personality: informal tone, emoji-led headers, 
small ASCII diagrams where they help. CLAUDE.md entries, decision log 
notes, and code comments stay neutral.

---

## Running locally

```bash
npm install
npm run dev
```

Requires Node 18+. `npm test` runs the Vitest suite; `npm run lint` checks
code quality and the layer-boundary rules.

---

## Decision log

*Project and architectural decisions are logged in `ROADMAP.md` (its Decision log
and Key design decisions sections). This log tracks changes to this CLAUDE.md only.*

### 2026-07-03 — Updated for the simplification pass

File tables gained `config/layout.js` and the new engine exports
(`createDaySimState`, `tickSimulation`, `interactionCommandFor`,
`resolveEraTransition`, `loanApplicationChanceFor`). Two key design
decisions added: single-writer state (all day mutations via
`tickSimulation`/`applyCommand`) and lint-enforced layer boundaries.
The full refactor rationale lives in ROADMAP.md's 2026-07-03 decision-log
entries.

### 2026-05-25 — Adopted the portfolio ROADMAP standard

`ROADMAP.md` was restructured to the portfolio standard (see
`writing-kit/ROADMAP-TEMPLATE.md`): retitled, gained a "What this builds toward"
section, and renamed its "Design decisions log" to "Decision log." Added this
CLAUDE.md decision log to track future changes to this guide.
