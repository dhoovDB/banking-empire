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
      the front door instead of spreading toward tellers. Queue slots may be
      too tightly clustered (gy:5.5–6.1) or the progress > 0.2 service-advance
      threshold kicks in too late. Investigate slot spacing first.
- [ ] **Customer movement too slow** — customers visibly crawl. Speed values in
      `evaluateCharacter` were calibrated for ISO_TW=96; with ISO_TW=144 the
      grid units are larger so the same speed values cover less screen distance
      per tick. Scale all speed constants proportionally (×1.5) or re-calibrate.
- [ ] **Customers exit to corner instead of door** — after service, customers
      walk to EXIT_POS `{gx:8.2, gy:6.0}` which is off-screen at the new tile
      size. Move EXIT_POS to align with the door openings at gx≈3 or gx≈5, gy≈6.5.
- [ ] **Inspector walks to corner** — same root cause as customer exit: target
      position for the inspector character is outside the visible canvas area.
      Audit all hardcoded target positions in `evaluateCharacter` / `resolveEvent`
      against the new tile layout.
- [ ] **Loan officer missing from canvas** — hiring a loan officer has no
      visible character. Ghost placeholder disappears but no named chibi
      replaces it. Need a separate loan officer roster drawn at the manager-desk
      position — same pattern as teller roster.
- [ ] **Customer spawn visibility** — customers spawn at gy:7.4 (below entrance).
      If doorway crossing reads late, try gy:6.6 so the entry moment is explicit.

### 2. Setup screen clarity
*Problem: players don't understand what they're buying.*

- [ ] **Staff role tooltips** — each staff type needs a one-line mechanic summary
      on the setup screen. Players are making blind hire decisions right now.
- [ ] **Vault era lock** — vault levels 2 and 3 should be visually greyed out
      in era 1 with "Unlocks Era 2" label.

### 3. Financial correctness minimums
*Problem: the game gives players incorrect signals about their starting position
and doesn't enforce consequences for bad decisions.*

- [ ] **One-time costs deducted at sim start** — setup screen shows projected
      cash after costs but the deduction doesn't happen when the sim starts.
      Players begin richer than the screen told them. Fix: apply
      `calculateOneTimeCosts()` result when transitioning from setup to sim.
- [x] **FDIC seizure confirmed working** — verified end-to-end; test added (2026-04-30)
- [x] **NPL receivership wired** — fixed consecutive-quarters check (was counting
      any N quarters in history; now checks the last N). Tests added. (2026-04-30)

### 4. Deploy to GitHub Pages
*Problem: no one can play the game without cloning the repo.*

- [ ] Add `base: '/banking-empire/'` to vite.config.js
- [ ] Run `npm run build` and deploy `dist/` to gh-pages branch
- [ ] Replace `[Live demo link]` placeholder in README.md
- [ ] Verify it loads on desktop (mobile acceptable to skip for v1)

### 5. README demo video
*Problem: a hiring manager won't clone a repo to evaluate a portfolio piece.*

- [ ] Record 60–90 second screen capture: setup → quarter 1 event → report screen
- [ ] Export as GIF or MP4 and embed in README above "What you'll learn"

---

## MEDIUM TERM — v2 quality
*Do these after v1 ships. Improves depth and replayability.*

### Gameplay loop improvements

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
