import { CUSTOMER_BEHAVIOUR, POLICY_IMPACTS, SIM_TIMING, SPAWN_RULES } from "../config/economy.js";
import { BRANCH_EVENTS }                      from "../config/events.js";
import { SKIN_TONES, HAIR_COLORS, STAFF_OUTFITS, ROLE_DEFAULTS, EMOTIONS, SPEEDS, CHATTER } from "../config/characters.js";
import { ERA_PROGRESS_RULES, ERA_RULES, QUARTER_MILESTONES, FORCED_INSPECTION_TRIGGER_MS } from "../config/progression.js";
import {
  QUEUE_SLOTS, TELLER_SLOTS, SEAT_POSITIONS, LOBBY_POSITIONS,
  EXIT_POS, VAULT_POS, MGR_POS, LOAN_DESK_POS, LOAN_BYPASS_WAYPOINT,
} from "../config/layout.js";

// ─── RANDOM UTILITIES ─────────────────────────────────────────────────────────
// All randomness flows through here. Swap for seeded version to enable replays.
export const randomFloat = () => Math.random();
export const randomInt   = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
export const pickRandom  = arr => arr[randomInt(0, arr.length - 1)];

// ─── STAFF FACTORY ────────────────────────────────────────────────────────────
export function createStaffMember(role, _existing) {
  return {
    role,
    skin:   pickRandom(SKIN_TONES),
    hair:   pickRandom(HAIR_COLORS),
    outfit: pickRandom(STAFF_OUTFITS.teller),
  };
}

// ─── LOAN DEMAND ─────────────────────────────────────────────────────────────
// The lending-rate slider's other half: high rates choke off applications,
// teaser rates attract them. Pure so the curve itself is testable.
export function loanApplicationChanceFor(policy) {
  const base = CUSTOMER_BEHAVIOUR.loanApplicationChance;
  if (!policy) return base;
  const { rateElasticity, rateBaseline } = POLICY_IMPACTS.loanDemand;
  const demand = Math.pow(policy.lendingRate / rateBaseline, -rateElasticity);
  return Math.min(0.95, Math.max(0.02, base * demand));
}

// ─── CHARACTER FACTORY ────────────────────────────────────────────────────────
export function createCustomer(id, queuePos, role = "customer", policy = null) {
  const defaults = ROLE_DEFAULTS[role];
  const beh      = CUSTOMER_BEHAVIOUR;

  const skin    = defaults?.skin   || pickRandom(SKIN_TONES);
  const outfit  = defaults?.outfit || pickRandom(STAFF_OUTFITS.teller);
  const hair    = defaults?.hair   || pickRandom(HAIR_COLORS);

  const depMin  = defaults?.depositRange?.min || beh.depositRange.min;
  const depMax  = defaults?.depositRange?.max || beh.depositRange.max;

  return {
    id,
    role,
    gx:          3.0 + (randomFloat() - 0.5) * 0.2, // enter through left door (gx≈3)
    gy:          5.8,
    state:       "entering",
    emotion:     defaults?.entryEmotion || "neutral",
    isMoving:    true,
    progress:    0,
    frustration: 0,
    baseAnger:   0,
    deposit:     randomInt(depMin, depMax),
    // < (not >) — the pre-2026-07 roll was inverted, giving a 60% application
    // rate for a field named loanApplicationChance: 0.4.
    loanAmt:     randomFloat() < loanApplicationChanceFor(policy)
                   ? randomInt(beh.loanRange.min, beh.loanRange.max) : 0,
    bubble:      null,
    bubbleTimer: 0,
    queuePos,
    skinTone:    skin,
    outfitColor: outfit,
    hairColor:   hair,
    scale:       defaults?.scale || 0.92,
  };
}

