import { CUSTOMER_BEHAVIOUR, POLICY_IMPACTS } from "../config/economy.js";
import { BRANCH_EVENTS }                      from "../config/events.js";
import { SKIN_TONES, HAIR_COLORS, STAFF_OUTFITS, ROLE_DEFAULTS, EMOTIONS } from "../config/characters.js";
import { ERA_PROGRESS_RULES }                 from "../config/progression.js";

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

// ─── CHARACTER FACTORY ────────────────────────────────────────────────────────
export function createCustomer(id, queuePos, role = "customer") {
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
    loanAmt:     randomFloat() > beh.loanApplicationChance
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

// ─── CHARACTER EVALUATION (pure) ─────────────────────────────────────────────
export function evaluateCharacter(char, simState, policy) {
  const { numTellers, activeEvent, loanOfficers, queueSlots, tellerSlots, exitPos } = simState;
  const beh     = CUSTOMER_BEHAVIOUR;
  const impacts = POLICY_IMPACTS;

  // Robber
  if (char.role === "robber") {
    if (char.state === "entering") {
      return isNear(char, vaultPos)
        ? { type: "ROBBER_START_VAULT", charId: char.id }
        : { type: "MOVE", charId: char.id, target: vaultPos, speed: 0.043 };
    }
    if (char.state === "robbing") {
      if (char.progress >= 1) return { type: "ROBBER_ESCAPE", charId: char.id };
      const baseChance = simState.securityCount > 0 ? 0.008 : 0;
      const dispatchedChance = char.securityDispatched ? 0.05 : 0;
      const caught = randomFloat() < (baseChance + dispatchedChance);
      if (caught) return { type: "ROBBER_CAUGHT", charId: char.id };
      return { type: "ROBBER_PROGRESS", charId: char.id };
    }
    if (char.state === "leaving") {
      if (isNear(char, exitPos)) return { type: "EXIT", charId: char.id };
      return { type: "MOVE_TO_EXIT", charId: char.id, speed: 0.056 };
    }
  }

  // Inspector
  if (char.role === "inspector") {
    if (char.state === "entering") {
      const dest = simState.managerPos;
      return isNear(char, dest)
        ? { type: "INSPECTOR_START", charId: char.id }
        : { type: "MOVE", charId: char.id, target: dest, speed: 0.032 };
    }
    if (char.state === "inspecting") {
      const wanders = char.wanderTargets || [];
      const idx     = char.wanderIdx    || 0;
      if (idx >= wanders.length) return { type: "INSPECTOR_DONE", charId: char.id };
      const target = wanders[idx].pos;
      if (isNear(char, target)) return { type: "INSPECTOR_WANDER_ARRIVE", charId: char.id };
      return { type: "MOVE", charId: char.id, target, speed: 0.032 };
    }
    if (char.state === "leaving") {
      if (isNear(char, exitPos)) return { type: "EXIT", charId: char.id };
      return { type: "MOVE_TO_EXIT", charId: char.id };
    }
  }

  // Customer
  const frustDelta = calcFrustrationDelta(policy, impacts);

  if (char.state === "entering") {
    const slot = queueSlots[Math.min(char.queuePos, queueSlots.length - 1)];
    if (!isNear(char, slot)) return { type: "MOVE", charId: char.id, target: slot, speed: 0.045 };
    const free = findFreeSlot(char, simState);
    return free
      ? { type: "CLAIM_SLOT", charId: char.id, ...free }
      : { type: "JOIN_WAIT", charId: char.id };
  }

  if (char.state === "waiting") {
    const newFrust = Math.min(1, char.frustration + frustDelta + (char.baseAnger || 0) * 0.002);
    if (activeEvent === "robbery" && randomFloat() < 0.004)
      return { type: "FLEE", charId: char.id, reason: "robbery" };
    if (newFrust > beh.walkoutThreshold && randomFloat() < beh.walkoutProbability)
      return { type: "WALKOUT", charId: char.id };
    if (activeEvent !== "outage") {
      const free = findFreeSlot(char, simState);
      if (free) return { type: "CLAIM_SLOT", charId: char.id, ...free };
    }
    return { type: "UPDATE_FRUSTRATION", charId: char.id, newFrust,
             newEmotion: frustEmotion(newFrust, beh) };
  }

  if (char.state === "advancing") {
    const target = char.useLoanDesk ? simState.loanDeskPos : tellerSlots[char.tellerIndex];
    if (!target) return { type: "NOOP", charId: char.id };
    if (isNear(char, target))
      return { type: "START_SERVICE", charId: char.id, tellerIndex: char.tellerIndex,
               hasLoan: char.useLoanDesk || (char.loanAmt > 0 && loanOfficers > 0) };
    return { type: "MOVE", charId: char.id, target, speed: 0.032 };
  }

  if (char.state === "served") {
    if (char.progress >= 1)
      return { type: "COMPLETE_SERVICE", charId: char.id,
               deposit: char.deposit, hasLoan: char.loanAmt > 0 && loanOfficers > 0,
               isWhale: char.role === "whale" };
    return { type: "SERVICE_PROGRESS", charId: char.id };
  }

  if (char.state === "leaving" || char.state === "fleeing") {
    if (isNear(char, exitPos)) return { type: "EXIT", charId: char.id };
    return { type: "MOVE_TO_EXIT", charId: char.id,
             speed: char.state === "fleeing" ? 0.062 : 0.040 };
  }

  return { type: "NOOP", charId: char.id };
}

// ─── COMMAND APPLICATION ──────────────────────────────────────────────────────
export function applyCommand(command, char, simState) {
  switch (command.type) {
    case "MOVE":
      return { updatedChar: moveToward(char, command.target, command.speed), stateDeltas: {} };
    case "MOVE_TO_EXIT":
      return { updatedChar: moveToward(char, simState.exitPos, command.speed || 1.4), stateDeltas: {} };
    case "JOIN_WAIT":
      return { updatedChar: { ...char, state: "waiting", isMoving: false }, stateDeltas: {} };
    case "CLAIM_SLOT": {
      const newOccupied = new Set(simState.occupiedTellerSlots);
      if (!command.useLoanDesk) newOccupied.add(command.tellerIndex);
      return {
        updatedChar: { ...char, state: "advancing", tellerIndex: command.tellerIndex, useLoanDesk: command.useLoanDesk || false, isMoving: true },
        stateDeltas: { occupiedTellerSlots: newOccupied, loanDeskOccupied: command.useLoanDesk ? true : simState.loanDeskOccupied },
      };
    }
    case "UPDATE_FRUSTRATION":
      return { updatedChar: { ...char, frustration: command.newFrust, emotion: command.newEmotion, isMoving: false }, stateDeltas: {} };
    case "WALKOUT":
      return { updatedChar: { ...char, state: "fleeing", emotion: "angry", isMoving: true }, stateDeltas: { walkouts: simState.walkouts + 1 } };
    case "FLEE":
      return { updatedChar: { ...char, state: "fleeing", emotion: "worried", bubble: command.reason === "robbery" ? "Help!" : null, bubbleTimer: 1300, isMoving: true }, stateDeltas: { walkouts: simState.walkouts + 1 } };
    case "START_SERVICE":
      return { updatedChar: { ...char, state: "served", progress: 0, emotion: "happy", isMoving: false }, stateDeltas: { activeTellers: new Set([...simState.activeTellers, command.tellerIndex]) } };
    case "COMPLETE_SERVICE": {
      const released = new Set(simState.occupiedTellerSlots);
      if (char.tellerIndex !== undefined && char.tellerIndex >= 0) released.delete(char.tellerIndex);
      return {
        updatedChar: { ...char, state: "leaving", emotion: "happy", isMoving: true },
        stateDeltas: {
          served:              simState.served + 1,
          deposited:           simState.deposited + char.deposit,
          loans:               command.hasLoan ? simState.loans + 1 : simState.loans,
          whaleServed:         command.isWhale ? true : simState.whaleServed,
          occupiedTellerSlots: released,
          loanDeskOccupied:    char.useLoanDesk ? false : simState.loanDeskOccupied,
        },
      };
    }
    case "SERVICE_PROGRESS":
      return { updatedChar: { ...char, progress: char.progress + 0.007, isMoving: false }, stateDeltas: {} };
    case "ROBBER_START_VAULT":
      return { updatedChar: { ...char, state: "robbing", progress: 0, isMoving: false }, stateDeltas: { vaultOpen: true } };
    case "ROBBER_PROGRESS":
      return { updatedChar: { ...char, progress: char.progress + 0.005, isMoving: false }, stateDeltas: {} };
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
    case "EXIT":
      return { updatedChar: { ...char, state: "exited" }, stateDeltas: {} };
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
    // Robber enters right door — sneaking in while customers use the left
    spawnedChars.push({ ...createCustomer(simState.nextId, 0, "robber"), gx: 4.0, gy: 5.9, bubble: "FREEZE!", bubbleTimer: 2400 });
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
    stateDeltas.pendingRushSpawns = 8;
  }
  if (type === "whale") {
    // VIP arrives through the right door
    spawnedChars.push({ ...createCustomer(simState.nextId, 0, "whale"), gx: 4.0, gy: 5.85, bubble: "I'd like a word.", bubbleTimer: 2400, queuePos: 0 });
  }

  return { spawnedChars, stateDeltas };
}

// ─── ERA PROGRESS ─────────────────────────────────────────────────────────────
export function calculateEraProgressDelta(dayResult, fin) {
  let delta = 0;
  for (const rule of ERA_PROGRESS_RULES.gains) {
    if (rule.condition === "nim"         && fin.nim        >= rule.threshold) delta += rule.points;
    if (rule.condition === "served"      && dayResult.served >= rule.threshold) delta += rule.points;
    if (rule.condition === "car"         && fin.car        >= rule.threshold) delta += rule.points;
    if (rule.condition === "reputation"  && fin.reputation >= rule.threshold) delta += rule.points;
    if (rule.condition === "whaleServed" && dayResult.whaleServed)            delta += rule.points;
    if (rule.condition === "noWalkouts"  && dayResult.walkouts === 0)         delta += rule.points;
  }
  for (const rule of ERA_PROGRESS_RULES.losses) {
    if (rule.condition === "robbed"     && dayResult.robberyLoss > 0)             delta += rule.points;
    if (rule.condition === "insFine"    && dayResult.regulatoryFine > 0)          delta += rule.points;
    if (rule.condition === "walkouts"   && dayResult.walkouts > rule.threshold)   delta += rule.points;
    if (rule.condition === "car"        && fin.car        < rule.threshold)       delta += rule.points;
    if (rule.condition === "nplRatio"   && fin.nplRatio   > rule.threshold)       delta += rule.points;
    if (rule.condition === "reputation" && fin.reputation < rule.threshold)       delta += rule.points;
  }
  return delta;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function findFreeSlot(char, simState) {
  const { numTellers, tellerSlots, occupiedTellerSlots, loanDeskOccupied, loanOfficers, loanDeskPos } = simState;
  if (char.loanAmt > 0 && loanOfficers > 0 && !loanDeskOccupied && loanDeskPos)
    return { tellerIndex: -1, useLoanDesk: true };
  for (let i = 0; i < Math.min(numTellers, tellerSlots.length); i++) {
    if (!occupiedTellerSlots.has(i)) return { tellerIndex: i, useLoanDesk: false };
  }
  return null;
}

function isNear(char, target) {
  const dx = target.gx - char.gx, dy = target.gy - char.gy;
  return Math.sqrt(dx*dx + dy*dy) < 0.09;
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
