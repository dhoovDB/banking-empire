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

## Current status (2026-10-10)

- **Phase:** v1 shipped 2026-08-02 and is live on GitHub Pages; v2 (MEDIUM
  TERM) not started.
- **Next:** GitHub Actions auto-deploy, the top MEDIUM TERM item. Owner picks
  when to resume.
- **Open decisions:** whether to trim the MEDIUM TERM backlog when v2 starts.
- **Blockers:** none.

---

## Guiding principles

- The player learns something true about banking from every mechanic. A mechanic that doesn't teach gets cut.
- A first-time player makes it through era 1 without ever opening a tutorial.
- A player who finishes 20 quarters can explain NIM, CAR, and NPL to a non-banker.
- The player has fun for 20 quarters straight. Fun isn't decoration — it's the delivery mechanism for the education.

---

## Definition of done — v1

**Banking Empire v1 SHIPPED 2026-08-02.**
- [x] A player can run a full 20-quarter playthrough start to finish in one sitting without hitting a crash
- [x] Anyone with the link can play in a desktop browser without cloning the repo
- [x] An outside reader understands what the game is within 90 seconds of opening the README
- [x] A player pulling a rate slider, watching a tick, or reading the quarterly report sees the response they expect — every time
- [x] A player who staffs up at setup sees the cost on their balance sheet before quarter 1 begins
- [x] A player who makes catastrophically bad decisions actually loses the game (negative equity or NPL receivership)

Everything beyond this is v2. Resist the pull to keep adding until v1 ships.

The specific bugs and gaps behind each criterion are in `ROADMAP-ARCHIVE.md`
(SHORT TERM §1–§6).

---

## v1 — shipped 2026-08-02

The full 20-quarter arc is playable and deployed; every Definition of done box
is checked. Three scope cuts got there (40 quarters cut to 20, loan officers
capped at 1, the demo video), and an adversarial review caught setup costs being
silently refunded, a bug the unit tests had agreed with. The SHORT TERM
blocker list (§1–§6), the dated v1 decision entries and the Completed list
are archived verbatim in `ROADMAP-ARCHIVE.md`.

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

- [ ] **Write down the screenshot capture recipe** — `docs/images/README.md`
      (adversarial review, 2026-08-02, WARNING). The four README stills landed
      with no record of how to remake them, so the next UI change means
      rediscovering all of it. Must capture: window size, the staffing used
      (2 tellers + 1 loan officer), the crop, and above all **the throttling
      trap** — Chrome throttles the 100 ms sim tick to ~1/sec in a hidden tab,
      so the branch captures nearly empty and the report reads "0 customers
      served" while looking exactly like a game bug. That one cost real time on
      2026-08-02 and currently lives only in this file's prose. Verify with
      `document.visibilityState === "visible"` and a tick-rate check (~30 fires
      in 3s) before capturing anything. The same file should record the standing
      rule that captures are **viewport only — never full-screen, no browser
      chrome**: committed images are permanent in public git history, so a
      screenshot that catches the author's tabs or bookmarks can't be taken
      back. (The current four are clean — verified viewport-only, and carrying
      no EXIF beyond JFIF quantization tables.)

*The entries below happen in the claude-skills repo, not here. They are a*
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

- [ ] **GitHub Actions auto-deploy on push to main** — *promoted to the top of
      MEDIUM TERM on 2026-08-02.* The gh-pages branch updates only when someone
      runs `npm run deploy` locally (added 2026-05-08). The 2026-08-02 capture
      pass found the live site 10 weeks behind `main` — two and a half months of
      shipped work invisible to anyone clicking the "Play Now" badge, and nobody
      noticed because nothing surfaces the drift. The earlier reasoning here
      ("the manual script is fine until playthrough churn slows down") had it
      backwards: churn is exactly when a manual step gets skipped. Replace with
      a workflow at `.github/workflows/deploy.yml` that builds and deploys on
      every push to `main`. Until it exists, `npm run deploy` is a required step
      in any session that changes player-visible behaviour.

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

- [ ] **Assert key symmetry between `STAFF_DEFINITIONS` and `DEFAULT_STAFF`**
      (adversarial review, 2026-08-02, WARNING). Since the 2026-08-02 label fix,
      both `ui/SetupScreen.jsx` and `ui/SimScreen.jsx` iterate
      `STAFF_DEFINITIONS` to decide which staff rows exist, while the state
      filling them is seeded from `DEFAULT_STAFF`. Add a fourth role to config
      and forget the seed and the setup screen renders a Stepper with
      `value={undefined}`: its `+` handler is `Math.min(max, value + 1)` → `NaN`,
      and `disabled={value >= max}` is `false` for undefined, so the button is
      live. One click writes `NaN` into the staff count, which flows straight
      into `calculateOneTimeCosts` and `calculateRecurringSalaries`. SimScreen
      hides it — `staff[role] || 0` renders a confident "0". The existing test
      only checks the reverse direction (every `DEFAULT_STAFF` key has a
      definition). Verified latent, not live: all three roles have entries on
      both sides today. Fix is ~6 lines in `engine/characters.test.js`.
      Bundle with it the one-line `// reason:` on `plural: "Security"`, which
      is identical to its `label` and reads like a copy-paste slip a future
      reader will "fix" to "Securities".

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

### 2026-10-10 — v1 history archived; exempt from the 300-line limit

v1's SHORT TERM blocker list, the dated v1 decision entries (2026-07-03 to
2026-08-02) and the Completed list moved verbatim to `ROADMAP-ARCHIVE.md`,
replaced here by a short v1 summary. Kept here: the undated game-design rules
and the 2026-06-03 and 2026-05-29 entries, because they still constrain code
and tests.

**Exception:** this roadmap is exempt from the template's ~300-line limit. It
stays around 500 lines because the project ran across many sessions and its
v2 backlog and design rules are detailed and still live. Don't trim the
backlog to meet the limit; trimming is a product decision for when v2 starts.

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
*Add the date when moving items here. Items completed through 2026-08-04 are in
`ROADMAP-ARCHIVE.md`.*

---

## Cut ideas

| Idea | Reason cut |
|---|---|
| Multiplayer competitive mode | Scope. Single-player educational arc first. |
| Real historical Fed rate data | Breaks replayability — players would memorise optimal responses. |
| 40-quarter playthrough | Reduced to 20. 40 is a live service product, not a portfolio piece. |
| Era 2 branch upgrades (Drive-through, ATM, Digital banking, Private Banking Suite, IT Systems, Second floor) | Superseded by era 3-4 infrastructure model. Era 2 is the right time to extend gameplay depth, not branch fixtures. |

---

*Last updated: 2026-10-10 (v1 history archived to ROADMAP-ARCHIVE.md; Current status added)*