// ─── DAY STATE FACTORY ────────────────────────────────────────────────────────
// Builds the mutable per-day simulation state. Layout comes from config;
// staffing and facilities from the committed setup. `dayStart` is injected so
// the engine itself never reads the wall clock.
export function createDaySimState({ fin, staff, fac, setupCost = 0, dayStart = 0 }) {
  const events = buildEventSchedule(fin.era);

  // Milestone quarters force an inspection on top of the random schedule.
  const absQ      = (fin.year - 1) * 4 + fin.quarter;
  const milestone = QUARTER_MILESTONES[absQ];
  if (milestone?.forceInspection && randomFloat() < milestone.inspectionProb) {
    events.push({ type: "inspection", triggerAt: FORCED_INSPECTION_TRIGGER_MS, done: false });
  }

  return {
    chars:          [],
    nextId:         0,
    dayStart,
    served:         0,
    deposited:      0,
    loans:          0,
    walkouts:       0,
    robberyLoss:    0,
    regulatoryFine: 0,
    robberCaught:   false,
    whaleServed:    false,
    inspectionDone: false,
    activeTellers:  new Set(),
    activeEvent:    null,
    eventClearAt:   null,
    vaultOpen:      false,
    vaultLevel:     fac.vaultLevel,
    securityCount:  staff.security,
    loanOfficers:   staff.loanOfficers,
    numTellers:     staff.tellers,
    events,
    queueCounter:   0,
    queueSlots:          QUEUE_SLOTS,
    tellerSlots:         TELLER_SLOTS,
    exitPos:             EXIT_POS,
    vaultPos:            VAULT_POS,
    managerPos:          MGR_POS,
    loanDeskPos:         LOAN_DESK_POS,
    loanBypassWaypoint:  LOAN_BYPASS_WAYPOINT,
    // One allocator for every claimable spot. Kinds: teller (by slot index),
    // loanDesk (spot 0 today; becomes per-desk indices when multi-desk lands),
    // seat (by seat index). Standing positions are NOT claimed — they're
    // computed from waiting order (see standingSpotFor).
    occupancy:           { teller: new Set(), loanDesk: new Set(), seat: new Set() },
    seatPositions:       SEAT_POSITIONS.slice(0, fac.waitingSeats),
    lobbyPositions:      LOBBY_POSITIONS,
    inspectorDistracted: false,
    clickedCharIds:      new Set(),
    pendingRushSpawns:   0,
    setupCost,
    greets:              0,
  };
}

// ─── DAY TICK ─────────────────────────────────────────────────────────────────
// One 100ms simulation step. Owns every mutation of simState during the day:
// event firing, banner expiry, spawning, character evaluate/apply, and ambient
// bubbles. Returns effects for the boundary to render (coins, log lines) —
// the engine never touches React or the canvas.
export function tickSimulation(s, policy, elapsed) {
  const effects = { dayOver: false, firedEvents: [], coins: [] };

  if (elapsed >= SIM_TIMING.dayLengthMs) {
    effects.dayOver = true;
    return effects;
  }

  // 1. Fire scheduled events.
  for (const ev of s.events) {
    if (!ev.done && ev.triggerAt <= elapsed) {
      ev.done = true;
      fireEvent(ev.type, s, elapsed);
      effects.firedEvents.push(ev.type);
    }
  }

  // 2. Event expiry. A single elapsed-time check replaces the old setTimeout
  // clears, which raced when two events overlapped. Commands that resolve an
  // event early (ROBBER_CAUGHT, DISTRACT_INSPECTOR, …) null activeEvent
  // themselves; a stale eventClearAt is harmless once activeEvent is null.
  if (s.activeEvent && s.eventClearAt != null && elapsed >= s.eventClearAt) {
    s.activeEvent  = null;
    s.eventClearAt = null;
  }

  // 3. Rush wave drip — pending rush customers trickle in pre-annoyed.
  if (s.pendingRushSpawns > 0 && randomFloat() < SPAWN_RULES.rushDripChance) {
    spawnCustomerInto(s, policy, SPAWN_RULES.rushSpawn);
    s.pendingRushSpawns--;
  }

  // 4. Regular spawn, capped by how crowded the branch is.
  const inBranch = s.chars.filter(c => c.state !== "exited").length;
  const isRush   = s.activeEvent === "rush";
  if (randomFloat() < (isRush ? SPAWN_RULES.rushChance : SPAWN_RULES.baseChance)
      && inBranch < (isRush ? SPAWN_RULES.rushCap : SPAWN_RULES.baseCap)) {
    spawnCustomerInto(s, policy);
  }

  // 5. Evaluate and apply, one character at a time (deltas apply immediately
  // so later characters in the same tick see claimed slots/seats).
  const newChars = [];
  for (const char of s.chars) {
    const command = evaluateCharacter(char, s, policy);
    const { updatedChar, stateDeltas } = applyCommand(command, char, s);
    Object.entries(stateDeltas).forEach(([k, v]) => { s[k] = v; });
    if (command.type === "COMPLETE_SERVICE") {
      effects.coins.push({ gx: char.gx, gy: char.gy, amount: char.deposit });
    }
    if (updatedChar.state !== "exited") newChars.push(updatedChar);
  }
  s.chars = newChars;

  // 6. Ambient: interaction-window expiry, idle chatter, bubble countdown.
  for (const c of s.chars) tickAmbient(c, elapsed);

  return effects;
}

