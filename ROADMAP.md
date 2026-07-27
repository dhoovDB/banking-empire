# Banking Empire — Roadmap

This file captures ideas, features, and design decisions for future development.
It is a living document. When an idea gets built, move it to the Completed section
with a date. When an idea gets cut, note why.

---

## What this builds toward

Banking Empire teaches real banking concepts — NIM, CAR, NPL — through play. It
builds toward a game a first-time player can finish in one sitting and come away
able to explain those concepts to a non-banker, with the whimsy carrying the
lesson rather than decorating it. v1 is the full 20-quarter playable arc (see
Definition of done below); v2 and beyond deepen the financial model and extend
the eras.

---

## Guiding principles

- The player learns something true about banking from every mechanic. A mechanic that doesn't teach gets cut.
- A first-time player makes it through era 1 without ever opening a tutorial.
- A player who finishes 20 quarters can explain NIM, CAR, and NPL to a non-banker.
- The player has fun for 20 quarters straight. Fun isn't decoration — it's the delivery mechanism for the education.

---

## Definition of done — v1

**Banking Empire v1 ships when:**
- [ ] A player can run a full 20-quarter playthrough start to finish in one sitting without hitting a crash
- [ ] Anyone with the link can play in a desktop browser without cloning the repo
- [ ] An outside reader understands what the game is within 90 seconds of opening the README
- [ ] A player pulling a rate slider, watching a tick, or reading the quarterly report sees the response they expect — every time
- [ ] A player who staffs up at setup sees the cost on their balance sheet before quarter 1 begins
- [ ] A player who makes catastrophically bad decisions actually loses the game (negative equity or NPL receivership)

Everything beyond this is v2. Resist the pull to keep adding until v1 ships.

See SHORT TERM section for the specific bugs and gaps behind each criterion.

---

## SHORT TERM — v1 blockers
*These must be done before anything else. In priority order.*

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
- [ ] **3-panel annotated walkthrough** above "What you'll learn" — stills of
      setup → mid-day with an event firing → report, one caption each. Deferred
      capture pass: use `claude-in-chrome` against the live deploy (chosen over
      a Playwright harness to avoid adding deps for the last v1 blocker). Crisp
      now that the high-DPI dpr work landed.
- [ ] **Complete the architecture diptych** — pair a gameplay screenshot beside
      the existing `architecture.svg`. Lands with the capture pass above.
- [ ] *(Fallback, only if stills read as static in review: a ~3s optimized GIF of*
      *the coins/chibi beat — frame-captures stitched, not a live screen-record.)*

---

## MEDIUM TERM — v2 quality
*Do these after v1 ships. Improves depth and replayability.*

### UI polish

- [ ] **UI credibility pass (from the 2026-07-02 critical review)** — the four
      items deliberately split out of the simplification refactor, in payoff
      order: (1) ~~high-DPI canvas rendering via `devicePixelRatio`~~ **done
      2026-07-19** (see Completed), (2) responsive scaling — canvas `max-width` +
      SetupScreen `auto-fit` grid; the app breaks below ~1280px, (3) spacing
      and font scales in `ui/theme.js`, sweeping the ad-hoc inline values
      across the three screens, (4) ReportScreen quarter-over-quarter deltas
      replacing the third copy of the live KPIs. **Skills to load, one per
      task** (unzipped local paths in `C:\Projects\claude-skills`):
      `engineering-team/skills/senior-frontend` for (1)–(2),
      `product-team/skills/ui-design-system` for (3)–(4) (design tokens +
      responsive calculations), and `engineering-team/playwright-pro` to
      verify — scripted screenshots at 1280×720 / high-DPI / narrow widths,
      which also produce the stills for the SHORT TERM §6 README credibility
      visuals.

- [ ] **Role clarity for chibis — legend panel in HUD (working direction)** —
      desks have nameplates ("LOANS") but the chibis themselves don't read
      as a specific role. The 2026-05-16 playtest produced "I see 2 people
      and one is transparent — is that the security placeholder?" The
      transparent figure WAS the security ghost; the player couldn't tell
      from the canvas alone. As staffing grows (era 2+ adds more roles,
      era 3-4 adds tiered units) this gets worse, not better. **Working
      direction:** a legend panel in the React HUD that maps outfit colour
      / silhouette to role, sitting alongside the KPI panel. Needs a design
      session to finalise before building — alternatives still on the table
      are floating role labels above each named chibi, hover tooltips, or
      distinct visual icons per role. Decide the approach, then build.

