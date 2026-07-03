import React, { useMemo } from "react";
import { STAFF_DEFINITIONS } from "../config/characters.js";
import { KPI_DEFINITIONS } from "../config/economy.js";
import { calculateNIM, calculateCAR, calculateOneTimeCosts, calculateRecurringSalaries } from "../engine/financials.js";
import { C, ERA_NAMES, panel, btnSm, kpiColor } from "./theme.js";

// Threshold copy for the KPI reference table. Values live in KPI_DEFINITIONS;
// formatting is per-KPI because the units differ (dollars, %, points).
const KPI_THRESHOLD_FMT = {
  cash:       v => `$${Math.round(v / 1000)}k`,
  nim:        v => `${v}%`,
  car:        v => `${v}%`,
  npl:        v => `${v * 100}%`,
  reputation: v => `${v}`,
};

function kpiThresholdLabel(key, def) {
  const fmt = KPI_THRESHOLD_FMT[key] || (v => `${v}`);
  const cmp = def.invert ? ">" : "<";
  return `warn ${cmp} ${fmt(def.warn)} · danger ${cmp} ${fmt(def.danger)}`;
}

function KPIBadge({ label, value, display, kpiKey }) {
  const color = kpiColor(kpiKey, value);
  return (
    <div style={{ textAlign: "center", flex: 1 }}>
      <div style={{ fontSize: 11, color: C.dim, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color }}>{display}</div>
    </div>
  );
}

function Stepper({ label, value, min, max, cost, salary, tooltip, onChange }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: C.text }}>{label}</div>
          <div style={{ fontSize: 10, color: C.dim }}>Hire ${cost.toLocaleString()} · $${salary.toLocaleString()}/qtr</div>
        </div>
        <button onClick={() => onChange(Math.max(min, value - 1))} style={btnSm} disabled={value <= min}>−</button>
        <span style={{ width: 20, textAlign: "center", color: C.gold, fontWeight: 700 }}>{value}</span>
        <button onClick={() => onChange(Math.min(max, value + 1))} style={btnSm} disabled={value >= max}>+</button>
      </div>
      {tooltip && <div style={{ fontSize: 10, color: C.dim, marginTop: 4, lineHeight: 1.4 }}>{tooltip}</div>}
    </div>
  );
}

