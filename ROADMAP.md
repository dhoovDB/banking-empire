# Banking Empire — Product Roadmap

This file captures ideas, features, and design decisions for future development.
It is a living document. When an idea gets built, move it to the Completed section
with a date. When an idea gets cut, note why.

---

## Guiding principles

- Every mechanic should teach something true about how banking works
- Complexity unlocks gradually — era 1 is simple enough for anyone
- A player who finishes 20 quarters should be able to explain NIM, CAR, and NPL to a non-banker
- Fun is a feature. If it isn't fun, the education doesn't land.

---

## Definition of done — v1

**Banking Empire v1 ships when:**
- [ ] The game runs end-to-end for a full 20-quarter playthrough without crashing
- [ ] A hosted demo link exists (GitHub Pages) and works on desktop
- [ ] A hiring manager can understand what the game is within 90 seconds of opening the README
- [ ] No known bugs that break core gameplay (rate sliders, sim loop, quarterly report)
- [ ] Setup costs are correctly deducted when the sim starts
- [ ] At least two loss conditions fire correctly (negative equity, NPL receivership)

Everything beyond this is v2. Resist the pull to keep adding until v1 ships.

See SHORT TERM section for the specific bugs and gaps behind each criterion.

---

## SHORT TERM — v1 blockers
*These must be done before anything else. In priority order.*

### 1. Core simulation bugs
*Problem: the sim loop has known issues that break the player experience.*

- [ ] **Customer pathfinding — bunching at entrance** — customers queue near
      the front door instead of spreading toward tellers. Re-evaluate after the
      6×5 grid overhaul (slot positions changed). If still bunching, hardcoded
      waypoints around the teller desk are the planned fix (see section 1c).
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
- [ ] **Narrower teller desk** — desk currently spans the full row width.
      Reduce to roughly half a tile per teller window so the counter reads as
      a service desk rather than a wall. (Slot gy already shifted forward as
      part of the pathfinding fix above; only the counter width remains.)
- [x] **Loan officer + customer share one desk** — fixed 2026-05-08. Same
      pattern as the teller fix: `LOAN_DESK_POS` shifted from gy=2.0 (where
      desk visual sits) to gy=2.4 (in front of desk). Live loan officer chibi
      now draws at gy=1.75 (behind desk) when `staff.loanOfficers > 0`; ghost
      stays in the same back-of-desk position when unhired. Hired officer is
      a real opaque named chibi from the new `loanOfficerRoster`, not a
      translucent placeholder.
- [ ] **Vault dimensionality** — the vault still breaks the iso projection
      (depth not consistent with the rest of the room). The new gx=5.0, gy=1.5
      position made it more visible but didn't fix the underlying math. Redraw
      with consistent iso depth (top face, front face, side faces all using
      the same per-pixel-per-grid-unit ratio).
- [ ] **Rearrange visuals — waiting seats, teller desk, and loan officer
      desk are crowded in the middle** — all three serving zones cluster in
      the gx 1.5–5 strip with chairs, queue lanes, and counters layered on
      top of each other. The eye should read three distinct service areas.
      Options: push the loan desk further left (or to the back wall),
      relocate waiting seats to one side instead of dead-center, or widen
      the teller counter span so the rest can breathe. Decide a layout
      pass before adding more chairs (era 2 seat purchases) or a second
      loan officer.

### 1d. Latent bug found during plan exploration

- [ ] **`vaultPos` referenced as bare variable in robber pathing** —
      `engine/simulation.js:67,69` references `vaultPos` directly instead of
      `simState.vaultPos`. ReferenceError fires the moment a robber tries to
      walk to the vault. Robberies are era 2+ only, so this hasn't been
      triggered in playtest. One-line fix; bundle with the next robbery-related
      task.

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

### 5. README demo video
*Problem: a hiring manager won't clone a repo to evaluate a portfolio piece.*

- [ ] Record 60–90 second screen capture: setup → quarter 1 event → report screen
- [ ] Export as GIF or MP4 and embed in README above "What you'll learn"

---

## MEDIUM TERM — v2 quality
*Do these after v1 ships. Improves depth and replayability.*

### UI polish

- [ ] **Framer Motion on the React shell** — animate phase transitions
      (setup → simulating → report), KPI counter tweens, event-banner
      enter/exit, and modal-style screens. Cannot animate inside the
      `<canvas>` element — this is for the React UI surrounding it.
      Item #6 in the 2026-05-03 playthrough sequence.

### Deploy automation

- [ ] **GitHub Actions auto-deploy on push to master** — currently the
      gh-pages branch updates only when someone runs `npm run deploy`
      locally (added 2026-05-08). Replace with a workflow at
      `.github/workflows/deploy.yml` that builds and deploys on every push.
      Worth doing once playthrough churn slows down — until then the
      manual script is fine and avoids CI debugging on small changes.

### Gameplay loop improvements

- [x] **Loan officer roster on canvas** — when loan officers > 0, named chibi from `loanOfficerRoster` draws at the loan desk (back side). Ghost stays for the unhired case. (2026-05-08)

- [ ] **Inspector click feedback in UI** — when inspector is distracted, show a banner or log entry confirming the fine amount was reduced (e.g. "Fine reduced to $1,250"). Player currently has to wait for the report screen to see the effect.

- [ ] **Robber click requires security hired** — currently clicking a robber works even with security = 0 (no security staff to dispatch). Guard the interaction: if `securityCount === 0`, show a "No security on duty" bubble instead.

- [ ] **Loan officer count beyond 1 has no effect** — `STAFF_DEFINITIONS.loanOfficers.max` is 3, but every check in `engine/simulation.js` (lines 138, 145, 297) is binary (`loanOfficers > 0`), and there's a single `loanDeskPos` / `loanDeskOccupied`. Hiring 2 or 3 burns $8k + $4k/qtr each for zero throughput gain. Two ways to fix: (a) scale loan desks with officer count (second desk at 2, third at 3), or (b) cap `max: 1` and accept the simpler model. (a) is more interesting gameplay, (b) is honest about what the game models today. Discovered while writing setup-screen tooltips on 2026-05-03.

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
