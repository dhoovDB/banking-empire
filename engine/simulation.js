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
    gx:          4.0 + (randomFloat() - 0.5) * 0.4,
    gy:          7.4,
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
  const { numTellers, activeEvent, loanOfficers, queueSlots, tellerSlots, exitPos, vaultPos, managerPos } = simState;
  const beh     = CUSTOMER_BEHAVIOUR;
  const impacts = POLICY_IMPACTS;

  // Robber
  if (char.role === "robber") {
    if (char.state === "entering") {
      return isNear(char, vaultPos)
        ? { type: "ROBBER_START_VAULT", charId: char.id }
        : { type: "MOVE", charId: char.id, target: vaultPos, speed: 0.038 };
    }
    if (char.state === "robbing") {
      if (char.progress >= 1) return { type: "ROBBER_ESCAPE", charId: char.id };
      const baseChance = simState.securityCount > 0 ? 0.008 : 0;
      const dispatchedChance = char.securityDispatched ? 0.05 : 0;
      const caught = randomFloat() < (baseChance + dispatchedChance);
      if (caught) return { type: "ROBBER_CAUGHT", charId: char.id };
      return { type: "ROBBER_PROGRESS", charId: char.id };
    }
    if (char.state === "leaving") return { type: "MOVE_TO_EXIT", charId: char.id, speed: 0.050 };
  }

  // Inspector
  if (char.role === "inspector") {
    if (char.state === "entering") {
      return isNear(char, managerPos)
        ? { type: "INSPECTOR_START", charId: char.id }
        : { type: "MOVE", charId: char.id, target: managerPos, speed: 0.028 };
    }
    if (char.state === "inspecting") {
      if (char.progress >= 1) return { type: "INSPECTOR_DONE", charId: char.id };
      return { type: "INSPECTOR_PROGRESS", charId: char.id };
    }
    if (char.state === "leaving") return { type: "MOVE_TO_EXIT", charId: char.id };
  }

  // Customer
  const frustDelta = calcFrustrationDelta(policy, impacts);

  if (char.state === "entering") {
    const slot = queueSlots[Math.min(char.queuePos, queueSlots.length - 1)];
    return isNear(char, slot)
      ? { type: "JOIN_QUEUE", charId: char.id }
      : { type: "MOVE", charId: char.id, target: slot, speed: 0.040 };
  }

  if (char.state === "queued") {
    const newFrust = Math.min(1, char.frustration + frustDelta + (char.baseAnger || 0) * 0.002);

    if (activeEvent === "robbery" && randomFloat() < 0.004)
      return { type: "FLEE", charId: char.id, reason: "robbery" };

    if (newFrust > beh.walkoutThreshold && randomFloat() < beh.walkoutProbability)
      return { type: "WALKOUT", charId: char.id };

    if (char.progress > 0.2 && activeEvent !== "outage") {
      const ti = char.id % Math.min(numTellers, tellerSlots.length);
      const slot = tellerSlots[ti];
      if (isNear(char, slot))
        return { type: "START_SERVICE", charId: char.id, tellerIndex: ti,
                 hasLoan: char.loanAmt > 0 && loanOfficers > 0 };
      return { type: "MOVE", charId: char.id, target: slot };
    }

    return { type: "UPDATE_FRUSTRATION", charId: char.id, newFrust,
             newEmotion: frustEmotion(newFrust, beh) };
  }

  if (char.state === "served") {
    if (char.progress >= 1)
      return { type: "COMPLETE_SERVICE", charId: char.id,
               deposit: char.deposit, hasLoan: char.loanAmt > 0 && loanOfficers > 0,
               isWhale: char.role === "whale" };
    return { type: "SERVICE_PROGRESS", charId: char.id };
  }

  if (char.state === "leaving" || char.state === "fleeing")
    return { type: "MOVE_TO_EXIT", charId: char.id,
             speed: char.state === "fleeing" ? 0.060 : 0.035 };

  return { type: "NOOP", charId: char.id };
}