- [ ] **Framer Motion on the React shell** — animate phase transitions
      (setup → simulating → report), KPI counter tweens, event-banner
      enter/exit, and modal-style screens. Cannot animate inside the
      `<canvas>` element — this is for the React UI surrounding it.
      Item #6 in the 2026-05-03 playthrough sequence.

### Developer tooling
*These changes happen in the claude-skills repo, not here. This entry is a*
*reminder only — Banking Empire benefits from them but doesn't host them.*

- [ ] **SKILL.md: html5-canvas** — iso coordinate system, tile-fraction
      sizing rules, `drawVault` geometry pattern, no raw pixel anchors.
      Trigger: any task touching `renderer/canvas.js` or `renderer/particles.js`.
      Lives in github.com/dhoovDB/claude-skills.

- [ ] **SKILL.md: react-game-loop** — `setInterval` simulation loop plus
      `requestAnimationFrame` render loop pattern, why `simState` is a ref
      not React state, how to add new loops without breaking the existing
      architecture. Trigger: any task touching `BankingEmpire.jsx`
      simulation or render logic. Lives in github.com/dhoovDB/claude-skills.

- [ ] **SKILL.md: vitest** — testing conventions for pure engine functions,
      how to write integration tests for multi-tick simulation sequences.
      Trigger: any unit test task in this repo. Lives in
      github.com/dhoovDB/claude-skills.

### Deploy automation

- [ ] **GitHub Actions auto-deploy on push to master** — currently the
      gh-pages branch updates only when someone runs `npm run deploy`
      locally (added 2026-05-08). Replace with a workflow at
      `.github/workflows/deploy.yml` that builds and deploys on every push.
      Worth doing once playthrough churn slows down — until then the
      manual script is fine and avoids CI debugging on small changes.

### Gameplay loop improvements

- [ ] **TELLER_SLOTS spacing aligned to the narrower counter** — the
      counter now uses 0.42-tile spacing (`drawTellerCounter`, 2026-05-15)
      while `TELLER_SLOTS` in `BankingEmpire.jsx` is still 0.55-tile spacing.
      At 2–4 tellers the rightmost customer sits inside the counter; at 5
      tellers it drifts 0.02 tiles past the right edge; at 6 tellers, 0.15
      tiles past. Era 1 ships 2 tellers so this is latent until era 2+
      hiring. Fix is to re-derive `TELLER_SLOTS` from the same constants
      `drawTellerCounter` uses — ideally lift those constants into a shared
      module so the renderer and engine can't drift again.

- [ ] **Per-tick personal-space rule (collision avoidance)** — waiting-state
      stacking is prevented by unique standing spots (deterministic
      `standingSpotFor` since 2026-07-03, previously the claimed-lobby-tile
      allocator). Neither prevents transient overlap during transitions —
      e.g. a customer walking from queue to seat can pass through another
      walking the opposite way. A per-tick rule in `moveToward` (or its
      caller) that checks proposed steps against other character positions
      and freezes/deflects on near-miss would close this gap. Shape A in the
      original design discussion. Deferred because collision physics adds
      deadlock and tuning risk for a purely cosmetic gap. Worth picking up
      if transient overlap becomes a recurring playtest complaint.

- [x] **Loan officer roster on canvas** — when loan officers > 0, named chibi from `loanOfficerRoster` draws at the loan desk (back side). Ghost stays for the unhired case. (2026-05-08)

- [ ] **Inspector click feedback in UI** — when inspector is distracted, show a banner or log entry confirming the fine amount was reduced (e.g. "Fine reduced to $1,250"). Player currently has to wait for the report screen to see the effect.

- [ ] **Robber click requires security hired** — currently clicking a robber works even with security = 0 (no security staff to dispatch). Guard the interaction: if `securityCount === 0`, show a "No security on duty" bubble instead.

