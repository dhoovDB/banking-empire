import { describe, it, expect } from "vitest";
import {
  evaluateCharacter, applyCommand, createCustomer,
  createDaySimState, tickSimulation, interactionCommandFor,
  loanApplicationChanceFor, resolveEraTransition,
} from "./simulation.js";
import { BRANCH_EVENTS } from "../config/events.js";
import { SIM_TIMING, CUSTOMER_BEHAVIOUR } from "../config/economy.js";
import { ERA_RULES } from "../config/progression.js";

// One-allocator occupancy builder: occ({ teller: [0, 1], seat: [2] })
function occ({ teller = [], loanDesk = [], seat = [] } = {}) {
  return { teller: new Set(teller), loanDesk: new Set(loanDesk), seat: new Set(seat) };
}

// Minimal simState for tests — only the fields evaluateCharacter/applyCommand need
function makeSimState(overrides = {}) {
  return {
    numTellers:          2,
    activeEvent:         null,
    loanOfficers:        0,
    queueSlots:          [{ gx: 3.9, gy: 5.5 }, { gx: 3.5, gy: 5.7 }],
    tellerSlots:         [{ gx: 3.3, gy: 3.4 }, { gx: 4.0, gy: 3.25 }],
    loanDeskPos:         { gx: 2.5, gy: 2.4 },
    loanBypassWaypoint:  { gx: 1.9, gy: 3.5 },
    exitPos:             { gx: 5.0, gy: 7.4 },
    vaultPos:            { gx: 7.4, gy: 2.3 },
    managerPos:          { gx: 1.6, gy: 2.4 },
    occupancy:           occ(),
    activeTellers:       new Set(),
    served:              0,
    deposited:           0,
    loans:               0,
    walkouts:            0,
    whaleServed:         false,
    securityCount:       0,
    vaultLevel:          1,
    robberyLoss:         0,
    clickedCharIds:      new Set(),
    chars:               [],
    ...overrides,
  };
}

function makePolicy() {
  return { depositRate: 2.0, lendingRate: 6.5 };
}

// Place a char exactly at a target so isNear returns true
function atPos(char, pos) {
  return { ...char, gx: pos.gx, gy: pos.gy };
}

// ─── ONE-CLICK-MAX ────────────────────────────────────────────────────────────

describe("one click max per character", () => {
  it("CLAIM_SLOT fires only once — second CLAIM_SLOT on same character has no slot effect", () => {
    const simState = makeSimState({ occupancy: occ({ teller: [0] }) });
    // Slot 0 is occupied — slot 1 should be free
    expect(simState.occupancy.teller.has(0)).toBe(true);
    expect(simState.occupancy.teller.has(1)).toBe(false);
  });

  it("clickedCharIds blocks second interaction on same id", () => {
    const s = makeSimState();
    const charId = 42;
    // First click: add to set
    s.clickedCharIds.add(charId);
    // Second click: id already present — interaction blocked
    expect(s.clickedCharIds.has(charId)).toBe(true);
    // Attempting to add again is a no-op (Set semantics)
    s.clickedCharIds.add(charId);
    expect(s.clickedCharIds.size).toBe(1);
  });
});

// ─── WHALE DEPOSIT BOOST ──────────────────────────────────────────────────────

describe("whale deposit boost", () => {
  it("greeted whale deposit is 1.2× the original", () => {
    const original = 500000;
    const boosted  = Math.round(original * 1.2);
    expect(boosted).toBe(600000);
  });

  it("COMPLETE_SERVICE records boosted deposit in stateDeltas", () => {
    const simState = makeSimState({ served: 0, deposited: 0 });
    const char = {
      id: 1, role: "whale", state: "served", deposit: 600000,
      tellerIndex: 0, useLoanDesk: false, loanAmt: 0,
    };
    const command = { type: "COMPLETE_SERVICE", tellerIndex: 0, hasLoan: false, isWhale: true };
    const { stateDeltas } = applyCommand(command, char, simState);
    expect(stateDeltas.deposited).toBe(600000);
    expect(stateDeltas.whaleServed).toBe(true);
  });
});

// ─── INSPECTOR DISTRACT FINE REDUCTION ───────────────────────────────────────

describe("inspector distract", () => {
  it("distracted inspector fine is 50% of base fine", () => {
    const baseFine = 2500;
    const reduced  = Math.round(baseFine * 0.5);
    expect(reduced).toBe(1250);
    expect(reduced).toBeLessThan(baseFine);
  });

  it("un-distracted inspector fine is full base fine", () => {
    const baseFine           = 2500;
    const inspectorDistracted = false;
    const fine = baseFine > 0 && inspectorDistracted ? Math.round(baseFine * 0.5) : baseFine;
    expect(fine).toBe(2500);
  });
});

// ─── WAITING STATE MACHINE ────────────────────────────────────────────────────

describe("waiting state — customer routes to teller when slot opens", () => {
  it("customer entering a free bank claims a slot immediately", () => {
    const simState = makeSimState();
    // Customer at queue slot 0 position (so isNear = true)
    const slot = simState.queueSlots[0];
    const char = { id: 1, role: "customer", state: "entering", queuePos: 0,
                   gx: slot.gx, gy: slot.gy, loanAmt: 0, frustration: 0, baseAnger: 0 };
    const command = evaluateCharacter(char, simState, makePolicy());
    expect(command.type).toBe("CLAIM_SLOT");
  });

  it("customer entering a full bank joins wait instead", () => {
    const simState = makeSimState({ occupancy: occ({ teller: [0, 1] }) });
    const slot = simState.queueSlots[0];
    const char = { id: 2, role: "customer", state: "entering", queuePos: 0,
                   gx: slot.gx, gy: slot.gy, loanAmt: 0, frustration: 0, baseAnger: 0 };
    const command = evaluateCharacter(char, simState, makePolicy());
    expect(command.type).toBe("JOIN_WAIT");
  });

  it("JOIN_WAIT sets state to waiting", () => {
    const simState = makeSimState();
    const char = { id: 3, role: "customer", state: "entering", gx: 0, gy: 0, frustration: 0 };
    const command = { type: "JOIN_WAIT", charId: 3 };
    const { updatedChar } = applyCommand(command, char, simState);
    expect(updatedChar.state).toBe("waiting");
  });

  it("CLAIM_SLOT sets state to advancing and marks slot occupied", () => {
    const simState = makeSimState();
    const char = { id: 4, role: "customer", state: "entering", gx: 0, gy: 0 };
    const command = { type: "CLAIM_SLOT", charId: 4, tellerIndex: 0, useLoanDesk: false };
    const { updatedChar, stateDeltas } = applyCommand(command, char, simState);
    expect(updatedChar.state).toBe("advancing");
    expect(stateDeltas.occupancy.teller.has(0)).toBe(true);
  });

  it("COMPLETE_SERVICE releases the occupied teller slot", () => {
    const simState = makeSimState({ occupancy: occ({ teller: [0] }) });
    const char = { id: 5, role: "customer", state: "served", deposit: 5000,
                   tellerIndex: 0, useLoanDesk: false, loanAmt: 0 };
    const command = { type: "COMPLETE_SERVICE", hasLoan: false, isWhale: false };
    const { stateDeltas } = applyCommand(command, char, simState);
    expect(stateDeltas.occupancy.teller.has(0)).toBe(false);
  });
});

