# Banking Empire — Product Roadmap

This file captures ideas, features, and design decisions for future development.
It is a living document. When an idea gets built, move it to the relevant config
or engine file with a comment. When an idea gets cut, note why.

---

## Guiding principles

- Every mechanic should teach something true about how banking works
- Complexity unlocks gradually — era 1 is simple enough for anyone
- A player who finishes 20 quarters should be able to explain NIM, CAR,
  and NPL to a non-banker
- Fun is a feature. If it isn't fun, the education doesn't land.

---

## Win / loss conditions

*Not yet designed. Needs decisions before progression.js is written.*

### Loss conditions (beyond the current FDIC seizure on negative equity)

- [ ] Cash hits zero during an active event (run, robbery) with no credit line
- [ ] NPL ratio exceeds 12% for two consecutive quarters — triggers forced
      receivership
- [ ] Reputation drops below 20 and stays there for two quarters — depositor
      flight makes recovery impossible
- [ ] CAR falls below regulatory minimum and player ignores recapitalisation
      warning for one quarter

### Win conditions

*Current: survive 20 quarters. Future ideas:*

- [ ] Reach era 4 (National Bank) with CAR > 12% and reputation > 80
- [ ] Achieve a specific asset size milestone (e.g. $10M in loans outstanding)
- [ ] Complete an acquisition event (era 3+) — absorb a failing competitor
- [ ] "Legacy" ending: finish with a specific combination of KPIs that
      triggers a narrative summary of what kind of banker you were

### Design question
Should there be multiple ending types (predatory bank vs. community pillar vs.
growth machine) that give the player a "banking identity" based on their
decisions across 20 quarters? Worth exploring in era design.

---

## Customer categories

*Currently all customers are functionally identical except whales.*

### Proposed customer types

| Type | Era unlocked | Deposit range | Special mechanic |
|---|---|---|---|
| Retail (current) | 1 | $1.5k–$10k | Base customer |
| Student | 1 | $500–$2k | High churn, reputation-sensitive |
| Small business | 2 | $15k–$80k | Requires loan officer to serve |
| Retiree | 2 | $20k–$120k | Rate-sensitive, low churn |
| Commercial | 3 | $200k–$2M | Requires commercial loan officer |
| Whale (current) | 1 | $380k–$1M | Random event, private banking suite needed |
| Institutional | 4 | $5M–$50M | Requires era 4 unlock |

### Customer category config structure
Each type should define: deposit range, loan likelihood, frustration rate,
rate sensitivity, and which staff type is required to serve them.

---

## Product expansion

*Currently: deposits and loans only.*

### Era 2 products
- [ ] **Savings accounts** — higher deposit rate, stickier customers,
      requires separate product config
- [ ] **Auto loans** — shorter duration than personal loans, different NPL profile
- [ ] **Credit cards** — revolving credit, interchange fee income stream,
      higher NPL risk

### Era 3 products
- [ ] **Mortgages** — long duration, large balance, housing market sensitivity
- [ ] **Commercial lines of credit** — tied to commercial customer category
- [ ] **Wealth management** — fee income, requires private banking suite facility

### Era 4 products
- [ ] **Investment products** — introduces market risk to balance sheet
- [ ] **International transfers** — FX exposure, compliance events

---

## Branch upgrades

*Currently: vault level and waiting seats only.*

### Proposed upgrades

| Upgrade | Era | Cost | Effect |
|---|---|---|---|
| IT Systems | 2 | $15k | Reduces outage impact 60% |
| Private Banking Suite | 2 | $25k | Required to serve whales and retirees properly |
| Second floor | 3 | $40k | Commercial lending division, unlocks commercial customers |
| Drive-through | 2 | $12k | Increases daily customer throughput 30% |
| ATM network | 2 | $8k | Passive income, reduces teller load |
| Digital banking | 3 | $30k | Reduces walk-outs, new customer category: digital-first |

---

## Events backlog

### Era 3+ events
- [ ] **Former staff joins competitor** — a teller you let go (or who was
      poached) now works at First National and is bringing clients with them.
      Triggers deposit flight proportional to their tenure. Flagged during
      characters.js design session.
- [ ] **Acquisition opportunity** — a failing community bank is available
      to purchase. High risk, high reward. Introduces due diligence mechanic.
- [ ] **Fintech challenger** — a digital-only competitor launches in your
      market. Ongoing reputation and deposit pressure, not a one-time event.