- [ ] **Split "rush" into two distinct events** (playtest feedback 2026-07-03:
      "a bank rush is more than just a rush of customers"). Today's `rush` is
      one event doing double duty. Split into:
      - **Foot-traffic surge** — the current mechanic renamed: a random
        influx of ordinary customers, era 1+, tests staffing and seats.
      - **Bank run** — macro/confidence-driven: depositors arrive to *pull
        money out*, triggered by conditions (low reputation, a macro rate
        shock, a publicized robbery) rather than pure probability. Withdrawals
        shrink the deposit book toward the liquidity loss condition — this is
        the event that teaches why the 2% cash floor exists.
      The bank run depends on two LONG TERM foundations: condition-triggered
      events (second evaluation pass) and macro events (Fed rate decisions).
      Sequence it with those; the surge rename is safe to do any time. This
      also gives the shelved concentration-risk mechanic its natural home —
      a whale walkout as a bank-run trigger.

- [ ] **Loan customer routes to a teller position instead of the loan
      desk** — observed 2026-05-19 during the §5 engine-handler sweep
      smoke test. Setup: 1 loan officer hired, era 1, customer with
      `loanAmt > 0` arrived and walked toward a spot next to the tellers
      instead of the loan desk at `loanDeskPos`. The §5 refactor preserved
      the `advancing` block's branch logic byte-for-byte (`target =
      char.useLoanDesk ? simState.loanDeskPos : tellerSlots[char.tellerIndex]`),
      so this is most likely a pre-existing bug that earlier playtests
      missed — probably in `findFreeSlot` (which sets `useLoanDesk: true`)
      or in `CLAIM_SLOT`'s waypoint+target wiring. Worth an investigation
      pass: log what `useLoanDesk`, `tellerIndex`, and `loanDeskPos` look
      like on the loan customer's first `advancing` tick to isolate which
      stage is dropping the loan-desk routing.

- [ ] **Multi-desk loan throughput (officer count scales capacity)** — v1 took
      option (b): `STAFF_DEFINITIONS.loanOfficers.max` is now `1`, so the player
      can't pay for officers the single-desk engine model can't use (see
      Completed 2026-06-03 and the decision-log entry). This entry is the
      remaining **v2** path — option (a): scale loan desks with officer count
      (second desk at 2, third at 3) so additional officers add real throughput,
      and draw each hired officer's chibi (today the renderer only draws
      `loanOfficerRoster[0]`). Touches `engine/simulation.js` (per-desk
      `loanDeskPos`/`loanDeskOccupied` → arrays indexed by officer), the renderer
      (one chibi per officer), and `config/characters.js` (raise `max` back up).
      Raise the cap only as part of this work — the `// reason:` comment on the
      config field and `engine/characters.test.js` both guard against lifting it
      on its own. Natural fit for era 2+ when staffing scales.

- [ ] **Proactive NIM tutorial** — era 1 quarter 1 should explain NIM before
      the player's first rate decision. Currently players discover it reactively.

- [ ] **KPI history chart** — players see current values but not trajectory.
      A falling CAR looks fine at 11% until you realize it was 14% three quarters ago.

- [ ] **Banker's journal** — end-of-quarter plain-language narrative.
      "Your NIM compressed because deposit costs rose faster than lending income."
      Good showcase of Claude API integration for the portfolio.

- [ ] **Win / loss conditions — full suite** — v1 ships with negative equity
      and NPL receivership. v2 adds:
      - [ ] Reputation < 20 for two quarters triggers depositor flight
      - [ ] CAR below regulatory minimum ignored for one quarter triggers seizure
      - [ ] Multiple endings based on playstyle (community pillar, growth machine, steady hand)

- [x] **Era 2 unlock wired** — pulled forward into v1 on 2026-07-03 (see
      decision log): `resolveEraTransition` promotes the bank when
      eraProgress fills, capped at era 2 by `ERA_RULES` in
      `config/progression.js`. Vault and seat costs already flowed through
      `calculateOneTimeCosts()`; verified while wiring. (2026-07-03)

### Financial model depth

- [x] **Educational links rendered** — closed by the SetupScreen "What these
      numbers mean" KPI reference table (2026-07-03): label, formula, plain-
      language explanation, warn/danger thresholds, and the educationalLink
      for every KPI_DEFINITIONS entry. (2026-07-03)

### Testing