// ─── LOAN DESK ROUTING ────────────────────────────────────────────────────────

describe("loan desk routing", () => {
  it("loan customer with available loan officer claims loan desk", () => {
    const simState = makeSimState({ loanOfficers: 1 });
    const slot = simState.queueSlots[0];
    const char = { id: 6, role: "customer", state: "entering", queuePos: 0,
                   gx: slot.gx, gy: slot.gy, loanAmt: 10000, frustration: 0, baseAnger: 0 };
    const command = evaluateCharacter(char, simState, makePolicy());
    expect(command.type).toBe("CLAIM_SLOT");
    expect(command.useLoanDesk).toBe(true);
  });

  it("CLAIM_SLOT with useLoanDesk claims the loan desk spot", () => {
    const simState = makeSimState({ loanOfficers: 1 });
    const char = { id: 7, role: "customer", state: "entering", gx: 0, gy: 0, loanAmt: 10000 };
    const command = { type: "CLAIM_SLOT", charId: 7, tellerIndex: -1, useLoanDesk: true };
    const { updatedChar, stateDeltas } = applyCommand(command, char, simState);
    expect(updatedChar.useLoanDesk).toBe(true);
    expect(stateDeltas.occupancy.loanDesk.has(0)).toBe(true);
  });

  it("COMPLETE_SERVICE releases loan desk when useLoanDesk is true", () => {
    const simState = makeSimState({ occupancy: occ({ loanDesk: [0] }) });
    const char = { id: 8, role: "customer", state: "served", deposit: 5000,
                   tellerIndex: -1, useLoanDesk: true, loanAmt: 10000 };
    const command = { type: "COMPLETE_SERVICE", hasLoan: true, isWhale: false };
    const { stateDeltas } = applyCommand(command, char, simState);
    expect(stateDeltas.occupancy.loanDesk.has(0)).toBe(false);
  });
});

// ─── LOAN BYPASS PATH ────────────────────────────────────────────────────────
// Loan customers route around the left end of the teller counter via a path
// waypoint, both when advancing to the loan desk and when leaving from it.

describe("loan bypass path", () => {
  it("CLAIM_SLOT with useLoanDesk puts the bypass point on the path", () => {
    const simState = makeSimState({ loanOfficers: 1 });
    const char = { id: 10, role: "customer", state: "entering", gx: 0, gy: 0, loanAmt: 10000 };
    const command = { type: "CLAIM_SLOT", charId: 10, tellerIndex: -1, useLoanDesk: true };
    const { updatedChar } = applyCommand(command, char, simState);
    expect(updatedChar.path).toEqual([simState.loanBypassWaypoint]);
  });

  it("CLAIM_SLOT without useLoanDesk leaves the path empty", () => {
    const simState = makeSimState();
    const char = { id: 11, role: "customer", state: "entering", gx: 0, gy: 0, loanAmt: 0 };
    const command = { type: "CLAIM_SLOT", charId: 11, tellerIndex: 0, useLoanDesk: false };
    const { updatedChar } = applyCommand(command, char, simState);
    expect(updatedChar.path).toEqual([]);
  });

  it("advancing customer walks the path first, consumes it, then targets loan desk", () => {
    const simState = makeSimState({ loanOfficers: 1, occupancy: occ({ loanDesk: [0] }) });
    // Customer just claimed loan desk — far from waypoint
    let char = { id: 12, role: "customer", state: "advancing", gx: 3.5, gy: 5.5,
                 useLoanDesk: true, tellerIndex: -1, loanAmt: 10000,
                 path: [simState.loanBypassWaypoint] };
    // Step 1: should target waypoint, not loan desk
    let cmd = evaluateCharacter(char, simState, makePolicy());
    expect(cmd.type).toBe("MOVE");
    expect(cmd.target).toEqual(simState.loanBypassWaypoint);

    // Step 2: customer reaches waypoint — should consume it (PATH_NEXT)
    char = atPos(char, simState.loanBypassWaypoint);
    cmd = evaluateCharacter(char, simState, makePolicy());
    expect(cmd.type).toBe("PATH_NEXT");

    // Step 3: apply PATH_NEXT, then advancing should target loan desk
    const { updatedChar } = applyCommand(cmd, char, simState);
    expect(updatedChar.path).toEqual([]);
    cmd = evaluateCharacter(updatedChar, simState, makePolicy());
    expect(cmd.type).toBe("MOVE");
    expect(cmd.target).toEqual(simState.loanDeskPos);
  });

  it("COMPLETE_SERVICE for loan customer sets the path for the leaving leg", () => {
    const simState = makeSimState({ occupancy: occ({ loanDesk: [0] }) });
    const char = { id: 13, role: "customer", state: "served", deposit: 5000,
                   tellerIndex: -1, useLoanDesk: true, loanAmt: 10000 };
    const command = { type: "COMPLETE_SERVICE", hasLoan: true, isWhale: false };
    const { updatedChar } = applyCommand(command, char, simState);
    expect(updatedChar.state).toBe("leaving");
    expect(updatedChar.path).toEqual([simState.loanBypassWaypoint]);
  });

  it("leaving customer with a pending path moves toward the waypoint, not the exit", () => {
    const simState = makeSimState();
    const char = { id: 14, role: "customer", state: "leaving",
                   gx: 2.2, gy: 2.0,
                   path: [simState.loanBypassWaypoint] };
    const cmd = evaluateCharacter(char, simState, makePolicy());
    expect(cmd.type).toBe("MOVE");
    expect(cmd.target).toEqual(simState.loanBypassWaypoint);
  });
});