- [ ] **Whistleblower** — internal compliance issue surfaces. Tests whether
      player has been running clean books.

### Era 4 events
- [ ] **Congressional hearing** — national-scale regulatory scrutiny
- [ ] **Systemic crisis** — correlated defaults across loan book,
      tests capital adequacy under stress

---

## Macro mechanics

### Fed decision window (designed, not yet built)
- One-quarter window with three player options
- Market forces a default outcome if player does nothing
- Each option has reputation and rate consequences
- See events.js for full config structure

### Future macro indicators
- [ ] **Housing market index** — leads mortgage NPL risk
- [ ] **Unemployment rate** — leads consumer loan defaults
- [ ] **Yield curve** — inversion signals recession, affects NIM
- [ ] **Inflation** — affects real deposit rate, customer behaviour

---

## UX and educational layer

- [ ] **Proactive tutorial** — era 1 quarter 1 should walk the player through
      NIM before they encounter their first rate decision
- [ ] **KPI history chart** — show trend lines on the KPI screen so the
      player can see trajectory, not just current state
- [ ] **Banker's journal** — end-of-quarter narrative summary in plain
      language. "Your NIM compressed this quarter because deposit costs
      rose faster than lending income. Here's what that means..."
- [ ] **Decision replay** — post-game screen showing key decision points
      and their downstream effects. Reinforces learning.

---

## Tiered staffing and automation

*Significant redesign — own design session before building.*

The current model (place individual tellers, manage a queue) is the right
loop for era 1-2. It's the Tavern Master mechanic: direct, tactile, human-scale.
At era 3-4 it breaks down — you can't manage $80M in deposits with 6 tellers.

### Proposed model

**Era 1-2: Individual staff (current)**
Player places tellers, loan officers, security guards one at a time.
Each teller serves one customer per tick. This is the core loop.

**Era 3-4: Organisational units**
Player buys capacity in bulk. The individual chibi tellers are replaced
by representations of teams and systems.

| Unit | Era | Capacity | Cost |
|---|---|---|---|
| Branch Manager | 3 | Supervises 10 tellers, reduces walk-outs 20% | $25k hire |
| Regional Hub | 3 | Handles 10x customer throughput per tick | $80k |
| Mobile App | 3 | Handles 100x low-value transactions passively | $50k + $5k/qtr |
| Digital Transformation | 4 | 1,000x throughput, unlocks institutional customers | $200k |

### Design question
The transition from individual tellers to organisational units should feel
meaningful — not just a bigger number. Consider a "Branch Review" milestone
event at quarter 11 where the player explicitly decides to scale the model
or stay boutique. Staying boutique could be a valid strategy for the
"Community Pillar" ending.

### Canvas implication
Era 3-4 canvas sim needs a different visual metaphor. Individual chibis
at desks no longer makes sense at regional scale. Options:
- Abstract to a city map with branch dots and customer flow lines
- Keep the branch view but add a "zoom out" toggle to the regional view
- Era 3+ gets a dashboard sim instead of a canvas sim

Flag for renderer design session.

---

## Infrastructure assets

*Replaces "waiting seats" at era 3+ scale. Own design session before building.*

Physical branch assets (waiting seats, vault, drive-through) make sense
at era 1-2 community bank scale. At era 3-4 the meaningful capital decisions
are about systems, compliance, and digital infrastructure.

### Proposed asset categories

**Era 1-2: Physical branch assets (current)**
Vault, waiting seats, drive-through, ATM

**Era 3-4: Infrastructure assets**

| Asset | Era | Effect | Cost |
|---|---|---|---|
| Server Rack (tier 1) | 3 | Reduces outage probability 40% | $20k |
| Server Rack (tier 2) | 3 | Eliminates outage risk, enables digital banking | $50k |
| Compliance Department | 3 | Reduces inspection fine probability 60% | $30k + $8k/qtr |
| Call Center | 3 | Handles customer complaints, reputation floor +10 | $25k + $6k/qtr |
| Data Center | 4 | Required for institutional customers | $100k |
| Fraud Detection System | 3 | Reduces NPL from credit card products | $40k |

### Transition mechanic
The moment a player upgrades to era 3, the setup screen should visually
shift — physical branch layout gives way to an infrastructure dashboard.
This transition is itself an educational moment: banking at scale is an
infrastructure business, not a people business.

---

## Design decisions log

*Decisions made during development, and why. Read this before changing
anything that seems "obviously wrong" — it probably isn't.*

