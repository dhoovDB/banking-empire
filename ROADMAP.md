# Banking Empire — Product Roadmap

This file captures ideas, features, and design decisions for future development.
It is a living document. When an idea gets built, move it to the Completed section
with a date. When an idea gets cut, note why.

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

- [ ] **Only one waiting seat fills during a rush** — observed 2026-05-21:
      with 3 waiting seats and multiple customers standing during a rush
      event, only one seat was occupied at a time. This is a *recurrence* of
      the original §1e observation (see Completed, 2026-05-13). That earlier
      pass added a multi-tick integration test proving the seat allocator
      seats 3 customers correctly — but the test injects 3 customers
      *directly into waiting state*, while a real rush spawns 8 through the
      full `entering → queue slot → JOIN_WAIT` pipeline. The renderer was
      ruled out this session: `renderer/canvas.js:885-893` draws each customer
      at its own `gx/gy` and the chairs come from the same
      `simState.seatPositions` the engine assigns from, so the visual faithfully
      reflects engine state — "one seat used" means one customer reached
      `seatedAt`. **Diagnostic-first plan:** write a rush-replica test (8
      customers, 2 tellers, run the tick loop, count `seatedAt`). If it shows
      3 seated → the bug is in the draw path after all (e.g. the +5px seated
      offset too subtle to read). If it shows 1 → an engine pipeline bug, and
      the test has localized it. Write the test before any fix, per the repo's
      testing norm. v1-scoped: a rush that visibly wastes seats undercuts the
      "staffing/facilities decisions matter" lesson.

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

- [ ] **Consolidate event display strings + colors to one source.** Three
      parallel maps describe the same five events: `EVT_DISPLAY` in
      `config/events.js` (title/description/color), `EVENT_VISUALS` in
      `renderer/canvas.js` (label/color/border), and `EVT_LABELS` in
      `ui/ReportScreen.jsx` (just titles). The colors *disagree* — e.g.
      robbery is `#ff6b6b` in config but `#d96060` in the renderer, so the
      React event banner and the canvas banner can show two different reds
      for the same event. Spans config + renderer + ui, and carries a real
      decision: which palette wins, and does the after-action report get the
      neutral label ("Robbery") while the live banner keeps the dramatic one
      ("Robbery!") per the in-game copy register? Per CLAUDE.md, `config/
      events.js` already owns "UI display strings," so config should be the
      single source of truth; the renderer and report should read from it.
      Deferred from the 2026-05-21 ui/ sweep because it is a design call, not
      a mechanical extraction.

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

### 6. README demo video
*Problem: a hiring manager won't clone a repo to evaluate a portfolio piece.*

- [ ] Record 60–90 second screen capture: setup → quarter 1 event → report screen
- [ ] Export as GIF or MP4 and embed in README above "What you'll learn"

---

## MEDIUM TERM — v2 quality
*Do these after v1 ships. Improves depth and replayability.*

### UI polish

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

- [ ] **Per-tick personal-space rule (collision avoidance)** — the lobby
      allocator (shipped 2026-05-11) prevents stacking *within waiting state*
      by giving each waiter a unique tile. It does not prevent transient
      overlap during transitions — e.g. a customer walking from queue to seat
      can pass through another customer walking the opposite way. A per-tick
      rule in `moveToward` (or its caller) that checks proposed steps against
      other character positions and freezes/deflects on near-miss would close
      this gap. Shape A in the original design discussion. Deferred because:
      (a) the allocator fix covers the visible bunching that prompted the
      task, (b) collision physics adds deadlock and tuning risk that the
      discrete-allocator pattern avoids, and (c) the architecture already
      treats positions as discrete claims, so adding a continuous-space rule
      would be a new pattern in the engine. Worth picking up if transient
      overlap becomes a recurring playtest complaint.

- [x] **Loan officer roster on canvas** — when loan officers > 0, named chibi from `loanOfficerRoster` draws at the loan desk (back side). Ghost stays for the unhired case. (2026-05-08)

- [ ] **Inspector click feedback in UI** — when inspector is distracted, show a banner or log entry confirming the fine amount was reduced (e.g. "Fine reduced to $1,250"). Player currently has to wait for the report screen to see the effect.

- [ ] **Robber click requires security hired** — currently clicking a robber works even with security = 0 (no security staff to dispatch). Guard the interaction: if `securityCount === 0`, show a "No security on duty" bubble instead.

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

- [ ] **Loan officer count beyond 1 has no effect** — `STAFF_DEFINITIONS.loanOfficers.max` is 3, but every check in `engine/simulation.js` (lines 138, 145, 297) is binary (`loanOfficers > 0`), and there's a single `loanDeskPos` / `loanDeskOccupied`. Hiring 2 or 3 burns $8k + $4k/qtr each for zero throughput gain. The renderer also only draws `loanOfficerRoster[0]`, so the player who hires a second officer sees no new chibi — a 2026-05-13 playtest confirmed this visually (player described it as "the 2nd loan officer is a ghost again"). Two ways to fix: (a) scale loan desks with officer count (second desk at 2, third at 3), or (b) cap `max: 1` and accept the simpler model. (a) is more interesting gameplay, (b) is honest about what the game models today. Discovered while writing setup-screen tooltips on 2026-05-03.

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

- [ ] **Era 2 unlock wired** — eraProgress accumulates but era transition
      doesn't change available staff, events, or facilities yet.
      - [ ] Verify vault upgrade and facility costs flow through
            `calculateOneTimeCosts()` and deduct at sim start. The era 1
            staff-cost path already exists; era 2 facilities should ride it.

### Financial model depth

- [ ] **Educational links rendered** — links defined in economy.js but not
      shown in the KPI panel UI. One line change in KPIPanel.jsx.

### Testing

- [ ] **Thorough unit test coverage** — initial Vitest suite covers
      `engine/financials.js`. Expand to `engine/simulation.js` (evaluateCharacter,
      resolveEvent, buildEventSchedule) and loss condition evaluation in
      `engine/financials.js`. Write tests before adding era 2 content so
      regressions surface immediately.

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

## Design decisions log
*Read this before changing anything that seems "obviously wrong" — it probably isn't.*

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

---

## Cut ideas

| Idea | Reason cut |
|---|---|
| Multiplayer competitive mode | Scope. Single-player educational arc first. |
| Real historical Fed rate data | Breaks replayability — players would memorise optimal responses. |
| 40-quarter playthrough | Reduced to 20. 40 is a live service product, not a portfolio piece. |
| Era 2 branch upgrades (Drive-through, ATM, Digital banking, Private Banking Suite, IT Systems, Second floor) | Superseded by era 3-4 infrastructure model. Era 2 is the right time to extend gameplay depth, not branch fixtures. |

---

*Last updated: roadmap restructured with short/medium/long term prioritization.*
*v1 definition of done added. Daily task selector will use SHORT TERM section.*