- [x] **Thorough unit test coverage** — the 2026-07-03 simplification pass
      closed the bulk of this: `tickSimulation` day-level tests (event firing,
      banner expiry, click windows, a full 750-tick day with per-tick
      occupancy invariants), interaction-command tests, loan-demand and
      era-transition tests. 103 tests. Remaining gaps (resolveEvent per-type
      spawn details, buildEventSchedule probability bounds) are small enough
      to add alongside whatever era-2 content touches them. (2026-07-03)

---

## LONG TERM — v3 and beyond
*Don't start these until v2 is stable. Each needs its own design session.*

### Era 3-4 content

- [ ] **Tiered staffing model** — era 3-4 replaces individual tellers with
      organisational units: Branch Manager, Regional Hub, Mobile App,
      Digital Transformation. Requires canvas metaphor rethink (see below).

- [ ] **Infrastructure assets** — Server racks, compliance departments,
      call centers replace vault/waiting seats at era 3+ scale.

- [ ] **Macro events** — Fed rate decisions with one-quarter player window,
      recession mechanics, market boom. Config designed in events.js. Engine not wired.

- [ ] **Customer categories** — students, small businesses, retirees,
      commercial, institutional. Each requires different staff to serve.

- [ ] **Era 3+ events** — former staff joins competitor, acquisition
      opportunity, fintech challenger, whistleblower.

### Canvas metaphor redesign (design session required before building)

The individual chibi-at-desk metaphor works at era 1-2 community bank scale —
it's tactile, human, and matches the Tavern Master loop the game is built on.
At era 3-4 it breaks down. You can't represent a $50M regional bank as
six tellers walking to a counter. The canvas needs a different visual language
that matches the educational moment: banking at scale is an infrastructure
and systems business, not a people business.

Three options to evaluate in the design session:
- **City map** — zoom out to a map view with branch dots and customer flow
  lines between them. Communicates geographic scale and network effects.
- **Zoom-out toggle** — keep the branch view but add a regional dashboard
  accessible via toggle. Players can switch between operational detail
  and strategic overview.
- **Dashboard sim** — era 3+ replaces the canvas entirely with a data
  dashboard. Reinforces that decision-making at scale is about reading
  indicators, not watching individuals.

Flag for renderer design session. Decision will cascade into how tiered
staffing and infrastructure assets are represented visually.

### Technical foundations (required before building era 3 content)

- [ ] **Condition-triggered events** — whaleExit fires on state condition,
      not probability. Engine needs a second evaluation pass each quarter,
      separate from the probability scheduler.

- [ ] **Individual loan book** — NPL is currently a manually nudged number.
      A real model tracks loans individually with origination quarter, rate,
      type, and default probability. NPL ratio then emerges from actual loan
      performance. Required for era 3+ realism.

- [ ] **Risk-weighted CAR** — current `equity / loans` works for era 1-2.
      Era 3+ with mortgages, credit cards, and commercial loans requires true
      risk-weighted assets. Each product type carries a Basel III risk weight
      (mortgages: 35–50%, commercial: 100%, etc.).
      Reference: https://www.bis.org/publ/bcbs128.pdf

---

## Detailed specs for future work

### Customer categories

| Type | Era | Deposit range | Special mechanic |
|---|---|---|---|
| Retail (current) | 1 | $1.5k–$10k | Base customer |
| Student | 1 | $500–$2k | High churn, reputation-sensitive |
| Small business | 2 | $15k–$80k | Requires loan officer to serve |
| Retiree | 2 | $20k–$120k | Rate-sensitive, low churn |
| Commercial | 3 | $200k–$2M | Requires commercial loan officer |
| Whale (current) | 1 | $380k–$1M | Random event, watch concentration risk |
| Institutional | 4 | $5M–$50M | Requires era 4 unlock |

### Tiered staffing (era 3-4)

| Unit | Era | Capacity | Cost |
|---|---|---|---|
| Branch Manager | 3 | Supervises 10 tellers, reduces walk-outs 20% | $25k hire |
| Regional Hub | 3 | Handles 10x customer throughput per tick | $80k |
| Mobile App | 3 | Handles 100x low-value transactions passively | $50k + $5k/qtr |
| Digital Transformation | 4 | 1,000x throughput, unlocks institutional customers | $200k |

### Infrastructure assets (era 3-4)

