# Banking Empire — Roadmap archive

Finished work moved out of `ROADMAP.md` on 2026-10-10, verbatim. Section
numbers (§1–§6) match the references still in `ROADMAP.md`. Nothing here
constrains current work; live decisions stay in `ROADMAP.md`.

---

## SHORT TERM — v1 blockers
*All closed as of 2026-08-02. Kept for the record; MEDIUM TERM is now the live
backlog. Was: these must be done before anything else, in priority order.*

### 1. Core simulation bugs
*Problem: the sim loop has known issues that break the player experience.*

- [x] **Customer pathfinding — bunching at entrance** — root cause was the
      queue-slot tile being a *walk target*, not a *claim*: multiple customers
      with the same `queuePos % QUEUE_SLOTS.length` could stand on the same
      spot, and once seats filled there was no fallback. Fixed by adding a
      `LOBBY_POSITIONS` overflow allocator (Shape B in the design discussion)
      — when seats and queue are saturated, each waiting customer claims a
      unique lobby tile via the same discrete-claim pattern as seats and
      teller slots. (2026-05-11)
- [x] **Customer movement too slow** — scaled all speed constants ×1.5 for ISO_TW=144. (2026-05-02)
- [x] **Customers exit to corner** — EXIT_POS already corrected by prior Lovable change; confirmed working. (2026-05-02)
- [x] **Inspector walks to corner** — inspector now wanders to teller desk and vault before leaving; no longer targets off-screen position. (2026-05-02)
- [x] **Loan officer desk added** — LOAN_DESK_POS at gx:2.5, gy:2.4; loan customers route there separately from teller queue. (2026-05-02)
- [x] **Customer spawn visibility** — superseded by the 6×5 grid overhaul. Spawn now lives at gy=5.8 just outside the gy=5 entrance row, so the doorway crossing reads cleanly. (2026-05-03)

### 1c. Layout overhaul follow-ups (from playthrough feedback 2026-05-03)
*The 6×5 grid + ISO_TW=192 overhaul shipped. These four items are the remaining*
*pieces from the same playthrough — they all depend on the new grid being settled.*

- [x] **Pathfinding — customers walk through the teller desk** — fixed by
      geometry adjustment, not waypoints. Customer service position moved to
      gy=3.10 (in front of counter front at 3.05) instead of inside the
      counter (gy=2.7/2.85). Teller chibi draw offset adjusted to keep teller
      behind the counter back at gy≈2.45. The waypoint mechanism is the right
      tool for genuine obstacle avoidance later — not needed here. (2026-05-05)
- [x] **Narrower teller desk** — per-window spacing reduced from 0.55 to
      0.42 tiles in `drawTellerCounter`; counter reads as a service desk
      instead of a wall. At 5+ tellers the engine-side TELLER_SLOTS (still
      0.55 apart) sit past the new counter's right edge — captured as a
      MEDIUM TERM follow-up. (2026-05-15)
- [x] **Loan officer + customer share one desk** — fixed 2026-05-08. Same
      pattern as the teller fix: `LOAN_DESK_POS` shifted from gy=2.0 (where
      desk visual sits) to gy=2.4 (in front of desk). Live loan officer chibi
      now draws at gy=1.75 (behind desk) when `staff.loanOfficers > 0`; ghost
      stays in the same back-of-desk position when unhired. Hired officer is
      a real opaque named chibi from the new `loanOfficerRoster`, not a
      translucent placeholder.
- [x] **Vault dimensionality** — `drawVault` redrawn as a proper iso
      prism. Footprint is the 1×1 tile from `toIso(5.0, 1.0)` to
      `toIso(6.0, 2.0)`; top diamond is the floor diamond raised by
      `H = ISO_TH * 0.85`; right and front faces are parallelograms between
      top and floor corners. Door radius and every fitting (rivets, wheel,
      hinges, handle) are sized as fractions of `H` — no raw pixel anchors
      survive. (2026-05-15)
- [x] **Rearrange visuals — three distinct service zones** — all three
      levers from the original entry now pulled: chairs already moved
      bottom-left (2026-05-11); loan desk pushed back from `toIso(2.2, 2.0)`
      to `toIso(2.0, 1.5)` so it sits in the gy=1 zone instead of crowding
      the manager desk; teller counter tightened via the 0.42 spacing above.
      Loan officer chibi updated to `toIso(2.0, 0.95)` to preserve the
      0.55-tile setback behind the new desk position. Side-effect: the new
      loan desk's right edge overlaps the security desk's left edge at
      `toIso(2.5, 1.0)` — fix is to move the security desk or pull the loan
      desk further left; captured below. (2026-05-15)

### 1d. Latent bug found during plan exploration

- [x] **`vaultPos` referenced as bare variable in robber pathing** — fixed by
      adding `vaultPos` to the `simState` destructure at the top of
      `evaluateCharacter`. Bundled with the §5 engine-handler sweep on
      2026-05-19 since that pass was reading the same handlers. (2026-05-19)

### 1e. Seat usage under load (recurrence — likely next daily task)

