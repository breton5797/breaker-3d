import * as THREE from 'three';
import { CELL, COLS, ROWS, PADDLE_Y } from './sim/constants.js';
import { SPECIALS } from './render/bricks.js';
import { fruitFor } from './fruits.js';
import { fruitArt } from './art.js';
import { createPacing } from './pacing.js';
import { fruitHaptic } from './haptics.js';

const SHARD_BUDGET = 260; // debris spawned per frame at most
const RAINBOW = [0xff4d4d, 0xff9f43, 0xfeca57, 0x1dd1a1, 0x48dbfb, 0x2e86de, 0xa55eea, 0xff6b81];
const rainbow = (k) => RAINBOW[k % RAINBOW.length];
const BALL_MILESTONES = [50, 100, 250, 500, 1000, 2000, 3000];
const COMBO_MILESTONES = [100, 300, 1000];
const COIN_BURSTS = 3; // gold ring + chip bursts per frame at most
const BOOM_FULL = 6; // bombs per frame that get scorch + dust; the rest just ring
const PADDLE_TAP_BALLS = 8; // paddle bounces buzz only while the swarm is this small (else it would hum)

const specialHex = Object.fromEntries(Object.entries(SPECIALS).map(([t, s]) => [t, new THREE.Color(...s.tint).multiplyScalar(0.45).getHex()]));
const STEEL_HEX = 0x6c7a96;

/**
 * Turns sim events into visuals, sound and pacing (slow-mo). Holds only
 * presentation state; never touches the sim.
 */