| Asset | Era | Effect | Cost |
|---|---|---|---|
| Server Rack (tier 1) | 3 | Reduces outage probability 40% | $20k |
| Server Rack (tier 2) | 3 | Eliminates outage risk, enables digital banking | $50k |
| Compliance Department | 3 | Reduces inspection fine probability 60% | $30k + $8k/qtr |
| Call Center | 3 | Handles customer complaints, reputation floor +10 | $25k + $6k/qtr |
| Data Center | 4 | Required for institutional customers | $100k |
| Fraud Detection System | 3 | Reduces NPL from credit card products | $40k |

---

## Decision log
*Project and architectural decisions live here. Changes to this repo's CLAUDE.md
are logged in CLAUDE.md, not here. Read this before changing anything that seems
"obviously wrong" — it probably isn't.*

### Era 1 NIM is intentionally low
Starting NIM (~1.125%) is below the warn threshold. This teaches the core
mechanic: deposits are a cost, loans are revenue. The KPI explainer tells
the player this. Do not raise it by tweaking rates — that hides the lesson.
If era 1 feels too punishing, adjust warn/danger thresholds in economy.js.

### True NIM formula
`NIM = (interest income - interest expense) / loans * 100`
Not rate spread. All thresholds are quarterly figures (formula uses * 0.25).
Reference: https://en.wikipedia.org/wiki/Net_interest_margin

### Robbery locked to era 2+
Era 1 players have no security staff, so a robbery offers no meaningful
decision. `eraRange: [2, 4]` is intentional. Do not change to [1, 4].

### Dynamic liquidity floor
Loss condition: `cash < deposits * 0.02` — not a fixed number.
Scales with the bank as it grows. Teaches reserve requirement proportionality.

### Vault upgrades locked to era 2+
Levels 2 and 3 serve no purpose in era 1 since robberies don't fire.
They display as locked teasers, not active options.

### Vault is an iso prism, not a screen-pixel sprite
`drawVault` anchors the vault to a 1×1 tile footprint between
`toIso(5.0, 1.0)` and `toIso(6.0, 2.0)`. The top diamond, right face, and
front face all derive from those iso corners and `H = ISO_TH * 0.85`. The
door radius (`H * 0.38`) and every fitting (rivets, wheel, hinges, handle,
glow halo) is sized as a fraction of `H` — never as raw screen pixels. Do
not re-introduce `vd.x ± 44`, `vd.y ± 80`-style offsets; the prior version
floated on a different floor than the room because the alcove and frame
were anchored in screen pixels independent of the iso transform. The same
rule applies to any future furniture: tile-fractions and iso corners only.

### Loan desk lives in the back-left, not next to the manager desk
The loan officer desk is at `toIso(2.0, 1.5)` and the loan officer chibi
at `toIso(2.0, 0.95)` (0.55-tile setback so legs clear the desk top). The
earlier `toIso(2.2, 2.0)` position crowded the manager desk one tile in
front of it; "manager and loan desk read as one merged blob" was a
playthrough complaint. The customer's loan-desk stop position
(`LOAN_DESK_POS` at gy=2.4, engine-side) is unchanged — the desk-to-customer
gap is the price of giving the manager desk room to breathe.

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

### 2026-06-03 — Loan officers capped at 1; honest v1 over half-built v2

`STAFF_DEFINITIONS.loanOfficers.max` was 3, but the engine models a single loan
desk: every check in `engine/simulation.js` is binary (`loanOfficers > 0`)
against one `loanDeskPos`/`loanDeskOccupied`, and the renderer only draws
`loanOfficerRoster[0]`. So hiring a 2nd or 3rd officer charged the player
$8k + $4k/qtr for zero throughput and no second chibi — a silent lie to the
player, confirmed visually in a 2026-05-13 playtest ("the 2nd loan officer is a
ghost again").

Two fixes were on the table: (a) scale loan desks with officer count so extra
officers add real capacity, or (b) cap `max: 1` and be honest about what the
game models today. **v1 took (b).** The governing constraint is "resist the pull
to keep adding until v1 ships" — option (a) is a *feature* (multi-layer: engine
desk arrays + renderer per-officer chibis), and v1 isn't done. Capping the role
removes a half-built capability rather than adding one, which is the better v1
call and the more honest player contract: you pay for one officer, you get one
officer's worth of service.