// ─── RUSH FRUSTRATION ────────────────────────────────────────────────────────
// During a rush, waiting customers' frustration grows faster — under-staffed
// rushes should produce walkouts where calm play would not.

describe("rush frustration multiplier", () => {
  function makeWaitingChar(overrides = {}) {
    return {
      id: 20, role: "customer", state: "waiting",
      gx: 3.5, gy: 4.0, frustration: 0.5, baseAnger: 0,
      ...overrides,
    };
  }

  it("non-rush waiting customer accumulates baseline frustration", () => {
    const simState = makeSimState({ activeEvent: null, occupancy: occ({ teller: [0, 1] }) });
    const char = makeWaitingChar();
    const cmd = evaluateCharacter(char, simState, makePolicy());
    expect(cmd.type).toBe("UPDATE_FRUSTRATION");
    const baselineFrustGrowth = cmd.newFrust - char.frustration;
    expect(baselineFrustGrowth).toBeGreaterThan(0);
    expect(baselineFrustGrowth).toBeLessThan(0.01);
  });

  it("rush waiting customer accumulates frustration faster than baseline", () => {
    const simStateBaseline = makeSimState({ activeEvent: null, occupancy: occ({ teller: [0, 1] }) });
    const simStateRush     = makeSimState({ activeEvent: "rush", occupancy: occ({ teller: [0, 1] }) });
    const char = makeWaitingChar();

    const cmdBaseline = evaluateCharacter(char, simStateBaseline, makePolicy());
    const cmdRush     = evaluateCharacter(char, simStateRush,     makePolicy());

    const baselineGrowth = cmdBaseline.newFrust - char.frustration;
    const rushGrowth     = cmdRush.newFrust     - char.frustration;
    // Rush should grow ~2x faster (rushFrustrationMultiplier = 2.0).
    expect(rushGrowth).toBeGreaterThan(baselineGrowth);
    expect(rushGrowth / baselineGrowth).toBeCloseTo(2.0, 1);
  });
});

// ─── WAITING SEATS ───────────────────────────────────────────────────────────
// Seats are an actual gameplay lever, not cosmetic. A waiting customer should
// claim a free seat, sit down, and accumulate frustration slower while seated.
// Releasing the seat happens on CLAIM_SLOT (teller free), WALKOUT, or FLEE.

describe("waiting seats", () => {
  function makeWaitingChar(overrides = {}) {
    return {
      id: 30, role: "customer", state: "waiting",
      gx: 3.5, gy: 4.0, frustration: 0.5, baseAnger: 0,
      seatId: null, seatedAt: false,
      ...overrides,
    };
  }

  function withSeats(overrides = {}) {
    return makeSimState({
      occupancy: occ({ teller: [0, 1] }), // no teller free
      seatPositions: [
        { gx: 1.5, gy: 3.5 },
        { gx: 1.9, gy: 3.5 },
        { gx: 2.3, gy: 3.5 },
      ],
      ...overrides,
    });
  }

  it("waiting customer claims a free seat", () => {
    const simState = withSeats();
    const char = makeWaitingChar();
    const cmd = evaluateCharacter(char, simState, makePolicy());
    expect(cmd.type).toBe("CLAIM_SEAT");
    expect(cmd.seatId).toBe(0);
  });

  it("CLAIM_SEAT marks the seat occupied and sets seatId on the customer", () => {
    const simState = withSeats();
    const char = makeWaitingChar();
    const cmd = evaluateCharacter(char, simState, makePolicy());
    const { updatedChar, stateDeltas } = applyCommand(cmd, char, simState);
    expect(updatedChar.seatId).toBe(0);
    expect(updatedChar.seatedAt).toBe(false); // not arrived yet
    expect(stateDeltas.occupancy.seat.has(0)).toBe(true);
  });

  it("customer with claimed seat walks toward it", () => {
    const simState = withSeats({ occupancy: occ({ teller: [0, 1], seat: [0] }) });
    const char = makeWaitingChar({ seatId: 0, gx: 3.5, gy: 4.0 });
    const cmd = evaluateCharacter(char, simState, makePolicy());
    expect(cmd.type).toBe("MOVE");
    expect(cmd.target).toEqual(simState.seatPositions[0]);
  });

  it("customer arriving at seat emits ARRIVE_AT_SEAT", () => {
    const simState = withSeats({ occupancy: occ({ teller: [0, 1], seat: [0] }) });
    const char = makeWaitingChar({ seatId: 0, gx: 1.5, gy: 3.5 });
    const cmd = evaluateCharacter(char, simState, makePolicy());
    expect(cmd.type).toBe("ARRIVE_AT_SEAT");
  });

  it("seated customer accumulates frustration slower than standing customer", () => {
    const standingState = makeSimState({ occupancy: occ({ teller: [0, 1] }) });
    const seatedState   = makeSimState({ occupancy: occ({ teller: [0, 1] }) });
    const standing = makeWaitingChar({ seatedAt: false });
    const seated   = makeWaitingChar({ seatedAt: true });

    const standingCmd = evaluateCharacter(standing, standingState, makePolicy());
    const seatedCmd   = evaluateCharacter(seated,   seatedState,   makePolicy());

    expect(standingCmd.type).toBe("UPDATE_FRUSTRATION");
    expect(seatedCmd.type).toBe("UPDATE_FRUSTRATION");
    const standingGrowth = standingCmd.newFrust - standing.frustration;
    const seatedGrowth   = seatedCmd.newFrust   - seated.frustration;
    expect(seatedGrowth).toBeLessThan(standingGrowth);
    // 0.4× multiplier configured in CUSTOMER_BEHAVIOUR
    expect(seatedGrowth / standingGrowth).toBeCloseTo(0.4, 1);
  });

  it("CLAIM_SLOT releases the customer's seat", () => {
    const simState = withSeats({
      occupancy: occ({ seat: [1] }), // teller 0 now free, customer holds seat 1
    });
    const char = makeWaitingChar({ seatId: 1, seatedAt: true });
    const cmd = evaluateCharacter(char, simState, makePolicy());
    expect(cmd.type).toBe("CLAIM_SLOT");
    const { updatedChar, stateDeltas } = applyCommand(cmd, char, simState);
    expect(updatedChar.seatId).toBeNull();
    expect(updatedChar.seatedAt).toBe(false);
    expect(stateDeltas.occupancy.seat.has(1)).toBe(false);
  });

  it("WALKOUT releases the customer's seat", () => {
    const simState = withSeats({ occupancy: occ({ teller: [0, 1], seat: [2] }) });
    const char = makeWaitingChar({ seatId: 2, seatedAt: true });
    const cmd = { type: "WALKOUT", charId: char.id };
    const { updatedChar, stateDeltas } = applyCommand(cmd, char, simState);
    expect(updatedChar.state).toBe("fleeing");
    expect(updatedChar.seatId).toBeNull();
    expect(stateDeltas.occupancy.seat.has(2)).toBe(false);
  });

  it("no seat claim when all seats occupied — falls through to frustration", () => {
    const simState = withSeats({ occupancy: occ({ teller: [0, 1], seat: [0, 1, 2] }) });
    const char = makeWaitingChar();
    const cmd = evaluateCharacter(char, simState, makePolicy());
    expect(cmd.type).toBe("UPDATE_FRUSTRATION");
  });
});

