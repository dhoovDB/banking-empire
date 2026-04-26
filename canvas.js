import { EMOTIONS } from "../config/characters.js";
import { tickParticles } from "./particles.js";

export const CANVAS_W = 960;
export const CANVAS_H = 540;

const ISO_TW = 72;
const ISO_TH = 36;

const PAL = {
  entrance: "#c8aa85", entranceAlt: "#b89a70",
  waiting:  "#a06840", waitingAlt:  "#8a5830",
  tellers:  "#7a5220", tellersAlt:  "#6a4418",
  vault:    "#4a1515", vaultAlt:    "#3a1010",
  manager:  "#3a1a50", managerAlt:  "#2a1040",
  security: "#1e3d24", securityAlt: "#162e1a",
  wallL:    "#2e2016", wallR:       "#201610",
  floorLine:"rgba(255,215,150,0.07)",
  bg:       "#0f0d0b",
};

export function toIso(gx, gy) {
  return {
    x: CANVAS_W / 2 + (gx - gy) * (ISO_TW / 2),
    y: 96           + (gx + gy) * (ISO_TH / 2),
  };
}

const TILE_MAP = [
  ...[2,3,4,5,6].map(gx => ({ gx, gy:6, c: gx%2 ? PAL.entrance   : PAL.entranceAlt })),
  ...[1,2,3].map(gx     => ({ gx, gy:5, c: gx%2 ? PAL.waiting    : PAL.waitingAlt  })),
  ...[4,5,6,7].map(gx   => ({ gx, gy:5, c: gx%2 ? PAL.tellers    : PAL.tellersAlt  })),
  { gx:1,gy:4,c:PAL.waiting  },{ gx:2,gy:4,c:PAL.waitingAlt },{ gx:3,gy:4,c:PAL.waiting  },
  { gx:4,gy:4,c:PAL.tellers  },{ gx:5,gy:4,c:PAL.tellersAlt },{ gx:6,gy:4,c:PAL.tellers  },{ gx:7,gy:4,c:PAL.tellers },
  { gx:1,gy:3,c:PAL.waiting  },{ gx:2,gy:3,c:PAL.waiting    },{ gx:3,gy:3,c:PAL.tellers  },
  { gx:4,gy:3,c:PAL.tellersAlt},{ gx:5,gy:3,c:PAL.tellers   },{ gx:6,gy:3,c:PAL.tellers  },
  { gx:7,gy:3,c:PAL.vault    },{ gx:8,gy:3,c:PAL.vault      },
  { gx:1,gy:2,c:PAL.manager  },{ gx:2,gy:2,c:PAL.managerAlt },{ gx:3,gy:2,c:PAL.manager  },
  { gx:4,gy:2,c:PAL.tellers  },{ gx:5,gy:2,c:PAL.tellersAlt },{ gx:6,gy:2,c:PAL.vault    },
  { gx:7,gy:2,c:PAL.vaultAlt },{ gx:8,gy:2,c:PAL.vault      },
  ...[2,3,4,5,6].map(gx => ({ gx, gy:1, c: gx%2 ? PAL.security : PAL.securityAlt })),
];

const TILE_LABELS = { "6,3":"Waiting","5,4":"Tellers","2,3":"Manager","7,3":"Vault","4,1":"Security" };

// ─── FLOOR & WALLS ────────────────────────────────────────────────────────────
function drawFloor(ctx, gx, gy, color, label) {
  const { x, y } = toIso(gx, gy);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y); ctx.lineTo(x+ISO_TW/2, y+ISO_TH/2);
  ctx.lineTo(x, y+ISO_TH); ctx.lineTo(x-ISO_TW/2, y+ISO_TH/2);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = PAL.floorLine; ctx.lineWidth = 0.5; ctx.stroke();
  if (label) {
    ctx.fillStyle = "rgba(255,215,150,0.2)";
    ctx.font = "7px 'Nunito',sans-serif"; ctx.textAlign = "center";
    ctx.fillText(label, x, y+ISO_TH/2+3);
  }
}

