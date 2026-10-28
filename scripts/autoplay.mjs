// Headless balance check: a bot paddle follows the lowest descending ball.
// Usage: node scripts/autoplay.mjs [seedOffset] [stage,stage,...]
import { getLevel } from '../src/sim/levels.js';
import { createWorld, stepWorld, launch, setPaddleX, useSkill } from '../src/sim/world.js';
import { mulberry32 } from '../src/sim/rng.js';
import { ballInside } from '../src/sim/units.js';

// Sampled stage numbers (1-based) across the 200-stage curve.
const STAGES = process.argv[3]
  ? process.argv[3].split(',').map(Number)
  : [1, 2, 3, 5, 10, 20, 40, 60, 80, 100, 130, 160, 200];
for (const stage of STAGES) {
  const li = stage - 1;
  const lvl = getLevel(li);
  const p = lvl.params;
  const w = createWorld(lvl.lines, { box: lvl.box, holes: lvl.holes, brickHp: p.brickHp, lives: p.lives, paddleW: p.paddleW, releaseRate: p.releaseRate, dropSpeed: p.dropSpeed, aggression: p.aggression, boss: lvl.boss, rng: mulberry32(li + 1 + Number(process.argv[2] ?? 0) * 1000) });
  const total = w.grid.remaining;
  const dt = 1 / 60;
  let t = 0;
  let worst = 0;
  let hits = 0;
  let firstCatch = null;
  let firstEntry = null;
  let finaleAt = null;
  let bossAtFinale = null;
  while (t < 420 && w.state !== 'clear' && w.state !== 'over') {
    if (w.state === 'ready') launch(w);
    if (t > 1 && w.charges.meteor > 0 && w.balls.n < 10) useSkill(w, 'meteor');
    let target = w.paddle.x;
    let low = Infinity;
    for (let i = 0; i < w.balls.n; i++) {
      if (w.balls.vy[i] < 0 && w.balls.y[i] < low) { low = w.balls.y[i]; target = w.balls.x[i]; }
    }
    // Falling multiplier items are worth more than any single ball.
    for (const d of w.drops) if (d.y - 7 < low) { low = d.y - 7; target = d.x; }
    // Sidestep enemy bombs that are about to land on the paddle.
    const threat = w.shells.find((sh) => sh.y < 18 && Math.abs(sh.x + sh.vx * 0.3 - w.paddle.x) < w.paddle.w / 2 + 2);
    // ...unless a ball is about to land: saving the ball beats dodging a stun.
    if (threat && low > 16) target = w.paddle.x + (threat.x < w.paddle.x ? 14 : -14);
    // Aim off-centre so returns fan out like a human player's would.
    const aim = target + Math.sin(t * 1.7) * 4;
    setPaddleX(w, w.paddle.x + Math.max(-2.2, Math.min(2.2, aim - w.paddle.x)));
    if (t > 20 && w.charges.split > 0) useSkill(w, 'split');
    const s = performance.now();
    stepWorld(w, dt);
    worst = Math.max(worst, performance.now() - s);
    hits += w.events.filter((e) => e.t === 'paddle-hit').length;
    if (firstCatch === null && w.collected > 0) firstCatch = t;
    if (finaleAt === null && w.finale) { finaleAt = t; bossAtFinale = w.boss?.alive ? Math.round(100 * w.boss.hp / w.boss.hpMax) : 0; }
    if (firstEntry === null && w.state === 'play' && ballInside(w)) firstEntry = t;
    w.events = [];
    t += dt;
  }
  console.log(`${String(stage).padStart(3)} ${lvl.name.padEnd(8)} holes=${p.holeCount}x${p.holeSize} hp=${p.brickHp} lv=${p.unitTop}x${p.unitCount} bricks=${total} state=${w.state} finale=${finaleAt === null ? '-' : `${finaleAt.toFixed(0)}s(boss ${bossAtFinale}%)`} boss=${w.boss ? (w.boss.alive ? `${Math.round(w.boss.hp)}/${w.boss.hpMax}` : 'down') : '-'} t=${t.toFixed(0)}s afterEntry=${firstEntry === null ? "-" : (t - firstEntry).toFixed(0)}s afterCatch=${firstCatch === null ? "-" : (t - firstCatch).toFixed(0)}s left=${w.grid.remaining} peak=${w.peakBalls} items=${w.collected} hits=${hits} lives=${w.lives} worstStep=${worst.toFixed(2)}ms`);
}