// Fires one branch event: applies resolveEvent's deltas, tags spawned
// characters with their clickable window, and arms the banner expiry.
function fireEvent(type, s, elapsed) {
  const { spawnedChars, stateDeltas } = resolveEvent(type, s);
  Object.entries(stateDeltas).forEach(([k, v]) => { s[k] = v; });
  spawnedChars.forEach(c => {
    const windowMs = c.role === "whale"  ? BRANCH_EVENTS.whale.resolution.interactWindowMs
                   : c.role === "robber" ? BRANCH_EVENTS.robbery.resolution.interactWindowMs
                   : null;
    if (windowMs != null) {
      c.interactable   = true;
      c.interactWindow = windowMs;
      c.interactUntil  = elapsed + windowMs;
    }
    s.chars.push(c);
    s.nextId++;
  });
  s.eventClearAt = elapsed + SIM_TIMING.eventBannerMs;
}

function spawnCustomerInto(s, policy, mood = null) {
  const c = createCustomer(s.nextId++, s.queueCounter % s.queueSlots.length, "customer", policy);
  s.chars.push(mood
    ? { ...c, frustration: mood.frustration, baseAnger: mood.baseAnger, emotion: "angry" }
    : c);
  s.queueCounter++;
}

// Per-character ambient upkeep. Runs after evaluate/apply each tick; the only
// other writer of character state is applyCommand.
function tickAmbient(c, elapsed) {
  if (c.interactable && c.interactUntil != null && elapsed > c.interactUntil) {
    c.interactable = false;
  }
  if (!c.bubble && randomFloat() < CHATTER.idleChance) {
    if (c.state === "served") {
      c.bubble = `+$${c.deposit.toLocaleString()}`;
      c.bubbleTimer = CHATTER.servedDeposit.ms;
    } else if (c.state === "waiting" && c.emotion === "angry") {
      c.bubble = pickRandom(CHATTER.waitingAngry.lines);
      c.bubbleTimer = CHATTER.waitingAngry.ms;
    } else if (c.state === "waiting" && c.emotion === "neutral") {
      c.bubble = pickRandom(CHATTER.waitingNeutral.lines);
      c.bubbleTimer = CHATTER.waitingNeutral.ms;
    }
  }
  if (c.bubbleTimer > 0) c.bubbleTimer -= SIM_TIMING.tickMs;
}

// Maps a clicked character to its interaction command. The boundary calls
// this, then routes the command through applyCommand like any other.
export function interactionCommandFor(char) {
  if (char.role === "whale")     return { type: "GREET_WHALE",         charId: char.id };
  if (char.role === "robber")    return { type: "DISPATCH_SECURITY",   charId: char.id };
  if (char.role === "inspector") return { type: "DISTRACT_INSPECTOR",  charId: char.id };
  return { type: "GREET_CUSTOMER", charId: char.id };
}