### Era 1 NIM is intentionally low
Starting NIM with true formula (deposits = loans = $80k, rates 6.5%/2.0%)
is ~1.125% — below the "warn" threshold. This is intentional.

The player's first task is growing the loan book relative to deposits,
which teaches the core banking mechanic: deposits are a cost centre,
loans are the revenue engine. You want more of the latter.

The KPI explainer tells the player this explicitly. Low NIM in era 1
is a teaching mechanic, not a bug. Do not raise starting NIM by
inflating the lending rate or reducing the deposit rate — that would
obscure the lesson.

If era 1 feels too punishing, the fix is to adjust KPI warn/danger
thresholds in `economy.js` — not to change starting financials.

### True NIM vs rate spread
The original codebase used `lendingRate - depositRate` as a proxy for NIM.
This was replaced with the correct formula during the engine refactor:

```
NIM = (interest income - interest expense) / loans * 100
```

This change cascaded into:
- KPI thresholds recalibrated (warn: 1.2%, danger: 0.5%)
- Era progress NIM targets lowered (1.2% and 2.0% replace 3.0% and 4.0%)
- Starting deposits reduced from $110k to $80k to match loan book
- All thresholds confirmed as quarterly figures (formula uses * 0.25)

Reference: https://en.wikipedia.org/wiki/Net_interest_margin

### All financial thresholds are quarterly
KPI warn/danger thresholds in `economy.js` and era progress targets in
`progression.js` are calibrated against quarterly figures. The NIM
formula multiplies annual rates by 0.25. Do not change this to annual
figures without updating every threshold simultaneously.

---

## Formula and financial model improvements

### Era 3+ formula upgrades
- [ ] **Risk-weighted CAR** — current `equity / loans` works for era 1-2.
      Era 3+ with mortgages, credit cards, and commercial loans requires
      true risk-weighted assets. Each product type carries a Basel III
      risk weight (mortgages: 35-50%, commercial: 100%, etc).
      Reference: https://www.bis.org/publ/bcbs128.pdf
- [ ] **Individual loan book** — NPL ratio is currently a magic number
      nudged by rate decisions. A proper model tracks individual loans
      with origination quarter, rate, type, and default probability.
      NPL ratio then emerges from actual loan performance rather than
      being manually adjusted. Required for era 3+ realism.

### Educational links
- [ ] Each KPI explainer and educational note should link to a public
      source for players who want to go deeper. Proposed sources:
      - NIM: https://en.wikipedia.org/wiki/Net_interest_margin
      - CAR: https://www.bis.org/fsi/fsisummaries/b3_capital.pdf
      - NPL: https://www.imf.org/en/Publications/fandd/issues/2016/06/basics
      - Reserve requirements: https://www.federalreserve.gov/monetarypolicy/reservereq.htm
      - Fed rate decisions: https://www.federalreserve.gov/monetarypolicy/fomc.htm
      These open in a new tab from the KPI explainer panel and event
      educational notes. Keeps the game honest about its simplifications.

---

## Technical backlog

- [ ] **Condition-triggered events** — `whaleExit` is the first event that
      fires based on a state condition rather than probability. Engine needs
      a second event evaluation pass that checks conditions after each quarter,
      separate from the probability scheduler. Design in engine session.
- [ ] **Unit tests for engine functions** — pure functions in `financials.js`
      and `simulation.js` are directly testable with Jest or Vitest. Start
      with `calculateNIM`, `calculateCAR`, and `calculateFrustration`.
      Good first contribution for anyone new to the codebase.
- [ ] **E2E testing suite** — simulate a full 20-quarter playthrough
      programmatically and assert win/loss conditions fire correctly.
      Requires engine to be fully decoupled from React state first.
- [ ] Persist game state to localStorage so a playthrough survives a
      page refresh
- [ ] Export quarterly report as a shareable summary card (image)
- [ ] Mobile-responsive layout for setup and report screens
      (canvas sim is desktop-only by design)
- [ ] Seed-based random events — same seed = same event schedule,
      useful for sharing "challenge runs"

---

## Cut ideas

*Ideas that were considered and set aside, and why.*

| Idea | Reason cut |
|---|---|
| Multiplayer competitive mode | Scope. Single-player educational arc first. |
| Real historical Fed rate data | Breaks replayability — players would memorise optimal responses. |
| 40-quarter playthrough | Reduced to 20. 40 is a live service product, not a portfolio piece. |

---

*Last updated: during config layer refactor session.*
*Next review: after progression.js is designed.*