- [x] **Only one waiting seat fills during a rush** — diagnosed 2026-06-01,
      **not a bug.** The diagnostic-first plan landed: a rush-replica
      integration test (`engine/simulation.test.js`, "real 8-customer replica
      fills all 3 seats") drives 8 customers spawned the way `spawnRushCustomer`
      does — `frustration 0.6`, `baseAnger 0.45`, angry — through the full
      `entering → queue slot → JOIN_WAIT → CLAIM_SEAT` pipeline, with both era-1
      tellers busy and `activeEvent: "rush"` doubling frustration growth. **All
      3 seats fill, with zero walkouts.** Combined with this session's prior
      ruling that the renderer faithfully draws engine state
      (`renderer/canvas.js:885-893`), the "one seat at a time" observation is
      explained by seat→teller churn, not a dropped seat claim: waiting-state
      priority 1 fires for *seated* customers too, so when a teller frees, a
      seated customer is pulled to the counter and releases the seat. The count
      of *simultaneously* seated customers therefore cycles during live play —
      a glance catches fewer than 3, which is correct behaviour (a seat is a
      transient waiting spot, not a destination). The test pins both tellers
      busy to isolate the allocator and proves it seats all 3. 93/93 passing.
      *Optional future polish (not a v1 blocker): a more distinct seated pose
      would make the transient occupancy read more clearly, but the mechanic is
      correct as-is.* (2026-06-01)

### 1b. Queue behaviour (completed this session)

- [x] **Waiting state** — customers hold at queue slot until a teller or loan desk slot is free. Direct-to-desk if slot open on entry. Removes the old progress-timer advance trigger. (2026-05-02)
- [x] **Click system refactored** — `clickedCharIds` Set enforces one interaction per character. Role-based routing: whale (1.2× deposit), robber (dispatch security), inspector (distract → 50% fine), customer (calm frustration). (2026-05-02)

### 2. Setup screen clarity
*Problem: players don't understand what they're buying.*

- [x] **Vault era lock** — already shipped earlier (vault levels 2 and 3
      grey out with "Unlocks Era 2" label in era 1). Verified in
      `ui/SetupScreen.jsx`; roadmap entry was just stale. (2026-05-10)
- [x] **Waiting seats era lock** — +/- stepper greys out in era 1 with
      "Unlocks Era 2" copy and the same locked treatment as the vault.
      Era 1 ships with the 3 default seats; player can't change the count
      until era 2. (2026-05-10)

### 3. Financial correctness minimums
*Problem: the game gives players incorrect signals about their starting position
and doesn't enforce consequences for bad decisions.*

- [x] **One-time costs deducted at sim start** — cash now decrements on the
      setup→sim transition so SimScreen HUD matches the SetupScreen promise.
      QPL keeps setupCost as a P&L line and adds it back to the cash equation
      to avoid double-charging. (2026-05-03)
- [x] **FDIC seizure confirmed working** — verified end-to-end; test added (2026-04-30)
- [x] **NPL receivership wired** — fixed consecutive-quarters check (was counting
      any N quarters in history; now checks the last N). Tests added. (2026-04-30)

### 4. Deploy to GitHub Pages
*Problem: no one can play the game without cloning the repo.*

- [x] Add `base: '/banking-empire/'` to vite.config.js (2026-05-08)
- [x] Run `npm run build` and deploy `dist/` to gh-pages branch — used `gh-pages` npm package; `npm run deploy` builds and pushes (2026-05-08)
- [x] Replace `[Live demo link]` placeholder in README.md with https://dhoovdb.github.io/banking-empire/ (2026-05-08)
- [x] Verify it loads on desktop — confirmed 200 OK on index.html and assets (2026-05-08)

### 5. Consistency audit across the codebase
*Problem: despite the four-layer architecture, ad-hoc per-element code keeps*
*piling up — three different desk nameplate styles, shadow ellipses copy-pasted*
*into six functions, tile colors competing instead of collaborating. The*
*2026-05-16 "Default to consistency" principle in CLAUDE.md is the rule;*
*this audit is the cleanup of what already drifted before the rule landed.*

- [x] **Sweep for duplicated visual primitives — `renderer/canvas.js`.**
      Three extractions landed: `verticalGradient(ctx, y0, y1, c0, c1)`
      collapses the four createLinearGradient/addColorStop incantations
      (manager desk, loan desk, security desk, counter front); `drawDeskBody`
      collapses the manager and security desk bodies into one helper while
      the loan desk keeps its green-baize divergence with a `// reason:`
      comment; `EVENT_VISUALS` is now one map for banner label + accent +
      border, shared by `drawEventBanner` and `drawEventBorder`. Hover ring
      and interact timer kept their separate palettes with a `// reason:`
      note (presence vs urgency carry different signals). Surfaced two
      visual fixes during smoke test: security desk relocated from the
      back wall (gx=3, gy=1) to in front of the vault (gx=5.5, gy=2.3)
      where it was overshooting the painted floor; back-left plant at
      (gx=1, gy=2) removed since it was crowding the manager desk.
      88/88 tests still passing. (2026-05-17)

- [x] **Sweep for duplicated visual primitives — `ui/`.** The palette object
      `C`, the `kpiColor(key, value)` function, the `panel` / `btnSm` style
      objects, and `ERA_NAMES` were copy-pasted across all three screens —
      `SetupScreen`, `SimScreen`, `ReportScreen`. Extracted into a new
      `ui/theme.js` (one ui-internal module; imports nothing from
      engine/renderer, so the layer rule holds). All three screens now import
      the shared primitives. The KPI row *components* — `KPIBadge` (vertical),
      `KPIRow` (horizontal), `KPICard` (threshold card) — stay separate
      because they are genuinely different layouts; they just share the one
      `kpiColor`. SimScreen's three sidebar cards were a within-file triple
      and collapsed to one local `sidebarCard` const (compact padding for the
      180px sidebar, distinct from the roomy shared `panel`). Palette unified
      per decision 2026-05-21: SimScreen's slightly darker `panel`/`border`
      and dimmer `dim` were drift, snapped to the Setup/Report values. Three
      screens −79/+12 lines; theme.js +46; net ~−21 plus one source of truth.
      88/88 tests still passing; production build clean (bundle 211.86 →
      210.07 kB). The `EVT_DISPLAY` / `EVENT_VISUALS` / `EVT_LABELS` color
      drift was deliberately NOT bundled here — see the separate task below.
      (2026-05-21)

- [x] **Consolidate event display strings + colors to one source** — the three
      parallel maps (`EVT_DISPLAY` in config, `EVENT_VISUALS` in
      `renderer/canvas.js`, `EVT_LABELS` in `ui/ReportScreen.jsx`) collapsed
      to one entry per event in `EVT_DISPLAY` with `bannerLabel` (live, dramatic),
      `reportLabel` (after-action, neutral), `color`, `description`, and an
      optional `border` spec. Config now wins the palette across the board —
      robbery is canonical `#ff6b6b` everywhere, demoting the renderer's
      `#d96060` and similar drift on inspection / rush / whale. The renderer
      and report import from config; `EVENT_VISUALS` and `EVT_LABELS` deleted.
      New `engine/events.test.js` (4 tests) locks the schema and asserts every
      `BRANCH_EVENTS` key has a well-formed `EVT_DISPLAY` entry so this drift
      can't recur silently. 92/92 tests passing. See decision log 2026-05-29.
      (2026-05-29)

- [x] **Sweep for parallel branches in engine handlers.** Five cuts landed in
      `engine/simulation.js`: (1) `MOVE_TO_EXIT` command removed entirely —
      it was a near-duplicate of `MOVE` with a 1.4-default speed that caused
      the 2026-05-11 inspector-flying bug; all four callers now use
      `MOVE` with an explicit `target: exitPos`. (2) `walkOrArrive(char,
      target, arriveCmd, speed)` helper collapses seven near-identical
      "if near target, fire arrive cmd; else MOVE" snippets (robber entering
      & leaving, inspector entering & wandering & leaving, customer
      advancing & advancing-via-waypoint, customer leaving & leaving-via-
      waypoint). (3) `WALKOUT` and `FLEE` cases in `applyCommand` merged —
      same shape, differing only in emotion + bubble (frustration vs
      external trigger). (4) `calculateEraProgressDelta` 12-line condition
      switch replaced by two `GAIN_PREDICATES` / `LOSS_PREDICATES` tables +
      one `sumIf` reducer — adding a new condition is now a row, not a
      branch. (5) `resolveEvent` audited and left alone — its four event
      branches are genuinely different (different roles, spawn positions,
      bubbles, sometimes extra wander state); a table doesn't pay off.
      Net -11 lines, but the wins are denser than the line count
      (one footgun removed, one command type removed, one switch became
      data). §1d `vaultPos` bug fixed in the same pass. 88/88 tests
      still passing. (2026-05-19)

- [x] **Sweep config for arrow-function values.** Grep for both `=>` and
      `function(` across `config/` returned zero hits. The data-only
      principle has held since the original refactor. No drift to clean
      up. (2026-05-19)

### 6. README credibility visuals
*Problem: a hiring manager won't clone a repo — or even click a link — to*
*evaluate a portfolio piece. The README has to show the game, prove the loop is*
*real, and signal the architecture, all skimmable in under 90 seconds. Replaces*
*the demo video: a 90s screen-record can't be skimmed, adds nothing to the*
*architecture signal, and is the only deliverable needing a manual capture step*
*(which is why it stayed open longest). See the 2026-07-25 decision-log entry.*

Split into a "reliable parts" pass (shipped 2026-07-25) and a follow-up
screenshot-capture pass, because exploration found the capture is the heavy,
risky piece (no Playwright installed; the canvas is driven by `Math.random`,
not yet seedable) while the copy + diagram are fast and reliable.

- [x] **Live-play badge emphasis** at the very top — a "▶ Play Now — No Install
      Needed" shields badge on the GitHub Pages link. (2026-07-25)
- [x] **README truthfulness pass.** Reconciled the overclaim: eras 3–4 and
      Fed-rate moves moved under "On the roadmap"; era 2 reworded to what it
      actually ships (security/robbery/inspection + vault & seat upgrades);
      "Concentration risk" and "Telegraphed macro events" relabelled designed-
      but-shelved / planned; bank-run and Fed lessons split into a "planned"
      list; the stale "unit tests" what's-next line fixed (104 tests already
      ship). Chose relabel-as-planned over deletion to keep the roadmap vision
      visible. (2026-07-25)