Option (a) is not lost — it's preserved as the MEDIUM TERM "Multi-desk loan
throughput" entry, scoped for era 2+ when staffing genuinely scales. Two guards
keep the cap honest until then: a `// reason:` comment on the config field
explaining the single-desk model, and `engine/characters.test.js` asserting
`max === 1` (and that every default staffing level sits within its role's cap).
Lifting the cap on its own now fails a test. The roster pre-build in
`BankingEmpire.jsx` dropped from `length: 3` to `length: 1` to match. 96/96
passing.

### 2026-05-29 — Event display config consolidated; config wins the palette

Three parallel maps (`EVT_DISPLAY` in `config/events.js`, `EVENT_VISUALS` in
`renderer/canvas.js`, `EVT_LABELS` in `ui/ReportScreen.jsx`) described the
same five events. The colors disagreed — robbery rendered `#ff6b6b` in the
React HUD banner but `#d96060` on the canvas overlay banner, for the same
event in the same quarter. The renderer's muted colors were unannounced drift
from a 2026-05-16-ish edit. Three decisions landed in this consolidation:

- **One config, three label fields.** `EVT_DISPLAY[event]` now carries
  `bannerLabel` (live, used by both the React HUD and the canvas overlay —
  the canvas uppercases at render time for legibility), `reportLabel`
  (neutral after-action label for `ReportScreen`), `description`, `color`,
  and an optional `border`. The renderer's local `EVENT_VISUALS` and the
  report's local `EVT_LABELS` were deleted; both surfaces now import from
  config. Adding a new event = one entry in `config/events.js` + one in
  `BRANCH_EVENTS`. Aligns with the CLAUDE.md rule that `config/events.js`
  owns "UI display strings."
- **Config palette wins.** Robbery is `#ff6b6b` (the brighter alarm red),
  demoting the renderer's `#d96060` as drift, per the CLAUDE.md "lean into
  the drama" copy register. The same logic applied to inspection (kept
  `#f5a623`), rush (`#ff8c42`), and whale (`#d4af37`); outage already agreed
  at `#9a8f7e`.
- **Copy register: dramatic banner, neutral report.** The banner says
  "Robbery!" with drama because the player is reacting *now*; the report
  says "Robbery" because the player is reviewing what happened. Two label
  fields encoded the rule as data instead of as scattered literals across
  layers.

New `engine/events.test.js` (4 tests) asserts every `BRANCH_EVENTS` key has
a matching `EVT_DISPLAY` entry with well-formed fields; runs alongside the
existing 88 tests (92/92 passing). The next instance of this drift will fail
a test instead of shipping silently.

---

## Completed
*Add the date when moving items here.*

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
- [x] §1e rush seat-usage recurrence diagnosed — **not a bug.** New rush-replica integration test (`engine/simulation.test.js`, "real 8-customer replica fills all 3 seats") drives 8 angry customers (frustration 0.6 / baseAnger 0.45) through the full `entering → queue slot → JOIN_WAIT → CLAIM_SEAT` pipeline with both era-1 tellers busy and `activeEvent: "rush"` doubling frustration growth. All 3 seats fill, zero walkouts. The earlier test injected only 3 calm customers with 0 tellers; this one exercises the real spawn conditions and proves the allocator is correct under load. The "one seat at a time" observation is seat→teller churn (waiting priority 1 pulls seated customers to a freed teller), not a dropped claim — correct behaviour for a transient waiting seat. 93/93 passing. See §1e for the full diagnosis. (2026-06-01)

---

## Cut ideas

| Idea | Reason cut |
|---|---|
| Multiplayer competitive mode | Scope. Single-player educational arc first. |
| Real historical Fed rate data | Breaks replayability — players would memorise optimal responses. |
| 40-quarter playthrough | Reduced to 20. 40 is a live service product, not a portfolio piece. |
| Era 2 branch upgrades (Drive-through, ATM, Digital banking, Private Banking Suite, IT Systems, Second floor) | Superseded by era 3-4 infrastructure model. Era 2 is the right time to extend gameplay depth, not branch fixtures. |

---

*Last updated: 2026-07-25. The daily-task selector reads the SHORT TERM section
first. Structure follows the portfolio standard in writing-kit/ROADMAP-TEMPLATE.md.*