function drawWall(ctx, gx, gy, side) {
  const { x, y } = toIso(gx, gy); const wh = 34;
  ctx.fillStyle = side === "left" ? PAL.wallL : PAL.wallR;
  ctx.beginPath();
  if (side === "left") {
    ctx.moveTo(x-ISO_TW/2,y+ISO_TH/2); ctx.lineTo(x,y+ISO_TH);
    ctx.lineTo(x,y+ISO_TH+wh); ctx.lineTo(x-ISO_TW/2,y+ISO_TH/2+wh);
  } else {
    ctx.moveTo(x+ISO_TW/2,y+ISO_TH/2); ctx.lineTo(x,y+ISO_TH);
    ctx.lineTo(x,y+ISO_TH+wh); ctx.lineTo(x+ISO_TW/2,y+ISO_TH/2+wh);
  }
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "rgba(255,190,120,0.035)"; ctx.lineWidth = 0.5; ctx.stroke();
}

// ─── FURNITURE ────────────────────────────────────────────────────────────────
function drawFurniture(ctx, { numTellers, vaultOpen, robberyActive, activeTellers }) {
  // Teller counter
  const ds = toIso(3.1,3.65), de = toIso(7.2,3.3);
  ctx.fillStyle = "#5a3810"; ctx.beginPath();
  ctx.roundRect(ds.x-18,ds.y-5,de.x-ds.x+46,14,5); ctx.fill();
  ctx.fillStyle = "#7a5228"; ctx.beginPath();
  ctx.roundRect(ds.x-16,ds.y-3,de.x-ds.x+42,10,4); ctx.fill();
  for (let i = 0; i < numTellers; i++) {
    const { x, y } = toIso(3.3+i*0.75, 3.55);
    const active = activeTellers.has(i);
    if (active) {
      ctx.fillStyle = "rgba(245,166,35,0.22)"; ctx.beginPath();
      ctx.ellipse(x,y+2,30,16,0,0,Math.PI*2); ctx.fill();
    }
    ctx.fillStyle = active ? "rgba(245,180,60,0.3)" : "rgba(180,220,255,0.11)";
    ctx.beginPath(); ctx.roundRect(x-13,y-12,26,8,2); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.09)"; ctx.lineWidth = 0.5; ctx.stroke();
  }
  // Vault
  const vd = toIso(7.5,2.35);
  ctx.fillStyle = "#300808"; ctx.beginPath();
  ctx.roundRect(vd.x-20,vd.y-28,40,38,8); ctx.fill();
  ctx.strokeStyle = robberyActive?"#ff3333":vaultOpen?"#cc6633":"#883333";
  ctx.lineWidth = robberyActive?3:2; ctx.beginPath();
  ctx.arc(vd.x,vd.y-9,14,0,Math.PI*2); ctx.stroke();
  const rot = vaultOpen ? 0.5 : 0;
  for (let i = 0; i < 6; i++) {
    const a = (i/6)*Math.PI*2+rot;
    ctx.strokeStyle = robberyActive?"#ff4":"#c33"; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(vd.x,vd.y-9);
    ctx.lineTo(vd.x+Math.cos(a)*13,vd.y-9+Math.sin(a)*13); ctx.stroke();
  }
  ctx.fillStyle = robberyActive?"#f44":"#933"; ctx.beginPath();
  ctx.arc(vd.x,vd.y-9,3.5,0,Math.PI*2); ctx.fill();
  if (robberyActive) {
    ctx.fillStyle="rgba(255,60,60,0.13)"; ctx.beginPath();
    ctx.arc(vd.x,vd.y-9,24,0,Math.PI*2); ctx.fill();
  }
  // Manager desk
  const md = toIso(1.6,2.4);
  ctx.fillStyle="#3a1d52"; ctx.beginPath(); ctx.roundRect(md.x-24,md.y-7,48,16,5); ctx.fill();
  ctx.fillStyle="#4a2a6a"; ctx.beginPath(); ctx.roundRect(md.x-20,md.y-4,40,11,4); ctx.fill();
  ctx.fillStyle="#1a1a2a"; ctx.beginPath(); ctx.roundRect(md.x-8,md.y-14,16,10,2); ctx.fill();
  // Security desk
  const sd = toIso(4.0,1.4);
  ctx.fillStyle="#1a3520"; ctx.beginPath(); ctx.roundRect(sd.x-28,sd.y-5,56,14,5); ctx.fill();
  // Chairs
  for (let i=0;i<7;i++) {
    const {x,y}=toIso(1.4+i*0.38,4.9);
    ctx.fillStyle="#7a4820"; ctx.beginPath(); ctx.roundRect(x-7,y-4,14,11,3); ctx.fill();
    ctx.fillStyle="#9a6030"; ctx.beginPath(); ctx.roundRect(x-5.5,y-2.5,11,7,2); ctx.fill();
  }
  // Plants
  [toIso(1.0,5.5),toIso(7.2,5.5),toIso(0.9,2.8),toIso(8.5,2.8)].forEach(p=>drawPlant(ctx,p));
}

