import React, { useState, useEffect, useRef, useCallback } from "react";
import { DEFAULT_FINANCIALS, DEFAULT_POLICY, SIM_TIMING } from "./config/economy.js";
import { DEFAULT_STAFF, DEFAULT_FACILITIES }              from "./config/characters.js";
import { EVT_DISPLAY, BRANCH_EVENTS }                     from "./config/events.js";
import { LOSS_CONDITIONS }                                from "./config/progression.js";
import {
  calculateQuarterlyPL, calculateNIM, calculateCAR,
  calculateOneTimeCosts, isLiquidityBreached, checkLossConditions,
} from "./engine/financials.js";
import {
  createDaySimState, tickSimulation, interactionCommandFor, applyCommand,
  calculateEraProgressDelta, resolveEraTransition, createStaffMember,
} from "./engine/simulation.js";
import { renderFrame, CANVAS_W, CANVAS_H, toIso } from "./renderer/canvas.js";

// Hit-test: returns the topmost clickable character near pixel (cssX, cssY).
// Lives here (not in canvas.js) because it's a calculation, not a draw call.
// Customers with `clicked: true` are excluded — one greet per customer.
function pickCharacter(chars, cssX, cssY, clickedCharIds = new Set()) {
  const candidates = [...chars]
    .filter(c => {
      if (c.state === "exited") return false;
      if (clickedCharIds.has(c.id)) return false;
      if (c.role === "inspector") return c.state === "inspecting";
      if (c.role === "whale" || c.role === "robber") return !!c.interactable;
      if (c.role === "customer") return c.state === "waiting";
      return false;
    })
    .sort((a, b) => (b.gx + b.gy) - (a.gx + a.gy));
  for (const c of candidates) {
    const { x, y } = toIso(c.gx, c.gy);
    const dx = cssX - x, dy = cssY - (y - 6);
    if (dx*dx/(16*16) + dy*dy/(24*24) <= 1) return c;
  }
  return null;
}
import { spawnCoins }                              from "./renderer/particles.js";
import SetupScreen                                 from "./ui/SetupScreen.jsx";
import SimScreen                                   from "./ui/SimScreen.jsx";
import ReportScreen                                from "./ui/ReportScreen.jsx";

