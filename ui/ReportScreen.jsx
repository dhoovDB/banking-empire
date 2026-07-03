import React from "react";
import { KPI_DEFINITIONS } from "../config/economy.js";
import { EVT_DISPLAY } from "../config/events.js";
import { C, ERA_NAMES, panel, kpiColor } from "./theme.js";

function PLRow({ label, value, sub, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6, fontSize: 13, paddingLeft: sub ? 14 : 0 }}>
      <span style={{ color: sub ? C.dim : C.text }}>{label}</span>
      <span style={{ color: color || (value >= 0 ? C.good : C.danger), fontWeight: sub ? 400 : 600 }}>
        {value >= 0 ? "+" : "−"}${Math.abs(value).toLocaleString()}
      </span>
    </div>
  );
}

function KPICard({ label, kpiKey, value, display }) {
  const color = kpiColor(kpiKey, value);
  const d     = KPI_DEFINITIONS[kpiKey];
  return (
    <div style={{ background: "rgba(0,0,0,0.25)", borderRadius: 6, padding: "10px 12px" }}>
      <div style={{ fontSize: 10, color: C.dim, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color }}>{display}</div>
      {d?.warn && (
        <div style={{ fontSize: 10, color: C.dim, marginTop: 2 }}>
          warn &lt; {d.invert ? d.warn * 100 + "%" : d.warn} · danger &lt; {d.invert ? d.danger * 100 + "%" : d.danger}
        </div>
      )}
    </div>
  );
}