// ─── CHARACTER EVALUATION (pure) ─────────────────────────────────────────────
export function evaluateCharacter(char, simState, policy) {
  const { numTellers, activeEvent, loanOfficers, queueSlots, tellerSlots, exitPos, vaultPos } = simState;
  const beh     = CUSTOMER_BEHAVIOUR;
  const impacts = POLICY_IMPACTS;

  // Robber
  if (char.role === "robber") {
    const rob = BRANCH_EVENTS.robbery.resolution;
    if (char.state === "entering")
      return walkOrArrive(char, vaultPos, { type: "ROBBER_START_VAULT", charId: char.id }, SPEEDS.robberEnter);
    if (char.state === "robbing") {
      if (char.progress >= 1) return { type: "ROBBER_ESCAPE", charId: char.id };
      const baseChance = simState.securityCount > 0 ? rob.baseCatchChance : 0;
      const dispatchedChance = char.securityDispatched ? rob.dispatchedCatchChance : 0;
      const caught = randomFloat() < (baseChance + dispatchedChance);
      if (caught) return { type: "ROBBER_CAUGHT", charId: char.id };
      return { type: "ROBBER_PROGRESS", charId: char.id };
    }
    if (char.state === "leaving")
      return walkOrArrive(char, exitPos, { type: "EXIT", charId: char.id }, SPEEDS.robberLeave);
  }

  // Inspector
  if (char.role === "inspector") {
    if (char.state === "entering")
      return walkOrArrive(char, simState.managerPos, { type: "INSPECTOR_START", charId: char.id }, SPEEDS.inspector);
    if (char.state === "inspecting") {
      const wanders = char.wanderTargets || [];
      const idx     = char.wanderIdx    || 0;
      if (idx >= wanders.length) return { type: "INSPECTOR_DONE", charId: char.id };
      return walkOrArrive(char, wanders[idx].pos, { type: "INSPECTOR_WANDER_ARRIVE", charId: char.id }, SPEEDS.inspector);
    }
    if (char.state === "leaving")
      return walkOrArrive(char, exitPos, { type: "EXIT", charId: char.id }, SPEEDS.inspector);
  }

  // Customer
  const frustDelta = calcFrustrationDelta(policy, impacts);

  if (char.state === "entering") {
    const slot = queueSlots[Math.min(char.queuePos, queueSlots.length - 1)];
    if (!isNear(char, slot)) return { type: "MOVE", charId: char.id, target: slot, speed: SPEEDS.customerEnter };
    const free = findFreeSlot(char, simState);
    return free
      ? { type: "CLAIM_SLOT", charId: char.id, ...free }
      : { type: "JOIN_WAIT", charId: char.id };
  }

  if (char.state === "waiting") {
    // Priority 1: a teller/loan slot opened up — go serve. Releases held spots.
    if (activeEvent !== "outage") {
      const free = findFreeSlot(char, simState);
      if (free) return { type: "CLAIM_SLOT", charId: char.id, ...free };
    }
    // Priority 2: robbery flee.
    if (activeEvent === "robbery" && randomFloat() < beh.robberyFleeChance)
      return { type: "FLEE", charId: char.id, reason: "robbery" };
    // Priority 3: claim a free seat if standing — seats are strictly better
    // (slower frustration growth).
    if (char.seatId == null && simState.seatPositions && simState.seatPositions.length > 0) {
      const seatId = findFreeSeat(simState);
      if (seatId !== null) return { type: "CLAIM_SEAT", charId: char.id, seatId };
    }
    // Priority 4: walk to claimed seat.
    if (char.seatId != null && !char.seatedAt) {
      const seatPos = simState.seatPositions[char.seatId];
      if (!seatPos) return { type: "NOOP", charId: char.id };
      if (isNear(char, seatPos)) return { type: "ARRIVE_AT_SEAT", charId: char.id };
      return { type: "MOVE", charId: char.id, target: seatPos, speed: SPEEDS.customerWalk };
    }
    // Priority 5: hold a unique standing spot, computed from waiting order —
    // nothing to claim, nothing to leak. As earlier waiters get served, the
    // whole line shuffles forward, which reads as a real queue. (Replaced the
    // claimed-lobby-tile allocator: standing spots have no gameplay meaning,
    // so they don't need claim/release state. The per-tick collision rule
    // — Shape A — remains a ROADMAP alternative if transient overlap during
    // walks becomes a playtest complaint.)
    if (char.seatId == null) {
      const spot = standingSpotFor(char, simState);
      if (spot && !isNear(char, spot)) {
        return { type: "MOVE", charId: char.id, target: spot, speed: SPEEDS.customerWalk };
      }
    }
    // Priority 6: accrue frustration (slower if seated; faster during rush).
    const rushMult   = activeEvent === "rush" ? (beh.rushFrustrationMultiplier || 1) : 1;
    const seatedMult = char.seatedAt ? (beh.seatedFrustrationMultiplier ?? 1) : 1;
    const newFrust   = Math.min(1, char.frustration + frustDelta * rushMult * seatedMult + (char.baseAnger || 0) * 0.002);
    if (newFrust > beh.walkoutThreshold && randomFloat() < beh.walkoutProbability)
      return { type: "WALKOUT", charId: char.id };
    return { type: "UPDATE_FRUSTRATION", charId: char.id, newFrust,
             newEmotion: frustEmotion(newFrust, beh) };
  }

  if (char.state === "advancing") {
    const target = char.useLoanDesk ? simState.loanDeskPos : tellerSlots[char.tellerIndex];
    if (!target) return { type: "NOOP", charId: char.id };
    return viaPath(char, target, {
      type: "START_SERVICE", charId: char.id, tellerIndex: char.tellerIndex,
      hasLoan: char.useLoanDesk || (char.loanAmt > 0 && loanOfficers > 0),
    }, SPEEDS.customerAdvance);
  }

  if (char.state === "served") {
    if (char.progress >= 1)
      return { type: "COMPLETE_SERVICE", charId: char.id,
               deposit: char.deposit, hasLoan: char.loanAmt > 0 && loanOfficers > 0,
               isWhale: char.role === "whale" };
    return { type: "SERVICE_PROGRESS", charId: char.id };
  }

  if (char.state === "leaving" || char.state === "fleeing") {
    const exitSpeed = char.state === "fleeing" ? SPEEDS.customerFlee : SPEEDS.customerWalk;
    return viaPath(char, exitPos, { type: "EXIT", charId: char.id }, exitSpeed);
  }

  return { type: "NOOP", charId: char.id };
}