// ─── COMMAND APPLICATION ──────────────────────────────────────────────────────
export function applyCommand(command, char, simState) {
  switch (command.type) {
    case "MOVE":
      return { updatedChar: moveToward(char, command.target, command.speed), stateDeltas: {} };
    case "MOVE_TO_EXIT":
      return { updatedChar: moveToward(char, simState.exitPos, command.speed || 1.4), stateDeltas: {} };
    case "JOIN_QUEUE":
      return { updatedChar: { ...char, state: "queued", progress: 0 }, stateDeltas: {} };
    case "UPDATE_FRUSTRATION":
      return { updatedChar: { ...char, frustration: command.newFrust, emotion: command.newEmotion, progress: char.progress + 0.003 }, stateDeltas: {} };
    case "WALKOUT":
      return { updatedChar: { ...char, state: "fleeing", emotion: "angry" }, stateDeltas: { walkouts: simState.walkouts + 1 } };
    case "FLEE":
      return { updatedChar: { ...char, state: "fleeing", emotion: "worried", bubble: command.reason === "robbery" ? "Help!" : null, bubbleTimer: 1300 }, stateDeltas: { walkouts: simState.walkouts + 1 } };
    case "START_SERVICE":
      return { updatedChar: { ...char, state: "served", progress: 0, emotion: "happy" }, stateDeltas: { activeTellers: new Set([...simState.activeTellers, command.tellerIndex]) } };
    case "COMPLETE_SERVICE":
      return { updatedChar: { ...char, state: "leaving", emotion: "happy" }, stateDeltas: { served: simState.served + 1, deposited: simState.deposited + char.deposit, loans: command.hasLoan ? simState.loans + 1 : simState.loans, whaleServed: command.isWhale ? true : simState.whaleServed } };
    case "SERVICE_PROGRESS":
      return { updatedChar: { ...char, progress: char.progress + 0.007 }, stateDeltas: {} };
    case "ROBBER_START_VAULT":
      return { updatedChar: { ...char, state: "robbing", progress: 0 }, stateDeltas: { vaultOpen: true } };
    case "ROBBER_PROGRESS":
      return { updatedChar: { ...char, progress: char.progress + 0.005 }, stateDeltas: {} };
    case "ROBBER_ESCAPE": {
      const factor = typeof char.lossFactor === "number" ? char.lossFactor : 1;
      const loss = Math.round((BRANCH_EVENTS.robbery.resolution.baseLoss * factor) / (simState.vaultLevel || 1));
      return { updatedChar: { ...char, state: "leaving" }, stateDeltas: { robberyLoss: simState.robberyLoss + loss, vaultOpen: false, activeEvent: null } };
    }
    case "ROBBER_CAUGHT":
      return { updatedChar: { ...char, state: "leaving", emotion: "worried" }, stateDeltas: { robberCaught: true, vaultOpen: false, activeEvent: null } };
    case "INSPECTOR_START":
      return { updatedChar: { ...char, state: "inspecting", progress: 0 }, stateDeltas: {} };
    case "INSPECTOR_PROGRESS":
      return { updatedChar: { ...char, progress: char.progress + 0.003 }, stateDeltas: {} };
    case "INSPECTOR_DONE":
      return { updatedChar: { ...char, state: "leaving", emotion: "happy" }, stateDeltas: { inspectionDone: true, activeEvent: null } };
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
    spawnedChars.push({ ...createCustomer(simState.nextId, 0, "robber"), gx: 4.0, gy: 7.6, bubble: "FREEZE!", bubbleTimer: 2400 });
  }
  if (type === "inspection") {
    spawnedChars.push({ ...createCustomer(simState.nextId, 0, "inspector"), gx: 4.0, gy: 7.5, bubble: "Inspection.", bubbleTimer: 2200 });
  }
  if (type === "rush") {
    stateDeltas.pendingRushSpawns = 8;
  }
  if (type === "whale") {
    spawnedChars.push({ ...createCustomer(simState.nextId, 0, "whale"), gx: 4.0, gy: 7.5, bubble: "I'd like a word.", bubbleTimer: 2400, queuePos: 0 });
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
function isNear(char, target) {
  const dx = target.gx - char.gx, dy = target.gy - char.gy;
  return Math.sqrt(dx*dx + dy*dy) < 0.09;
}

function moveToward(char, target, speed = 0.028) {
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
