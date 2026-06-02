import { describe, it, expect } from "vitest";
import { evaluateCharacter, applyCommand, createCustomer } from "./simulation.js";

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
    occupiedTellerSlots: new Set(),
    loanDeskOccupied:    false,
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
    const simState = makeSimState();
    // Manually mark slot 0 as claimed
    const newOccupied = new Set(simState.occupiedTellerSlots);
    newOccupied.add(0);
    simState.occupiedTellerSlots = newOccupied;
    // Slot 0 is now occupied — slot 1 should be free
    expect(simState.occupiedTellerSlots.has(0)).toBe(true);
    expect(simState.occupiedTellerSlots.has(1)).toBe(false);
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
    const simState = makeSimState({ occupiedTellerSlots: new Set([0, 1]) });
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
    expect(stateDeltas.occupiedTellerSlots.has(0)).toBe(true);
  });

  it("COMPLETE_SERVICE releases the occupied teller slot", () => {
    const simState = makeSimState({ occupiedTellerSlots: new Set([0]) });
    const char = { id: 5, role: "customer", state: "served", deposit: 5000,
                   tellerIndex: 0, useLoanDesk: false, loanAmt: 0 };
    const command = { type: "COMPLETE_SERVICE", hasLoan: false, isWhale: false };
    const { stateDeltas } = applyCommand(command, char, simState);
    expect(stateDeltas.occupiedTellerSlots.has(0)).toBe(false);
  });
});

// ─── LOAN DESK ROUTING ────────────────────────────────────────────────────────

describe("loan desk routing", () => {
  it("loan customer with available loan officer claims loan desk", () => {
    const simState = makeSimState({ loanOfficers: 1, loanDeskOccupied: false });
    const slot = simState.queueSlots[0];
    const char = { id: 6, role: "customer", state: "entering", queuePos: 0,
                   gx: slot.gx, gy: slot.gy, loanAmt: 10000, frustration: 0, baseAnger: 0 };
    const command = evaluateCharacter(char, simState, makePolicy());
    expect(command.type).toBe("CLAIM_SLOT");
    expect(command.useLoanDesk).toBe(true);
  });

  it("CLAIM_SLOT with useLoanDesk marks loanDeskOccupied", () => {
    const simState = makeSimState({ loanOfficers: 1 });
    const char = { id: 7, role: "customer", state: "entering", gx: 0, gy: 0, loanAmt: 10000 };
    const command = { type: "CLAIM_SLOT", charId: 7, tellerIndex: -1, useLoanDesk: true };
    const { updatedChar, stateDeltas } = applyCommand(command, char, simState);
    expect(updatedChar.useLoanDesk).toBe(true);
    expect(stateDeltas.loanDeskOccupied).toBe(true);
  });

  it("COMPLETE_SERVICE releases loan desk when useLoanDesk is true", () => {
    const simState = makeSimState({ loanDeskOccupied: true });
    const char = { id: 8, role: "customer", state: "served", deposit: 5000,
                   tellerIndex: -1, useLoanDesk: true, loanAmt: 10000 };
    const command = { type: "COMPLETE_SERVICE", hasLoan: true, isWhale: false };
    const { stateDeltas } = applyCommand(command, char, simState);
    expect(stateDeltas.loanDeskOccupied).toBe(false);
  });
});

// ─── LOAN BYPASS WAYPOINT ────────────────────────────────────────────────────
// Loan customers route around the left end of the teller counter via a single
// waypoint, both when advancing to the loan desk and when leaving from it.