export default function ReportScreen({ report, fin, onNextQuarter, onRestart }) {
  const isGameOver = !!report.lossCondition;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Nunito', sans-serif", padding: "24px", maxWidth: 820, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, color: isGameOver ? C.danger : C.gold }}>
            {isGameOver ? report.lossCondition.title : `Q${fin.quarter > 1 ? fin.quarter - 1 : 4} Report Complete`}
          </h2>
          <div style={{ fontSize: 13, color: C.dim, marginTop: 2 }}>
            Era {fin.era}: {ERA_NAMES[fin.era]} · Year {fin.year}
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
          <button onClick={onRestart} style={{ padding: "9px 20px", background: "transparent", border: `1px solid ${C.border}`, color: C.dim, borderRadius: 6, cursor: "pointer", fontSize: 13 }}>
            Restart
          </button>
          {!isGameOver && (
            <button onClick={onNextQuarter} style={{ padding: "9px 24px", background: C.gold, color: "#0f0d0b", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 800 }}>
              Next Quarter →
            </button>
          )}
        </div>
      </div>

      {/* Loss condition */}
      {isGameOver && (
        <div style={{ ...panel, borderColor: C.danger + "55", background: "rgba(255,107,107,0.07)", marginBottom: 16 }}>
          <div style={{ fontSize: 14, color: C.danger, fontWeight: 700, marginBottom: 6 }}>Game Over</div>
          <div style={{ fontSize: 13 }}>{report.lossCondition.message}</div>
        </div>
      )}

      {/* Era advancement */}
      {!isGameOver && report.eraAdvanced && (
        <div style={{ ...panel, borderColor: C.gold + "66", background: "rgba(245,166,35,0.08)", marginBottom: 16 }}>
          <div style={{ fontSize: 14, color: C.gold, fontWeight: 700, marginBottom: 6 }}>
            ★ Era {fin.era} unlocked: {ERA_NAMES[fin.era]}
          </div>
          <div style={{ fontSize: 13 }}>
            Your bank has outgrown its first chapter. Robbers now know your vault
            exists — hire security and upgrade it. VIP depositors start walking
            in, your systems can fail, and you can finally expand the waiting
            area. Staff up before the trouble arrives.
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>

        {/* P&L */}
        <div style={panel}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.gold, marginBottom: 14 }}>Quarterly P&L</div>

          <div style={{ fontSize: 11, color: C.dim, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Income</div>
          <PLRow label="Interest income"     value={report.interestIncome}  sub />
          <PLRow label="Deposit growth"      value={report.depositGrowth}   sub />
          {report.whaleBonus > 0 && <PLRow label="VIP client bonus" value={report.whaleBonus} sub />}

          <div style={{ fontSize: 11, color: C.dim, marginBottom: 6, marginTop: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Expenses</div>
          <PLRow label="Interest expense"    value={-report.interestExpense}  sub />
          <PLRow label="NPL provisions"      value={-report.nplProvision}     sub />
          <PLRow label="Staff salaries"      value={-report.salaries}         sub />
          {report.robberyLoss > 0     && <PLRow label="Robbery loss"      value={-report.robberyLoss}     sub />}
          {report.regulatoryFine > 0  && <PLRow label="Regulatory fine"   value={-report.regulatoryFine}  sub />}
          {report.setupCost > 0       && <PLRow label="Setup costs"        value={-report.setupCost}       sub />}

          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10, marginTop: 10 }}>
            <PLRow label="Net income" value={report.netIncome} color={report.netIncome >= 0 ? C.good : C.danger} />
          </div>
        </div>

        {/* KPIs */}
        <div style={panel}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.gold, marginBottom: 14 }}>Key Metrics</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <KPICard label="NIM"        kpiKey="nim"        value={parseFloat(report.nim)}     display={`${report.nim}%`} />
            <KPICard label="CAR"        kpiKey="car"        value={parseFloat(report.car)}     display={`${report.car}%`} />
            <KPICard label="NPL Ratio"  kpiKey="npl"        value={fin.nplRatio}               display={`${(fin.nplRatio*100).toFixed(1)}%`} />
            <KPICard label="Reputation" kpiKey="reputation" value={fin.reputation}             display={`${fin.reputation}`} />
            <KPICard label="Cash"       kpiKey="cash"       value={fin.cash}                   display={`$${Math.round(fin.cash/1000)}k`} />
            <KPICard label="Equity"     kpiKey="car"        value={fin.equity > 0 ? 100 : 0}  display={`$${Math.round(fin.equity/1000)}k`} />
          </div>
        </div>

        {/* Quarter summary */}
        <div style={panel}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.gold, marginBottom: 14 }}>Quarter Summary</div>
          {[
            ["Customers served",  report.served],
            ["Deposits collected", `$${Math.round(report.deposited / 1000)}k`],
            ["Loans originated",   report.loans],
            ["Walk-outs",          report.walkouts],
          ].map(([label, value]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 7 }}>
              <span style={{ color: C.dim }}>{label}</span>
              <span style={{ color: C.text, fontWeight: 600 }}>{value}</span>
            </div>
          ))}

          {report.robberCaught && (
            <div style={{ fontSize: 12, color: C.good, marginTop: 6 }}>✓ Robber apprehended by security</div>
          )}
          {report.whaleServed && (
            <div style={{ fontSize: 12, color: C.gold, marginTop: 4 }}>★ VIP client served successfully</div>
          )}
        </div>

        {/* Events */}
        <div style={panel}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.gold, marginBottom: 14 }}>Events This Quarter</div>
          {report.events.length === 0
            ? <div style={{ fontSize: 13, color: C.dim }}>No events this quarter.</div>
            : report.events.map(type => (
                <div key={type} style={{ fontSize: 13, color: C.text, marginBottom: 6, paddingLeft: 10, borderLeft: `2px solid ${C.border}` }}>
                  {EVT_DISPLAY[type]?.reportLabel || type}
                </div>
              ))
          }
        </div>
      </div>

      {!isGameOver && (
        <div style={{ textAlign: "right", marginTop: 8 }}>
          <button onClick={onNextQuarter} style={{ padding: "12px 32px", background: C.gold, color: "#0f0d0b", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 15, fontWeight: 800 }}>
            Next Quarter →
          </button>
        </div>
      )}
    </div>
  );
}