// ─── COMMAND APPLICATION ──────────────────────────────────────────────────────
export function applyCommand(command, char, simState) {
  switch (command.type) {
    case "MOVE":
      return { updatedChar: moveToward(char, command.target, command.speed), stateDeltas: {} };
    case "JOIN_WAIT":
      return { updatedChar: { ...char, state: "waiting", isMoving: false }, stateDeltas: {} };
    case "CLAIM_SLOT": {
      // Release whatever the customer holds (a seat, usually), then claim
      // the service spot they're heading to.
      const released = releaseHeldSpots(simState.occupancy, char);
      const occupancy = command.useLoanDesk
        ? claimSpot(released, "loanDesk", 0)
        : claimSpot(released, "teller", command.tellerIndex);
      return {
        updatedChar: {
          ...char,
          state: "advancing",
          tellerIndex: command.tellerIndex,
          useLoanDesk: command.useLoanDesk || false,
          isMoving: true,
          // Loan customers route around the left end of the teller counter.
          path: command.useLoanDesk ? [simState.loanBypassWaypoint] : [],
          seatId: null,
          seatedAt: false,
        },
        stateDeltas: { occupancy },
      };
    }
    case "CLAIM_SEAT":
      return {
        updatedChar: { ...char, seatId: command.seatId, seatedAt: false, isMoving: true },
        stateDeltas: { occupancy: claimSpot(simState.occupancy, "seat", command.seatId) },
      };
    case "ARRIVE_AT_SEAT":
      return { updatedChar: { ...char, seatedAt: true, isMoving: false }, stateDeltas: {} };
    case "UPDATE_FRUSTRATION":
      return { updatedChar: { ...char, frustration: command.newFrust, emotion: command.newEmotion, isMoving: false }, stateDeltas: {} };
    case "WALKOUT":
    case "FLEE": {
      // Same shape: customer abandons the bank. WALKOUT = frustration-driven
      // (angry, no bubble). FLEE = external trigger like a robbery (worried,
      // help bubble). Both release every held spot and bump the walkouts counter.
      const isFlee = command.type === "FLEE";
      return {
        updatedChar: {
          ...char,
          state: "fleeing", isMoving: true,
          seatId: null, seatedAt: false, tellerIndex: null, useLoanDesk: false,
          emotion: isFlee ? "worried" : "angry",
          bubble:      isFlee && command.reason === "robbery" ? "Help!" : null,
          bubbleTimer: isFlee && command.reason === "robbery" ? 1300   : 0,
        },
        stateDeltas: {
          walkouts:  simState.walkouts + 1,
          occupancy: releaseHeldSpots(simState.occupancy, char),
        },
      };
    }
    case "START_SERVICE":
      return { updatedChar: { ...char, state: "served", progress: 0, emotion: "happy", isMoving: false }, stateDeltas: { activeTellers: new Set([...simState.activeTellers, command.tellerIndex]) } };
    case "COMPLETE_SERVICE":
      return {
        updatedChar: {
          ...char,
          state: "leaving",
          emotion: "happy",
          isMoving: true,
          // Loan customers retrace the bypass waypoint on the way out.
          path: char.useLoanDesk ? [simState.loanBypassWaypoint] : [],
          tellerIndex: null,
          useLoanDesk: false,
        },
        stateDeltas: {
          served:      simState.served + 1,
          deposited:   simState.deposited + char.deposit,
          loans:       command.hasLoan ? simState.loans + 1 : simState.loans,
          whaleServed: command.isWhale ? true : simState.whaleServed,
          occupancy:   releaseHeldSpots(simState.occupancy, char),
        },
      };
    case "SERVICE_PROGRESS":
      return { updatedChar: { ...char, progress: char.progress + SPEEDS.serviceProgress, isMoving: false }, stateDeltas: {} };
    case "ROBBER_START_VAULT":
      return { updatedChar: { ...char, state: "robbing", progress: 0, isMoving: false }, stateDeltas: { vaultOpen: true } };
    case "ROBBER_PROGRESS":
      return { updatedChar: { ...char, progress: char.progress + SPEEDS.robberyProgress, isMoving: false }, stateDeltas: {} };
    case "ROBBER_ESCAPE": {
      const factor = typeof char.lossFactor === "number" ? char.lossFactor : 1;
      const loss = Math.round((BRANCH_EVENTS.robbery.resolution.baseLoss * factor) / (simState.vaultLevel || 1));
      return { updatedChar: { ...char, state: "leaving" }, stateDeltas: { robberyLoss: simState.robberyLoss + loss, vaultOpen: false, activeEvent: null } };
    }
    case "ROBBER_CAUGHT":
      return { updatedChar: { ...char, state: "leaving", emotion: "worried" }, stateDeltas: { robberCaught: true, vaultOpen: false, activeEvent: null } };
    case "INSPECTOR_START":
      return { updatedChar: { ...char, state: "inspecting", wanderIdx: 0, isMoving: false, bubble: "Are your records in order?", bubbleTimer: 2000 }, stateDeltas: {} };
    case "INSPECTOR_WANDER_ARRIVE": {
      const wander = (char.wanderTargets || [])[char.wanderIdx || 0];
      return { updatedChar: { ...char, wanderIdx: (char.wanderIdx || 0) + 1, isMoving: false, bubble: wander?.bubble || null, bubbleTimer: 2400 }, stateDeltas: {} };
    }
    case "INSPECTOR_DONE":
      return { updatedChar: { ...char, state: "leaving", emotion: "happy", isMoving: true }, stateDeltas: { inspectionDone: true, activeEvent: null } };
    case "PATH_NEXT":
      return { updatedChar: { ...char, path: (char.path || []).slice(1) }, stateDeltas: {} };
    case "EXIT":
      return { updatedChar: { ...char, state: "exited" }, stateDeltas: {} };

    // ── Player interactions (canvas clicks routed through the boundary) ──────
    case "GREET_CUSTOMER": {
      const beh         = CUSTOMER_BEHAVIOUR;
      const frustration = Math.max(0, (char.frustration || 0) - beh.greetFrustrationRelief);
      const baseAnger   = Math.max(0, (char.baseAnger   || 0) - beh.greetAngerRelief);
      return {
        updatedChar: {
          ...char, frustration, baseAnger,
          emotion:     frustration > 0.5 ? "neutral" : "happy",
          bubble:      pickRandom(CHATTER.greeted.lines),
          bubbleTimer: CHATTER.greeted.ms,
        },
        stateDeltas: { greets: (simState.greets || 0) + 1 },
      };
    }
    case "GREET_WHALE": {
      const res = BRANCH_EVENTS.whale.resolution;
      return {
        updatedChar: {
          ...char,
          interactable: false,
          deposit:      Math.round(char.deposit * res.greetDepositBoost),
          emotion:      "happy",
          bubble:       pickRandom(CHATTER.whaleGreeted.lines),
          bubbleTimer:  CHATTER.whaleGreeted.ms,
        },
        stateDeltas: {},
      };
    }
    case "DISPATCH_SECURITY": {
      const res = BRANCH_EVENTS.robbery.resolution;
      return {
        updatedChar: {
          ...char,
          securityDispatched: true,
          interactable:       false,
          lossFactor:         res.dispatchedLossFactor,
          bubble:             pickRandom(CHATTER.robberDispatched.lines),
          bubbleTimer:        CHATTER.robberDispatched.ms,
        },
        stateDeltas: {},
      };
    }
    case "DISTRACT_INSPECTOR":
      // Mirrors INSPECTOR_DONE's deltas — the old click path skipped
      // activeEvent, which left the inspection banner hanging on screen.
      return {
        updatedChar: {
          ...char,
          state: "leaving", emotion: "happy", isMoving: true,
          interactable: false,
          bubble:       pickRandom(CHATTER.inspectorDistracted.lines),
          bubbleTimer:  CHATTER.inspectorDistracted.ms,
        },
        stateDeltas: { inspectorDistracted: true, activeEvent: null },
      };
    default:
      return { updatedChar: char, stateDeltas: {} };
  }
}