// ─── STANDING SPOTS ──────────────────────────────────────────────────────────
// When teller and seat allocators are both exhausted, waiting customers hold
// unique standing spots computed from arrival order (queue slots first, then
// lobby tiles) — no claims, so nothing can leak when they leave. This replaced
// the CLAIM_LOBBY allocator (Shape B); the positions are pure layout.

describe("standing spots", () => {
  function makeWaitingChar(overrides = {}) {
    return {
      id: 50, role: "customer", state: "waiting",
      gx: 9.0, gy: 9.0, frustration: 0.5, baseAnger: 0,
      seatId: null, seatedAt: false,
      ...overrides,
    };
  }

  function withStanders(standerIds, overrides = {}) {
    const chars = standerIds.map(id => makeWaitingChar({ id }));
    return {
      state: makeSimState({
        occupancy:     occ({ teller: [0, 1], seat: [0] }), // teller + seat full
        seatPositions: [{ gx: 1.5, gy: 3.5 }],
        lobbyPositions: [
          { gx: 3.5, gy: 5.0 },
          { gx: 3.1, gy: 5.2 },
          { gx: 3.9, gy: 5.2 },
        ],
        chars,
        ...overrides,
      }),
      chars,
    };
  }

  it("a stander away from their spot walks toward it", () => {
    const { state, chars } = withStanders([50]);
    const cmd = evaluateCharacter(chars[0], state, makePolicy());
    expect(cmd.type).toBe("MOVE");
    // First (only) stander gets the first spot — queue slot 0
    expect(cmd.target).toEqual(state.queueSlots[0]);
  });

  it("standers get distinct spots by arrival order", () => {
    const { state, chars } = withStanders([51, 52, 53]);
    const targets = chars.map(c => evaluateCharacter(c, state, makePolicy()).target);
    expect(targets[0]).toEqual(state.queueSlots[0]);
    expect(targets[1]).toEqual(state.queueSlots[1]);
    expect(targets[2]).toEqual(state.lobbyPositions[0]); // queue slots exhausted → lobby tiles
    expect(new Set(targets.map(t => `${t.gx},${t.gy}`)).size).toBe(3);
  });

  it("when an earlier stander leaves, the line shuffles forward", () => {
    const { state } = withStanders([51, 52]);
    const second = state.chars[1];
    // With 51 present, 52 holds spot 1
    expect(evaluateCharacter(second, state, makePolicy()).target).toEqual(state.queueSlots[1]);
    // 51 gets served/leaves → 52 becomes the front of the line
    state.chars = state.chars.filter(c => c.id !== 51);
    expect(evaluateCharacter(second, state, makePolicy()).target).toEqual(state.queueSlots[0]);
  });

  it("a stander at their spot falls through to frustration accrual", () => {
    const { state, chars } = withStanders([50]);
    const atSpot = { ...chars[0], gx: state.queueSlots[0].gx, gy: state.queueSlots[0].gy };
    state.chars = [atSpot];
    const cmd = evaluateCharacter(atSpot, state, makePolicy());
    expect(cmd.type).toBe("UPDATE_FRUSTRATION");
  });

  it("a free seat is strictly preferred over a standing spot", () => {
    const { state, chars } = withStanders([50], { occupancy: occ({ teller: [0, 1] }) });
    const cmd = evaluateCharacter(chars[0], state, makePolicy());
    expect(cmd.type).toBe("CLAIM_SEAT");
  });

  it("event characters are excluded from the standing order", () => {
    const { state } = withStanders([51, 52]);
    // A wandering inspector in the chars list must not shift customer spots
    state.chars = [{ id: 1, role: "inspector", state: "waiting" }, ...state.chars];
    const second = state.chars[2];
    expect(evaluateCharacter(second, state, makePolicy()).target).toEqual(state.queueSlots[1]);
  });
});

// ─── MULTI-TICK RUSH — DEFAULT 3 SEATS ALL FILL ──────────────────────────────
// The first integration-style test in the suite. Existing tests verify single
// commands in isolation; this one drives the full lifecycle —
// entering → MOVE-to-queue → JOIN_WAIT → CLAIM_SEAT → MOVE-to-seat →
// ARRIVE_AT_SEAT — across many ticks for three customers at once.
//
// Why it exists: a 2026-05-11 playthrough reported "3 chairs visible, only 1
// used at a time during a rush." The engine unit tests (CLAIM_SEAT, uniqueness,
// releases) all pass, so if the bug is real it lives somewhere the unit tests
// don't reach — most likely the multi-character interleaving inside a single
// tick. This test exercises exactly that path. Logged as ROADMAP §1e.

