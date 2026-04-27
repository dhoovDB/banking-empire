import React, { useState, useEffect, useRef, useCallback } from "react";
import { DEFAULT_FINANCIALS, DEFAULT_POLICY, POLICY_IMPACTS, CUSTOMER_BEHAVIOUR } from "./config/economy.js";
import { DEFAULT_STAFF, DEFAULT_FACILITIES }                                        from "./config/characters.js";
import { EVT_DISPLAY }                                                             from "./config/events.js";
import { LOSS_CONDITIONS, QUARTER_MILESTONES }                                     from "./config/progression.js";
import {
  calculateQuarterlyPL, calculateNIM, calculateCAR,
  calculateOneTimeCosts, isLiquidityBreached, checkLossConditions,
} from "./engine/financials.js";
import {
  buildEventSchedule, resolveEvent,
  evaluateCharacter, applyCommand,
  calculateEraProgressDelta, createCustomer, createStaffMember,
  randomFloat, randomInt,
} from "./engine/simulation.js";
import { renderFrame, CANVAS_W, CANVAS_H, toIso } from "./renderer/canvas.js";
import { spawnCoins }                              from "./renderer/particles.js";
import SetupScreen                                 from "./ui/SetupScreen.jsx";
import SimScreen                                   from "./ui/SimScreen.jsx";
import ReportScreen                                from "./ui/ReportScreen.jsx";

// ─── LAYOUT CONSTANTS ────────────────────────────────────────────────────────
const QUEUE_SLOTS = [
  {gx:3.9,gy:5.5},{gx:3.5,gy:5.7},{gx:4.3,gy:5.7},{gx:3.1,gy:5.9},
  {gx:3.9,gy:5.9},{gx:4.7,gy:5.9},{gx:3.5,gy:6.1},{gx:4.3,gy:6.1},
  {gx:3.0,gy:6.1},{gx:5.0,gy:6.1},
];
const TELLER_SLOTS = [
  {gx:3.3,gy:3.4},{gx:4.0,gy:3.25},{gx:4.7,gy:3.4},
  {gx:5.4,gy:3.25},{gx:6.1,gy:3.4},{gx:6.8,gy:3.25},
];
const EXIT_POS   = {gx:8.2, gy:6.0};
const VAULT_POS  = {gx:7.4, gy:2.3};
const MGR_POS    = {gx:1.6, gy:2.4};

// ─── INITIAL STATE ────────────────────────────────────────────────────────────
const makeInitial = () => ({
  fin:       { ...DEFAULT_FINANCIALS },
  staff:     { ...DEFAULT_STAFF },
  fac:       { ...DEFAULT_FACILITIES },
  policy:    { ...DEFAULT_POLICY },
  committed: { staff: { ...DEFAULT_STAFF }, fac: { ...DEFAULT_FACILITIES } },
});

