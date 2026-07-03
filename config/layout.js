// ─── BRANCH LAYOUT ───────────────────────────────────────────────────────────
// Floor positions as pure data. Grid is 6 wide × 5 deep (gx 1–6, gy 1–5);
// the spawn/exit row sits at gy=5.8 just outside. Moved here from
// BankingEmpire.jsx (2026-07-02) — positions are game rules, not React state.

export const QUEUE_SLOTS = [
  {gx:3.5,gy:4.0},
  {gx:3.1,gy:4.2},{gx:3.9,gy:4.2},
  {gx:2.7,gy:4.4},{gx:3.5,gy:4.4},{gx:4.3,gy:4.4},
  {gx:3.1,gy:4.6},{gx:3.9,gy:4.6},
  {gx:2.7,gy:4.8},{gx:4.3,gy:4.8},
];

// Teller slots are where the *customer* stops to be served — in front of the
// counter (gyFront=3.05), not inside it. The teller chibi is drawn behind the
// counter via a fixed offset in renderer/canvas.js.
export const TELLER_SLOTS = [
  {gx:2.4,gy:3.10},{gx:2.95,gy:3.10},{gx:3.5,gy:3.10},
  {gx:4.05,gy:3.10},{gx:4.6,gy:3.10},{gx:5.15,gy:3.10},
];

export const EXIT_POS  = {gx:3.5, gy:5.8}; // exit through entrance row
export const VAULT_POS = {gx:5.0, gy:1.5};
export const MGR_POS   = {gx:1.2, gy:2.0};

// Loan customer service position — in front of the desk drawing (which is
// centered at gy≈2.0). The loan officer chibi draws behind the desk via a
// fixed offset in renderer/canvas.js.
export const LOAN_DESK_POS = {gx:2.2, gy:2.4};

// Loan customers route around the left end of the teller counter via this
// waypoint (left of counter at gx<2.4, in front of counter at gy>3.05).
// Used on both advancing (queue → loan desk) and leaving (loan desk → exit).
export const LOAN_BYPASS_WAYPOINT = {gx:1.9, gy:3.5};

// Waiting-seat tile positions. Engine claims seats by index; renderer draws a
// chair at each. Era 1 ships 3 seats (DEFAULT_FACILITIES.waitingSeats); era 2+
// can buy up to 10 via the SetupScreen stepper.
//
// Layout: bottom-left cluster, deliberately away from the teller approach
// zone (gx 2.4+) and the queue triangle (gx 2.7–4.3). Earlier positions at
// gy=3.50/3.85, gx=1.5–3.1 ran the chairs right up against the counter,
// which made the seated chibis visually merge with the teller backstage.
export const SEAT_POSITIONS = [
  // Front row — closer to the entrance
  {gx:1.0, gy:3.90}, {gx:1.4, gy:3.90}, {gx:1.8, gy:3.90},
  {gx:2.2, gy:3.90}, {gx:2.6, gy:3.90},
  // Back row — same columns, one half-tile back
  {gx:1.0, gy:4.25}, {gx:1.4, gy:4.25}, {gx:1.8, gy:4.25},
  {gx:2.2, gy:4.25}, {gx:2.6, gy:4.25},
];

// Lobby tiles — overflow standing positions for when seats and the queue line
// are both full. Positions continue the queue triangle backward toward the
// entrance + flank the door funnel on both sides.
export const LOBBY_POSITIONS = [
  // Back of the queue line — extends the QUEUE_SLOTS triangle toward gy=5
  {gx:3.5, gy:5.0},
  {gx:3.1, gy:5.2}, {gx:3.9, gy:5.2},
  {gx:2.7, gy:5.4}, {gx:4.3, gy:5.4},
  // Door-flank standing — outside the queue funnel
  {gx:1.8, gy:5.0}, {gx:5.2, gy:5.0},
  {gx:1.8, gy:5.4}, {gx:5.2, gy:5.4},
];