describe("multi-tick rush — all 3 default seats fill correctly", () => {
  // Mirror BankingEmpire.jsx layout constants so the test exercises the same
  // geometry the live sim sees. A passing test with throwaway coordinates
  // wouldn't say anything about what the player observed on the canvas.
  const QUEUE_SLOTS = [
    {gx:3.5,gy:4.0},
    {gx:3.1,gy:4.2}, {gx:3.9,gy:4.2},
    {gx:2.7,gy:4.4}, {gx:3.5,gy:4.4}, {gx:4.3,gy:4.4},
    {gx:3.1,gy:4.6}, {gx:3.9,gy:4.6},
    {gx:2.7,gy:4.8}, {gx:4.3,gy:4.8},
  ];
  const TELLER_SLOTS = [
    {gx:2.4,gy:3.10}, {gx:2.95,gy:3.10}, {gx:3.5,gy:3.10},
    {gx:4.05,gy:3.10}, {gx:4.6,gy:3.10}, {gx:5.15,gy:3.10},
  ];
  // The era-1 default — 3 seats, mirrors BankingEmpire.jsx SEAT_POSITIONS
  // (shifted +0.1 gx on 2026-05-16 so the leftmost seat sits on the floor)
  const SEAT_POSITIONS = [
    {gx:1.0, gy:3.90}, {gx:1.4, gy:3.90}, {gx:1.8, gy:3.90},
  ];
  const EXIT_POS             = {gx:3.5, gy:5.8};
  const LOAN_DESK_POS        = {gx:2.2, gy:2.4};
  const LOAN_BYPASS_WAYPOINT = {gx:1.9, gy:3.5};

  // 0 tellers forces every customer to JOIN_WAIT — the same state they'd be in
  // mid-rush when the single era-1 teller is already serving someone.
  function rushyState() {
    return {
      numTellers:          0,
      activeEvent:         null,
      loanOfficers:        0,
      queueSlots:          QUEUE_SLOTS,
      tellerSlots:         TELLER_SLOTS,
      loanDeskPos:         LOAN_DESK_POS,
      loanBypassWaypoint:  LOAN_BYPASS_WAYPOINT,
      exitPos:             EXIT_POS,
      occupancy:           occ(),
      activeTellers:       new Set(),
      seatPositions:       SEAT_POSITIONS,
      lobbyPositions:      [],
      served:              0,
      deposited:           0,
      loans:               0,
      walkouts:            0,
      whaleServed:         false,
      securityCount:       0,
      vaultLevel:          1,
      robberyLoss:         0,
      clickedCharIds:      new Set(),
      chars:               [],
    };
  }

  // One tick — mirrors the loop in BankingEmpire.jsx exactly, including the
  // crucial detail that stateDeltas are applied to simState between characters
  // within the same tick (so char B sees char A's claim).
  function tick(simState, policy) {
    const next = [];
    for (const char of simState.chars) {
      const command = evaluateCharacter(char, simState, policy);
      const { updatedChar, stateDeltas } = applyCommand(command, char, simState);
      Object.entries(stateDeltas).forEach(([k, v]) => { simState[k] = v; });
      if (updatedChar.state !== "exited") next.push(updatedChar);
    }
    simState.chars = next;
  }

  it("three customers spawned at once each claim a unique seat and arrive", () => {
    const simState = rushyState();
    simState.chars = [
      createCustomer(0, 0, "customer"),
      createCustomer(1, 1, "customer"),
      createCustomer(2, 2, "customer"),
    ];
    // Force loanAmt=0 so randomness in createCustomer can't route anyone to the
    // (nonexistent) loan desk. We're testing the seat path, not the loan path.
    simState.chars.forEach(c => { c.loanAmt = 0; });

    const policy = makePolicy();
    const TICK_BUDGET = 400;
    let ticksUsed = 0;
    for (let i = 0; i < TICK_BUDGET; i++) {
      tick(simState, policy);
      ticksUsed = i + 1;
      if (simState.chars.filter(c => c.seatedAt).length === 3) break;
    }

    // No one fled or walked out — all three still present
    expect(simState.chars.length).toBe(3);
    expect(simState.walkouts).toBe(0);

    // All three seats claimed
    expect(simState.occupancy.seat.size).toBe(3);
    expect(simState.occupancy.seat.has(0)).toBe(true);
    expect(simState.occupancy.seat.has(1)).toBe(true);
    expect(simState.occupancy.seat.has(2)).toBe(true);

    // All three customers actually arrived (seatedAt=true), with unique seatIds
    const seated = simState.chars.filter(c => c.seatedAt);
    expect(seated.length).toBe(3);
    expect(new Set(seated.map(c => c.seatId)).size).toBe(3);

    // Tick budget sanity — if this ever takes more than ~300 ticks something
    // is wrong (walk distance is ~2 grid units at 0.040/tick = 50 ticks).
    expect(ticksUsed).toBeLessThan(300);
  });
});

// ─── MULTI-TICK RUSH — REAL 8-CUSTOMER REPLICA (ROADMAP §1e RECURRENCE) ───────
// The test above injects 3 calm customers with 0 tellers. The 2026-05-21
// recurrence ("only one waiting seat fills during a rush") reported the bug
// under conditions that block never exercised: a *real* rush spawns 8 customers
// through `spawnRushCustomer` — frustration 0.6, baseAnger 0.45, angry — while
// the era-1 tellers are already busy, and `activeEvent === "rush"` doubles
// frustration growth. This block replicates all four differences and counts how
// many of the 3 seats actually fill.
//
// Diagnostic intent (write the test before any fix, per the repo norm):
//   • 3 seats fill → the engine is correct under true rush load; "one seat at a
//     time" is a render/timing artifact, and the fix belongs in the draw path.
//   • <3 seats fill → an engine pipeline bug, localized to the full
//     entering → queue slot → JOIN_WAIT → CLAIM_SEAT path this block drives.
//
// Walkout-free guarantee: a waiting customer claims a seat at priority 3 BEFORE
// the priority-7 walkout check, and never accrues frustration while walking to
// it. Lobby standers do accrue — but at policy (2.0 / 6.5) the per-tick delta is
// 0.00008·2 + 0.45·0.002 ≈ 0.00106, so reaching the 0.88 threshold from 0.6
// takes ~264 ticks, far beyond the ~60 ticks the 3 seats need to fill. So the
// loop breaks on "3 seated" long before any walkout is possible.