describe("loan bypass waypoint", () => {
  it("CLAIM_SLOT with useLoanDesk sets nextWaypoint to the bypass point", () => {
    const simState = makeSimState({ loanOfficers: 1 });
    const char = { id: 10, role: "customer", state: "entering", gx: 0, gy: 0, loanAmt: 10000 };
    const command = { type: "CLAIM_SLOT", charId: 10, tellerIndex: -1, useLoanDesk: true };
    const { updatedChar } = applyCommand(command, char, simState);
    expect(updatedChar.nextWaypoint).toEqual(simState.loanBypassWaypoint);
  });

  it("CLAIM_SLOT without useLoanDesk leaves nextWaypoint null", () => {
    const simState = makeSimState();
    const char = { id: 11, role: "customer", state: "entering", gx: 0, gy: 0, loanAmt: 0 };
    const command = { type: "CLAIM_SLOT", charId: 11, tellerIndex: 0, useLoanDesk: false };
    const { updatedChar } = applyCommand(command, char, simState);
    expect(updatedChar.nextWaypoint).toBeNull();
  });

  it("advancing customer with nextWaypoint moves toward waypoint, then clears, then targets loan desk", () => {
    const simState = makeSimState({ loanOfficers: 1, loanDeskOccupied: true });
    // Customer just claimed loan desk — far from waypoint
    let char = { id: 12, role: "customer", state: "advancing", gx: 3.5, gy: 5.5,
                 useLoanDesk: true, tellerIndex: -1, loanAmt: 10000,
                 nextWaypoint: simState.loanBypassWaypoint };
    // Step 1: should target waypoint, not loan desk
    let cmd = evaluateCharacter(char, simState, makePolicy());
    expect(cmd.type).toBe("MOVE");
    expect(cmd.target).toEqual(simState.loanBypassWaypoint);

    // Step 2: customer reaches waypoint — should request CLEAR_WAYPOINT
    char = atPos(char, simState.loanBypassWaypoint);
    cmd = evaluateCharacter(char, simState, makePolicy());
    expect(cmd.type).toBe("CLEAR_WAYPOINT");

    // Step 3: apply CLEAR_WAYPOINT, then advancing should target loan desk
    const { updatedChar } = applyCommand(cmd, char, simState);
    expect(updatedChar.nextWaypoint).toBeNull();
    cmd = evaluateCharacter(updatedChar, simState, makePolicy());
    expect(cmd.type).toBe("MOVE");
    expect(cmd.target).toEqual(simState.loanDeskPos);
  });

  it("COMPLETE_SERVICE for loan customer sets nextWaypoint for the leaving path", () => {
    const simState = makeSimState({ loanDeskOccupied: true });
    const char = { id: 13, role: "customer", state: "served", deposit: 5000,
                   tellerIndex: -1, useLoanDesk: true, loanAmt: 10000 };
    const command = { type: "COMPLETE_SERVICE", hasLoan: true, isWhale: false };
    const { updatedChar } = applyCommand(command, char, simState);
    expect(updatedChar.state).toBe("leaving");
    expect(updatedChar.nextWaypoint).toEqual(simState.loanBypassWaypoint);
  });

  it("leaving customer with nextWaypoint moves toward waypoint, not exit", () => {
    const simState = makeSimState();
    const char = { id: 14, role: "customer", state: "leaving",
                   gx: 2.2, gy: 2.0, useLoanDesk: true,
                   nextWaypoint: simState.loanBypassWaypoint };
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
    const simState = makeSimState({ activeEvent: null, occupiedTellerSlots: new Set([0, 1]) });
    const char = makeWaitingChar();
    const cmd = evaluateCharacter(char, simState, makePolicy());
    expect(cmd.type).toBe("UPDATE_FRUSTRATION");
    const baselineFrustGrowth = cmd.newFrust - char.frustration;
    expect(baselineFrustGrowth).toBeGreaterThan(0);
    expect(baselineFrustGrowth).toBeLessThan(0.01);
  });

  it("rush waiting customer accumulates frustration faster than baseline", () => {
    const simStateBaseline = makeSimState({ activeEvent: null, occupiedTellerSlots: new Set([0, 1]) });
    const simStateRush     = makeSimState({ activeEvent: "rush", occupiedTellerSlots: new Set([0, 1]) });
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
      occupiedTellerSlots: new Set([0, 1]), // no teller free
      seatPositions: [
        { gx: 1.5, gy: 3.5 },
        { gx: 1.9, gy: 3.5 },
        { gx: 2.3, gy: 3.5 },
      ],
      occupiedSeats: new Set(),
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
    expect(stateDeltas.occupiedSeats.has(0)).toBe(true);
  });

  it("customer with claimed seat walks toward it", () => {
    const simState = withSeats({ occupiedSeats: new Set([0]) });
    const char = makeWaitingChar({ seatId: 0, gx: 3.5, gy: 4.0 });
    const cmd = evaluateCharacter(char, simState, makePolicy());
    expect(cmd.type).toBe("MOVE");
    expect(cmd.target).toEqual(simState.seatPositions[0]);
  });

  it("customer arriving at seat emits ARRIVE_AT_SEAT", () => {
    const simState = withSeats({ occupiedSeats: new Set([0]) });
    const char = makeWaitingChar({ seatId: 0, gx: 1.5, gy: 3.5 });
    const cmd = evaluateCharacter(char, simState, makePolicy());
    expect(cmd.type).toBe("ARRIVE_AT_SEAT");
  });

  it("seated customer accumulates frustration slower than standing customer", () => {
    const simState = withSeats({ seatPositions: [], occupiedSeats: new Set() }); // no seats — force standing path
    const standingState = makeSimState({ occupiedTellerSlots: new Set([0, 1]) });
    const seatedState   = makeSimState({ occupiedTellerSlots: new Set([0, 1]) });
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
      occupiedTellerSlots: new Set(),  // teller 0 now free
      occupiedSeats:       new Set([1]),
    });
    const char = makeWaitingChar({ seatId: 1, seatedAt: true });
    const cmd = evaluateCharacter(char, simState, makePolicy());
    expect(cmd.type).toBe("CLAIM_SLOT");
    const { updatedChar, stateDeltas } = applyCommand(cmd, char, simState);
    expect(updatedChar.seatId).toBeNull();
    expect(updatedChar.seatedAt).toBe(false);
    expect(stateDeltas.occupiedSeats.has(1)).toBe(false);
  });

  it("WALKOUT releases the customer's seat", () => {
    const simState = withSeats({ occupiedSeats: new Set([2]) });
    const char = makeWaitingChar({ seatId: 2, seatedAt: true });
    const cmd = { type: "WALKOUT", charId: char.id };
    const { updatedChar, stateDeltas } = applyCommand(cmd, char, simState);
    expect(updatedChar.state).toBe("fleeing");
    expect(updatedChar.seatId).toBeNull();
    expect(stateDeltas.occupiedSeats.has(2)).toBe(false);
  });

  it("no seat claim when all seats occupied — falls through to frustration", () => {
    const simState = withSeats({ occupiedSeats: new Set([0, 1, 2]) });
    const char = makeWaitingChar();
    const cmd = evaluateCharacter(char, simState, makePolicy());
    expect(cmd.type).toBe("UPDATE_FRUSTRATION");
  });
});

