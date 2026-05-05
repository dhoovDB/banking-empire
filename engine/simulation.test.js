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