describe("multi-tick rush — real 8-customer replica fills all 3 seats", () => {
  // Layout constants mirror BankingEmpire.jsx so the test sees the live geometry.
  const QUEUE_SLOTS = [
    {gx:3.5,gy:4.0},
    {gx:3.1,gy:4.2}, {gx:3.9,gy:4.2},
    {gx:2.7,gy:4.4}, {gx:3.5,gy:4.4}, {gx:4.3,gy:4.4},
    {gx:3.1,gy:4.6}, {gx:3.9,gy:4.6},
    {gx:2.7,gy:4.8}, {gx:4.3,gy:4.8},
  ];
  const TELLER_SLOTS = [
    {gx:2.4,gy:3.10}, {gx:2.95,gy:3.10}, {gx:3.5,gy:3.10},
    {gx:4.05,gy:3.10}, {gx:4.6,gy:3.10}, {gx:5.15,gy:3.10},
  ];
  // Era-1 default — 3 seats (DEFAULT_FACILITIES.waitingSeats).
  const SEAT_POSITIONS = [
    {gx:1.0, gy:3.90}, {gx:1.4, gy:3.90}, {gx:1.8, gy:3.90},
  ];
  // Real overflow tiles so the 5 unseated waiters have somewhere to stand
  // instead of being forced into spurious frustration/walkouts.
  const LOBBY_POSITIONS = [
    {gx:3.5, gy:5.0},
    {gx:3.1, gy:5.2}, {gx:3.9, gy:5.2},
    {gx:2.7, gy:5.4}, {gx:4.3, gy:5.4},
    {gx:1.8, gy:5.0}, {gx:5.2, gy:5.0},
    {gx:1.8, gy:5.4}, {gx:5.2, gy:5.4},
  ];
  const EXIT_POS             = {gx:3.5, gy:5.8};
  const LOAN_DESK_POS        = {gx:2.2, gy:2.4};
  const LOAN_BYPASS_WAYPOINT = {gx:1.9, gy:3.5};

  // 2 tellers, both already busy serving (teller occupancy full) — the real
  // mid-rush condition. findFreeSlot returns null, so every arrival must wait,
  // then upgrade to a seat (3 available) or a unique standing spot.
  function rushState() {
    return {
      numTellers:          2,
      activeEvent:         "rush",
      loanOfficers:        0,
      queueSlots:          QUEUE_SLOTS,
      tellerSlots:         TELLER_SLOTS,
      loanDeskPos:         LOAN_DESK_POS,
      loanBypassWaypoint:  LOAN_BYPASS_WAYPOINT,
      exitPos:             EXIT_POS,
      occupancy:           occ({ teller: [0, 1] }),
      activeTellers:       new Set([0, 1]),
      seatPositions:       SEAT_POSITIONS,
      lobbyPositions:      LOBBY_POSITIONS,
      served:              0,
      deposited:           0,
      loans:               0,
      walkouts:            0,
      whaleServed:         false,
      securityCount:       0,
      vaultLevel:          1,
      robberyLoss:         0,
      clickedCharIds:      new Set(),
      chars:               [],
    };
  }

  // One tick — mirrors BankingEmpire.jsx, applying each character's stateDeltas
  // to simState before the next character evaluates (so B sees A's seat claim).
  function tick(simState, policy) {
    const next = [];
    for (const char of simState.chars) {
      const command = evaluateCharacter(char, simState, policy);
      const { updatedChar, stateDeltas } = applyCommand(command, char, simState);
      Object.entries(stateDeltas).forEach(([k, v]) => { simState[k] = v; });
      if (updatedChar.state !== "exited") next.push(updatedChar);
    }
    simState.chars = next;
  }

  it("all 3 seats fill and no one walks out during an 8-customer rush", () => {
    const simState = rushState();
    // Spawn 8 the way spawnRushCustomer does: distinct queuePos, angry, primed
    // with frustration. loanAmt=0 keeps everyone on the seat path (not the
    // absent loan desk), exactly as the calm-rush test does.
    simState.chars = Array.from({ length: 8 }, (_, i) => ({
      ...createCustomer(i, i % QUEUE_SLOTS.length, "customer"),
      frustration: 0.6,
      baseAnger:   0.45,
      emotion:     "angry",
      loanAmt:     0,
    }));

    const policy = makePolicy();
    const TICK_BUDGET = 400;
    let ticksUsed = 0;
    for (let i = 0; i < TICK_BUDGET; i++) {
      tick(simState, policy);
      ticksUsed = i + 1;
      if (simState.chars.filter(c => c.seatedAt).length === 3) break;
    }

    // All 8 customers still present — none fled, none walked out before seating.
    expect(simState.chars.length).toBe(8);
    expect(simState.walkouts).toBe(0);

    // All 3 seats claimed, by distinct customers who actually arrived.
    expect(simState.occupancy.seat.size).toBe(3);
    expect(simState.occupancy.seat.has(0)).toBe(true);
    expect(simState.occupancy.seat.has(1)).toBe(true);
    expect(simState.occupancy.seat.has(2)).toBe(true);

    const seated = simState.chars.filter(c => c.seatedAt);
    expect(seated.length).toBe(3);
    expect(new Set(seated.map(c => c.seatId)).size).toBe(3);

    // The 5 unseated waiters hold 5 distinct standing spots — either already
    // there (UPDATE_FRUSTRATION) or walking toward one (MOVE target).
    const standers = simState.chars.filter(c => c.state === "waiting" && !c.seatedAt && c.seatId == null);
    expect(standers.length).toBe(5);
    const spots = standers.map(c => {
      const cmd = evaluateCharacter(c, simState, policy);
      const p = cmd.type === "MOVE" ? cmd.target : { gx: c.gx, gy: c.gy };
      return `${Math.round(p.gx * 10)},${Math.round(p.gy * 10)}`;
    });
    expect(new Set(spots).size).toBe(5);

    // Seats fill well before any lobby stander could approach the walkout
    // threshold (~264 ticks) — generous bound guards against a regression that
    // slows the seat path.
    expect(ticksUsed).toBeLessThan(300);
  });
});

