import { EMOTIONS } from "../config/characters.js";
import { tickParticles } from "./particles.js";

export const CANVAS_W = 1080;
export const CANVAS_H = 640;

const ISO_TW = 192;
const ISO_TH = 96;

// Single coherent unit for ALL furniture sizing.
// Previously some objects used a 2x inflation (S = ISO_TW/72) while characters
// and small props used raw pixels — that mismatch made desks/vault feel like
// they were on a different floor. We now express everything in tile-fractions
// and only convert to pixels via the iso transform.
const U = ISO_TW / 6; // ≈ 24px per "small unit" — matches character footprint

// ─── REFINED PALETTE — modern marble-and-walnut bank ─────────────────────────
const PAL = {
  // Two subtle marble tones for the public floor — alternating like real polished tile
  floorA:    "#d8d2c4",
  floorB:    "#cec8b8",
  // Carpet runners for working zones (warm taupe, low chroma)
  carpetA:   "#8a6f55",
  carpetB:   "#7e6349",
  // Manager nook — quiet inkwell teal carpet
  manager:   "#2f3a3d",
  managerAlt:"#293235",
  // Security strip — graphite
  security:  "#3a3530",
  securityAlt:"#332e2a",
  // Vault alcove — cool deep slate (no more cartoon red)
  vault:     "#2b3036",
  vaultAlt:  "#252a30",
  // Walls
  wallL:     "#3b322a",
  wallR:     "#2d251f",
  floorLine: "rgba(0,0,0,0.06)",
  bg:        "#0e0d0c",
  // Accents
  brass:     "#b89150",
  brassDk:   "#8a6a36",
  walnut:    "#5a3a22",
  walnutLt:  "#7a5230",
  walnutHi:  "#9a6f44",
  steel:     "#9aa0a8",
  steelDk:   "#5a6068",
  steelHi:   "#c8ccd2",
};

export function toIso(gx, gy) {
  return {
    x: CANVAS_W / 2 - 40 + (gx - gy) * (ISO_TW / 2),
    y: 60                 + (gx + gy) * (ISO_TH / 2),
  };
}

// gy=1 vault row · gy=2 manager+loan officer backstage · gy=3 teller counter · gy=4 queue/waiting · gy=5 entrance
const TILE_MAP = [
  // gy=1 — back row, vault alcove
  { gx:1,gy:1,c:PAL.security    }, { gx:2,gy:1,c:PAL.securityAlt }, { gx:3,gy:1,c:PAL.security    },
  { gx:4,gy:1,c:PAL.vaultAlt    }, { gx:5,gy:1,c:PAL.vault       }, { gx:6,gy:1,c:PAL.vaultAlt    },
  // gy=2 — manager + loan officer backstage
  { gx:1,gy:2,c:PAL.manager     }, { gx:2,gy:2,c:PAL.managerAlt  }, { gx:3,gy:2,c:PAL.carpetA     },
  { gx:4,gy:2,c:PAL.carpetB     }, { gx:5,gy:2,c:PAL.vault       }, { gx:6,gy:2,c:PAL.vaultAlt    },
  // gy=3 — teller counter
  { gx:1,gy:3,c:PAL.floorA      }, { gx:2,gy:3,c:PAL.carpetA     }, { gx:3,gy:3,c:PAL.carpetB     },
  { gx:4,gy:3,c:PAL.carpetA     }, { gx:5,gy:3,c:PAL.carpetB     }, { gx:6,gy:3,c:PAL.floorA      },
  // gy=4 — queue / waiting carpet
  { gx:1,gy:4,c:PAL.floorB      }, { gx:2,gy:4,c:PAL.carpetA     }, { gx:3,gy:4,c:PAL.carpetB     },
  { gx:4,gy:4,c:PAL.carpetA     }, { gx:5,gy:4,c:PAL.carpetB     }, { gx:6,gy:4,c:PAL.floorB      },
  // gy=5 — entrance row
  ...[1,2,3,4,5,6].map(gx => ({ gx, gy:5, c: gx%2 ? PAL.floorA : PAL.floorB })),
];

const TILE_LABELS = {}; // tile labels removed — they fought the cleaner look

// ─── FLOOR & WALLS ────────────────────────────────────────────────────────────
function drawFloor(ctx, gx, gy, color) {
  const { x, y } = toIso(gx, gy);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y); ctx.lineTo(x+ISO_TW/2, y+ISO_TH/2);
  ctx.lineTo(x, y+ISO_TH); ctx.lineTo(x-ISO_TW/2, y+ISO_TH/2);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = PAL.floorLine; ctx.lineWidth = 0.5; ctx.stroke();
}

function drawWall(ctx, gx, gy, side, wh = 78) {
  const { x, y } = toIso(gx, gy);
  ctx.fillStyle = side === "left" ? PAL.wallL : PAL.wallR;
  ctx.beginPath();
  if (side === "left") {
    ctx.moveTo(x-ISO_TW/2,y+ISO_TH/2); ctx.lineTo(x,y+ISO_TH);
    ctx.lineTo(x,y+ISO_TH-wh); ctx.lineTo(x-ISO_TW/2,y+ISO_TH/2-wh);
  } else {
    ctx.moveTo(x+ISO_TW/2,y+ISO_TH/2); ctx.lineTo(x,y+ISO_TH);
    ctx.lineTo(x,y+ISO_TH-wh); ctx.lineTo(x+ISO_TW/2,y+ISO_TH/2-wh);
  }
  ctx.closePath(); ctx.fill();
  // Wood paneling line
  ctx.strokeStyle = "rgba(255,220,180,0.04)"; ctx.lineWidth = 0.5; ctx.stroke();
  // Picture rail
  ctx.fillStyle = "rgba(184,145,80,0.18)";
  if (side === "left") ctx.fillRect(x-ISO_TW/2, y+ISO_TH/2-wh+12, ISO_TW/2, 1.5);
  else                 ctx.fillRect(x,           y+ISO_TH/2-wh+12, ISO_TW/2, 1.5);
}