// ─── EVENT SCHEDULING ────────────────────────────────────────────────────────
export function buildEventSchedule(era) {
  return Object.entries(BRANCH_EVENTS)
    .filter(([, def]) => era >= def.eraRange[0] && era <= def.eraRange[1])
    .filter(([,  def]) => randomFloat() <= def.triggerProbability)
    .map(([type, def]) => ({
      type,
      lifecycle: "pending",
      triggerAt: randomInt(def.timing.earliest, def.timing.latest),
      done:      false,
    }));
}

// ─── EVENT RESOLUTION ────────────────────────────────────────────────────────
export function resolveEvent(type, simState) {
  const spawnedChars = [];
  const stateDeltas  = { activeEvent: type };

  if (type === "robbery") {
    // Robber enters right door — sneaking in while customers use the left.
    // lossFactor defaults to 1 (full loss); DISPATCH_SECURITY lowers it.
    spawnedChars.push({ ...createCustomer(simState.nextId, 0, "robber"), gx: 4.0, gy: 5.9, lossFactor: 1, bubble: "FREEZE!", bubbleTimer: 2400 });
  }
  if (type === "inspection") {
    const wanders = [
      { pos: simState.tellerSlots[0], bubble: "Is this ledger up to date?" },
      { pos: simState.vaultPos,       bubble: "Interesting vault setup." },
    ];
    spawnedChars.push({
      ...createCustomer(simState.nextId, 0, "inspector"),
      gx: 2.5, gy: 5.85,
      bubble: "Inspection.", bubbleTimer: 2200,
      wanderTargets: wanders, wanderIdx: 0,
    });
  }
  if (type === "rush") {
    stateDeltas.pendingRushSpawns = BRANCH_EVENTS.rush.resolution.pendingSpawns;
  }
  if (type === "whale") {
    // VIP arrives through the right door
    spawnedChars.push({ ...createCustomer(simState.nextId, 0, "whale"), gx: 4.0, gy: 5.85, bubble: "I'd like a word.", bubbleTimer: 2400, queuePos: 0 });
  }

  return { spawnedChars, stateDeltas };
}