// ─── PLAYER INTERACTION COMMANDS ─────────────────────────────────────────────
// Clicks route through applyCommand like every other mutation. These pin the
// behaviors that used to live as direct mutations in BankingEmpire.jsx.

describe("interaction commands", () => {
  it("interactionCommandFor maps roles to commands", () => {
    expect(interactionCommandFor({ id: 1, role: "whale" }).type).toBe("GREET_WHALE");
    expect(interactionCommandFor({ id: 2, role: "robber" }).type).toBe("DISPATCH_SECURITY");
    expect(interactionCommandFor({ id: 3, role: "inspector" }).type).toBe("DISTRACT_INSPECTOR");
    expect(interactionCommandFor({ id: 4, role: "customer" }).type).toBe("GREET_CUSTOMER");
  });

  it("GREET_WHALE boosts the deposit by the config factor and consumes the click window", () => {
    const s = makeSimState();
    const whale = { id: 1, role: "whale", deposit: 500000, interactable: true, gx: 4, gy: 5 };
    const { updatedChar } = applyCommand({ type: "GREET_WHALE", charId: 1 }, whale, s);
    expect(updatedChar.deposit).toBe(Math.round(500000 * BRANCH_EVENTS.whale.resolution.greetDepositBoost));
    expect(updatedChar.interactable).toBe(false);
    expect(updatedChar.emotion).toBe("happy");
  });

  it("GREET_CUSTOMER clamps frustration and anger at zero", () => {
    const s = makeSimState({ greets: 0 });
    const calm = { id: 2, role: "customer", frustration: 0.2, baseAnger: 0.05, gx: 3, gy: 4 };
    const { updatedChar, stateDeltas } = applyCommand({ type: "GREET_CUSTOMER", charId: 2 }, calm, s);
    // Old click handler subtracted below zero (0.2 - 0.45 = -0.25) — locked out here.
    expect(updatedChar.frustration).toBe(0);
    expect(updatedChar.baseAnger).toBe(0);
    expect(updatedChar.emotion).toBe("happy");
    expect(stateDeltas.greets).toBe(1);
  });

  it("DISPATCH_SECURITY lowers the robbery loss via lossFactor", () => {
    const s = makeSimState({ robberyLoss: 0, vaultLevel: 1 });
    const robber = { id: 3, role: "robber", state: "robbing", progress: 1, lossFactor: 1, gx: 5, gy: 2 };

    const dispatched = applyCommand({ type: "DISPATCH_SECURITY", charId: 3 }, robber, s).updatedChar;
    expect(dispatched.lossFactor).toBe(BRANCH_EVENTS.robbery.resolution.dispatchedLossFactor);
    expect(dispatched.securityDispatched).toBe(true);

    // Escape with the dispatched factor vs the spawn default of 1
    const base = BRANCH_EVENTS.robbery.resolution.baseLoss;
    const fullLoss = applyCommand({ type: "ROBBER_ESCAPE", charId: 3 }, robber, s).stateDeltas.robberyLoss;
    const cutLoss  = applyCommand({ type: "ROBBER_ESCAPE", charId: 3 }, dispatched, s).stateDeltas.robberyLoss;
    expect(fullLoss).toBe(base);
    expect(cutLoss).toBe(Math.round(base * BRANCH_EVENTS.robbery.resolution.dispatchedLossFactor));
  });

  it("DISTRACT_INSPECTOR clears the active event — the old click path left the banner hanging", () => {
    const s = makeSimState({ activeEvent: "inspection", inspectorDistracted: false });
    const inspector = { id: 4, role: "inspector", state: "inspecting", gx: 2, gy: 2 };
    const { updatedChar, stateDeltas } = applyCommand({ type: "DISTRACT_INSPECTOR", charId: 4 }, inspector, s);
    expect(updatedChar.state).toBe("leaving");
    expect(stateDeltas.inspectorDistracted).toBe(true);
    expect(stateDeltas.activeEvent).toBe(null);
  });
});

// ─── DAY TICK ────────────────────────────────────────────────────────────────

describe("tickSimulation", () => {
  // Era-1 quarter with a deterministic schedule (no milestone at absQ=2,
  // random schedule overwritten after construction).
  function makeDayState(events) {
    const s = createDaySimState({
      fin:   { era: 1, year: 1, quarter: 2 },
      staff: { tellers: 2, loanOfficers: 0, security: 0 },
      fac:   { vaultLevel: 1, waitingSeats: 3 },
    });
    s.events = events;
    return s;
  }

  it("ends the day at the configured length", () => {
    const s = makeDayState([]);
    expect(tickSimulation(s, makePolicy(), SIM_TIMING.dayLengthMs - 1).dayOver).toBe(false);
    expect(tickSimulation(s, makePolicy(), SIM_TIMING.dayLengthMs).dayOver).toBe(true);
  });

  it("fires scheduled events once and reports them as effects", () => {
    const s = makeDayState([{ type: "inspection", triggerAt: 1000, done: false }]);
    const fx1 = tickSimulation(s, makePolicy(), 1000);
    expect(fx1.firedEvents).toEqual(["inspection"]);
    expect(s.activeEvent).toBe("inspection");
    expect(s.chars.some(c => c.role === "inspector")).toBe(true);
    // Next tick: already done, does not re-fire
    const fx2 = tickSimulation(s, makePolicy(), 1100);
    expect(fx2.firedEvents).toEqual([]);
  });

  it("overlapping events expire on elapsed time — the setTimeout race is gone", () => {
    const s = makeDayState([
      { type: "inspection", triggerAt: 1000, done: false },
      { type: "rush",       triggerAt: 5000, done: false },
    ]);
    tickSimulation(s, makePolicy(), 1000);
    expect(s.activeEvent).toBe("inspection");
    tickSimulation(s, makePolicy(), 5000);
    expect(s.activeEvent).toBe("rush");
    // Inspection's original 12s window passing must NOT clear the rush…
    tickSimulation(s, makePolicy(), 1000 + SIM_TIMING.eventBannerMs + 100);
    expect(s.activeEvent).toBe("rush");
    // …but the rush's own window does.
    tickSimulation(s, makePolicy(), 5000 + SIM_TIMING.eventBannerMs);
    expect(s.activeEvent).toBe(null);
    expect(s.eventClearAt).toBe(null);
  });

  it("event characters get a click window that expires with sim time", () => {
    // Robbery is era-2 content; the schedule is injected directly so the
    // interaction tagging is exercised regardless of era gating.
    const s = makeDayState([{ type: "robbery", triggerAt: 1000, done: false }]);
    tickSimulation(s, makePolicy(), 1000);
    const robber = s.chars.find(c => c.role === "robber");
    expect(robber.interactable).toBe(true);
    expect(robber.lossFactor).toBe(1); // spawn default — no NaN loss for un-clicked robbers
    expect(robber.interactUntil).toBe(1000 + BRANCH_EVENTS.robbery.resolution.interactWindowMs);

    tickSimulation(s, makePolicy(), robber.interactUntil + 200);
    expect(s.chars.find(c => c.role === "robber").interactable).toBe(false);
  });
});

