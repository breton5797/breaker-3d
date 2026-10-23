import * as THREE from 'three';
import { CELL, COLS } from './sim/constants.js';
import { SPECIALS } from './render/bricks.js';
import { fruitFor } from './fruits.js';

const SHARD_BUDGET = 260; // debris spawned per frame at most
const BALL_MILESTONES = [50, 100, 250, 500, 1000, 2000, 3000];
const COMBO_MILESTONES = [100, 300, 1000];

const specialHex = Object.fromEntries(Object.entries(SPECIALS).map(([t, s]) => [t, new THREE.Color(...s.tint).multiplyScalar(0.45).getHex()]));
const STEEL_HEX = 0x6c7a96;

/**
 * Turns sim events into visuals, sound and pacing (slow-mo). Holds only
 * presentation state; never touches the sim.
 */
export function createDirector({ stage, bricks, fx, audio, ui, units3d }) {
  let slow = { scale: 1, until: 0 };
  let ballMark = 0;
  let comboMark = 0;
  let clock = 0;

  function reset() {
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
        case 'zap': fx.zap(e.c, e.r); audio.zap(); break;
        case 'drop': fx.gold(e.c, e.r); audio.drop(); break;
        case 'collect':
          fx.catchBurst(e.x, e.mult);
          stage.shake(Math.min(1.5, 0.3 + e.mult / 60));
          audio.collect(e.mult);
          ui.toast(`${fruitFor(e.mult).emoji} ${fruitFor(e.mult).name}!  →  ${ui.fmt(e.n)} BALLS`, e.mult >= 20 ? 'mega' : '');
          if (e.mult >= 50) slowMo(0.4, 0.5);
          break;
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
          ui.toast(e.lethal ? '치명탄! −1 ♥' : '기절!', 'danger');
          break;
        case 'miss': ui.toast(`${fruitFor(e.mult).emoji} ${fruitFor(e.mult).name} 놓침`, 'small danger'); break;
        case 'paddle': audio.paddle(); break;
        case 'launch': audio.launch(); break;
        case 'skill':
          audio.skill();
          stage.shake(0.6);
          ui.toast(e.name === 'split' ? '전체 ×3 분열!' : '메테오!', 'mega');
          break;
        case 'lost': audio.lost(); stage.shake(1); ui.toast('−1 ♥', 'danger'); break;
        case 'finale':
          ui.toast('FINALE', 'mega');
          slowMo(0.45, 99);
          stage.setZoom(0.93);
          break;
        default: break;
      }
    }
    if (booms >= 3) slowMo(0.5, 0.35);
    if (booms >= 8) stage.shake(1.2);
    milestones(w);
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