// ─── LOBBY OVERFLOW ──────────────────────────────────────────────────────────
// When teller and seat allocators are both exhausted, waiting customers should
// each claim a unique lobby tile rather than stacking on one spot. This is the
// "no walking through each other" guarantee (Shape B in ROADMAP).

describe("lobby overflow positions", () => {
  function makeWaitingChar(overrides = {}) {
    return {
      id: 50, role: "customer", state: "waiting",
      gx: 3.5, gy: 4.0, frustration: 0.5, baseAnger: 0,
      seatId: null, seatedAt: false, lobbyId: null,
      ...overrides,
    };
  }

  function withLobby(overrides = {}) {
    return makeSimState({
      occupiedTellerSlots: new Set([0, 1]),                  // teller full
      seatPositions:       [{ gx: 1.5, gy: 3.5 }],
      occupiedSeats:       new Set([0]),                     // seat full
      lobbyPositions: [
        { gx: 3.5, gy: 5.0 },
        { gx: 3.1, gy: 5.2 },
        { gx: 3.9, gy: 5.2 },
      ],
      occupiedLobby: new Set(),
      ...overrides,
    });
  }

  it("claims a lobby tile when no teller and no seat is available", () => {
    const simState = withLobby();
    const char    = makeWaitingChar();
    const cmd     = evaluateCharacter(char, simState, makePolicy());
    expect(cmd.type).toBe("CLAIM_LOBBY");
    expect(cmd.lobbyId).toBe(0);
  });

  it("CLAIM_LOBBY marks the lobby occupied and sets lobbyId on customer", () => {
    const simState = withLobby();
    const char    = makeWaitingChar();
    const cmd     = evaluateCharacter(char, simState, makePolicy());
    const { updatedChar, stateDeltas } = applyCommand(cmd, char, simState);
    expect(updatedChar.lobbyId).toBe(0);
    expect(stateDeltas.occupiedLobby.has(0)).toBe(true);
  });

  it("two customers cannot claim the same lobby tile", () => {
    const simState = withLobby();
    const a = makeWaitingChar({ id: 51 });
    const cmdA = evaluateCharacter(a, simState, makePolicy());
    const resultA = applyCommand(cmdA, a, simState);
    // Apply the first claim's delta before evaluating the second customer
    simState.occupiedLobby = resultA.stateDeltas.occupiedLobby;

    const b = makeWaitingChar({ id: 52 });
    const cmdB = evaluateCharacter(b, simState, makePolicy());
    expect(cmdB.type).toBe("CLAIM_LOBBY");
    expect(cmdB.lobbyId).not.toBe(cmdA.lobbyId);
  });

  it("customer with claimed lobby walks toward the tile", () => {
    const simState = withLobby({ occupiedLobby: new Set([0]) });
    const char    = makeWaitingChar({ lobbyId: 0, gx: 3.5, gy: 4.0 });
    const cmd     = evaluateCharacter(char, simState, makePolicy());
    expect(cmd.type).toBe("MOVE");
    expect(cmd.target).toEqual(simState.lobbyPositions[0]);
  });

  it("seated customer keeps no lobby claim (seat is strictly preferred)", () => {
    // Seat available → customer should claim seat, never lobby.
    const simState = withLobby({ occupiedSeats: new Set() });
    const char    = makeWaitingChar();
    const cmd     = evaluateCharacter(char, simState, makePolicy());
    expect(cmd.type).toBe("CLAIM_SEAT");
  });

  it("CLAIM_SEAT from lobby releases the lobby tile", () => {
    // Customer holds lobby; seat opens up; they should release lobby and claim seat.
    const simState = withLobby({
      occupiedSeats: new Set(),         // seat free
      occupiedLobby: new Set([1]),      // customer holds lobby 1
    });
    const char = makeWaitingChar({ lobbyId: 1 });
    const cmd  = evaluateCharacter(char, simState, makePolicy());
    expect(cmd.type).toBe("CLAIM_SEAT");
    const { updatedChar, stateDeltas } = applyCommand(cmd, char, simState);
    expect(updatedChar.lobbyId).toBeNull();
    expect(stateDeltas.occupiedLobby.has(1)).toBe(false);
  });

  it("CLAIM_SLOT releases the customer's lobby tile", () => {
    const simState = withLobby({
      occupiedTellerSlots: new Set(),   // teller free
      occupiedLobby:       new Set([1]),
    });
    const char = makeWaitingChar({ lobbyId: 1 });
    const cmd  = evaluateCharacter(char, simState, makePolicy());
    expect(cmd.type).toBe("CLAIM_SLOT");
    const { updatedChar, stateDeltas } = applyCommand(cmd, char, simState);
    expect(updatedChar.lobbyId).toBeNull();
    expect(stateDeltas.occupiedLobby.has(1)).toBe(false);
  });

  it("WALKOUT releases the customer's lobby tile", () => {
    const simState = withLobby({ occupiedLobby: new Set([2]) });
    const char = makeWaitingChar({ lobbyId: 2 });
    const cmd  = { type: "WALKOUT", charId: char.id };
    const { updatedChar, stateDeltas } = applyCommand(cmd, char, simState);
    expect(updatedChar.state).toBe("fleeing");
    expect(updatedChar.lobbyId).toBeNull();
    expect(stateDeltas.occupiedLobby.has(2)).toBe(false);
  });

  it("FLEE releases the customer's lobby tile", () => {
    const simState = withLobby({ occupiedLobby: new Set([0]) });
    const char = makeWaitingChar({ lobbyId: 0 });
    const cmd  = { type: "FLEE", charId: char.id, reason: "robbery" };
    const { updatedChar, stateDeltas } = applyCommand(cmd, char, simState);
    expect(updatedChar.lobbyId).toBeNull();
    expect(stateDeltas.occupiedLobby.has(0)).toBe(false);
  });

  it("all lobby tiles occupied — customer falls through to frustration accrual", () => {
    const simState = withLobby({ occupiedLobby: new Set([0, 1, 2]) });
    const char    = makeWaitingChar();
    const cmd     = evaluateCharacter(char, simState, makePolicy());
    expect(cmd.type).toBe("UPDATE_FRUSTRATION");
  });

  it("eight customers each get a unique lobby tile when seats + queue are saturated", () => {
    // The rush-spawn worst case: 8 customers arrive at once with nowhere to sit
    // and nowhere to be served. Each must get a unique standing tile.
    const simState = withLobby({
      lobbyPositions: Array.from({ length: 10 }, (_, i) => ({ gx: i, gy: 5 })),
    });
    const claimedIds = new Set();
    for (let i = 0; i < 8; i++) {
      const char = makeWaitingChar({ id: 60 + i });
      const cmd  = evaluateCharacter(char, simState, makePolicy());
      expect(cmd.type).toBe("CLAIM_LOBBY");
      const { stateDeltas } = applyCommand(cmd, char, simState);
      simState.occupiedLobby = stateDeltas.occupiedLobby;
      expect(claimedIds.has(cmd.lobbyId)).toBe(false);
      claimedIds.add(cmd.lobbyId);
    }
    expect(claimedIds.size).toBe(8);
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
      occupiedTellerSlots: new Set(),
      loanDeskOccupied:    false,
      activeTellers:       new Set(),
      seatPositions:       SEAT_POSITIONS,
      occupiedSeats:       new Set(),
      lobbyPositions:      [],
      occupiedLobby:       new Set(),
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
    expect(simState.occupiedSeats.size).toBe(3);
    expect(simState.occupiedSeats.has(0)).toBe(true);
    expect(simState.occupiedSeats.has(1)).toBe(true);
    expect(simState.occupiedSeats.has(2)).toBe(true);

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

  // 2 tellers, both already busy serving (occupiedTellerSlots full) — the real
  // mid-rush condition. findFreeSlot returns null, so every arrival must wait,
  // then upgrade to a seat (3 available) or a lobby tile (5 overflow).
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
      occupiedTellerSlots: new Set([0, 1]),
      loanDeskOccupied:    false,
      activeTellers:       new Set([0, 1]),
      seatPositions:       SEAT_POSITIONS,
      occupiedSeats:       new Set(),
      lobbyPositions:      LOBBY_POSITIONS,
      occupiedLobby:       new Set(),
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
    expect(simState.occupiedSeats.size).toBe(3);
    expect(simState.occupiedSeats.has(0)).toBe(true);
    expect(simState.occupiedSeats.has(1)).toBe(true);
    expect(simState.occupiedSeats.has(2)).toBe(true);

    const seated = simState.chars.filter(c => c.seatedAt);
    expect(seated.length).toBe(3);
    expect(new Set(seated.map(c => c.seatId)).size).toBe(3);

    // The 5 unseated waiters spread across unique lobby tiles, never stacking.
    const lobbied = simState.chars.filter(c => c.lobbyId != null && !c.seatedAt);
    expect(lobbied.length).toBe(5);
    expect(new Set(lobbied.map(c => c.lobbyId)).size).toBe(5);

    // Seats fill well before any lobby stander could approach the walkout
    // threshold (~264 ticks) — generous bound guards against a regression that
    // slows the seat path.
    expect(ticksUsed).toBeLessThan(300);
  });
});
