import * as THREE from 'three';
import { CELL, COLS, ROWS, PADDLE_Y } from './sim/constants.js';
import { SPECIALS } from './render/bricks.js';
import { fruitFor } from './fruits.js';

const SHARD_BUDGET = 260; // debris spawned per frame at most
const RAINBOW = [0xff4d4d, 0xff9f43, 0xfeca57, 0x1dd1a1, 0x48dbfb, 0x2e86de, 0xa55eea, 0xff6b81];
const rainbow = (k) => RAINBOW[k % RAINBOW.length];
const BALL_MILESTONES = [50, 100, 250, 500, 1000, 2000, 3000];
const COMBO_MILESTONES = [100, 300, 1000];

const specialHex = Object.fromEntries(Object.entries(SPECIALS).map(([t, s]) => [t, new THREE.Color(...s.tint).multiplyScalar(0.45).getHex()]));
const STEEL_HEX = 0x6c7a96;

/** Phone haptics; silent together with the sound (the mute button is "quiet mode"). */
function buzz(audio, pattern) {
  if (audio.isMuted() || typeof navigator === 'undefined' || !navigator.vibrate) return;
  navigator.vibrate(pattern);
}

/**
 * Turns sim events into visuals, sound and pacing (slow-mo). Holds only
 * presentation state; never touches the sim.
 */
