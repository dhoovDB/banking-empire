import { describe, it, expect } from "vitest";
import { BRANCH_EVENTS, EVT_DISPLAY } from "../config/events.js";

// Cross-layer consistency for the event display config. Before the 2026-05-29
// consolidation, three parallel maps (EVT_DISPLAY in config, EVENT_VISUALS in
// renderer/canvas.js, EVT_LABELS in ui/ReportScreen.jsx) described the same
// five events and their colors disagreed silently — robbery rendered #ff6b6b
// in the React HUD banner but #d96060 on the canvas. EVT_DISPLAY is now the
// single source. These tests guarantee that source is complete and well-formed
// so the renderer and UI can read from it without per-event fallbacks.

const COLOR_RX = /^#[0-9a-f]{6}$/i;

describe("event display config consistency", () => {
  it("every BRANCH_EVENTS key has a matching EVT_DISPLAY entry", () => {
    for (const eventKey of Object.keys(BRANCH_EVENTS)) {
      expect(
        EVT_DISPLAY[eventKey],
        `missing EVT_DISPLAY entry for "${eventKey}" — the renderer and UI will fall back to defaults`,
      ).toBeDefined();
    }
  });

  it("every EVT_DISPLAY entry has bannerLabel, reportLabel, color, description", () => {
    for (const [eventKey, display] of Object.entries(EVT_DISPLAY)) {
      expect(display.bannerLabel, `${eventKey}.bannerLabel`).toBeTypeOf("string");
      expect(display.bannerLabel.length, `${eventKey}.bannerLabel non-empty`).toBeGreaterThan(0);
      expect(display.reportLabel, `${eventKey}.reportLabel`).toBeTypeOf("string");
      expect(display.reportLabel.length, `${eventKey}.reportLabel non-empty`).toBeGreaterThan(0);
      expect(display.description, `${eventKey}.description`).toBeTypeOf("string");
      expect(display.color, `${eventKey}.color must be #rrggbb hex`).toMatch(COLOR_RX);
    }
  });

  it("border, when present, has color/width/dash fields", () => {
    for (const [eventKey, display] of Object.entries(EVT_DISPLAY)) {
      if (display.border === undefined || display.border === null) continue;
      expect(display.border.color, `${eventKey}.border.color`).toMatch(COLOR_RX);
      expect(display.border.width, `${eventKey}.border.width`).toBeTypeOf("number");
      expect(display.border.width, `${eventKey}.border.width > 0`).toBeGreaterThan(0);
      // dash may be null (solid border) or an array of dash/gap lengths
      if (display.border.dash !== null) {
        expect(Array.isArray(display.border.dash), `${eventKey}.border.dash`).toBe(true);
      }
    }
  });

  it("every EVT_DISPLAY key has a matching BRANCH_EVENTS entry (no orphan display)", () => {
    // Catches the reverse drift: a display entry for an event the engine no
    // longer fires. Less critical than the forward check above, but it keeps
    // EVT_DISPLAY honest as the spec.
    for (const displayKey of Object.keys(EVT_DISPLAY)) {
      expect(
        BRANCH_EVENTS[displayKey],
        `orphan EVT_DISPLAY entry for "${displayKey}" — no matching BRANCH_EVENTS event`,
      ).toBeDefined();
    }
  });
});
