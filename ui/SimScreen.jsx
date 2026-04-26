import React from "react";
import { CANVAS_W, CANVAS_H } from "../renderer/canvas.js";
import { KPI_DEFINITIONS }    from "../config/economy.js";

const C = {
  bg:     "#0f0d0b",
  panel:  "rgba(20,14,9,0.88)",
  border: "rgba(245,166,35,0.16)",
  text:   "#c8b99a",
  gold:   "#f5a623",
  dim:    "#6a5a4a",
  danger: "#ff6b6b",
  warn:   "#f5c842",
  good:   "#4ecdc4",
};

function kpiColor(key, value) {
  const d = KPI_DEFINITIONS[key];
  if (!d) return C.text;
  if (d.invert) return value > d.danger ? C.danger : value > d.warn ? C.warn : C.good;
  return value < d.danger ? C.danger : value < d.warn ? C.warn : C.good;
}

function KPIRow({ label, kpiKey, value, display }) {
  const color = kpiColor(kpiKey, value);
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12 }}>
      <span style={{ color: C.dim }}>{label}</span>
      <span style={{ color, fontWeight: 700 }}>{display}</span>
    </div>
  );
}

export default function SimScreen({ canvasRef, activeEvent, simLog, fin, staff, dayProgress }) {
  return (
    <div style={{ background: C.bg, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", fontFamily: "'Nunito', sans-serif", padding: "12px 16px" }}>

      {/* Top bar */}
      <div style={{ width: CANVAS_W, display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: C.dim }}>
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
          ⚠ {activeEvent.title}
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
          style={{ display: "block", borderRadius: 6, border: `1px solid ${C.border}` }} />

        <div style={{ width: 180, flexShrink: 0 }}>

          {/* KPIs */}
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 14px", marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: C.gold, fontWeight: 700, marginBottom: 10, letterSpacing: 0.5 }}>KPIs</div>
            <KPIRow label="Cash"       kpiKey="cash"       value={fin.cash}       display={`$${Math.round(fin.cash/1000)}k`} />
            <KPIRow label="NIM"        kpiKey="nim"        value={fin.nim}        display={`${(fin.nim||0).toFixed(2)}%`} />
            <KPIRow label="CAR"        kpiKey="car"        value={fin.car}        display={`${(fin.car||0).toFixed(1)}%`} />
            <KPIRow label="NPL"        kpiKey="npl"        value={fin.nplRatio}   display={`${(fin.nplRatio*100).toFixed(1)}%`} />
            <KPIRow label="Reputation" kpiKey="reputation" value={fin.reputation} display={`${fin.reputation}`} />
          </div>

          {/* Staff */}
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 14px", marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: C.gold, fontWeight: 700, marginBottom: 8, letterSpacing: 0.5 }}>STAFF</div>
            {[["Tellers", staff.tellers], ["Loan Officers", staff.loanOfficers], ["Security", staff.security]].map(([label, count]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: C.dim }}>{label}</span>
                <span style={{ color: count > 0 ? C.text : C.dim }}>{count}</span>
              </div>
            ))}
          </div>

          {/* Event log */}
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 14px" }}>
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
