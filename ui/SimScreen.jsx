import React from "react";
import { CANVAS_W, CANVAS_H } from "../renderer/canvas.js";
import { STAFF_DEFINITIONS } from "../config/characters.js";
import { C, ERA_NAMES, kpiColor } from "./theme.js";

function KPIRow({ label, kpiKey, value, display }) {
  const color = kpiColor(kpiKey, value);
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12 }}>
      <span style={{ color: C.dim }}>{label}</span>
      <span style={{ color, fontWeight: 700 }}>{display}</span>
    </div>
  );
}

export default function SimScreen({
  canvasRef, activeEvent, simLog, fin, staff, dayProgress,
  greets = 0, day = {}, onCanvasMove, onCanvasLeave, onCanvasClick,
}) {
  // Compact card for the 180px sidebar — tighter padding than the shared
  // `panel` token, which is sized for the full-width setup/report screens.
  const sidebarCard = {
    background: C.panel, border: `1px solid ${C.border}`,
    borderRadius: 8, padding: "12px 14px", marginBottom: 10,
  };
  return (
    <div style={{ background: C.bg, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", fontFamily: "'Nunito', sans-serif", padding: "12px 16px" }}>

      {/* Top bar */}
      <div style={{ width: CANVAS_W, display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: C.gold, fontWeight: 700, whiteSpace: "nowrap" }}>
          Era {fin.era}: {ERA_NAMES[fin.era]}
        </span>
        <span style={{ fontSize: 12, color: C.dim, whiteSpace: "nowrap" }}>
          Q{fin.quarter} · Year {fin.year}
        </span>
        <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3 }}>
          <div style={{
            height: "100%", width: `${dayProgress * 100}%`,
            background: dayProgress > 0.8 ? C.danger : dayProgress > 0.5 ? C.warn : C.gold,
            borderRadius: 3, transition: "width 0.1s",
          }} />
        </div>
        <span style={{ fontSize: 11, color: C.dim }}>{Math.round(dayProgress * 100)}%</span>
      </div>

      {/* Player tip / interaction hint */}
      <div style={{
        width: CANVAS_W, marginBottom: 8, padding: "6px 12px", borderRadius: 6,
        background: "rgba(184,145,80,0.10)", border: "1px solid rgba(184,145,80,0.25)",
        color: C.text, fontSize: 12, display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span>
          <span style={{ color: C.gold, fontWeight: 700 }}>Tip:</span>{" "}
          Click waiting customers to <em style={{ color: C.gold }}>greet</em> them.
          During events, click the <em style={{ color: "#f5c842" }}>VIP</em> for a deposit bonus,
          or the <em style={{ color: C.danger }}>robber</em> to send security — before their timer runs out.
        </span>
        <span style={{ color: C.gold, fontWeight: 700 }}>Greets: {greets}</span>
      </div>

      {/* Event alert */}
      {activeEvent && (
        <div style={{
          width: CANVAS_W, marginBottom: 8,
          padding: "8px 14px", borderRadius: 6,
          background: `${activeEvent.color || C.gold}18`,
          border: `1px solid ${activeEvent.color || C.gold}55`,
          color: activeEvent.color || C.gold,
          fontSize: 13, fontWeight: 700,
        }}>
          ⚠ {activeEvent.bannerLabel}
          {activeEvent.description && (
            <span style={{ fontWeight: 400, color: C.text, fontSize: 11, marginLeft: 8 }}>
              {activeEvent.description}
            </span>
          )}
        </div>
      )}

      {/* Canvas + sidebar */}
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H}
          onMouseMove={onCanvasMove}
          onMouseLeave={onCanvasLeave}
          onClick={onCanvasClick}
          style={{
            // CSS size stays in logical pixels; the render loop scales the
            // backing store by devicePixelRatio behind this fixed footprint.
            display: "block", width: CANVAS_W, height: CANVAS_H,
            borderRadius: 6, border: `1px solid ${C.border}`,
          }} />

        <div style={{ width: 180, flexShrink: 0 }}>

          {/* Today's counters — was a canvas-drawn HUD box; one display path now */}
          <div style={sidebarCard}>
            <div style={{ fontSize: 11, color: C.gold, fontWeight: 700, marginBottom: 10, letterSpacing: 0.5 }}>TODAY</div>
            {[
              ["Served",    day.served ?? 0],
              ["Deposits",  `$${Math.round((day.deposited ?? 0) / 1000)}k`],
              ["Walk-outs", day.walkouts ?? 0],
              ["In queue",  day.queue ?? 0],
            ].map(([label, value]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: C.dim }}>{label}</span>
                <span style={{ color: C.text, fontWeight: 700 }}>{value}</span>
              </div>
            ))}
          </div>

          {/* KPIs */}
          <div style={sidebarCard}>
            <div style={{ fontSize: 11, color: C.gold, fontWeight: 700, marginBottom: 10, letterSpacing: 0.5 }}>KPIs</div>
            <KPIRow label="Cash"       kpiKey="cash"       value={fin.cash}       display={`$${Math.round(fin.cash/1000)}k`} />
            <KPIRow label="NIM"        kpiKey="nim"        value={fin.nim}        display={`${(fin.nim||0).toFixed(2)}%`} />
            <KPIRow label="CAR"        kpiKey="car"        value={fin.car}        display={`${(fin.car||0).toFixed(1)}%`} />
            <KPIRow label="NPL"        kpiKey="npl"        value={fin.nplRatio}   display={`${(fin.nplRatio*100).toFixed(1)}%`} />
            <KPIRow label="Reputation" kpiKey="reputation" value={fin.reputation} display={`${fin.reputation}`} />
          </div>

          {/* Staff */}
          <div style={sidebarCard}>
            <div style={{ fontSize: 11, color: C.gold, fontWeight: 700, marginBottom: 8, letterSpacing: 0.5 }}>STAFF</div>
            {Object.entries(STAFF_DEFINITIONS).map(([role, def]) => {
              const count = staff[role] || 0;
              return (
                <div key={role} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: C.dim }}>{def.plural}</span>
                  <span style={{ color: count > 0 ? C.text : C.dim }}>{count}</span>
                </div>
              );
            })}
          </div>

          {/* Event log */}
          <div style={{ ...sidebarCard, marginBottom: 0 }}>
            <div style={{ fontSize: 11, color: C.gold, fontWeight: 700, marginBottom: 8, letterSpacing: 0.5 }}>LOG</div>
            {simLog.length === 0
              ? <div style={{ fontSize: 11, color: C.dim }}>No events yet</div>
              : simLog.slice(-6).map((entry, i) => (
                  <div key={i} style={{ fontSize: 11, color: C.dim, marginBottom: 3 }}>· {entry}</div>
                ))
            }
          </div>
        </div>
      </div>
    </div>
  );
}
