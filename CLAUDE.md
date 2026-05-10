# Banking Empire — Developer Guide

A browser-based banking simulation game built to teach real financial concepts through play.
Players manage a community bank across 20 quarters, setting interest rates, hiring staff, and
navigating crises. Built with React 18, HTML5 Canvas, and Vite. No backend — everything runs
in the browser.

The game is intentionally whimsical — chibi characters, isometric branch, coins flying across
the canvas. That whimsy is not decoration. It's what makes the education land. A player who
is charmed sticks around long enough to learn. A player who is bored does not.

## Delegation and Workflow

### Feedback and Planning Mode

When the human uses phrases like "add this to the roadmap," "here is my feedback," "I want to
note," "for the backlog," or "I am thinking about" — do not take any action. Acknowledge the
input in one sentence and wait. The human may have more feedback coming. Only act when explicitly
told to proceed with a clear instruction like "go ahead," "make those changes," or "implement
that now." Default to planning mode when in doubt.

### Batching

When collecting multiple pieces of feedback or roadmap items, accumulate them all first. Before
doing anything, summarize what you heard in a numbered list and ask: "Ready to proceed with all
of these?" Wait for confirmation before touching any file.

### The 4D Framework

This project follows Anthropic's AI Fluency framework:

- **Delegation:** The human decides what to build and when. Claude Code executes. Never start
  implementation without explicit approval. "Sounds good" is not approval. "Go ahead" is approval.

- **Description:** If a task is ambiguous, ask one clarifying question before starting — not five
  questions, not zero. One.

- **Discernment:** Before marking any task complete, check the output against the architecture
  principles in this file. Flag violations before the human has to find them.

- **Diligence:** Follow the Status Reporting format defined in this file.

---

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

### Separation of concerns

Four layers. Each has one job.

| Layer | Responsibility |
|---|---|
| `config/` | Game rules as data. Rebalancing means editing config, never the engine. |
| `engine/` | Pure functions. No React. No side effects. |
| `renderer/canvas.js` | Receives state and draws. No calculations. |
| `BankingEmpire.jsx` | Only smart component. Owns state, passes callbacks down. |

### The test

Adding a new event type = one entry in `config/events.js`. The engine and UI render it automatically.

Adding a new KPI = one entry in `config/economy.js`. The UI renders it automatically.

If adding a feature requires touching more than one layer, stop and check whether the logic belongs where you put it.

### What to protect when using AI tools

Lovable and Claude Code will sometimes collapse these layers into a single component. Do not accept
those changes. Extract visual improvements only and apply them to the existing structure.

Specific things to watch for:
- Calculations appearing inside `canvas.js` (hit-testing, value derivation) → move upstream
- State or `useState` appearing in `ui/` components → belongs in `BankingEmpire.jsx`
- Logic or arrow-function values appearing in `config/` files → belongs in `engine/`
- Engine functions that call `setState` or read React refs → remove the React dependency

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

## Design spirit

**Fun is load-bearing.** The chibi sim is not an optional UI layer — it's why the financial
concepts land. A mechanic that is technically correct but unfun is not finished. If the
simulation feels inert, that's a bug.

**Prefer alive over accurate — except the financials.** The core metrics (NIM, CAR, NPL,
liquidity ratio) must be correct. Those are what the game teaches. Everything else — character
movement, event pacing, visual feedback, UI copy — should favour feeling alive over being
precise. A teller who visibly walks to a customer and pauses before serving them teaches more
than a progress bar. Choose the more animated path when the cost is reasonable.

**Whimsy is a feature, not polish.** Coin particles, speech bubbles, chibi expressions — these
ship in v1, not after. Do not treat visual delight as something to layer on once the "real"
work is done. It is the real work.

**If it isn't fun, the education doesn't land.** This is in the ROADMAP guiding principles for
a reason. Apply it as a filter when making implementation choices, not just product decisions.

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
this — the default is `0.032`. Current calibrated values for `ISO_TW=192` (6×5 grid): entering
`0.045`, normal walk `0.040`, robber `0.043`, robber escape `0.056`, fleeing `0.062`, inspector
`0.032`, advancing/customer-to-teller `0.032`. `moveToward` clamps movement to never overshoot
the target, but speeds above ~`0.06` will still produce coarse single-step arrivals.

When tile size changes, multiply all speeds by `OLD_ISO_TW / NEW_ISO_TW` to preserve perceived
pace. The 6×5 grid + ISO_TW=192 values above derive from the original ISO_TW=144 set scaled by
`144/192 = 0.75`.

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
- **Match the register of the sim.** The canvas has chibi characters and flying coins. Copy
  should feel like a knowledgeable friend, not a compliance manual. Warm, direct, slightly
  irreverent.
- **Lean into the drama.** A robbery is terrifying. A whale walking through the door is
  exciting. A regulatory inspection is nerve-wracking. Write it that way. Events are stories,
  not notifications.
- **Whimsy is allowed.** A teller named "Mia" who waves at customers teaches more than a
  generic "staff member." Named, specific, human details make the world feel real.

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

## Status Reporting

Every task summary must end with this block — no exceptions:

---
WRITTEN TO DISK: [list every file created or modified]
ROADMAP.md UPDATED: [exactly one of: "yes — completed items moved, new entries added" / "no changes needed" / "NOT YET — must do before commit"]
GIT STATUS: [exactly one of: "untracked" / "modified, not staged" / "staged, not committed" / "committed locally" / "pushed to origin/main"]
NEXT STEP: [one sentence — what needs to happen next]
---

Additional rules:
- Never use the word "done" or "complete" without this block immediately following it
- **ROADMAP.md must be updated before every commit.** Check two things: (1) move any work completed this session to the Completed section with today's date; (2) add any new backlog entries or design notes that emerged from the session. If nothing changed, write "no changes needed."
- Never assume a file was written to disk unless the write command ran and returned no errors in this session
- Never assume a commit happened unless git commit ran and showed a commit hash in this session
- Never assume a push happened unless git push ran and returned no errors in this session
- If asked "is this on GitHub?" — the answer is yes only if git push ran successfully in this session
- If the session was interrupted or restarted, git status must be run before reporting any git state

---

## Git commit practices

**One logical change per commit.** Each commit should be a coherent unit you
could describe in one sentence. The signal that two changes belong in separate
commits: you'd want two separate sentences in the commit message. Size is a
weak signal — a 500-line refactor that does one thing is fine; a 50-line
commit that mixes a bug fix and an unrelated rename is two commits.

Why it matters:
- **Bisecting.** `git bisect` finds the commit that introduced a bug. Mixed
  commits hide the cause.
- **Reverting.** A surgical revert undoes one change without losing unrelated
  work. Bundled commits force all-or-nothing.
- **History reads as a story.** `git log` should explain what happened, not
  list "various updates."

**Commit voice — whimsical and narrative, not dry technical bullets.** Match
the existing log: "The till empties when you hire, not when you tally" beats
"fix: deduct hire costs at sim start." Lead with the change as a tiny story.
The body can list specifics, but the subject line is a sentence in the
project's voice.

**Commit when each logical piece lands, not in batches.** If you finish a
feature, commit it before starting the next. Avoid the "commit a day's worth
of work in one go" pattern — it bundles unrelated changes by accident and
makes the next session's history harder to read.

**Never commit without approval.** "Sounds good" is not approval. "Go ahead"
or "commit it" is approval. Same rule as feature scope (see Delegation).

**Always update ROADMAP.md before committing** — already required by Status
Reporting, repeated here because git practice and roadmap practice are
linked. Roadmap drift is invisible until you go looking; commit-level
discipline is what keeps it out.