- [x] **Architecture diagram** — `docs/images/architecture.svg`, a self-
      contained four-layer diagram (config → engine → renderer → ui, plus the
      BankingEmpire.jsx root and the ESLint-enforced import rule), derived from
      the CLAUDE.md layer table and dropped into the Architecture section in
      place of the ASCII block. This is the diptych's left half. (2026-07-25)
- [x] **3-panel annotated walkthrough** above "What you'll learn" — shipped as
      "One quarter, start to finish": `screenshot-setup.jpg` (2 tellers + 1 loan
      officer hired, $13,000 setup cost showing), `screenshot-event.jpg` (a
      regulatory inspection firing — amber banner, dashed canvas border,
      inspector on the floor among nine customers), `screenshot-report.jpg` (the
      unserved inspection's $2,500 fine on the P&L, reputation 72 → 67, era-1 NIM
      at 1.31%). One caption each, written to the CLAUDE.md in-game copy
      register. Captured with `claude-in-chrome` against the live deploy as
      planned. (2026-08-02)
- [x] **Complete the architecture diptych** — `screenshot-branch.jpg` (two
      tellers working the counter, loan officer at the desk, eight customers on
      the floor) now sits beside `architecture.svg` in a two-column HTML table
      captioned "What the player sees" / "What's underneath". (2026-08-02)
- [ ] *(Fallback, only if stills read as static in review: a ~3s optimized GIF of*
      *the coins/chibi beat — frame-captures stitched, not a live screen-record.*
      *Not a v1 blocker; v1 shipped on the stills.)*

**Two things the capture pass surfaced, both fixed the same day:**