export function createDirector({ stage, bricks, fx, audio, ui, units3d, coins3d, haptics, gimmicks3d, boss3d }) {
  const pacing = createPacing();
  let ballMark = 0;
  let comboMark = 0;
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
    pacing.reset();
    ballMark = 0;
    comboMark = 0;
  }

  const slowMo = pacing.slowMo;

  /**
   * @param {object[]} events drained from the sim this frame
   * @param {object} w the world (read-only here)
   */
  function handle(events, w) {
    let shards = 0;
    let booms = 0;
    let coinGold = 0;
    let coinX = 0;
    let coinBursts = 0;
    let paddleHits = 0;
    let chips = 0;
    let lasers = 0;
    let coreHits = 0;
    let catches = 0;
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
        case 'hit':
          bricks.dent(w.grid, e.r * COLS + e.c);
          if (chips++ < 40) fx.chip(e.c, e.r);
          audio.pop(0);
          break;
        case 'boom':
          booms++;
          fx.boom(e.c, e.r, booms <= BOOM_FULL);
          stage.shake(0.45);
          if (booms === 1) stage.kick(0, 0, -1.2);
          audio.boom();
          haptics.play('boom');
          break;
        case 'laser':
          fx.laser(e.axis, e.c, e.r);
          stage.shake(0.3);
          if (lasers++ === 0) { if (e.axis === 'h') stage.kick(0, 0.6, 0); else stage.kick(0.6, 0, 0); }
          audio.laser();
          haptics.play('laser');
          break;
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
          if (catches++ === 0) {
            stage.kick(0, 0, -0.3 - e.gain * 0.06);
            stage.paddle.punch(0.35 + e.gain * 0.06);
          }
          audio.collect(e.mult);
          haptics.play(fruitHaptic(e.gain));
          if (e.gain >= 9) pacing.hitStop(0.06);
          {
            const f = fruitFor(e.mult);
            const badge = { small: `×${e.gain}` };
            ui.toast([{ emoji: f.emoji, art: fruitArt(f.id) }, ` ${f.name} `, badge, `!  →  ${ui.fmt(e.n)} BALLS`], e.mult >= 20 ? 'mega' : '');
            // Combo number right where the fruit landed on the paddle.
            const at = stage.project(e.x, PADDLE_Y, 1.5);
            ui.floatAt(at.x, at.y, [[{ big: `${e.streak} COMBO` }], [{ emoji: f.emoji, art: fruitArt(f.id) }, badge]], e.streak >= 5 ? 'hot' : '');
          }
          if (e.mult >= 50) slowMo(0.4, 0.5);
          break;
        case 'coin':
          coins3d.pop(e.x); // every coin gets its own pop; the louder feedback is batched below
          coinGold += e.gold;
          coinX = e.x;
          if (coinBursts < COIN_BURSTS) { fx.coinBurst(e.x); coinBursts++; }
          break;
        case 'fire-shell': audio.shoot(); break;
        case 'over': haptics.play('over'); break;
        case 'unit-hit': units3d.hit(e.c, e.r); audio.pop(0); break;
        case 'unit-down':
          fx.boom(e.c, e.r);
          for (let k = 0; k < 24; k++) fx.shards(e.c + 0.5, e.r + 0.5, 0xff6a4a, 1.4);
          stage.shake(0.3 + e.tier * 0.05);
          audio.boom();
          haptics.play('unitDown');
          if (e.tier >= 3) pacing.hitStop(0.05);
          ui.toast(`Lv.${e.tier} 유닛 격파! +${ui.fmt(200 * e.tier)}`, 'small');
          break;
        case 'paddle-hit':
          stage.shake(e.lethal ? 1.4 : 0.7);
          stage.kick(0, -0.8, e.lethal ? -1.6 : -0.8);
          stage.paddle.shakeOff(1);
          pacing.hitStop(e.lethal ? 0.1 : 0.06);
          audio.stunned();
          haptics.play(e.lethal ? 'lethal' : 'stun');
          ui.damageFlash(e.lethal);
          ui.toast(e.lethal ? '치명탄! −1 ♥' : '기절!', 'danger');
          break;
        case 'miss': ui.toast([{ emoji: fruitFor(e.mult).emoji, art: fruitArt(fruitFor(e.mult).id) }, ` ${fruitFor(e.mult).name} 놓침`], 'small danger'); break;
        case 'paddle':
          audio.paddle();
          if (paddleHits++ === 0) {
            stage.paddle.punch(0.15);
            if (w.balls.n <= PADDLE_TAP_BALLS) haptics.play('paddle');
          }
          break;
        case 'launch': audio.launch(); stage.paddle.punch(0.25); haptics.play('launch'); break;
        case 'skill':
          audio.skill();
          stage.shake(0.6);
          stage.kick(0, 0, -1.5);
          haptics.play('skill');
          ui.toast(e.name === 'split' ? '전체 ×3 분열!' : '메테오!', 'mega');
          break;
        case 'lost':
          audio.lost();
          stage.shake(1);
          stage.kick(0, -1, -1);
          pacing.hitStop(0.1);
          haptics.play('lost');
          ui.damageFlash(true);
          ui.toast('−1 ♥', 'danger');
          break;
        case 'boss-hit':
          boss3d.hit();
          if (coreHits++ < 3) audio.coreHit();
          break;
        case 'boss-shield':
          // The swarm hits faster than the boss can take damage: the rest clank off a shield.
          if (coreHits++ < 3) audio.coreHit();
          ui.bossShield();
          break;
        case 'boss-phase':
          audio.bossWarn();
          stage.shake(1);
          haptics.play('stun');
          for (let k = 0; k < 30; k++) fx.shards(e.x, e.y, e.phase === 3 ? 0x8b93a8 : 0xff2a2a, 1.6);
          ui.toast(e.phase === 3 ? '갑옷이 부서졌다! 지금이야!' : '보스가 분노했다!', 'mega danger');
          break;
        case 'boss-warn':
          if (e.kind === 'sweep') audio.laser(); else audio.rumble();
          break;
        case 'boss-strike':
          boss3d.strike(e, w.boss);
          if (e.kind === 'sweep') { audio.laser(); break; }
          fx.boom(e.x - 0.5, PADDLE_Y - 0.5);
          stage.shake(e.kind === 'stomp' ? 1.2 : 0.8);
          stage.kick(0, 0, -1);
          audio.thunder();
          break;
        case 'boss-down':
          boss3d.down();
          fx.firework(e.x, e.y, 0xffd23a, [1, 0.8, 0.2]);
          fx.firework(e.x, e.y, 0xff5a3c, [1, 0.35, 0.2]);
          stage.shake(2);
          stage.kick(0, 0, -2.5);
          pacing.hitStop(0.12);
          audio.bossDown();
          haptics.play('clear');
          ui.toast('BOSS 격파!', 'mega');
          break;
        case 'storm-warn':
          gimmicks3d.warnColumn(e.c, e.bottom, e.top);
          audio.rumble();
          break;
        case 'storm':
          gimmicks3d.hideWarning();
          fx.zap(e.c, e.bottom, 0xbfe3ff);
          stage.shake(0.7);
          stage.kick(0, 0, -0.8);
          audio.thunder();
          haptics.play('boom');
          break;
        case 'finale':
          haptics.play('milestone');
          zapCount = 0;
          slowMo(0.45, 99);
          stage.setZoom(0.93);
          break;
        case 'clear': haptics.play('clear'); if (w.finale) fireworks(); break;
        default: break;
      }
    }
    if (coinGold) {
      // One jingle, shake, buzz and "+N" per frame, however many coins landed together.
      audio.coin();
      stage.shake(Math.min(0.7, 0.4 + coinGold * 0.05));
      stage.paddle.punch(0.25);
      haptics.play('coin');
      ui.pumpGold();
      const at = stage.project(coinX, PADDLE_Y, 1.5);
      ui.floatAt(at.x, at.y, [[{ emoji: '🪙' }, { big: `+${coinGold}` }]], 'gold');
    }
    if (booms >= 3) { slowMo(0.5, 0.35); pacing.hitStop(0.05); }
    if (booms >= 8) stage.shake(1.2);
    milestones(w);
    ui.setFinale(w.finale && w.state === 'play' ? w.grid.remaining : null);
  }

  function milestones(w) {
    const n = w.balls.n;
    while (ballMark < BALL_MILESTONES.length && n >= BALL_MILESTONES[ballMark]) {
      ui.toast(`${ui.fmt(BALL_MILESTONES[ballMark])} BALLS!`, ballMark >= 4 ? 'mega' : '');
      audio.milestone();
      haptics.play('milestone');
      ballMark++;
    }
    while (comboMark < COMBO_MILESTONES.length && w.combo >= COMBO_MILESTONES[comboMark]) {
      ui.toast(`COMBO ${ui.fmt(COMBO_MILESTONES[comboMark])}`, comboMark >= 2 ? 'mega' : '');
      audio.milestone();
      haptics.play('milestone');
      comboMark++;
    }
  }

  /** @returns {number} sim time scale for this frame */
  function tick(dt) {
    return pacing.tick(dt);
  }

  return { handle, tick, reset, slowMo };
}