export function createDirector({ stage, bricks, fx, audio, ui, units3d }) {
  let slow = { scale: 1, until: 0 };
  let ballMark = 0;
  let comboMark = 0;
  let clock = 0;
  let zapCount = 0;

  /** Finale send-off: staggered firework bursts across the board. */
  function fireworks() {
    for (let k = 0; k < 9; k++) {
      setTimeout(() => {
        const x = COLS * (0.15 + Math.random() * 0.7);
        const y = ROWS * (0.35 + Math.random() * 0.5);
        const c = new THREE.Color(rainbow(k));
        fx.firework(x, y, rainbow(k), [c.r, c.g, c.b]);
        stage.shake(0.25);
        audio.firework();
      }, k * 160);
    }
  }

  function reset() {
    ui.setFinale(null);
    slow = { scale: 1, until: 0 };
    ballMark = 0;
    comboMark = 0;
  }

  function slowMo(scale, seconds) {
    if (scale <= slow.scale || clock > slow.until) slow = { scale, until: clock + seconds };
  }

  /**
   * @param {object[]} events drained from the sim this frame
   * @param {object} w the world (read-only here)
   */
  function handle(events, w) {
    let shards = 0;
    let booms = 0;
    for (const e of events) {
      switch (e.t) {
        case 'break': {
          bricks.remove(e.r * COLS + e.c, e.type);
          const hex = e.type === CELL.BRICK ? bricks.colorOf(e.color) : specialHex[e.type] ?? STEEL_HEX;
          const n = e.type === CELL.BRICK ? 2 : 6;
          for (let k = 0; k < n && shards < SHARD_BUDGET; k++, shards++) fx.shards(e.c + 0.5, e.r + 0.5, hex, e.type === CELL.BRICK ? 1 : 1.3);
          audio.pop(w.combo);
          break;
        }
        case 'hit': bricks.dent(w.grid, e.r * COLS + e.c); audio.pop(0); break;
        case 'boom':
          booms++;
          fx.boom(e.c, e.r);
          stage.shake(0.45);
          audio.boom();
          break;
        case 'laser': fx.laser(e.axis, e.c, e.r); stage.shake(0.3); audio.laser(); break;
        case 'split': fx.split(e.c, e.r, e.n); audio.split(e.n); break;
        case 'gold': fx.gold(e.c, e.r); audio.gold(); ui.toast(e.skill === 'split' ? '+1 분열' : '+1 메테오', 'small'); break;
        case 'fire': audio.split(5); break;
        case 'zap':
          fx.zap(e.c, e.r, rainbow(zapCount));
          audio.zap(zapCount++);
          stage.shake(0.06);
          break;
        case 'drop': fx.gold(e.c, e.r); audio.drop(); break;
        case 'collect':
          fx.catchBurst(e.x, e.mult);
          stage.shake(Math.min(1.5, 0.3 + e.mult / 60));
          audio.collect(e.mult);
          buzz(audio, e.mult >= 50 ? [20, 30, 20] : 15);
          {
            const f = fruitFor(e.fruit ?? e.mult);
            const badge = { small: e.fever ? `🔥×${e.mult}` : `×${e.mult}` };
            ui.toast([{ emoji: f.emoji }, ` ${f.name} `, badge, `!  →  ${ui.fmt(e.n)} BALLS`], e.mult >= 20 ? 'mega' : '');
            // Combo number right where the fruit landed on the paddle.
            const at = stage.project(e.x, PADDLE_Y, 1.5);
            ui.floatAt(at.x, at.y, [[{ big: `${e.streak} COMBO` }], [{ emoji: f.emoji }, badge]], e.streak >= 5 ? 'hot' : '');
          }
          if (e.mult >= 50) slowMo(0.4, 0.5);
          break;
        case 'fever':
          audio.fever();
          stage.shake(0.8);
          buzz(audio, [30, 40, 30, 40, 60]);
          ui.toast([{ emoji: '🔥' }, ' FRUIT FEVER! ', { emoji: '🔥' }], 'mega');
          setTimeout(() => ui.toast('패들 확대 · 과일 자석 · 배수 ×2', 'small'), 300);
          break;
        case 'fever-end': ui.toast('피버 종료', 'small'); break;
        case 'fire-shell': audio.shoot(); break;
        case 'unit-hit': units3d.hit(e.c, e.r); audio.pop(0); break;
        case 'unit-down':
          fx.boom(e.c, e.r);
          for (let k = 0; k < 24; k++) fx.shards(e.c + 0.5, e.r + 0.5, 0xff6a4a, 1.4);
          stage.shake(0.3 + e.tier * 0.05);
          audio.boom();
          ui.toast(`Lv.${e.tier} 유닛 격파! +${ui.fmt(200 * e.tier)}`, 'small');
          break;
        case 'paddle-hit':
          stage.shake(e.lethal ? 1.4 : 0.7);
          audio.stunned();
          buzz(audio, e.lethal ? [80, 40, 120] : 60);
          ui.toast(e.lethal ? '치명탄! −1 ♥' : '기절!', 'danger');
          break;
        case 'miss': ui.toast([{ emoji: fruitFor(e.mult).emoji }, ` ${fruitFor(e.mult).name} 놓침`], 'small danger'); break;
        case 'paddle': audio.paddle(); break;
        case 'launch': audio.launch(); break;
        case 'skill':
          audio.skill();
          stage.shake(0.6);
          ui.toast(e.name === 'split' ? '전체 ×3 분열!' : '메테오!', 'mega');
          break;
        case 'lost': audio.lost(); stage.shake(1); buzz(audio, 150); ui.toast('−1 ♥', 'danger'); break;
        case 'finale':
          zapCount = 0;
          slowMo(0.45, 99);
          stage.setZoom(0.93);
          break;
        case 'clear': if (w.finale) fireworks(); break;
        default: break;
      }
    }
    if (booms >= 3) slowMo(0.5, 0.35);
    if (booms >= 8) stage.shake(1.2);
    milestones(w);
    ui.setFinale(w.finale && w.state === 'play' ? w.grid.remaining : null);
  }

  function milestones(w) {
    const n = w.balls.n;
    while (ballMark < BALL_MILESTONES.length && n >= BALL_MILESTONES[ballMark]) {
      ui.toast(`${ui.fmt(BALL_MILESTONES[ballMark])} BALLS!`, ballMark >= 4 ? 'mega' : '');
      ballMark++;
    }
    while (comboMark < COMBO_MILESTONES.length && w.combo >= COMBO_MILESTONES[comboMark]) {
      ui.toast(`COMBO ${ui.fmt(COMBO_MILESTONES[comboMark])}`, comboMark >= 2 ? 'mega' : '');
      comboMark++;
    }
  }

  /** @returns {number} sim time scale for this frame */
  function tick(dt) {
    clock += dt;
    if (clock > slow.until) slow = { scale: 1, until: 0 };
    return slow.scale;
  }

  return { handle, tick, reset, slowMo };
}