// ─── ERA PROGRESS ─────────────────────────────────────────────────────────────
// Each condition maps to a predicate. Adding a new gain/loss condition means
// adding one row here — the rules in config/progression.js stay pure data.
const GAIN_PREDICATES = {
  nim:         (r, _, fin) => fin.nim        >= r.threshold,
  served:      (r, day)    => day.served     >= r.threshold,
  car:         (r, _, fin) => fin.car        >= r.threshold,
  reputation:  (r, _, fin) => fin.reputation >= r.threshold,
  whaleServed: (_, day)    => day.whaleServed,
  noWalkouts:  (_, day)    => day.walkouts === 0,
};
const LOSS_PREDICATES = {
  robbed:     (_, day)     => day.robberyLoss    > 0,
  insFine:    (_, day)     => day.regulatoryFine > 0,
  walkouts:   (r, day)     => day.walkouts       > r.threshold,
  car:        (r, _, fin)  => fin.car            < r.threshold,
  nplRatio:   (r, _, fin)  => fin.nplRatio       > r.threshold,
  reputation: (r, _, fin)  => fin.reputation     < r.threshold,
};

export function calculateEraProgressDelta(dayResult, fin) {
  const sumIf = (rules, preds) => rules.reduce(
    (d, r) => preds[r.condition]?.(r, dayResult, fin) ? d + r.points : d, 0);
  return sumIf(ERA_PROGRESS_RULES.gains,  GAIN_PREDICATES)
       + sumIf(ERA_PROGRESS_RULES.losses, LOSS_PREDICATES);
}

// Applies the quarter's progress to the era bar. A full bar promotes the bank
// to the next era (capped by ERA_RULES) and resets progress — this is what
// unlocks era-2 events, security, vault upgrades, and seat purchases.
export function resolveEraTransition(era, progress) {
  const clamped = Math.min(100, Math.max(0, progress));
  if (clamped >= ERA_RULES.advanceAt && era < ERA_RULES.cap) {
    return { era: era + 1, eraProgress: 0, eraAdvanced: true };
  }
  return { era, eraProgress: clamped, eraAdvanced: false };
}

// ─── SPOT ALLOCATOR ──────────────────────────────────────────────────────────
// One claim/release mechanism for every claimable spot kind (teller, loanDesk,
// seat). Commands release via releaseHeldSpots — which frees *everything* the
// character holds — so a forgotten per-kind release can't leak a spot. This
// replaced three parallel Set-pairs (occupiedTellerSlots / occupiedSeats /
// occupiedLobby) that each exit path had to remember individually.

function claimSpot(occupancy, kind, spotId) {
  const next = { ...occupancy, [kind]: new Set(occupancy[kind]) };
  next[kind].add(spotId);
  return next;
}