function drawPlant(ctx,{x,y}) {
  ctx.fillStyle="#3a1e0c"; ctx.beginPath(); ctx.roundRect(x-4.5,y-1,9,9,3); ctx.fill();
  ctx.fillStyle="#2d5c1a"; ctx.beginPath(); ctx.arc(x,y-4,8,0,Math.PI*2); ctx.fill();
  ctx.fillStyle="#3a7a20";
  ctx.beginPath(); ctx.arc(x-5,y-6,5.5,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(x+5,y-6,5.5,0,Math.PI*2); ctx.fill();
}

// ─── CHIBI ────────────────────────────────────────────────────────────────────
export function drawChibi(ctx, x, y, char, ts, opts={}) {
  const { ghost=false, scale=1, forceEmotion } = opts;
  ctx.save(); ctx.translate(x,y); ctx.scale(scale,scale);
  if (ghost) ctx.globalAlpha = 0.2;
  const moving = char.isMoving && !ghost;
  const wc  = moving ? Math.sin(ts*0.011+(char.id||0)*1.7) : 0;
  const bob = moving ? Math.abs(Math.sin(ts*0.011+(char.id||0)*1.7))*1.0 : 0;
  const emotion = forceEmotion||char.emotion||"neutral";
  const skin    = char.skinTone   ||"#f5c89a";
  const outfit  = char.outfitColor||"#4a90d9";
  const hair    = char.hairColor  ||"#2c1810";
  const role    = char.role       ||"customer";
  ctx.fillStyle="rgba(0,0,0,0.15)"; ctx.beginPath();
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
  ctx.fillStyle=role==="robber"?"#111":outfit;
  ctx.beginPath(); ctx.roundRect(-2.5,0,5,7,2); ctx.fill();
  ctx.fillStyle=role==="whale"?"#1a1a1a":role==="inspector"?"#8B6914":"#2a1a10";
  ctx.beginPath(); ctx.ellipse(0,8.5,3.5,2.2,0,0,Math.PI*2); ctx.fill();
  ctx.restore();
}
function drawBody(ctx,outfit,role,bob) {
  if (role==="robber") { ctx.fillStyle="#111"; ctx.beginPath(); ctx.roundRect(-6,4+bob,12,11,3); ctx.fill(); return; }
  if (role==="inspector") { ctx.fillStyle="#7a6020"; ctx.beginPath(); ctx.roundRect(-6,4+bob,12,11,3); ctx.fill(); return; }
  if (role==="whale") {
    ctx.fillStyle="#1a2a4a"; ctx.beginPath(); ctx.roundRect(-7,4+bob,14,12,3); ctx.fill();
    ctx.fillStyle="#fff"; ctx.beginPath(); ctx.moveTo(-2,5+bob); ctx.lineTo(0,10+bob); ctx.lineTo(2,5+bob); ctx.closePath(); ctx.fill(); return;
  }
  if (role==="teller") {
    ctx.fillStyle=outfit; ctx.beginPath(); ctx.roundRect(-6,4+bob,12,11,3); ctx.fill();
    ctx.fillStyle="#fff"; ctx.beginPath(); ctx.roundRect(-2.5,4+bob,5,5,1); ctx.fill(); return;
  }
  ctx.fillStyle=outfit; ctx.beginPath(); ctx.roundRect(-6,4+bob,12,11,3); ctx.fill();
}
function drawHair(ctx,role,hair,outfit,bob) {
  if (role==="robber") {
    ctx.fillStyle="#111"; ctx.beginPath(); ctx.arc(0,-5+bob,10,Math.PI,0); ctx.fill();
    ctx.beginPath(); ctx.roundRect(-9.5,-7+bob,19,5,2); ctx.fill();
    ctx.fillStyle="#1a1a1a"; ctx.beginPath(); ctx.roundRect(-7,-2+bob,14,9,3); ctx.fill(); return;
  }
  if (role==="inspector") {
    ctx.fillStyle="#8B6914"; ctx.beginPath(); ctx.ellipse(0,-13.5+bob,12.5,3,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.roundRect(-7,-22+bob,14,9.5,3); ctx.fill();
    ctx.fillStyle="#5a3c08"; ctx.fillRect(-7,-13.5+bob,14,2); return;
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
  ctx.font="bold 9px 'Nunito',sans-serif";
  const tw=ctx.measureText(text).width, bw=tw+12, bh=17, bx=x-bw/2, by=y-44;
  ctx.fillStyle=bg; ctx.beginPath(); ctx.roundRect(bx,by,bw,bh,4); ctx.fill();
  ctx.strokeStyle="rgba(0,0,0,0.1)"; ctx.lineWidth=0.5; ctx.stroke();
  ctx.fillStyle=bg; ctx.beginPath(); ctx.moveTo(x-3,by+bh); ctx.lineTo(x,by+bh+6); ctx.lineTo(x+3,by+bh); ctx.closePath(); ctx.fill();
  ctx.fillStyle="#2a1a0e"; ctx.textAlign="center"; ctx.fillText(text,x,by+bh-5);
}

// ─── HUD ──────────────────────────────────────────────────────────────────────
function drawHUD(ctx, { served, deposited, walkouts, queueLength }) {
  ctx.fillStyle="rgba(15,11,9,0.84)"; ctx.beginPath(); ctx.roundRect(14,14,192,78,8); ctx.fill();
  ctx.strokeStyle="rgba(245,166,35,0.16)"; ctx.lineWidth=0.5; ctx.stroke();
  [
    [`Served: ${served}`,                     "#4ecdc4"],
    [`Deposits: $${Math.round(deposited/1000)}k`,"#f5a623"],
    [`Walk-outs: ${walkouts}`,                "#ff6b6b"],
    [`Queue: ${queueLength}`,                 "#c8b99a"],
  ].forEach(([text,color],i)=>{
    ctx.fillStyle=color; ctx.font=`bold 9px 'Nunito',sans-serif`;
    ctx.textAlign="left"; ctx.fillText(text,26,34+i*14);
  });
}

function drawEventBanner(ctx, activeEvent) {
  if (!activeEvent) return;
  const labels = { robbery:"ROBBERY", inspection:"INSPECTION", rush:"BANK RUSH", whale:"VIP CLIENT", outage:"SYSTEM DOWN" };
  const colors = { robbery:"#ff6b6b", inspection:"#f5a623", rush:"#ff8c42", whale:"#d4af37", outage:"#9a8f7e" };
  const text=labels[activeEvent]||activeEvent.toUpperCase(), color=colors[activeEvent]||"#9a8f7e";
  ctx.font="bold 10px 'Nunito',sans-serif"; ctx.textAlign="center";
  const tw=ctx.measureText(text).width+34;
  ctx.fillStyle=color+"22"; ctx.beginPath(); ctx.roundRect(CANVAS_W/2-tw/2,8,tw,22,5); ctx.fill();
  ctx.strokeStyle=color+"55"; ctx.lineWidth=1; ctx.stroke();
  ctx.fillStyle=color; ctx.fillText(text,CANVAS_W/2,24);
}

function drawEventBorder(ctx, activeEvent) {
  if (activeEvent==="robbery") { ctx.strokeStyle="#ff4a4a"; ctx.lineWidth=3; ctx.strokeRect(2,2,CANVAS_W-4,CANVAS_H-4); }
  if (activeEvent==="inspection") { ctx.setLineDash([8,4]); ctx.strokeStyle="#f5a623"; ctx.lineWidth=2; ctx.strokeRect(2,2,CANVAS_W-4,CANVAS_H-4); ctx.setLineDash([]); }
}

// ─── MAIN RENDER FRAME ────────────────────────────────────────────────────────
export function renderFrame(ctx, renderState, ts) {
  const { chars, staff, particles, activeEvent, vaultOpen, activeTellers,
          hudState, queueSlots, tellerSlots, tellerRoster } = renderState;

  ctx.fillStyle=PAL.bg; ctx.fillRect(0,0,CANVAS_W,CANVAS_H);
  const g=ctx.createRadialGradient(CANVAS_W/2,CANVAS_H*0.45,0,CANVAS_W/2,CANVAS_H*0.45,CANVAS_W*0.65);
  g.addColorStop(0,"rgba(90,55,20,0.12)"); g.addColorStop(1,"rgba(0,0,0,0)");
  ctx.fillStyle=g; ctx.fillRect(0,0,CANVAS_W,CANVAS_H);

  TILE_MAP.filter(t=>t.gy<=2).forEach(t=>drawWall(ctx,t.gx,t.gy,"right"));
  TILE_MAP.filter(t=>t.gx<=1).forEach(t=>drawWall(ctx,t.gx,t.gy,"left"));
  TILE_MAP.forEach(t=>drawFloor(ctx,t.gx,t.gy,t.c,TILE_LABELS[`${t.gy},${t.gx}`]||""));

  queueSlots.slice(0,8).forEach(({gx,gy})=>{
    const{x,y}=toIso(gx,gy); ctx.fillStyle="rgba(255,210,130,0.09)";
    ctx.beginPath(); ctx.ellipse(x,y+15,9,4.5,0,0,Math.PI*2); ctx.fill();
  });

  drawFurniture(ctx,{ numTellers:staff.tellers, vaultOpen, robberyActive:activeEvent==="robbery", activeTellers });

  // Ghost unlockable staff
  if (staff.loanOfficers===0) { const p=toIso(1.8,2.5); drawChibi(ctx,p.x,p.y-8,{id:900,role:"teller",skinTone:"#c47840",hairColor:"#2c1810",outfitColor:"#27ae60",isMoving:false,emotion:"neutral"},ts,{ghost:true,scale:0.85}); }
  if (staff.security===0)     { const p=toIso(4.0,1.45);drawChibi(ctx,p.x,p.y-8,{id:901,role:"teller",skinTone:"#e8a870",hairColor:"#1a1a2e",outfitColor:"#1a3020",isMoving:false,emotion:"neutral"},ts,{ghost:true,scale:0.85}); }

  // Named tellers
  for (let i=0; i<Math.min(staff.tellers, tellerRoster.length, tellerSlots.length); i++) {
    const def=tellerRoster[i];
    const{x,y}=toIso(tellerSlots[i].gx,tellerSlots[i].gy-0.25);
    const emotion=activeTellers.has(i)?"serving":"neutral";
    drawChibi(ctx,x,y-8,{id:800+i,role:"teller",skinTone:def.skin,hairColor:def.hair,outfitColor:def.outfit,isMoving:false,emotion},ts,{scale:0.9});
    if (activeTellers.has(i)) drawBubble(ctx,x,y-30,"Next please!");
  }

  // Customers sorted by depth
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
    });

  tickParticles(ctx, particles, 16);
  drawHUD(ctx, hudState);
  drawEventBanner(ctx, activeEvent);
  drawEventBorder(ctx, activeEvent);
}