// ─── ENTRANCE — refined wood + brass double doors ───────────────────────────
function drawEntrance(ctx) {
  const wh = 50;
  [1,2,3,4,5,6].forEach(gx => {
    const isDoor = gx === 3 || gx === 4;
    const { x, y } = toIso(gx, 5);
    const x0 = x - ISO_TW/2, y0 = y + ISO_TH/2;
    const x1 = x,             y1 = y + ISO_TH;

    if (isDoor) {
      // Recessed dark threshold
      ctx.fillStyle = "#0a0807";
      ctx.beginPath();
      ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
      ctx.lineTo(x1, y1 - wh); ctx.lineTo(x0, y0 - wh);
      ctx.closePath(); ctx.fill();
      // Walnut door panel
      const grad = ctx.createLinearGradient(x0, y0-wh, x1, y1);
      grad.addColorStop(0, PAL.walnutHi);
      grad.addColorStop(1, PAL.walnut);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x0+3, y0-3); ctx.lineTo(x1-3, y1-3);
      ctx.lineTo(x1-3, y1-wh+3); ctx.lineTo(x0+3, y0-wh+3);
      ctx.closePath(); ctx.fill();
      // Inset rectangle panel
      ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x0+10, y0-10); ctx.lineTo(x1-10, y1-10);
      ctx.lineTo(x1-10, y1-wh+10); ctx.lineTo(x0+10, y0-wh+10);
      ctx.closePath(); ctx.stroke();
      // Brass frame
      ctx.strokeStyle = PAL.brass; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
      ctx.lineTo(x1, y1-wh); ctx.lineTo(x0, y0-wh); ctx.closePath();
      ctx.stroke();
      // Brass handle
      const hx = x0 + (x1-x0)*0.7 + 4;
      const hy = y0 - wh*0.45;
      ctx.fillStyle = PAL.brass;
      ctx.fillRect(hx-1, hy-6, 2, 12);
      ctx.beginPath(); ctx.arc(hx, hy, 2.4, 0, Math.PI*2); ctx.fill();
    } else {
      // Painted plaster wall section
      const grad = ctx.createLinearGradient(x0, y0-wh, x0, y1);
      grad.addColorStop(0, "#564539");
      grad.addColorStop(1, "#3d3026");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
      ctx.lineTo(x1, y1-wh); ctx.lineTo(x0, y0-wh);
      ctx.closePath(); ctx.fill();
      // Subtle brass dado line
      ctx.fillStyle = "rgba(184,145,80,0.22)";
      ctx.beginPath();
      ctx.moveTo(x0, y0-wh+14); ctx.lineTo(x1, y1-wh+14);
      ctx.lineTo(x1, y1-wh+15); ctx.lineTo(x0, y0-wh+15);
      ctx.closePath(); ctx.fill();
    }
  });
}