// Branch floor positions live in config/layout.js — they are game rules, not
// React state. The discrete-claim (Shape B) design note for lobby tiles lives
// with the waiting-state priority order in engine/simulation.js.

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

  // Stable teller and loan officer rosters for the session
  const [tellerRoster] = useState(() =>
    Array.from({ length: 6 }, () => createStaffMember("teller", []))
  );
  const [loanOfficerRoster] = useState(() =>
    Array.from({ length: 1 }, () => createStaffMember("teller", []))
  );

  const canvasRef  = useRef(null);
  const animRef    = useRef(null);
  const simRef     = useRef(null);
  const simState   = useRef(null);
  const particles  = useRef([]);
  // Player interaction state — refs so we don't re-render every mouse move
  const hoverRef   = useRef(null);
  const greetCdRef = useRef(0);
  const bannerRef  = useRef(null); // last event type mirrored into React banner state
  const [greets, setGreets] = useState(0);

  // ── RENDER LOOP ──────────────────────────────────────────────────────────────
  // Never calls setState — pure canvas drawing.
  const renderLoop = useCallback((ts) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const s   = simState.current;
    if (!s) return;

    // Resolve hovered char from latest sim state
    const hovered = hoverRef.current
      ? s.chars.find(c => c.id === hoverRef.current) || null
      : null;

    renderFrame(ctx, {
      chars:         s.chars,
      staff,
      particles:     particles.current,
      activeEvent:   s.activeEvent,
      vaultOpen:     s.vaultOpen,
      activeTellers: s.activeTellers,
      queueSlots:    s.queueSlots,
      tellerSlots:   s.tellerSlots,
      loanDeskPos:   s.loanDeskPos,
      seatPositions: s.seatPositions ?? [],
      tellerRoster,
      loanOfficerRoster,
      hoveredChar:   hovered,
      simElapsed:    s.dayStart ? Date.now() - s.dayStart : 0,
    }, ts);

    animRef.current = requestAnimationFrame(renderLoop);
  }, [staff, tellerRoster, loanOfficerRoster]);

  // ── CANVAS POINTER HANDLERS ─────────────────────────────────────────────────
  const getCanvasPoint = (evt) => {
    const c = canvasRef.current;
    if (!c) return null;
    const rect = c.getBoundingClientRect();
    const sx = (evt.clientX - rect.left) * (CANVAS_W / rect.width);
    const sy = (evt.clientY - rect.top)  * (CANVAS_H / rect.height);
    return { x: sx, y: sy };
  };

  const handleCanvasMove = useCallback((evt) => {
    const s = simState.current; if (!s) return;
    const p = getCanvasPoint(evt); if (!p) return;
    const hit = pickCharacter(s.chars, p.x, p.y, s.clickedCharIds);
    hoverRef.current = hit ? hit.id : null;
    const c = canvasRef.current;
    if (c) c.style.cursor = hit ? "pointer" : "default";
  }, []);

  const handleCanvasLeave = useCallback(() => {
    hoverRef.current = null;
    const c = canvasRef.current; if (c) c.style.cursor = "default";
  }, []);

  const handleCanvasClick = useCallback((evt) => {
    const s = simState.current; if (!s) return;
    const now = Date.now();
    if (now < greetCdRef.current) return;
    const p = getCanvasPoint(evt); if (!p) return;
    const hit = pickCharacter(s.chars, p.x, p.y, s.clickedCharIds);
    if (!hit) return;

    greetCdRef.current = now + SIM_TIMING.greetCooldownMs;
    s.clickedCharIds.add(hit.id);

    // Interactions run through the same command pipeline as every other
    // character mutation — the engine owns the effects, this handler only
    // translates a click into a command and renders the feedback.
    const command = interactionCommandFor(hit);
    const { updatedChar, stateDeltas } = applyCommand(command, hit, s);
    Object.entries(stateDeltas).forEach(([k, v]) => { s[k] = v; });
    s.chars = s.chars.map(c => (c.id === hit.id ? updatedChar : c));

    const { x, y } = toIso(updatedChar.gx, updatedChar.gy);
    if (command.type === "GREET_WHALE") {
      particles.current.push(...spawnCoins(x, y - 14, 3));
      setSimLog(log => [...log, "VIP greeted — deposit boosted"]);
    } else if (command.type === "DISPATCH_SECURITY") {
      setSimLog(log => [...log, "Security dispatched — robbery loss reduced"]);
    } else if (command.type === "DISTRACT_INSPECTOR") {
      setSimLog(log => [...log, "Inspector distracted — fine reduced"]);
    } else {
      setGreets(s.greets);
      particles.current.push(...spawnCoins(x, y - 14, 1));
    }
  }, []);


  useEffect(() => {
    if (phase === "simulating") {
      animRef.current = requestAnimationFrame(renderLoop);
    }
    return () => cancelAnimationFrame(animRef.current);
  }, [phase, renderLoop]);

  // ── START SIMULATION ─────────────────────────────────────────────────────────
  const startSim = useCallback(() => {
    // Deduct hire/upgrade costs at the moment of transition so the SimScreen
    // HUD reflects post-deduction cash. QPL's cash equation adds this back to
    // avoid double-charging at finishDay; the P&L still surfaces it as a line.
    const setupCost = calculateOneTimeCosts(staff, fac, committed);
    if (setupCost > 0) setFin(f => ({ ...f, cash: f.cash - setupCost }));

    simState.current = createDaySimState({ fin, staff, fac, setupCost, dayStart: Date.now() });

    particles.current  = [];
    hoverRef.current   = null;
    greetCdRef.current = 0;
    bannerRef.current  = null;
    setGreets(0);
    setSimLog([]);
    setActiveEvt(null);
    setDayProg(0);
    setPhase("simulating");

    // The day loop is pure engine (tickSimulation). This interval only feeds
    // it wall-clock time and renders its effects into React state + particles.
    simRef.current = setInterval(() => {
      const s       = simState.current;
      const elapsed = Date.now() - s.dayStart;
      const fx      = tickSimulation(s, policy, elapsed);

      if (fx.dayOver) { clearInterval(simRef.current); finishDay(); return; }

      setDayProg(Math.min(1, elapsed / SIM_TIMING.dayLengthMs));

      if (fx.firedEvents.length > 0) {
        setSimLog(log => [...log,
          ...fx.firedEvents.map(t => `${EVT_DISPLAY[t]?.bannerLabel || t} — Q${fin.quarter}`)]);
      }
      fx.coins.forEach(({ gx, gy, amount }) => {
        const { x, y } = toIso(gx, gy);
        particles.current.push(...spawnCoins(x, y - 12, amount));
      });

      // Banner mirrors engine state: appears when an event fires, clears when
      // it expires or resolves early (robber caught, inspector distracted).
      if (s.activeEvent !== bannerRef.current) {
        bannerRef.current = s.activeEvent;
        setActiveEvt(s.activeEvent ? EVT_DISPLAY[s.activeEvent] : null);
      }
    }, SIM_TIMING.tickMs);
  }, [fin, staff, fac, policy, committed]);

  // ── FINISH DAY ───────────────────────────────────────────────────────────────
  function finishDay() {
    cancelAnimationFrame(animRef.current);
    const s = simState.current;

    const insRes         = BRANCH_EVENTS.inspection.resolution;
    const hadInspection  = s.events.some(e => e.type === "inspection" && e.done);
    const baseFine       = hadInspection && !s.inspectionDone ? insRes.fine : 0;
    const regulatoryFine = baseFine > 0 && s.inspectorDistracted
      ? Math.round(baseFine * insRes.distractedFineFactor) : baseFine;

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
    const eraTransition = resolveEraTransition(fin.era, fin.eraProgress + progressDelta);
    updatedFin.era         = eraTransition.era;
    updatedFin.eraProgress = eraTransition.eraProgress;

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
      eraAdvanced:   eraTransition.eraAdvanced,
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

  // Day counters are read straight off the sim ref at render time — the
  // dayProgress state update already re-renders this screen every tick.
  const s = simState.current;
  if (phase === "simulating") return (
    <SimScreen canvasRef={canvasRef} activeEvent={activeEvt} simLog={simLog}
      fin={fin} staff={staff} dayProgress={dayProg} greets={greets}
      day={{
        served:    s?.served    ?? 0,
        deposited: s?.deposited ?? 0,
        walkouts:  s?.walkouts  ?? 0,
        queue:     s?.chars.filter(c => c.state === "waiting").length ?? 0,
      }}
      onCanvasMove={handleCanvasMove}
      onCanvasLeave={handleCanvasLeave}
      onCanvasClick={handleCanvasClick} />
  );

  if (phase === "report" && report) return (
    <ReportScreen report={report} fin={fin}
      onNextQuarter={() => setPhase("setup")} onRestart={handleRestart} />
  );

  return null;
}