// ─── COMPONENT ────────────────────────────────────────────────────────────────
export default function BankingEmpire() {
  const init = makeInitial();
  const [phase,     setPhase]     = useState("setup");
  const [fin,       setFin]       = useState(init.fin);
  const [staff,     setStaff]     = useState(init.staff);
  const [fac,       setFac]       = useState(init.fac);
  const [policy,    setPolicy]    = useState(init.policy);
  const [committed, setCommitted] = useState(init.committed);
  const [simLog,    setSimLog]    = useState([]);
  const [activeEvt, setActiveEvt] = useState(null);
  const [dayProg,   setDayProg]   = useState(0);
  const [report,    setReport]    = useState(null);
  const [history,   setHistory]   = useState([]);

  // Stable teller roster for the session
  const [tellerRoster] = useState(() =>
    Array.from({ length: 6 }, () => createStaffMember("teller", []))
  );

  const canvasRef  = useRef(null);
  const animRef    = useRef(null);
  const simRef     = useRef(null);
  const simState   = useRef(null);
  const particles  = useRef([]);

  // ── RENDER LOOP ──────────────────────────────────────────────────────────────
  // Never calls setState — pure canvas drawing.
  const renderLoop = useCallback((ts) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const s   = simState.current;
    if (!s) return;

    renderFrame(ctx, {
      chars:         s.chars,
      staff,
      particles:     particles.current,
      activeEvent:   s.activeEvent,
      vaultOpen:     s.vaultOpen,
      activeTellers: s.activeTellers,
      hudState: {
        served:      s.served,
        deposited:   s.deposited,
        walkouts:    s.walkouts,
        queueLength: s.chars.filter(c => c.state === "queued").length,
      },
      queueSlots:   QUEUE_SLOTS,
      tellerSlots:  TELLER_SLOTS,
      tellerRoster,
    }, ts);

    animRef.current = requestAnimationFrame(renderLoop);
  }, [staff, tellerRoster]);

  useEffect(() => {
    if (phase === "simulating") {
      animRef.current = requestAnimationFrame(renderLoop);
    }
    return () => cancelAnimationFrame(animRef.current);
  }, [phase, renderLoop]);

  // ── START SIMULATION ─────────────────────────────────────────────────────────
  const startSim = useCallback(() => {
    simState.current = {
      chars:          [],
      nextId:         0,
      dayStart:       Date.now(),
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
      vaultOpen:      false,
      vaultLevel:     fac.vaultLevel,
      securityCount:  staff.security,
      loanOfficers:   staff.loanOfficers,
      numTellers:     staff.tellers,
      events:         buildEventSchedule(fin.era),
      queueCounter:   0,
      queueSlots:     QUEUE_SLOTS,
      tellerSlots:    TELLER_SLOTS,
      exitPos:        EXIT_POS,
      vaultPos:       VAULT_POS,
      managerPos:     MGR_POS,
      pendingRushSpawns: 0,
      setupCost:         calculateOneTimeCosts(staff, fac, committed),
    };

    particles.current = [];
    setSimLog([]);
    setActiveEvt(null);
    setDayProg(0);
    setPhase("simulating");

    // Check for milestone-triggered inspection
    const absQ = (fin.year - 1) * 4 + fin.quarter;
    const milestone = QUARTER_MILESTONES[absQ];
    if (milestone?.forceInspection && randomFloat() < milestone.inspectionProb) {
      simState.current.events.push({ type:"inspection", triggerAt:15000, done:false });
    }

    simRef.current = setInterval(() => {
      const s       = simState.current;
      const elapsed = Date.now() - s.dayStart;

      if (elapsed >= 75000) { clearInterval(simRef.current); finishDay(); return; }

      setDayProg(Math.min(1, elapsed / 75000));

      // Fire scheduled events
      for (const ev of s.events) {
        if (!ev.done && ev.triggerAt <= elapsed) {
          ev.done = true;
          fireEvent(ev.type, s);
        }
      }

      // Rush wave spawning
      if (s.pendingRushSpawns > 0 && randomFloat() < 0.35) {
        spawnRushCustomer(s);
        s.pendingRushSpawns--;
      }

      // Regular customer spawn
      const inBranch = s.chars.filter(c => c.state !== "exited").length;
      const isRush   = s.activeEvent === "rush";
      if (randomFloat() < (isRush ? 0.26 : 0.042) && inBranch < (isRush ? 18 : 7)) {
        spawnCustomer(s);
      }

      // Tick characters
      const newChars = [];
      for (const char of s.chars) {
        const command = evaluateCharacter(char, s, policy);
        const { updatedChar, stateDeltas } = applyCommand(command, char, s);

        // Apply state deltas
        Object.entries(stateDeltas).forEach(([k, v]) => { s[k] = v; });

        // Coin particles on service complete
        if (command.type === "COMPLETE_SERVICE") {
          const { x, y } = toIso(char.gx, char.gy);
          particles.current.push(...spawnCoins(x, y - 12, char.deposit));
        }

        if (updatedChar.state !== "exited") newChars.push(updatedChar);
      }
      s.chars = newChars;

      // Bubble ticks
      s.chars.forEach(c => {
        if (!c.bubble && randomFloat() < 0.003) {
          if (c.state === "served") {
            c.bubble = `+$${c.deposit.toLocaleString()}`; c.bubbleTimer = 1900;
          } else if (c.state === "queued" && c.emotion === "angry") {
            c.bubble = ["Come ON!","Hurry up!","Seriously?!","I'm late!"][Math.floor(Math.random()*4)];
            c.bubbleTimer = 1700;
          } else if (c.state === "queued" && c.emotion === "neutral") {
            c.bubble = ["Good morning","Need a loan...","Hello!"][Math.floor(Math.random()*3)];
            c.bubbleTimer = 1500;
          }
        }
        if (c.bubbleTimer > 0) c.bubbleTimer -= 100;
      });
    }, 100);
  }, [fin, staff, fac, policy]);

  // ── EVENT HELPERS ────────────────────────────────────────────────────────────
  function fireEvent(type, s) {
    const { spawnedChars, stateDeltas } = resolveEvent(type, s);
    Object.entries(stateDeltas).forEach(([k, v]) => { s[k] = v; });
    spawnedChars.forEach(c => { s.chars.push(c); s.nextId++; });

    const evtDef = EVT_DISPLAY[type];
    if (evtDef) setActiveEvt(evtDef);
    setSimLog(log => [...log, `${evtDef?.title || type} — Q${fin.quarter}`]);

    setTimeout(() => {
      if (s.activeEvent === type) s.activeEvent = null;
      setActiveEvt(null);
    }, 12000);
  }

  function spawnCustomer(s) {
    const id = s.nextId++;
    s.chars.push(createCustomer(id, s.queueCounter % QUEUE_SLOTS.length));
    s.queueCounter++;
  }

  function spawnRushCustomer(s) {
    const id = s.nextId++;
    const c  = createCustomer(id, s.queueCounter % QUEUE_SLOTS.length);
    s.chars.push({ ...c, frustration:0.6, baseAnger:0.45, emotion:"angry" });
    s.queueCounter++;
  }

  // ── FINISH DAY ───────────────────────────────────────────────────────────────
  function finishDay() {
    cancelAnimationFrame(animRef.current);
    const s = simState.current;

    const hadInspection   = s.events.some(e => e.type === "inspection" && e.done);
    const regulatoryFine  = hadInspection && !s.inspectionDone ? 2500 : 0;

    const dayResult = {
      served:         s.served,
      deposited:      s.deposited,
      loans:          s.loans,
      walkouts:       s.walkouts,
      robberyLoss:    s.robberyLoss,
      regulatoryFine,
      setupCost:      s.setupCost,
      robberCaught:   s.robberCaught,
      whaleServed:    s.whaleServed,
    };

    const pl = calculateQuarterlyPL(fin, policy, staff, dayResult);

    const nim = calculateNIM(pl.updatedFin.loans, pl.updatedFin.deposits, policy.lendingRate, policy.depositRate);
    const car = calculateCAR(pl.updatedFin.equity, pl.updatedFin.loans);
    const updatedFin = { ...pl.updatedFin, nim, car };

    const progressDelta = calculateEraProgressDelta(dayResult, updatedFin);
    updatedFin.eraProgress = Math.min(100, Math.max(0, fin.eraProgress + progressDelta));

    const newHistory    = [...history, { ...updatedFin }].slice(-8);
    const lossCondition = checkLossConditions(updatedFin, newHistory, LOSS_CONDITIONS);

    setFin(updatedFin);
    setHistory(newHistory);
    setCommitted({ staff: { ...staff }, fac: { ...fac } });
    setReport({
      ...dayResult,
      ...pl,
      nim:           nim.toFixed(2),
      car:           car.toFixed(1),
      events:        s.events.filter(e => e.done).map(e => e.type),
      lossCondition: lossCondition || null,
    });
    setPhase("report");
    setActiveEvt(null);
  }

  // ── CALLBACKS ────────────────────────────────────────────────────────────────
  const handleStaffChange  = useCallback((role, value) => setStaff(s => ({ ...s, [role]: value })), []);
  const handleFacChange    = useCallback((key,  value) => setFac(f   => ({ ...f, [key]:  value })), []);
  const handlePolicyChange = useCallback((key,  value) => setPolicy(p => ({ ...p, [key]: value })), []);

  const handleRestart = useCallback(() => {
    const i = makeInitial();
    setFin(i.fin); setStaff(i.staff); setFac(i.fac);
    setPolicy(i.policy); setCommitted(i.committed);
    setHistory([]); setPhase("setup");
  }, []);

  // ── SCREEN SWITCH ────────────────────────────────────────────────────────────
  if (phase === "setup") return (
    <SetupScreen fin={fin} staff={staff} fac={fac} policy={policy} committed={committed}
      onStaffChange={handleStaffChange} onFacChange={handleFacChange}
      onPolicyChange={handlePolicyChange} onStartSim={startSim} />
  );

  if (phase === "simulating") return (
    <SimScreen canvasRef={canvasRef} activeEvent={activeEvt} simLog={simLog}
      fin={fin} staff={staff} dayProgress={dayProg} />
  );

  if (phase === "report" && report) return (
    <ReportScreen report={report} fin={fin}
      onNextQuarter={() => setPhase("setup")} onRestart={handleRestart} />
  );

  return null;
}