export default function SetupScreen({ fin, staff, fac, policy, committed, onStaffChange, onFacChange, onPolicyChange, onStartSim }) {
  const absQ    = (fin.year - 1) * 4 + fin.quarter;
  const projNIM = useMemo(
    () => calculateNIM(fin.loans, fin.deposits, policy.lendingRate, policy.depositRate),
    [fin.loans, fin.deposits, policy.lendingRate, policy.depositRate]
  );
  const projCAR    = calculateCAR(fin.equity, fin.loans);
  const setupCost  = calculateOneTimeCosts(staff, fac, committed);
  const salaries   = calculateRecurringSalaries(staff);
  const canAfford  = fin.cash >= setupCost;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Nunito', sans-serif", padding: "20px 24px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 20, color: C.gold, fontWeight: 800 }}>Banking Empire</h1>
        <span style={{ color: C.dim, fontSize: 13 }}>
          Quarter {fin.quarter} · Year {fin.year} · Q{absQ}/20
        </span>
        <span style={{ marginLeft: "auto", fontSize: 12, color: C.dim, background: "rgba(245,166,35,0.08)", padding: "3px 10px", borderRadius: 12, border: `1px solid ${C.border}` }}>
          Era {fin.era}: {ERA_NAMES[fin.era]}
        </span>
      </div>

      {/* Era progress */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.dim, marginBottom: 4 }}>
          <span>Era Progress</span><span>{Math.round(fin.eraProgress)}%</span>
        </div>
        <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3 }}>
          <div style={{ height: "100%", width: `${fin.eraProgress}%`, background: C.gold, borderRadius: 3, transition: "width 0.3s" }} />
        </div>
      </div>

      {/* KPI bar */}
      <div style={{ ...panel, display: "flex", gap: 12 }}>
        <KPIBadge label="Cash"       kpiKey="cash"       value={fin.cash}       display={`$${Math.round(fin.cash / 1000)}k`} />
        <KPIBadge label="NIM"        kpiKey="nim"        value={projNIM}        display={`${projNIM.toFixed(2)}%`} />
        <KPIBadge label="CAR"        kpiKey="car"        value={projCAR}        display={`${projCAR.toFixed(1)}%`} />
        <KPIBadge label="NPL Ratio"  kpiKey="npl"        value={fin.nplRatio}   display={`${(fin.nplRatio * 100).toFixed(1)}%`} />
        <KPIBadge label="Reputation" kpiKey="reputation" value={fin.reputation} display={`${fin.reputation}`} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>

        {/* Policy */}
        <div style={panel}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.gold, marginBottom: 12 }}>Interest Rates</div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
              <span>Lending Rate</span>
              <span style={{ color: C.gold, fontWeight: 700 }}>{policy.lendingRate.toFixed(1)}%</span>
            </div>
            <input type="range" min={3.0} max={12.0} step={0.1} value={policy.lendingRate}
              onChange={e => onPolicyChange("lendingRate", parseFloat(e.target.value))}
              style={{ width: "100%", accentColor: C.gold }} />
            <div style={{ fontSize: 10, color: C.dim }}>Higher rates → more income, but higher NPL risk and lower demand</div>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
              <span>Deposit Rate</span>
              <span style={{ color: C.gold, fontWeight: 700 }}>{policy.depositRate.toFixed(1)}%</span>
            </div>
            <input type="range" min={0.5} max={5.0} step={0.1} value={policy.depositRate}
              onChange={e => onPolicyChange("depositRate", parseFloat(e.target.value))}
              style={{ width: "100%", accentColor: C.gold }} />
            <div style={{ fontSize: 10, color: C.dim }}>Lower rates → less cost, but more customer frustration</div>
          </div>

          <div style={{ marginTop: 14, padding: "8px 10px", background: "rgba(0,0,0,0.25)", borderRadius: 6, fontSize: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: C.dim }}>Projected NIM</span>
              <span style={{ color: kpiColor("nim", projNIM), fontWeight: 700 }}>{projNIM.toFixed(2)}%</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
              <span style={{ color: C.dim }}>Spread</span>
              <span style={{ color: C.text }}>{(policy.lendingRate - policy.depositRate).toFixed(1)}pp</span>
            </div>
          </div>
        </div>

        {/* Staff */}
        <div style={panel}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.gold, marginBottom: 12 }}>Staff</div>
          {Object.entries(STAFF_DEFINITIONS).map(([role, def]) => (
            <Stepper key={role}
              label={def.label + "s"} value={staff[role]} min={0} max={def.max}
              cost={def.hireCost} salary={def.salary} tooltip={def.tooltip}
              onChange={v => onStaffChange(role, v)} />
          ))}
          <div style={{ marginTop: 8, fontSize: 11, color: C.dim, borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
            Quarterly salaries: <span style={{ color: C.text }}>${salaries.toLocaleString()}</span>
          </div>
        </div>

        {/* Facilities */}
        <div style={panel}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.gold, marginBottom: 12 }}>Facilities</div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: C.text, marginBottom: 6 }}>Vault Level</div>
            <div style={{ display: "flex", gap: 6 }}>
              {[
                { lvl: 1, label: "Basic",  unlockEra: 1 },
                { lvl: 2, label: "$8k",    unlockEra: 2 },
                { lvl: 3, label: "$20k",   unlockEra: 2 },
              ].map(({ lvl, label, unlockEra }) => {
                const locked = fin.era < unlockEra;
                return (
                  <button key={lvl}
                    onClick={locked ? undefined : () => onFacChange("vaultLevel", lvl)}
                    style={{
                      flex: 1, padding: "6px 0", borderRadius: 5, lineHeight: 1.3,
                      cursor:     locked ? "not-allowed" : "pointer",
                      opacity:    locked ? 0.4 : 1,
                      pointerEvents: locked ? "none" : "auto",
                      border:     locked
                                    ? `1px dashed ${C.dim}`
                                    : `1px solid ${fac.vaultLevel >= lvl ? C.gold : C.border}`,
                      background: locked ? "transparent"
                                    : fac.vaultLevel >= lvl ? "rgba(245,166,35,0.15)" : "transparent",
                      color:      locked ? C.dim
                                    : fac.vaultLevel >= lvl ? C.gold : C.dim,
                      fontSize:   locked ? 9 : 12,
                      fontWeight: !locked && fac.vaultLevel === lvl ? 700 : 400,
                    }}>
                    {locked ? `Unlocks Era ${unlockEra}` : label}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 10, color: C.dim, marginTop: 4 }}>Higher vault → lower robbery losses</div>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
              <span>Waiting Seats</span>
              <span style={{ color: fin.era < 2 ? C.dim : C.gold }}>
                {fin.era < 2 ? `${fac.waitingSeats} included` : `${fac.waitingSeats} × $500`}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, opacity: fin.era < 2 ? 0.4 : 1 }}>
              <button
                onClick={fin.era < 2 ? undefined : () => onFacChange("waitingSeats", Math.max(0, fac.waitingSeats - 1))}
                style={{ ...btnSm, cursor: fin.era < 2 ? "not-allowed" : "pointer", pointerEvents: fin.era < 2 ? "none" : "auto" }}
                disabled={fin.era < 2 || fac.waitingSeats <= 0}>−</button>
              <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3 }}>
                <div style={{ height: "100%", width: `${(fac.waitingSeats / 10) * 100}%`, background: C.gold, borderRadius: 3 }} />
              </div>
              <button
                onClick={fin.era < 2 ? undefined : () => onFacChange("waitingSeats", Math.min(10, fac.waitingSeats + 1))}
                style={{ ...btnSm, cursor: fin.era < 2 ? "not-allowed" : "pointer", pointerEvents: fin.era < 2 ? "none" : "auto" }}
                disabled={fin.era < 2 || fac.waitingSeats >= 10}>+</button>
            </div>
            <div style={{ fontSize: 10, color: C.dim, marginTop: 4 }}>
              {fin.era < 2
                ? "Unlocks Era 2 — era 1 includes 3 seats. More seats → less frustration during rush events."
                : "More seats → less frustration during rush events"}
            </div>
          </div>

          <div style={{ marginTop: 14, padding: "8px 10px", background: "rgba(0,0,0,0.25)", borderRadius: 6, fontSize: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: C.dim }}>Deposits</span>
              <span>${Math.round(fin.deposits / 1000)}k</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
              <span style={{ color: C.dim }}>Loans outstanding</span>
              <span>${Math.round(fin.loans / 1000)}k</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
              <span style={{ color: C.dim }}>Equity</span>
              <span style={{ color: fin.equity < 0 ? C.danger : C.text }}>${Math.round(fin.equity / 1000)}k</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 4 }}>
        <div style={{ flex: 1, fontSize: 12, color: setupCost > 0 ? (canAfford ? C.text : C.danger) : C.dim }}>
          {setupCost > 0
            ? `Setup cost this quarter: $${setupCost.toLocaleString()}${!canAfford ? " — insufficient cash" : ""}`
            : "No new hires or upgrades this quarter"}
        </div>
        <button
          onClick={onStartSim}
          disabled={!canAfford && setupCost > 0}
          style={{
            padding: "12px 32px", fontSize: 15, fontWeight: 800,
            background: canAfford ? C.gold : C.dim,
            color: "#0f0d0b", border: "none", borderRadius: 8,
            cursor: canAfford ? "pointer" : "not-allowed", letterSpacing: 0.5,
          }}>
          Start Q{fin.quarter} ▶
        </button>
      </div>

      {/* KPI reference — what the numbers at the top actually mean */}
      <div style={{ ...panel, marginTop: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.gold, marginBottom: 12 }}>
          What these numbers mean
        </div>
        {Object.entries(KPI_DEFINITIONS).map(([key, def], i) => (
          <div key={key} style={{
            display: "grid", gridTemplateColumns: "170px 1fr 170px", gap: 12,
            padding: "10px 0", alignItems: "baseline",
            borderTop: i > 0 ? `1px solid rgba(255,255,255,0.06)` : "none",
          }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{def.label}</div>
              <div style={{ fontSize: 10, color: C.dim, marginTop: 2 }}>{def.formula}</div>
            </div>
            <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.5 }}>
              {def.explain}
              {def.educationalLink && (
                <>{" "}
                  <a href={def.educationalLink} target="_blank" rel="noreferrer"
                     style={{ color: C.gold, textDecoration: "none" }}>
                    Learn more ↗
                  </a>
                </>
              )}
            </div>
            <div style={{ fontSize: 11, color: C.dim, textAlign: "right" }}>
              {kpiThresholdLabel(key, def)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
