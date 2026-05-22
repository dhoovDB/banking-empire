// ─── UI THEME ─────────────────────────────────────────────────────────────────
// Single source of truth for the bank's visual language. Every screen imports
// from here — the palette, the card/button chrome, and the KPI status colour.
// Before this module the palette and kpiColor were copy-pasted into all three
// screens, which is exactly how the event colours drifted apart. Diverging KPI
// row *layouts* (badge / row / card) still live in their own screens; only the
// shared primitives belong here.
import { KPI_DEFINITIONS } from "../config/economy.js";

export const C = {
  bg:     "#0f0d0b",
  panel:  "rgba(40,28,18,0.97)",
  border: "rgba(245,166,35,0.18)",
  text:   "#c8b99a",
  gold:   "#f5a623",
  dim:    "#7a6a5a",
  danger: "#ff6b6b",
  warn:   "#f5c842",
  good:   "#4ecdc4",
};

export const ERA_NAMES = { 1: "Community Bank", 2: "Regional Bank", 3: "Commercial Bank", 4: "National Bank" };

export const panel = {
  background: C.panel, border: `1px solid ${C.border}`,
  borderRadius: 8, padding: "16px 18px", marginBottom: 12,
};

export const btnSm = {
  width: 26, height: 26, border: `1px solid ${C.border}`,
  background: "rgba(245,166,35,0.08)", color: C.gold,
  borderRadius: 4, cursor: "pointer", fontSize: 14, lineHeight: 1,
};

// Maps a KPI value to a status colour using the warn/danger thresholds in
// config. `invert` flags KPIs where higher is worse (e.g. NPL ratio).
export function kpiColor(key, value) {
  const d = KPI_DEFINITIONS[key];
  if (!d) return C.text;
  if (d.invert) return value > d.danger ? C.danger : value > d.warn ? C.warn : C.good;
  return value < d.danger ? C.danger : value < d.warn ? C.warn : C.good;
}
