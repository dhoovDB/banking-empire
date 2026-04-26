// ─── COIN PARTICLE SYSTEM ────────────────────────────────────────────────────

const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const COIN_COLORS = ["#f5a623", "#f0c040", "#e8b830", "#ffd700"];

export function spawnCoins(x, y, depositAmount) {
  const count = Math.min(10, Math.floor(depositAmount / 1500) + 2);
  return Array.from({ length: count }, () => ({
    x,
    y,
    vx:    (Math.random() - 0.5) * 3.5,
    vy:    -(Math.random() * 3.0 + 1.0),
    life:  1.0,
    decay: 0.018 + Math.random() * 0.012,
    size:  3.5 + Math.random() * 2.5,
    color: pick(COIN_COLORS),
  }));
}

export function tickParticles(ctx, particles, _dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x    += p.vx;
    p.y    += p.vy;
    p.vy   += 0.13;
    p.life -= p.decay;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    ctx.globalAlpha = p.life * 0.9;
    ctx.fillStyle   = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