// Which spots this character currently holds, derived from its own fields —
// the character is the single source of truth for its claims.
function heldSpots(char) {
  const held = [];
  if (char.seatId != null) held.push(["seat", char.seatId]);
  if (char.useLoanDesk) held.push(["loanDesk", 0]);
  else if (typeof char.tellerIndex === "number" && char.tellerIndex >= 0) held.push(["teller", char.tellerIndex]);
  return held;
}

function releaseHeldSpots(occupancy, char) {
  let next = occupancy;
  for (const [kind, spotId] of heldSpots(char)) {
    next = { ...next, [kind]: new Set(next[kind]) };
    next[kind].delete(spotId);
  }
  return next;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function findFreeSlot(char, simState) {
  const { numTellers, tellerSlots, occupancy, loanOfficers, loanDeskPos } = simState;
  if (char.loanAmt > 0 && loanOfficers > 0 && !occupancy.loanDesk.has(0) && loanDeskPos)
    return { tellerIndex: -1, useLoanDesk: true };
  for (let i = 0; i < Math.min(numTellers, tellerSlots.length); i++) {
    if (!occupancy.teller.has(i)) return { tellerIndex: i, useLoanDesk: false };
  }
  return null;
}

function findFreeSeat(simState) {
  const seats = simState.seatPositions || [];
  for (let i = 0; i < seats.length; i++) {
    if (!simState.occupancy.seat.has(i)) return i;
  }
  return null;
}

// Deterministic standing position for a waiting customer with no seat: the
// queue slots then the lobby tiles, assigned by arrival order among current
// standers. Pure layout — no claims, so nothing to release when they leave.
function standingSpotFor(char, simState) {
  const spots = [...(simState.queueSlots || []), ...(simState.lobbyPositions || [])];
  if (spots.length === 0) return null;
  const standing = (simState.chars || [])
    .filter(c => c.state === "waiting" && c.seatId == null
                 && c.role !== "robber" && c.role !== "inspector")
    .sort((a, b) => a.id - b.id);
  const idx = standing.findIndex(c => c.id === char.id);
  if (idx < 0) return null;
  return spots[Math.min(idx, spots.length - 1)];
}

function isNear(char, target) {
  const dx = target.gx - char.gx, dy = target.gy - char.gy;
  return Math.sqrt(dx*dx + dy*dy) < 0.09;
}

// Almost every state in evaluateCharacter follows the same shape: "if I'm at
// the target, fire an arrive command; otherwise keep walking toward it."
// One helper kills seven 2-line repeats and a footgun (the old MOVE_TO_EXIT
// command had a 1.4-default speed that produced the 2026-05-11 inspector bug).
function walkOrArrive(char, target, arriveCmd, speed) {
  return isNear(char, target)
    ? arriveCmd
    : { type: "MOVE", charId: char.id, target, speed };
}

// walkOrArrive through the character's pending path first. Consumes one
// waypoint at a time (PATH_NEXT), then heads for the final target. Replaced
// the single-use nextWaypoint/CLEAR_WAYPOINT machinery.
function viaPath(char, target, arriveCmd, speed) {
  const waypoint = char.path && char.path[0];
  return waypoint
    ? walkOrArrive(char, waypoint, { type: "PATH_NEXT", charId: char.id }, speed)
    : walkOrArrive(char, target, arriveCmd, speed);
}

function moveToward(char, target, speed = 0.032) {
  const dx = target.gx - char.gx, dy = target.gy - char.gy;
  const d  = Math.sqrt(dx*dx + dy*dy);
  if (d < 0.09) return { ...char, isMoving: false };
  const step = Math.min(d - 0.001, speed);
  return { ...char, gx: char.gx + (dx/d)*step, gy: char.gy + (dy/d)*step, isMoving: true };
}

function calcFrustrationDelta(policy, impacts) {
  let delta = 0;
  for (const r of impacts.frustration.depositRate) {
    if (r.below !== undefined && policy.depositRate < r.below) { delta += r.value; break; }
    if (r.default !== undefined) { delta += r.default; break; }
  }
  for (const r of impacts.frustration.lendingRate) {
    if (r.above !== undefined && policy.lendingRate > r.above) { delta += r.value; break; }
    if (r.default !== undefined) { delta += r.default; break; }
  }
  return delta * CUSTOMER_BEHAVIOUR.frustrationGrowthRate;
}

function frustEmotion(frustration, beh) {
  if (frustration > beh.angryThreshold)   return "angry";
  if (frustration > beh.worriedThreshold) return "worried";
  return "neutral";
}