- [x] **The live deploy was 10 weeks stale.** `gh-pages` was last published
      2026-05-17 (`2d82f47`) while `main` had moved through the entire
      simplification pass, era-2 advancement, the KPI reference table, the
      setup-cost refund fix, and the high-DPI canvas work. The "▶ Play Now"
      badge added 2026-07-25 was pointing at a build without any of it —
      confirmed in-browser (the live setup screen had no "What these numbers
      mean" table, which `ui/SetupScreen.jsx` renders unconditionally). Ran
      `npm run deploy`; the live build now matches `main`. This is the concrete
      cost of manual deploy and promotes the MEDIUM TERM GitHub Actions
      auto-deploy item — see below. (2026-08-02)
- [x] **"Securitys" on the setup screen.** `ui/SetupScreen.jsx` rendered staff
      labels as `def.label + "s"`, so `"Security"` came out `"Securitys"` —
      while `ui/SimScreen.jsx` showed "Security" correctly, so the two screens
      disagreed. Caught because the typo landed in the setup screenshot. Fixed
      by moving pluralisation into config as data: every `STAFF_DEFINITIONS`
      entry now carries an explicit `plural`, and the UI renders `def.plural`
      instead of applying a string rule. `/codereview` then caught the other
      half: `ui/SimScreen.jsx` hard-coded the same three labels as a literal
      array, so config wasn't actually the single source and a fourth role
      would have meant editing two files. SimScreen now maps over
      `STAFF_DEFINITIONS` like SetupScreen does. A new test in
      `engine/characters.test.js` requires a non-empty `label` and `plural` on
      every role, so a role added without one fails loudly rather than
      rendering blank. 105/105 passing. (2026-08-02)
- [x] **"What got cut" section**, added below the architecture diptych.
      Documents three scope cuts — 40 quarters reduced to 20 (a single-sitting
      arc, not a live-service product), loan officers capped at 1 (the engine
      models one loan desk; a playtest found the second officer was "a ghost
      again"), and the 90-second demo video dropped in favour of the three
      stills — plus a fourth entry on **the bug the tests agreed with**: hiring
      charged the player's cash mid-quarter, then silently refunded it,
      because the day loop snapshotted financials before the deduction
      landed; the unit tests encoded the same false premise, so they passed
      while the game did the wrong thing, and an adversarial review pass
      caught it instead of the suite. The intro also gained an audience line
      — "for anyone who wants to understand how a bank actually works." The
      point isn't the four call-outs; it's making the v1 scope-defense
      legible to a hiring manager without them reading a single commit — the
      reasoning behind what got cut is the portfolio signal, not the
      features that shipped. (2026-08-04)

---

## Decision log (v1 delivery, 2026-07-03 to 2026-08-02)

### 2026-08-02 — v1 shipped; the deploy gap was the real last blocker

The last two v1 boxes were screenshots, and capturing them turned up something
bigger than the screenshots. The live GitHub Pages build was ten weeks stale —
`gh-pages` at 2026-05-17 against a `main` that had since landed the whole
simplification pass, era-2 advancement, the KPI reference table, the setup-cost
refund fix, and high-DPI rendering. Every one of those is player-visible. The
"▶ Play Now — No Install Needed" badge added on 2026-07-25, in the same pass
that removed the README's overclaims, was itself pointing at a build that could
not deliver what the README described.

Nothing in the repo was wrong. `main` was correct, tested, and lint-clean the
whole time; the deploy step just never ran. That is the failure mode worth
recording: a manual publish step attached to no gate drifts silently, and the
drift is invisible from inside the repo — you have to look at the deployed
artifact to see it. The capture pass only caught it because a screenshot forces
you to look at what a visitor actually sees. Ticking the v1 criterion "anyone
with the link can play in a desktop browser" against the repo rather than
against the link would have been wrong.

Two consequences. The GitHub Actions auto-deploy item moves to the top of
MEDIUM TERM with its old reasoning explicitly reversed — it argued the manual
script was fine until playthrough churn slowed down, when churn is precisely
when a manual step gets skipped. And until that workflow exists, `npm run
deploy` is a required step in any session touching player-visible behaviour,
not an optional finishing move.

The same pass caught "Securitys" on the setup screen — `label + "s"` applied to
"Security" — because the typo landed in a screenshot bound for the README. Fixed
by moving pluralisation into `STAFF_DEFINITIONS` as an explicit `plural` field
rather than leaving a string rule in the UI, which is the config-owns-display-
strings rule the 2026-05-29 event-display consolidation already established.
`/codereview` then found the fix was half-done: `ui/SimScreen.jsx` still
hard-coded `[["Tellers", …], ["Loan Officers", …], ["Security", …]]` as a
literal, so config was one of two sources and the two screens could drift again
the moment a role was added. Both screens now map over `STAFF_DEFINITIONS`. A
test requires the field so the next role added can't reintroduce the bug.

Small fix, but it makes two points worth keeping. First, screenshots function as
a review gate the test suite can't replace: tests assert behaviour, screenshots
assert what the player reads, and no test in the suite was ever going to fail on
"Securitys". Second, this is the third variant of the same drift the 2026-05-29
consolidation and the 2026-05-21 `ui/theme.js` extraction each caught — display
strings copied into a component instead of read from config. The rule is already
written down in CLAUDE.md; what keeps catching it is a review pass, not the rule.

v1 is done. All six Definition-of-done criteria are checked, and the deliverable
behind the README criterion is the three-panel walkthrough plus the architecture
diptych, per the 2026-07-25 decision below.

### 2026-07-25 — Demo video cut in favor of static README visuals

The lone remaining v1 blocker was a 60–90s demo video. Cut it. A video wins only
on motion; it loses on the goals that matter here — you cannot skim a 90s clip in
the "understand within 90 seconds" sense, it adds nothing to the architecture
signal a PM reviewer is looking for, and it is the only deliverable that needs a
manual screen-record (which is why it stayed open longest). Replaced with three
skimmable, scriptable assets: a Playwright 3-panel loop walkthrough, an
architecture diptych (gameplay screenshot + layer diagram), and a prominent
live-play badge on the already-deployed GitHub Pages build. All three are
capturable without a recording session, which is what unblocks v1. A ~3s charm
GIF stays as a fallback only if reviewers find the stills static. The change also
surfaced a prerequisite: the README describes eras 3–4 and concentration risk as
live though era is capped at 2 and concentration risk was shelved — the
honest-capture requirement forces a README truthfulness pass at the same time.
The v1 Definition-of-done criterion is unchanged ("understands what the game is
within 90 seconds of opening the README"); only the deliverable behind it changed.

### 2026-07-03 — Setup costs were silently refunded; adversarial review caught it

Found by running the `adversarial-reviewer` skill (claude-skills) over the
simplification commits — flagged independently by two of its personas and
promoted to blocking. `startSim` deducted hire/upgrade costs via `setFin`,
but the day-loop's `finishDay` closure captured the render *before* that
update, so `calculateQuarterlyPL` always received pre-deduction cash while
its add-back assumed post-deduction — hires were charged on the HUD during
the day, then silently refunded at quarter end. The unit tests encoded the
same false premise ("cash: already post-deduction at sim start"), so they
passed while reality diverged.

Fix: one point of charge. `createDaySimState` carries a detached
quarter-start snapshot (`finAtDayStart`); `finishDay` reads the snapshot
instead of React state; the QPL add-back is deleted (netIncome carries
setupCost, cash pays it exactly once). Tests now assert the charge lands
in carried-forward cash. Same pass fixed the review's other should-fix:
the multi-tick tests import live geometry from `config/layout.js` instead
of hand-copied mirrors that could drift.

### 2026-07-03 — Simplification pass: the engine owns the day

Four commits (phases 1–4) that shrank the codebase while completing its own
architecture contract, prompted by "every bug I squash raises two more."
The diagnosis: bugs bred exclusively in `BankingEmpire.jsx`, the one file
with no tests, because game data (floor layout, ~40 tuning constants) and
game orchestration (the tick loop, click mutations, setTimeout event clears)
lived in the component instead of the layers built for them. What changed:

- **`tickSimulation()` in the engine owns the whole 75-second day** — event
  firing, spawning, character evaluate/apply, ambient bubbles, banner expiry
  (elapsed-time `eventClearAt` replaced racing setTimeouts). The component's
  interval is ~10 lines of glue. The day is unit-testable for the first time.
- **Clicks are commands.** GREET_CUSTOMER / GREET_WHALE / DISPATCH_SECURITY /
  DISTRACT_INSPECTOR run through `applyCommand` like every other mutation.
  Three latent bugs died with the bypass path: the inspection banner that
  never cleared on distract, greets pushing frustration negative, un-clicked
  robbers escaping with an undefined lossFactor.
- **One spot allocator.** Three parallel Set-pairs (teller/seat/lobby claims)
  became one `occupancy` map; every exit path calls `releaseHeldSpots` once,
  derived from the character's own fields — a forgotten per-kind release is
  no longer writable. Lobby claims deleted outright: standing positions are
  computed from waiting order (`standingSpotFor`), so the line shuffles
  forward like a real queue and there is nothing to leak.
- **Layout and tuning constants live in config** (`config/layout.js`,
  `SIM_TIMING`, `SPAWN_RULES`, `PL_RULES`, `SPEEDS`, `CHATTER`, event
  `resolution` blocks). ESLint `no-restricted-imports` rules now encode the
  layer boundaries, so a Lovable/AI edit that collapses layers fails lint
  instead of shipping.

Net: `BankingEmpire.jsx` 535 → ~300 lines, one command and one field-family
deleted, 96 → 103 tests, and the canvas HUD retired in favor of the React
sidebar (one display path).

### 2026-07-03 — Era advancement pulled into v1; concentration risk cut

`fin.era` was never incremented anywhere — the progress bar filled and
nothing happened, which kept robbery/whale/outage events, security staff,
vault upgrades, and seat purchases permanently unreachable (~40% of built
content). v1 originally deferred "era 2 unlock wired" to v2, but a progress
bar that lies is worse than a smaller roadmap: `resolveEraTransition` now
promotes the bank at 100 progress, capped at era 2 (`ERA_RULES`). Eras 3–4
stay locked pending the canvas-metaphor redesign. Gains rebalanced
(served≥8: 2→3, noWalkouts: 3→4) so a played-well era 1 promotes around
quarter 8–10. ReportScreen announces the promotion.

Two dead mechanics also resolved: `CONCENTRATION_RISK` +
`getConcentrationRisk` deleted (never called from game flow; referenced a
"bankRush" event that doesn't exist — the mechanic returns to the v2 shelf),
and `POLICY_IMPACTS.loanDemand` wired instead of deleted —
`loanApplicationChanceFor` scales applications by lending-rate elasticity,
fixing an inverted roll that had granted loans to 60% of customers under a
field named `loanApplicationChance: 0.4`.

---

## Completed (through 2026-08-04)


- [x] Refactor monolith into config / engine / renderer / ui layers
- [x] True NIM formula replacing rate spread proxy
- [x] Robbery eraRange changed to [2, 4]
- [x] Dynamic liquidity loss condition (cash < deposits * 0.02)
- [x] CLAUDE.md created with architecture principles and status reporting
- [x] Larger tiles and canvas (ISO tile size 72 to 96, canvas height 600)
- [x] More floor tiles — security, teller, and entrance rows extended
- [x] Entrance doors — front wall with two door openings
- [x] Vault redesign — steel frame, riveted disc, combination wheel
- [x] Larger speech bubbles — font 9 to 13px
- [x] Initial Vitest unit tests for engine/financials.js (2026-04-28)
- [x] NPL receivership: fixed consecutive-quarters check in checkLossConditions; 9 tests added (2026-04-30)
- [x] FDIC seizure confirmed working end-to-end; insolvency test added (2026-04-30)
- [x] Character movement speed scaled ×1.5 for ISO_TW=144; CLAUDE.md calibrated values updated (2026-05-02)
- [x] Waiting-state queue machine: customers hold at slot until teller/loan desk free; direct-to-desk if slot open on entry (2026-05-02)
- [x] Loan officer desk (LOAN_DESK_POS gx:2.5, gy:2.4); loan customers routed there separately (2026-05-02)
- [x] Inspector wander: walks manager → teller desk → vault with inspection bubbles; click to distract → 50% fine (2026-05-02)
- [x] Click system refactor: clickedCharIds enforces one click per character; whale 1.2×, robber dispatch, inspector distract (2026-05-02)
- [x] simulation.test.js: 17 tests covering one-click-max, whale boost, inspector fine, waiting state, loan desk routing (2026-05-02)
- [x] One-time costs deducted at sim start — cash decrements on setup→sim transition; QPL adds back to avoid double-deduction; 3 tests added (2026-05-03)
- [x] Staff role tooltips on setup screen — `tooltip` field added to `STAFF_DEFINITIONS`, rendered inline below each Stepper; covers teller, loan officer, security (2026-05-03)
- [x] Bigger-feeling branch — grid 8×6 → 6×5, ISO_TW 144 → 192, all speed constants × 0.75; canvas elements (vault, desks, chairs, plants) repositioned for the new grid; tests still 61/61 passing (2026-05-03)
- [x] No more walk-through teller desk — customer service position shifted from inside counter (gy=2.7/2.85) to in front (gy=3.10); teller draw offset adjusted (-0.25 → -0.65) to keep teller behind counter back. Waypoint state machine deferred until a route genuinely needs obstacle avoidance. (2026-05-05)
- [x] Loan customer hardcoded path around the teller counter — `nextWaypoint` field on customer state; `CLAIM_SLOT` with `useLoanDesk` sets the bypass point at (gx=1.9, gy=3.5); `COMPLETE_SERVICE` for loan customers sets it again on the way out; advancing/leaving states consume the waypoint before the final target. New `CLEAR_WAYPOINT` command. 5 tests added; 66/66 passing. (2026-05-05)
- [x] Back and left walls disabled — commented out in renderer/canvas.js while the layout is being tuned; bring back by uncommenting. Entrance row stays. (2026-05-05)
- [x] Deployed to GitHub Pages — vite.config.js base path set to `/banking-empire/`, `gh-pages` dev dep + `npm run deploy` script, live at https://dhoovdb.github.io/banking-empire/. Auto-deploy via GitHub Actions captured as MEDIUM TERM follow-up. (2026-05-08)
- [x] Loan officer visuals — live chibi from `loanOfficerRoster` draws behind the desk when hired (no longer translucent); `LOAN_DESK_POS` shifted to gy=2.4 so customer stops in front of desk and officer behind, matching the teller geometry. (2026-05-08)
- [x] Rush walkout sensitivity — added `rushFrustrationMultiplier: 2.0` to `CUSTOMER_BEHAVIOUR`; `evaluateCharacter` waiting state applies it when `activeEvent === "rush"`. Under-staffed rushes produce 1-2 walkouts; calm play unchanged. 2 tests added; 68/68 passing. (2026-05-08)
- [x] Waiting seats era lock — `ui/SetupScreen.jsx` greys out the +/- stepper in era 1 with the same locked treatment as the vault levels. Era 1 keeps the 3 default seats (free); era 2+ unlocks purchases. Vault era lock entry was already shipped — moved to Completed alongside. (2026-05-10)
- [x] Waiting seats now matter — `SEAT_POSITIONS` array (10 tiles, two rows) lifted into BankingEmpire.jsx and threaded into both engine (`simState.seatPositions`) and renderer (`drawChairs(seatPositions)`). New `CLAIM_SEAT` / `ARRIVE_AT_SEAT` commands; waiting customers walk to a free seat and accumulate frustration at 0.4× standing rate (`seatedFrustrationMultiplier` in CUSTOMER_BEHAVIOUR). Seat releases on `CLAIM_SLOT`, `WALKOUT`, `FLEE`. Renderer draws the chibi with a sit-offset when `seatedAt`. 8 new tests; 76/76 passing. (2026-05-10)
- [x] Customer bunching at entrance — root cause: queue-slot tiles were walk targets, not unique claims; multiple customers with the same `queuePos % 10` could share a tile, and once seats filled there was no fallback. Fixed by adding `LOBBY_POSITIONS` (9 overflow standing tiles near the entrance) threaded through `simState.lobbyPositions` and `occupiedLobby`. New `CLAIM_LOBBY` command + `findFreeLobby` / `releaseLobbyIfHeld` helpers. Waiting-state priority now: teller → flee → seat → lobby → frustration. Lobby releases on CLAIM_SLOT, CLAIM_SEAT, WALKOUT, FLEE. Chose this discrete-allocator approach (Shape B) over a per-tick collision rule (Shape A) because it matches the existing claim/release pattern and avoids deadlock risk. Shape A captured as medium-term follow-up. 11 new tests; 87/87 passing. (2026-05-11)
- [x] Inspector exit speed fixed — `evaluateCharacter` returned `MOVE_TO_EXIT` with no speed when the inspector was leaving (either via INSPECTOR_DONE or the player's distract click), falling through to `applyCommand`'s 1.4-units-per-tick default — about 35× a normal walk. The inspector visibly flew off the canvas. Added `speed: 0.032` to match the inspector's normal wander pace. Pre-existing bug, not a regression. (2026-05-11)
- [x] Waiting chairs moved bottom-left — `SEAT_POSITIONS` shifted from gx 1.5–3.1, gy 3.50/3.85 to gx 0.9–2.5, gy 3.90/4.25. The old layout sat the chairs right up against the teller counter back, where seated chibis visually merged with the teller backstage. New layout keeps chairs clear of the teller approach zone (gx 2.4+), the queue triangle (gx 2.7–4.3), and the corner plant at (0.7, 4.5). Side effect: shorter walk from queue to seat. Related observation about visible seat usage during a rush parked in §1e for next-session investigation. (2026-05-11)
- [x] Loan officer scooted back behind her desk — chibi shifted from gy=1.75 to gy=1.45 in `renderer/canvas.js`. The old 0.25-tile setback left only ~12px of screen-y clearance between the chibi and the desk visual; the chibi's legs and shadow (~21px below anchor) overlapped the desk top, and because the chibi was drawn after the desk, the legs rendered on top — making the officer look like she was standing in front of her own desk. New 0.55-tile setback mirrors the teller geometry (gy=2.45 chibi vs gy=3.10 customer). Comment in canvas.js explains the geometry so a future renderer pass doesn't undo it. (2026-05-13)
- [x] §1e seat-usage investigation — first multi-tick integration test in the suite, in `engine/simulation.test.js`. Spawns 3 customers at once into a state mirroring the era-1 layout (3 seats, 0 free tellers), runs the engine tick loop with the same per-character delta-application order as `BankingEmpire.jsx`, and asserts all three seats fill and all three customers reach `seatedAt=true` within a bounded tick budget. Test passes on first run. Conclusion: the engine's seat allocator works correctly under the conditions that produced the playtest observation. The "only 1 chair used at a time" report is therefore either (a) timing — only one chibi is visibly *sitting* at a given moment because others are still walking, or (b) a renderer-side issue that doesn't show up in engine state. Test stays in the suite as a regression canary; if the visual report recurs after replay, the next session investigates downstream of the engine. 88 tests passing. (2026-05-13)
- [x] Vault redrawn as a proper iso prism — `drawVault` no longer anchors its alcove and door frame in raw screen pixels. Footprint is the 1×1 tile from `toIso(5.0, 1.0)` to `toIso(6.0, 2.0)`; top diamond is the floor diamond raised by `H = ISO_TH * 0.85`; right and front faces are parallelograms between top and floor corners. Door radius (`H * 0.38`) and every fitting (rivet positions and sizes, inner ring, wheel spokes, hub, hinges, handle, glow halo) is a fraction of `H`. The vault now sits flush with the vault/vaultAlt tiles it occupies in TILE_MAP instead of floating on a different floor. (2026-05-15)
- [x] Loan officer desk pushed back into the gy=1 zone — `drawDesks` loan desk moved from `toIso(2.2, 2.0)` to `toIso(2.0, 1.5)` so it stops crowding the manager desk one tile in front of it. Loan officer chibi in `renderFrame` shifted from `toIso(2.2, 1.45)` to `toIso(2.0, 0.95)` to preserve the 0.55-tile setback behind the new desk position (same setback that fixed leg-overlap on 2026-05-13). The customer's loan-desk stop position (engine-side, `LOAN_DESK_POS` at gy=2.4) is unchanged, so the visual gap between desk and customer widens — accepted trade for the manager-desk breathing room. Side-effect captured as §1e follow-up: the new desk's right edge now overlaps the security desk's left edge. (2026-05-15)
- [x] Teller counter narrower — `drawTellerCounter` per-window spacing reduced from 0.55 to 0.42 in both `endGx` and the per-teller plaque loop. The counter reads as a service desk instead of a wall across the back. The engine-side `TELLER_SLOTS` in `BankingEmpire.jsx` is still 0.55-spaced, so at 5+ tellers the rightmost customer drifts past the counter's right edge (0.02 tiles at 5, 0.15 at 6). Era 1 ships 2 tellers so this is latent. Aligning TELLER_SLOTS to the new counter spacing is captured as a MEDIUM TERM follow-up. (2026-05-15)
- [x] Security desk no longer overlaps loan desk — `drawDesks` security desk shifted from `toIso(2.5, 1.0)` to `toIso(3.0, 1.0)`, and the security ghost (era 1, security=0) in `renderFrame` moved from `toIso(2.5, 1.05)` to `toIso(3.0, 1.05)` to match. The security desk is 72px wide vs the loan desk's 52px, so moving it was the cheaper trade than pulling the loan desk further left out of the back-left zone. The gx=3 tile is already a security strip in TILE_MAP, and the vault footprint starting at gx=5 leaves clear room. Side-effect from the 2026-05-15 loan-desk relocation, closed before next playtest. (2026-05-16)
- [x] Loan officer tightened in behind the desk — chibi setback reduced from 0.55 to 0.35 tiles (`renderFrame` loan-officer block, gy=0.95 → gy=1.15). Playtest read after the security-desk move was "officer is very far from his desk." The 0.55 setback was set on 2026-05-13 against the older, taller desk drawing; the slimmer back-row desk tolerates a tighter setback. Comment in canvas.js notes that legs were the historical reason and points to raising back toward 0.55 if leg-overlap returns. (2026-05-16)
- [x] Floor decluttered — every furniture drop shadow removed (teller counter, vault, manager / loan / security desks, waiting chairs). Chibi shadows kept since they ground each moving character; the others were copy-pasted ellipses adding visual noise to a stationary scene. (2026-05-16)
- [x] Tile colors unified to alternating marble — `TILE_MAP` rebuilt as a single loop emitting `floorA`/`floorB` checkerboard across the whole floor. The earlier mix of security graphite + manager teal + vault slate competed with each other and with the furniture; now the vault prism, desks, counter, and chairs do all the zone signaling. Tile colors stop carrying meaning they couldn't pay off. (2026-05-16)
- [x] Desk nameplates unified — `drawDeskNameplate(ctx, anchor, label, opts)` helper added (auto-sizes plate to label, 7px bold Nunito brass on dark, single source of truth for plate geometry and font). Manager and Security desks gained nameplates ("MANAGER", "SECURITY"); loan desk's 4px "LOANS" plate now goes through the helper; per-teller window numbers also routed through the helper. Three ad-hoc conventions collapsed to one. (2026-05-16)
- [x] Floor objects snapped onto the grid — left plants `gx 0.7 → 1.0`, right plants `gx 6.3 → 6.0`, all SEAT_POSITIONS shifted +0.1 gx (0.9→1.0, 1.3→1.4, etc.). The previous half-tile offsets put the leftmost chair and both side plants on bare canvas outside the painted floor. Local SEAT_POSITIONS in `engine/simulation.test.js` updated in lockstep. (2026-05-16)
- [x] CLAUDE.md gained a "Default to consistency across similar elements" architecture principle, plus a new SHORT TERM consistency audit item — the rule is recorded going forward, and the audit captures the cleanup of what drifted before the rule landed. (2026-05-16)
- [x] Vault door redrawn on the iso face plane — `drawVault` door body, outer ring, inner ring, spokes, hinges, and handle were all `ctx.arc` / axis-aligned rects in screen space, pasted onto a 2D-projected parallelogram. Playtest read was "the door is not in the same dimension/angle as the rest of the vault." Rebuilt with a `facePoint(u, v)` helper that maps face-local fractions onto the front-face plane (U = brT - blT, V = (0, H)). The door body and rings are now parametric 48-segment polygons; spokes use facePoint for both endpoints; hinges and the handle are parallelograms with all four corners projected through facePoint. Rivets, hub, and inner hub stay as screen-space circles — small enough that the projection delta would only read as noise. Door radius restated as a face-fraction (R = 0.38 of one tile) so width and height scale together with the face. 88/88 tests still passing. (2026-05-16)
- [x] Loan officers capped at 1 — `STAFF_DEFINITIONS.loanOfficers.max` 3 → 1, so
      the setup screen can no longer sell a 2nd or 3rd officer ($8k + $4k/qtr
      each) that the single-desk engine model can't use. The renderer only ever
      drew `loanOfficerRoster[0]`; the roster pre-build is now `length: 1` to
      match. A `// reason:` comment on the config field and a new
      `engine/characters.test.js` (3 tests, incl. asserting `max === 1` and that
      every default staffing level sits within its cap) keep the cap from being
      lifted without the matching multi-desk engine work. Chose honesty (option
      b) over building multi-desk throughput (option a) because v1 ships before
      v2 features; option (a) is preserved as the MEDIUM TERM "Multi-desk loan
      throughput" entry. 96/96 passing. See decision log 2026-06-03. (2026-06-03)
- [x] First era-2 playtest feedback round — KPI reference table on the setup
      screen ("What these numbers mean": formula, explanation, thresholds,
      educational links from KPI_DEFINITIONS); era + name shown in the
      SimScreen top bar; era pacing retuned so decent play promotes at the
      end of Q3 (~36 pts/quarter, losses doubled to match). Rush/bank-run
      event split captured as a MEDIUM TERM design item. (2026-07-03)
- [x] Setup-cost refund bug fixed — quarter-start snapshot in simState, QPL
      add-back deleted, hires now actually paid from carried-forward cash.
      Found via adversarial review; see decision log. 104/104 tests. (2026-07-03)
- [x] Simplification pass phases 1–4 — engine-owned day (`tickSimulation`),
      click commands, one spot allocator + deterministic standing spots,
      layout/tuning constants to config, era advancement wired (cap 2),
      loan demand elasticity wired (inverted roll fixed), concentration risk
      and canvas HUD deleted, ESLint layer-boundary rules added. 103/103
      tests. See the two 2026-07-03 decision-log entries. (2026-07-03)
- [x] High-DPI canvas rendering — UI credibility pass item (1). The render
      loop in `BankingEmpire.jsx` sizes the backing store to
      `CANVAS_W/H × devicePixelRatio` and applies one absolute
      `ctx.setTransform(dpr, …)` per frame; `ui/SimScreen.jsx` pins the CSS
      size to the logical 1080×640 so the on-screen footprint is unchanged.
      All drawing stays in logical coordinates — zero changes in `renderer/`
      (its `save`/`scale`/`restore` pairs compose on top of the base
      transform). dpr is re-read each frame so monitor hops re-crisp the
      canvas; the backing store only resizes on change (resizing wipes the
      canvas). Click mapping untouched — `getCanvasPoint` already normalizes
      via `CANVAS_W / rect.width`, which is dpr-agnostic. dpr read lives at
      the boundary (`BankingEmpire.jsx`), not the renderer, per the layer
      contract. 104/104 tests, lint clean. Items (2)–(4) of the pass remain.
      (2026-07-19)
- [x] **v1 SHIPPED** — §6 README credibility visuals closed with four stills
      captured from the live deploy via `claude-in-chrome`: a three-panel
      "One quarter, start to finish" walkthrough (setup → a regulatory
      inspection firing → the Q1 report showing the $2,500 fine it cost) above
      "What you'll learn", and `screenshot-branch.jpg` paired with
      `architecture.svg` as the architecture diptych. All six v1
      Definition-of-done criteria now checked. Two defects fixed in the same
      pass: the live deploy was 10 weeks stale (`npm run deploy` run; the
      GitHub Actions item promoted with the drift as evidence), and the setup
      screen's "Securitys" label (pluralisation moved into `STAFF_DEFINITIONS`
      as data, guarded by a new test). 105/105 passing. See decision log
      2026-08-02. (2026-08-02)
- [x] §1e rush seat-usage recurrence diagnosed — **not a bug.** New rush-replica integration test (`engine/simulation.test.js`, "real 8-customer replica fills all 3 seats") drives 8 angry customers (frustration 0.6 / baseAnger 0.45) through the full `entering → queue slot → JOIN_WAIT → CLAIM_SEAT` pipeline with both era-1 tellers busy and `activeEvent: "rush"` doubling frustration growth. All 3 seats fill, zero walkouts. The earlier test injected only 3 calm customers with 0 tellers; this one exercises the real spawn conditions and proves the allocator is correct under load. The "one seat at a time" observation is seat→teller churn (waiting priority 1 pulls seated customers to a freed teller), not a dropped claim — correct behaviour for a transient waiting seat. 93/93 passing. See §1e for the full diagnosis. (2026-06-01)

---

Previous footer of `ROADMAP.md`, kept for the record:

*Last updated: 2026-08-04 — §6 gained a "What got cut" README section (scope
cuts plus the setup-cost refund bug the tests agreed with). The daily-task
selector reads the SHORT TERM section first; with v1 closed, MEDIUM TERM is
now the live backlog and GitHub Actions auto-deploy sits at the top of it.
Structure follows the portfolio standard in writing-kit/ROADMAP-TEMPLATE.md.*