// ─── TELLER COUNTER — proper isometric box sitting on the floor grid ─────────
function drawTellerCounter(ctx, { numTellers, activeTellers }) {
  if (numTellers <= 0) return;

  const startGx = 2.4;
  const endGx   = startGx + (numTellers - 1) * 0.55 + 0.5;
  const gyFront = 3.05; // front edge (customer-facing)
  const gyBack  = 2.55; // back edge (teller-side)
  const faceH   = 32;   // pixel height of the counter face

  // Four iso corners of the counter top surface
  const bl = toIso(startGx, gyFront); // front-left
  const br = toIso(endGx,   gyFront); // front-right
  const tr = toIso(endGx,   gyBack);  // back-right
  const tl = toIso(startGx, gyBack);  // back-left

  // Drop shadow
  ctx.fillStyle = "rgba(0,0,0,0.20)";
  ctx.beginPath();
  ctx.ellipse((bl.x+br.x)/2, br.y + faceH + 3, (br.x-bl.x)*0.48, 5, 0, 0, Math.PI*2);
  ctx.fill();

  // Front face — walnut, slightly darker than top
  const frontGrad = ctx.createLinearGradient(0, bl.y, 0, bl.y + faceH);
  frontGrad.addColorStop(0, PAL.walnutLt);
  frontGrad.addColorStop(1, PAL.walnut);
  ctx.fillStyle = frontGrad;
  ctx.beginPath();
  ctx.moveTo(bl.x, bl.y);
  ctx.lineTo(br.x, br.y);
  ctx.lineTo(br.x, br.y + faceH);
  ctx.lineTo(bl.x, bl.y + faceH);
  ctx.closePath();
  ctx.fill();

  // Top surface — iso diamond, lighter walnut
  const topGrad = ctx.createLinearGradient(tl.x, tl.y, bl.x, bl.y);
  topGrad.addColorStop(0, PAL.walnut);
  topGrad.addColorStop(1, PAL.walnutHi);
  ctx.fillStyle = topGrad;
  ctx.beginPath();
  ctx.moveTo(tl.x, tl.y);
  ctx.lineTo(tr.x, tr.y);
  ctx.lineTo(br.x, br.y);
  ctx.lineTo(bl.x, bl.y);
  ctx.closePath();
  ctx.fill();

  // Marble counter-top strip along the front edge
  ctx.fillStyle = "#d8d0c0";
  ctx.beginPath();
  ctx.moveTo(tl.x, tl.y - 2); ctx.lineTo(tr.x, tr.y - 2);
  ctx.lineTo(br.x, br.y - 2); ctx.lineTo(bl.x, bl.y - 2);
  ctx.lineTo(bl.x, bl.y);     ctx.lineTo(br.x, br.y);
  ctx.lineTo(tr.x, tr.y);     ctx.lineTo(tl.x, tl.y);
  ctx.closePath();
  ctx.fill();

  // Brass rail along the front edge
  ctx.fillStyle = PAL.brass;
  ctx.beginPath();
  ctx.moveTo(bl.x + 2, bl.y - 1); ctx.lineTo(br.x - 2, br.y - 1);
  ctx.lineTo(br.x - 2, br.y + 2); ctx.lineTo(bl.x + 2, bl.y + 2);
  ctx.closePath();
  ctx.fill();

  // Per-teller window plaque on the front face
  for (let i = 0; i < numTellers; i++) {
    const px = toIso(startGx + 0.25 + i * 0.55, gyFront);
    const active = activeTellers.has(i);
    if (active) {
      ctx.fillStyle = "rgba(245,200,120,0.22)";
      ctx.beginPath();
      ctx.ellipse(px.x, px.y + faceH * 0.55, 18, 5, 0, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.fillStyle = "#1a140e";
    ctx.fillRect(px.x - 5, px.y + 7, 10, 5);
    ctx.fillStyle = PAL.brass;
    ctx.font = "bold 5px 'Nunito',sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(String(i + 1), px.x, px.y + 11);
  }
}

// ─── VAULT — polished steel, subtle, no cartoon red ─────────────────────────
function drawVault(ctx, { vaultOpen, robberyActive }) {
  const vd = toIso(5.0, 1.5);

  // Alcove — recessed dark slate
  ctx.fillStyle = "#15181b";
  ctx.beginPath();
  ctx.roundRect(vd.x - 44, vd.y - 80, 88, 88, 5);
  ctx.fill();

  // Door frame — steel
  const fg = ctx.createLinearGradient(vd.x-40, vd.y-76, vd.x+40, vd.y);
  fg.addColorStop(0, PAL.steelDk);
  fg.addColorStop(0.5, PAL.steel);
  fg.addColorStop(1, PAL.steelDk);
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.roundRect(vd.x - 38, vd.y - 74, 76, 78, 4);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(vd.x - 38, vd.y - 74, 76, 78, 4);
  ctx.stroke();

  // Round door
  const cy = vd.y - 36;
  const r  = 30;
  const dg = ctx.createRadialGradient(vd.x-8, cy-8, 4, vd.x, cy, r);
  dg.addColorStop(0, robberyActive ? "#5a2222" : "#4d535a");
  dg.addColorStop(1, robberyActive ? "#2a0808" : "#262a30");
  ctx.fillStyle = dg;
  ctx.beginPath(); ctx.arc(vd.x, cy, r, 0, Math.PI*2); ctx.fill();

  // Outer ring
  ctx.strokeStyle = robberyActive ? "#a04040" : vaultOpen ? PAL.brass : PAL.steel;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(vd.x, cy, r, 0, Math.PI*2); ctx.stroke();

  // Rivets
  for (let i = 0; i < 12; i++) {
    const a = (i/12) * Math.PI*2;
    const bx = vd.x + Math.cos(a)*(r-4);
    const by = cy   + Math.sin(a)*(r-4);
    ctx.fillStyle = PAL.steelDk;
    ctx.beginPath(); ctx.arc(bx, by, 1.8, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = PAL.steelHi;
    ctx.beginPath(); ctx.arc(bx-0.5, by-0.5, 0.8, 0, Math.PI*2); ctx.fill();
  }

  // Inner ring
  ctx.strokeStyle = "rgba(0,0,0,0.3)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(vd.x, cy, r-9, 0, Math.PI*2); ctx.stroke();

  // Combination wheel — 4 spokes
  const rot = vaultOpen ? Math.PI/4 : 0;
  ctx.lineCap = "round";
  for (let i = 0; i < 4; i++) {
    const a = (i/4) * Math.PI*2 + rot;
    ctx.strokeStyle = robberyActive ? "#c08040" : PAL.steelHi;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(vd.x + Math.cos(a)*3,    cy + Math.sin(a)*3);
    ctx.lineTo(vd.x + Math.cos(a)*(r-13), cy + Math.sin(a)*(r-13));
    ctx.stroke();
  }
  ctx.lineCap = "butt";
  // Hub
  ctx.fillStyle = PAL.steel;
  ctx.beginPath(); ctx.arc(vd.x, cy, 3.5, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = "#1a1f25";
  ctx.beginPath(); ctx.arc(vd.x, cy, 1.8, 0, Math.PI*2); ctx.fill();

  // Hinges
  [-0.55, 0.55].forEach(f => {
    const hy = cy + f*r;
    ctx.fillStyle = PAL.steelDk;
    ctx.beginPath(); ctx.roundRect(vd.x - 36, hy - 4, 7, 8, 1.5); ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.roundRect(vd.x - 36, hy - 4, 7, 8, 1.5); ctx.stroke();
  });

  // Handle bar
  ctx.fillStyle = PAL.steelDk;
  ctx.beginPath(); ctx.roundRect(vd.x + 12, cy - 4, 14, 6, 2); ctx.fill();
  ctx.fillStyle = PAL.steelHi;
  ctx.fillRect(vd.x + 13, cy - 3.2, 12, 1.2);

  // Open / robbery glow
  if (vaultOpen || robberyActive) {
    ctx.fillStyle = robberyActive ? "rgba(220,80,60,0.10)" : "rgba(220,170,90,0.10)";
    ctx.beginPath(); ctx.arc(vd.x, cy, r+18, 0, Math.PI*2); ctx.fill();
  }

  // Plaque under vault
  ctx.fillStyle = "#0e1114";
  ctx.fillRect(vd.x - 22, vd.y + 2, 44, 6);
  ctx.fillStyle = PAL.brass;
  ctx.font = "bold 5px 'Nunito',sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("VAULT", vd.x, vd.y + 6.5);
}

// ─── MANAGER & SECURITY DESKS — sober walnut with monitor ───────────────────
function drawDesks(ctx) {
  // Manager desk
  const md = toIso(1.2, 2.0);
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath(); ctx.ellipse(md.x, md.y + 14, 38, 5, 0, 0, Math.PI*2); ctx.fill();
  const mg = ctx.createLinearGradient(0, md.y-12, 0, md.y+12);
  mg.addColorStop(0, PAL.walnutHi);
  mg.addColorStop(1, PAL.walnut);
  ctx.fillStyle = mg;
  ctx.beginPath(); ctx.roundRect(md.x - 34, md.y - 8, 68, 18, 3); ctx.fill();
  ctx.fillStyle = "#1f1a16";
  ctx.beginPath(); ctx.roundRect(md.x - 34, md.y - 10, 68, 4, 2); ctx.fill();
  // Monitor
  ctx.fillStyle = "#1a1d22";
  ctx.beginPath(); ctx.roundRect(md.x - 12, md.y - 22, 24, 14, 2); ctx.fill();
  ctx.fillStyle = "#3a5a78";
  ctx.fillRect(md.x - 10, md.y - 20, 20, 10);
  ctx.fillStyle = "rgba(120,180,220,0.4)";
  ctx.fillRect(md.x - 10, md.y - 20, 20, 2);
  // Stand
  ctx.fillStyle = "#1a1d22";
  ctx.fillRect(md.x - 2, md.y - 8, 4, 3);
  // Desk lamp
  ctx.strokeStyle = PAL.brass; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(md.x + 22, md.y - 6); ctx.lineTo(md.x + 26, md.y - 16); ctx.stroke();
  ctx.fillStyle = PAL.brassDk;
  ctx.beginPath(); ctx.arc(md.x + 26, md.y - 17, 3, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = "rgba(255,220,150,0.35)";
  ctx.beginPath(); ctx.ellipse(md.x + 24, md.y - 12, 9, 4, 0, 0, Math.PI*2); ctx.fill();

  // Loan officer desk — smaller, beside manager, green baize top
  const ld = toIso(2.2, 2.0);
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath(); ctx.ellipse(ld.x, ld.y + 12, 30, 4, 0, 0, Math.PI*2); ctx.fill();
  const lg = ctx.createLinearGradient(0, ld.y-10, 0, ld.y+10);
  lg.addColorStop(0, PAL.walnutHi); lg.addColorStop(1, PAL.walnut);
  ctx.fillStyle = lg;
  ctx.beginPath(); ctx.roundRect(ld.x - 26, ld.y - 7, 52, 15, 3); ctx.fill();
  // Green baize top
  ctx.fillStyle = "#2a4a2a";
  ctx.beginPath(); ctx.roundRect(ld.x - 24, ld.y - 9, 48, 5, 2); ctx.fill();
  ctx.fillStyle = "#3a6a3a";
  ctx.fillRect(ld.x - 23, ld.y - 8, 46, 1);
  // Nameplate
  ctx.fillStyle = "#1a140e";
  ctx.fillRect(ld.x - 12, ld.y - 2, 24, 6);
  ctx.fillStyle = PAL.brass;
  ctx.font = "bold 4px 'Nunito',sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("LOANS", ld.x, ld.y + 2);

  // Security desk
  const sd = toIso(2.5, 1.0);
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath(); ctx.ellipse(sd.x, sd.y + 12, 40, 4, 0, 0, Math.PI*2); ctx.fill();
  const sg = ctx.createLinearGradient(0, sd.y-10, 0, sd.y+10);
  sg.addColorStop(0, "#3a3530");
  sg.addColorStop(1, "#2a2520");
  ctx.fillStyle = sg;
  ctx.beginPath(); ctx.roundRect(sd.x - 36, sd.y - 8, 72, 16, 3); ctx.fill();
  ctx.fillStyle = "#1a1812";
  ctx.beginPath(); ctx.roundRect(sd.x - 36, sd.y - 10, 72, 4, 2); ctx.fill();
  // CCTV bank — three small monitors
  for (let i = 0; i < 3; i++) {
    const cx = sd.x - 18 + i*18;
    ctx.fillStyle = "#0e0f12";
    ctx.beginPath(); ctx.roundRect(cx - 6, sd.y - 19, 12, 9, 1); ctx.fill();
    ctx.fillStyle = "#2c4a3a";
    ctx.fillRect(cx - 5, sd.y - 18, 10, 7);
    ctx.fillStyle = "rgba(120,200,140,0.35)";
    ctx.fillRect(cx - 5, sd.y - 18 + (i%2)*3, 10, 1);
  }
}

// Waiting chairs — leather club chairs
function drawChairs(ctx) {
  for (let i = 0; i < 5; i++) {
    const { x, y } = toIso(1.5 + i*0.4, 3.5);
    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.beginPath(); ctx.ellipse(x, y + 8, 11, 3, 0, 0, Math.PI*2); ctx.fill();
    // Chair base
    ctx.fillStyle = "#3a2a20";
    ctx.beginPath(); ctx.roundRect(x-9, y-3, 18, 11, 3); ctx.fill();
    // Seat cushion (warm cognac leather)
    ctx.fillStyle = "#7a4a28";
    ctx.beginPath(); ctx.roundRect(x-7, y-1, 14, 6, 2); ctx.fill();
    // Highlight
    ctx.fillStyle = "rgba(255,200,140,0.18)";
    ctx.fillRect(x-6, y-1, 12, 1);
    // Backrest
    ctx.fillStyle = "#5a3520";
    ctx.beginPath(); ctx.roundRect(x-7, y-9, 14, 6, 2); ctx.fill();
  }
}

// Plants — fuller and more refined
function drawPlant(ctx, {x, y}) {
  // Pot
  ctx.fillStyle = "#2a1a10";
  ctx.beginPath(); ctx.roundRect(x-7, y-1, 14, 12, 2); ctx.fill();
  ctx.fillStyle = "rgba(255,200,150,0.10)";
  ctx.fillRect(x-7, y-1, 14, 1.5);
  // Foliage layers
  ctx.fillStyle = "#27451a";
  ctx.beginPath(); ctx.arc(x, y-7, 11, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = "#356a26";
  ctx.beginPath(); ctx.arc(x-7, y-9, 7, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(x+7, y-9, 7, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(x, y-13, 6, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = "rgba(180,220,140,0.25)";
  ctx.beginPath(); ctx.arc(x-3, y-12, 3, 0, Math.PI*2); ctx.fill();
}

function drawFurniture(ctx, opts) {
  drawVault(ctx, opts);
  drawDesks(ctx);
  drawChairs(ctx);
  [toIso(0.7, 4.5), toIso(6.3, 4.5), toIso(0.7, 2.0), toIso(6.3, 2.0)]
    .forEach(p => drawPlant(ctx, p));
}

// ─── CHIBI (slightly desaturated outfits set elsewhere) ─────────────────────
export function drawChibi(ctx, x, y, char, ts, opts={}) {
  const { ghost=false, scale=1, forceEmotion } = opts;
  ctx.save(); ctx.translate(x,y); ctx.scale(scale,scale);
  if (ghost) ctx.globalAlpha = 0.2;
  const moving = char.isMoving && !ghost;
  const wc  = moving ? Math.sin(ts*0.011+(char.id||0)*1.7) : 0;
  const bob = moving ? Math.abs(Math.sin(ts*0.011+(char.id||0)*1.7))*1.0 : 0;
  const emotion = forceEmotion||char.emotion||"neutral";
  const skin    = char.skinTone   ||"#e8b890";
  const outfit  = char.outfitColor||"#3a5a82";
  const hair    = char.hairColor  ||"#2c1810";
  const role    = char.role       ||"customer";
  ctx.fillStyle="rgba(0,0,0,0.22)"; ctx.beginPath();
  ctx.ellipse(0,21,9,3.5,0,0,Math.PI*2); ctx.fill();
  drawLegs(ctx,wc,bob,outfit,role);
  drawBody(ctx,outfit,role,bob);
  ctx.fillStyle=skin; ctx.beginPath(); ctx.arc(0,-5+bob,9.5,0,Math.PI*2); ctx.fill();
  drawHair(ctx,role,hair,outfit,bob);
  drawFace(ctx,emotion,bob,role);
  ctx.restore();
}

function drawLegs(ctx,wc,bob,outfit,role) {
  drawLeg(ctx,-4,14+bob, wc*0.48, outfit,role);
  drawLeg(ctx, 4,14+bob,-wc*0.48,outfit,role);
}
function drawLeg(ctx,x,y,angle,outfit,role) {
  ctx.save(); ctx.translate(x,y); ctx.rotate(angle);
  ctx.fillStyle=role==="robber"?"#1a1a1a":role==="teller"?"#2a2520":"#2c2620";
  ctx.beginPath(); ctx.roundRect(-2.5,0,5,7,2); ctx.fill();
  ctx.fillStyle=role==="whale"?"#1a1a1a":role==="inspector"?"#5a4014":"#1a1108";
  ctx.beginPath(); ctx.ellipse(0,8.5,3.5,2.2,0,0,Math.PI*2); ctx.fill();
  ctx.restore();
}
function drawBody(ctx,outfit,role,bob) {
  if (role==="robber") { ctx.fillStyle="#15161a"; ctx.beginPath(); ctx.roundRect(-6,4+bob,12,11,3); ctx.fill(); return; }
  if (role==="inspector") { ctx.fillStyle="#5a4818"; ctx.beginPath(); ctx.roundRect(-6,4+bob,12,11,3); ctx.fill(); return; }
  if (role==="whale") {
    ctx.fillStyle="#1f2a3e"; ctx.beginPath(); ctx.roundRect(-7,4+bob,14,12,3); ctx.fill();
    ctx.fillStyle="#e8e8e8"; ctx.beginPath(); ctx.moveTo(-2,5+bob); ctx.lineTo(0,10+bob); ctx.lineTo(2,5+bob); ctx.closePath(); ctx.fill(); return;
  }
  if (role==="teller") {
    ctx.fillStyle=outfit; ctx.beginPath(); ctx.roundRect(-6,4+bob,12,11,3); ctx.fill();
    ctx.fillStyle="#f0ece0"; ctx.beginPath(); ctx.roundRect(-2.5,4+bob,5,5,1); ctx.fill(); return;
  }
  ctx.fillStyle=outfit; ctx.beginPath(); ctx.roundRect(-6,4+bob,12,11,3); ctx.fill();
}
function drawHair(ctx,role,hair,outfit,bob) {
  if (role==="robber") {
    ctx.fillStyle="#15161a"; ctx.beginPath(); ctx.arc(0,-5+bob,10,Math.PI,0); ctx.fill();
    ctx.beginPath(); ctx.roundRect(-9.5,-7+bob,19,5,2); ctx.fill();
    ctx.fillStyle="#1a1a1a"; ctx.beginPath(); ctx.roundRect(-7,-2+bob,14,9,3); ctx.fill(); return;
  }
  if (role==="inspector") {
    ctx.fillStyle="#5a4818"; ctx.beginPath(); ctx.ellipse(0,-13.5+bob,12.5,3,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.roundRect(-7,-22+bob,14,9.5,3); ctx.fill();
    ctx.fillStyle="#3a2c08"; ctx.fillRect(-7,-13.5+bob,14,2); return;
  }
  if (role==="teller") {
    ctx.fillStyle=outfit; ctx.beginPath(); ctx.arc(0,-5+bob,10.5,Math.PI+0.45,-0.45); ctx.fill();
    ctx.fillStyle=hair; ctx.beginPath(); ctx.arc(0,-5+bob,9,0.4,Math.PI-0.4); ctx.fill(); return;
  }
  ctx.fillStyle=hair;
  ctx.beginPath(); ctx.arc(0,-5+bob,9.5,Math.PI+0.15,-0.15); ctx.fill();
  ctx.beginPath(); ctx.arc(-3.5,-13.5+bob,3.8,0,Math.PI*2); ctx.arc(0,-15+bob,3.2,0,Math.PI*2); ctx.arc(3.5,-13.5+bob,3.8,0,Math.PI*2); ctx.fill();
}
function drawFace(ctx,emotion,bob,role) {
  if (role==="robber") {
    ctx.fillStyle="#f22";
    ctx.beginPath(); ctx.ellipse(-3,-3+bob,2.8,1.9,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(3,-3+bob,2.8,1.9,0,0,Math.PI*2); ctx.fill(); return;
  }
  ctx.fillStyle="#fff";
  ctx.beginPath(); ctx.ellipse(-3.2,-6+bob,2.9,3.1,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(3.2,-6+bob,2.9,3.1,0,0,Math.PI*2); ctx.fill();
  const emotionDef = EMOTIONS[emotion]||EMOTIONS.neutral;
  const ex = emotion==="angry"?0.5:0;
  ctx.fillStyle=emotionDef.eyeColor;
  ctx.beginPath(); ctx.ellipse(-3.2+ex,-5.5+bob,1.9,2.3,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(3.2+ex,-5.5+bob,1.9,2.3,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle="#1a1a1a";
  ctx.beginPath(); ctx.ellipse(-3.2+ex,-5.3+bob,1.1,1.4,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(3.2+ex,-5.3+bob,1.1,1.4,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle="rgba(255,255,255,0.9)";
  ctx.beginPath(); ctx.ellipse(-2.5+ex,-6.3+bob,0.8,0.8,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(3.9+ex,-6.3+bob,0.8,0.8,0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle="#3a2510"; ctx.lineWidth=1.3; ctx.lineCap="round";
  if (emotion==="angry") {
    ctx.beginPath(); ctx.moveTo(-6.5,-10.5+bob); ctx.lineTo(-1,-9+bob); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(6.5,-10.5+bob);  ctx.lineTo(1,-9+bob);  ctx.stroke();
  } else if (emotion==="worried") {
    ctx.beginPath(); ctx.moveTo(-6,-9+bob); ctx.lineTo(-1,-10.5+bob); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(6,-9+bob);  ctx.lineTo(1,-10.5+bob);  ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(-6,-10.5+bob); ctx.quadraticCurveTo(-3.5,-11.5+bob,-1,-10.5+bob); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(1,-10.5+bob);  ctx.quadraticCurveTo(3.5,-11.5+bob,6,-10.5+bob);  ctx.stroke();
  }
  ctx.strokeStyle="#8B4040"; ctx.lineWidth=1.4; ctx.lineCap="round"; ctx.beginPath();
  if (emotion==="happy"||emotion==="serving") {
    ctx.arc(0,-1+bob,3.8,0.3,Math.PI-0.3); ctx.stroke();
    ctx.fillStyle="#fff"; ctx.beginPath(); ctx.arc(0,-1+bob,3,0.4,Math.PI-0.4); ctx.fill();
    ctx.fillStyle="rgba(255,140,110,0.3)";
    ctx.beginPath(); ctx.ellipse(-5.5,-2+bob,3.2,2.2,-0.3,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(5.5,-2+bob,3.2,2.2,0.3,0,Math.PI*2);  ctx.fill();
  } else if (emotion==="angry") {
    ctx.moveTo(-3.5,1.5+bob); ctx.quadraticCurveTo(0,4+bob,3.5,1.5+bob); ctx.stroke();
  } else if (emotion==="worried") {
    ctx.moveTo(-3.2,2+bob); ctx.quadraticCurveTo(0,0.5+bob,3.2,2+bob); ctx.stroke();
    ctx.fillStyle="#88aaff"; ctx.beginPath(); ctx.arc(8.5,-7+bob,1.6,0,Math.PI*2); ctx.fill();
  } else if (emotion==="surprised") {
    ctx.beginPath(); ctx.arc(0,0.5+bob,3.2,0,Math.PI*2); ctx.stroke();
  } else {
    ctx.moveTo(-3,0.5+bob); ctx.lineTo(3,0.5+bob); ctx.stroke();
  }
}

// ─── BUBBLE ───────────────────────────────────────────────────────────────────
export function drawBubble(ctx, x, y, text, bg="#fffbee") {
  ctx.font = "bold 13px 'Nunito',sans-serif";
  const tw = ctx.measureText(text).width, bw = tw+18, bh = 24, bx = x-bw/2, by = y-56;
  ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 5); ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.22)"; ctx.lineWidth = 0.8; ctx.stroke();
  ctx.fillStyle = bg; ctx.beginPath();
  ctx.moveTo(x-4, by+bh); ctx.lineTo(x, by+bh+9); ctx.lineTo(x+4, by+bh); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#2a1a0e"; ctx.textAlign = "center";
  ctx.fillText(text, x, by+bh-6);
}

// ─── HUD ──────────────────────────────────────────────────────────────────────
function drawHUD(ctx, { served, deposited, walkouts, queueLength, greets=0 }) {
  ctx.fillStyle="rgba(20,16,12,0.86)"; ctx.beginPath(); ctx.roundRect(14,14,210,94,8); ctx.fill();
  ctx.strokeStyle="rgba(184,145,80,0.22)"; ctx.lineWidth=0.8; ctx.stroke();
  [
    [`Served: ${served}`,                          "#7fd4cc"],
    [`Deposits: $${Math.round(deposited/1000)}k`,  "#e8b25a"],
    [`Walk-outs: ${walkouts}`,                     "#e88080"],
    [`Queue: ${queueLength}`,                      "#c8b99a"],
    [`Greets: ${greets}`,                          "#b89150"],
  ].forEach(([text,color],i)=>{
    ctx.fillStyle=color; ctx.font=`bold 9px 'Nunito',sans-serif`;
    ctx.textAlign="left"; ctx.fillText(text,26,34+i*14);
  });
}

function drawEventBanner(ctx, activeEvent) {
  if (!activeEvent) return;
  const labels = { robbery:"ROBBERY", inspection:"INSPECTION", rush:"BANK RUSH", whale:"VIP CLIENT", outage:"SYSTEM DOWN" };
  const colors = { robbery:"#d96060", inspection:"#e8b25a", rush:"#e89050", whale:"#c8a14a", outage:"#9a8f7e" };
  const text=labels[activeEvent]||activeEvent.toUpperCase(), color=colors[activeEvent]||"#9a8f7e";
  ctx.font="bold 10px 'Nunito',sans-serif"; ctx.textAlign="center";
  const tw=ctx.measureText(text).width+34;
  ctx.fillStyle=color+"22"; ctx.beginPath(); ctx.roundRect(CANVAS_W/2-tw/2,8,tw,22,5); ctx.fill();
  ctx.strokeStyle=color+"55"; ctx.lineWidth=1; ctx.stroke();
  ctx.fillStyle=color; ctx.fillText(text,CANVAS_W/2,24);
}

function drawEventBorder(ctx, activeEvent) {
  if (activeEvent==="robbery") { ctx.strokeStyle="#c84a4a"; ctx.lineWidth=3; ctx.strokeRect(2,2,CANVAS_W-4,CANVAS_H-4); }
  if (activeEvent==="inspection") { ctx.setLineDash([8,4]); ctx.strokeStyle="#e8b25a"; ctx.lineWidth=2; ctx.strokeRect(2,2,CANVAS_W-4,CANVAS_H-4); ctx.setLineDash([]); }
}

// Highlight ring for hovered character (player interaction)
function drawHoverRing(ctx, char, ts) {
  if (!char) return;
  const { x, y } = toIso(char.gx, char.gy);
  const pulse = 0.55 + Math.sin(ts*0.006)*0.25;
  const color = char.role === "robber"   ? `rgba(255,90,80,${pulse.toFixed(2)})`
              : char.role === "whale"    ? `rgba(245,200,90,${pulse.toFixed(2)})`
              : char.role === "inspector"? `rgba(232,200,120,${pulse.toFixed(2)})`
              :                            `rgba(232,178,90,${pulse.toFixed(2)})`;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.ellipse(x, y+18, 14, 5.5, 0, 0, Math.PI*2); ctx.stroke();
}

// Countdown ring above interactable event chars (whale, robber)
function drawInteractTimer(ctx, char, now) {
  if (!char.interactable || !char.interactDeadline) return;
  const total = char.interactWindow || 1;
  const remain = Math.max(0, char.interactDeadline - now);
  const frac = Math.min(1, remain / total);
  if (frac <= 0) return;
  const { x, y } = toIso(char.gx, char.gy);
  const cy = y - 26;
  const r  = 7;
  const color = char.role === "robber" ? "#ff6b6b" : "#f5c842";
  // Background ring
  ctx.strokeStyle = "rgba(0,0,0,0.45)"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(x, cy, r, 0, Math.PI*2); ctx.stroke();
  // Foreground arc
  ctx.strokeStyle = color; ctx.lineWidth = 2.4; ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(x, cy, r, -Math.PI/2, -Math.PI/2 + Math.PI*2*frac);
  ctx.stroke();
  ctx.lineCap = "butt";
  // Icon — exclamation
  ctx.fillStyle = color;
  ctx.font = "bold 8px 'Nunito',sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("!", x, cy + 3);
}

// ─── MAIN RENDER FRAME ────────────────────────────────────────────────────────
export function renderFrame(ctx, renderState, ts) {
  const { chars, staff, particles, activeEvent, vaultOpen, activeTellers,
          hudState, queueSlots, tellerSlots, loanDeskPos, tellerRoster,
          loanOfficerRoster, hoveredChar } = renderState;

  ctx.fillStyle=PAL.bg; ctx.fillRect(0,0,CANVAS_W,CANVAS_H);
  // Soft warm spotlight
  const g=ctx.createRadialGradient(CANVAS_W/2,CANVAS_H*0.4,0,CANVAS_W/2,CANVAS_H*0.4,CANVAS_W*0.6);
  g.addColorStop(0,"rgba(220,180,120,0.10)"); g.addColorStop(1,"rgba(0,0,0,0)");
  ctx.fillStyle=g; ctx.fillRect(0,0,CANVAS_W,CANVAS_H);

  TILE_MAP.forEach(t=>drawFloor(ctx,t.gx,t.gy,t.c,TILE_LABELS[`${t.gy},${t.gx}`]||""));
  // Back and left walls intentionally disabled while the layout is being tuned.
  // Bring them back by uncommenting; drawWall() and the picture-rail accents are
  // still in place. Entrance row (drawEntrance) renders separately below.
  // TILE_MAP.filter(t=>t.gy<=2).forEach(t=>drawWall(ctx,t.gx,t.gy,"right", t.gy===2 ? 48 : 104));
  // TILE_MAP.filter(t=>t.gx<=1).forEach(t=>drawWall(ctx,t.gx,t.gy,"left",  t.gy<=2  ? 48 : 104));

  // Subtle queue-line marker (brass dots)
  queueSlots.slice(0,8).forEach(({gx,gy})=>{
    const{x,y}=toIso(gx,gy);
    ctx.fillStyle="rgba(184,145,80,0.18)";
    ctx.beginPath(); ctx.ellipse(x,y+15,7,3.2,0,0,Math.PI*2); ctx.fill();
  });

  drawFurniture(ctx,{ vaultOpen, robberyActive:activeEvent==="robbery" });

  // Loan officer — drawn behind the desk (gy=1.75) regardless of where the
  // customer routes (loanDeskPos at gy=2.4 is the customer's stop position).
  // Ghost when unhired; live named chibi when staff.loanOfficers > 0.
  {
    const p = toIso(2.2, 1.75);
    if (staff.loanOfficers === 0) {
      drawChibi(ctx, p.x, p.y-8, {id:900, role:"teller", skinTone:"#c47840", hairColor:"#2c1810", outfitColor:"#3a6a4a", isMoving:false, emotion:"neutral"}, ts, {ghost:true, scale:0.85});
    } else if (loanOfficerRoster && loanOfficerRoster.length > 0) {
      const def = loanOfficerRoster[0];
      drawChibi(ctx, p.x, p.y-8, {id:910, role:"teller", skinTone:def.skin, hairColor:def.hair, outfitColor:def.outfit, isMoving:false, emotion:"neutral"}, ts, {scale:0.9});
    }
  }
  if (staff.security===0)     { const p=toIso(2.5,1.05);drawChibi(ctx,p.x,p.y-8,{id:901,role:"teller",skinTone:"#e8a870",hairColor:"#1a1a2e",outfitColor:"#2a3a2a",isMoving:false,emotion:"neutral"},ts,{ghost:true,scale:0.85}); }

  for (let i=0; i<Math.min(staff.tellers, tellerRoster.length, tellerSlots.length); i++) {
    const def=tellerRoster[i];
    // Slot gy is the *customer*'s stop position (in front of counter at 3.10).
    // Teller stands behind the counter back edge at ~2.45 — 0.65 grid units back.
    const{x,y}=toIso(tellerSlots[i].gx, tellerSlots[i].gy-0.65);
    const emotion=activeTellers.has(i)?"serving":"neutral";
    drawChibi(ctx,x,y-8,{id:800+i,role:"teller",skinTone:def.skin,hairColor:def.hair,outfitColor:def.outfit,isMoving:false,emotion},ts,{scale:0.9});
    if (activeTellers.has(i)) drawBubble(ctx,x,y-30,"Next please!");
  }

  drawTellerCounter(ctx,{ numTellers:staff.tellers, activeTellers });

  drawEntrance(ctx);

  // Hover highlight under target customer
  drawHoverRing(ctx, hoveredChar, ts);

  // Customers sorted by depth
  const now = Date.now();
  [...chars].filter(c=>c.state!=="exited")
    .sort((a,b)=>(a.gx+a.gy)-(b.gx+b.gy))
    .forEach(c=>{
      const{x,y}=toIso(c.gx,c.gy);
      const scale=c.role==="whale"?1.12:c.role==="robber"?1.05:0.92;
      drawChibi(ctx,x,y,c,ts,{scale});
      if (c.bubble&&c.bubbleTimer>0) {
        const bg=c.role==="robber"?"#ffcccc":c.role==="whale"?"#fff8d0":c.emotion==="angry"?"#ffe8d0":"#fffbee";
        drawBubble(ctx,x,y-12*scale,c.bubble,bg);
      }
      drawInteractTimer(ctx, c, now);
    });

  tickParticles(ctx, particles, 16);
  drawHUD(ctx, hudState);
  drawEventBanner(ctx, activeEvent);
  drawEventBorder(ctx, activeEvent);
}