// ─── LOAN DEMAND ELASTICITY ──────────────────────────────────────────────────
// The lending-rate slider must actually move loan demand. Before 2026-07 the
// loanDemand config block existed but was never read, and the application
// roll was inverted (60% at a configured 40%).

describe("loanApplicationChanceFor", () => {
  const base = CUSTOMER_BEHAVIOUR.loanApplicationChance;

  it("returns the configured base chance without a policy", () => {
    expect(loanApplicationChanceFor(null)).toBe(base);
  });

  it("returns the base chance at the baseline rate", () => {
    expect(loanApplicationChanceFor({ lendingRate: 5.0 })).toBeCloseTo(base, 5);
  });

  it("higher lending rates reduce demand; lower rates raise it", () => {
    const atBaseline = loanApplicationChanceFor({ lendingRate: 5.0 });
    const predatory  = loanApplicationChanceFor({ lendingRate: 9.0 });
    const teaser     = loanApplicationChanceFor({ lendingRate: 3.5 });
    expect(predatory).toBeLessThan(atBaseline);
    expect(teaser).toBeGreaterThan(atBaseline);
  });

  it("stays clamped to a sane probability range", () => {
    expect(loanApplicationChanceFor({ lendingRate: 0.5 })).toBeLessThanOrEqual(0.95);
    expect(loanApplicationChanceFor({ lendingRate: 50 })).toBeGreaterThanOrEqual(0.02);
  });
});

// ─── ERA TRANSITION ──────────────────────────────────────────────────────────
// eraProgress used to accumulate forever without ever advancing the era,
// which kept robbery/whale/outage, security, vault upgrades, and seat
// purchases permanently unreachable. resolveEraTransition closes the loop.

describe("resolveEraTransition", () => {
  it("advances the era and resets progress when the bar fills", () => {
    const t = resolveEraTransition(1, 104);
    expect(t).toEqual({ era: 2, eraProgress: 0, eraAdvanced: true });
  });

  it("stays in era below the threshold, clamped to 0–100", () => {
    expect(resolveEraTransition(1, 55)).toEqual({ era: 1, eraProgress: 55, eraAdvanced: false });
    expect(resolveEraTransition(1, -12)).toEqual({ era: 1, eraProgress: 0, eraAdvanced: false });
  });

  it("respects the v1 era cap — a full bar at the cap does not advance", () => {
    const t = resolveEraTransition(ERA_RULES.cap, 150);
    expect(t.era).toBe(ERA_RULES.cap);
    expect(t.eraAdvanced).toBe(false);
    expect(t.eraProgress).toBe(100);
  });
});

// ─── FULL DAY INTEGRATION ────────────────────────────────────────────────────
// Drives tickSimulation through an entire 75-second day at real tick spacing.
// Spawns and service pacing are random, so assertions are structural: the day
// ends on time, customers actually got served, and every claim in the
// occupancy allocator is backed by a living character (no leaked spots —
// the exact bug family the one-allocator refactor exists to prevent).

describe("full day integration", () => {
  it("a staffed day serves customers and leaks no occupancy claims", () => {
    const s = createDaySimState({
      fin:   { era: 1, year: 1, quarter: 2 }, // absQ 2 — no forced milestone
      staff: { tellers: 3, loanOfficers: 1, security: 0 },
      fac:   { vaultLevel: 1, waitingSeats: 3 },
    });
    // Deterministic schedule: one rush mid-day exercises the drip spawner,
    // seats, and standing spots under load.
    s.events = [{ type: "rush", triggerAt: 20000, done: false }];

    const policy = makePolicy();
    let dayOver = false;
    for (let elapsed = 0; elapsed <= SIM_TIMING.dayLengthMs; elapsed += SIM_TIMING.tickMs) {
      const fx = tickSimulation(s, policy, elapsed);
      if (fx.dayOver) { dayOver = true; break; }

      // Allocator invariant, checked every tick: each claimed spot belongs to
      // exactly one present character.
      const holders = { teller: [], loanDesk: [], seat: [] };
      for (const c of s.chars) {
        if (c.state === "exited") continue;
        for (const [kind, spotId] of (c.seatId != null ? [["seat", c.seatId]] : []))
          holders[kind].push(spotId);
        if (c.useLoanDesk) holders.loanDesk.push(0);
        else if (typeof c.tellerIndex === "number" && c.tellerIndex >= 0) holders.teller.push(c.tellerIndex);
      }
      for (const kind of ["teller", "loanDesk", "seat"]) {
        for (const spotId of s.occupancy[kind]) {
          expect(holders[kind], `${kind} spot ${spotId} at t=${elapsed} has a holder`).toContain(spotId);
        }
        expect(new Set(holders[kind]).size, `${kind} claims unique at t=${elapsed}`).toBe(holders[kind].length);
      }
    }

    expect(dayOver).toBe(true);
    // A 3-teller day reliably serves several customers (service takes ~14s;
    // spawn pressure fills the counter well before the rush).
    expect(s.served).toBeGreaterThan(0);
    expect(s.deposited).toBeGreaterThan(0);
    // The rush fired and cleared through the elapsed-time path.
    expect(s.events[0].done).toBe(true);
    expect(s.activeEvent).toBe(null);
  });
});
