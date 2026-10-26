import * as THREE from 'three';
import { COLS, PADDLE_Y, PADDLE_H, BALL_R, COIN_VALUE } from './sim/constants.js';
import { getLevel } from './sim/levels.js';
import { createWorld, stepWorld, drainEvents, launch, setPaddleX, useSkill } from './sim/world.js';
import { ballInside } from './sim/units.js';
import { createStage, toWorldX } from './render/stage.js';
import { createBricks } from './render/bricks.js';
import { createBalls3d } from './render/balls3d.js';
import { createFx } from './render/fx.js';
import { createDrops3d, createBeacon } from './render/drops3d.js';
import { createPhoto } from './render/photo.js';
import { createCoins3d } from './render/coins3d.js';
import { createUnits3d } from './render/units3d.js';
import { createTrails3d } from './render/trails3d.js';
import { createHaptics } from './haptics.js';
import { createFullscreen } from './fullscreen.js';
import { bindUiSounds } from './uiSounds.js';
import { createAudio } from './audio.js';
import { createUI } from './ui.js';
import { createDirector } from './director.js';
import { loadSave, writeSave, recordClear, unlockAchievements, addGold } from './storage.js';
import { loadCredits } from './credits.js';
import { fruitFor } from './fruits.js';
import { ACHIEVEMENTS, earned } from './achievements.js';
import { createQualityGovernor, QUALITY_LEVELS } from './render/quality.js';

const KEY_SPEED = 45; // paddle cells per second with the keyboard
const MAX_DT = 1 / 30;

const stage = createStage(document.getElementById('game'));
const bricks = createBricks(stage.scene);
const trails3d = createTrails3d(stage.scene);
const balls3d = createBalls3d(stage.scene);
const fx = createFx(stage.scene);
const drops3d = createDrops3d(stage.scene);
const beacon = createBeacon(stage.scene);
const photo = createPhoto(stage.scene);
const coins3d = createCoins3d(stage.scene);
const units3d = createUnits3d(stage.scene);
const audio = createAudio();
const haptics = createHaptics();
const fullscreen = createFullscreen();
const quality = createQualityGovernor();
const PADDLE_HEX = 0xa9b8dc; // steel; the paddle's satin sheen brightens its top
const STUN_HEX = 0xff3040;

let save = loadSave();
// Photo credits (author and licence per landmark), shown on the credits screen and under each stage.
let credits = {};
loadCredits().then((c) => { credits = c; if (level && (mode === 'play' || mode === 'paused')) ui.setPhotoCredit(credits[level.photo] ?? null); });
audio.setMuted(save.muted);
haptics.setEnabled(save.vibrate);

let level = null;
let world = null;
let mode = 'title'; // title | play | paused | outro
let elapsed = 0;
let hudTimer = 0;
const keys = new Set();

const ui = createUI({
  onPlay: (i) => startLevel(i),
  onNext: () => startLevel(level.index + 1),
  onRetry: () => startLevel(level.index),
  onMenu: () => { bankLiveGold(); showMenu(); },
  onSkill: (name) => world && mode === 'play' && useSkill(world, name),
  onMute: () => {
    audio.unlock();
    audio.setMuted(!audio.isMuted());
    save = { ...save, muted: audio.isMuted() };
    writeSave(save);
    if (!audio.isMuted()) audio.toggle(); // sound just came back: let it be heard
  },
  onVibe: () => {
    haptics.setEnabled(!haptics.enabled);
    save = { ...save, vibrate: haptics.enabled };
    writeSave(save);
    ui.setVibe(haptics.supported, haptics.enabled);
    haptics.play('launch'); // a little buzz confirms it's on
  },
  onFullscreen: () => { fullscreen.toggle(); },
  sfx: (name, ...args) => audio[name]?.(...args),
  impact: (kind) => {
    stage.shake(kind === 'slam' ? 0.7 : 0.25);
    haptics.play(kind === 'slam' ? 'boom' : 'coin');
  },
  onPause: () => togglePause(),
  onResume: () => togglePause(),
  onAchievements: () => ui.showAchievements(save),
  onCredits: () => ui.showCredits(credits),
});
// Every button press clicks (the press itself unlocks audio on the first tap).
bindUiSounds(document, (name) => { audio.unlock(); audio[name]?.(); });
const director = createDirector({ stage, bricks, fx, audio, ui, units3d, coins3d, haptics });
ui.setVibe(haptics.supported, haptics.enabled);
ui.setFullscreen(fullscreen.supported, fullscreen.active);
// Esc or the system back gesture also leaves fullscreen; keep the labels and the framing in step.
fullscreen.onChange((on) => { ui.setFullscreen(fullscreen.supported, on); stage.resize(); });

function startLevel(i) {
  level = getLevel(i);
  coins3d.reset();
  const p = level.params;
  world = createWorld(level.lines, {
    box: level.box, holes: level.holes,
    brickHp: p.brickHp, lives: p.lives, paddleW: p.paddleW, releaseRate: p.releaseRate,
    dropSpeed: p.dropSpeed, aggression: p.aggression,
  });
  bricks.setLevel(world.grid, level.palette);
  beacon.setLevel(world.grid);
  photo.setLevel(level);
  ui.setPhotoCredit(credits[level.photo] ?? null);
  units3d.setLevel(world.units);
  director.reset();
  stage.setZoom(1);
  elapsed = 0;
  quality.reset();
  mode = 'play';
  ui.startStage(level);
  audio.stageIntro();
  if (world.units.length) {
    const top = Math.max(...world.units.map((u) => u.tier));
    setTimeout(() => ui.toast(`적 유닛 최고 Lv.${top} · ${world.units.length}기 매복`, 'small danger'), 2300);
  }
}

/** Unlocks any achievement this run has earned so far and announces it. */
function checkAchievements(cleared) {
  const w = world;
  const stats = {
    stage: level.index, cleared, peakBalls: w.peakBalls, bestCombo: w.bestCombo, bestStreak: w.bestStreak,
    bestFruit: w.bestFruit, topKill: w.topKill,
    livesLost: Math.max(0, level.params.lives - w.lives), elapsed,
  };
  const fresh = earned(stats, save.achievements);
  if (!fresh.length) return;
  save = unlockAchievements(save, fresh);
  writeSave(save);
  audio.achievement();
  haptics.play('achievement');
  fresh.forEach((id, k) => {
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    setTimeout(() => ui.toast([{ emoji: '🏆' }, ' 업적 달성: ', { emoji: a.icon }, ` ${a.name}`], 'small'), 400 + k * 700);
  });
}

/** Drops one quality step when frames have stayed slow (see render/quality.js). */
function applyQuality(levelIndex) {
  const q = QUALITY_LEVELS[levelIndex];
  balls3d.setShadows(q.ballShadows);
  trails3d.setEnabled(q.trails);
  stage.setQuality(q);
  ui.toast('화질 자동 조정', 'small');
}

/** Leaving a stage mid-run (pause -> menu) keeps the gold caught so far, as a game over does. */
function bankLiveGold() {
  if (!world || (mode !== 'play' && mode !== 'paused') || world.gold <= 0) return;
  save = addGold(save, world.gold);
  writeSave(save);
  world.gold = 0;
}

function togglePause() {
  // Sounds here (not on the buttons) so P / Esc / window blur get them too.
  if (mode === 'play') { mode = 'paused'; haptics.stop(); audio.pause(); ui.showPause(true); }
  else if (mode === 'paused') { mode = 'play'; audio.resume(); ui.showPause(false); }
}

function finishLevel(cleared) {
  mode = 'outro';
  const w = world;
  if (cleared) {
    audio.fanfare();
    stage.setZoom(0.9);
    // Every surviving ball pops into confetti.
    for (let i = 0; i < Math.min(w.balls.n, 400); i++) fx.shards(w.balls.x[i], w.balls.y[i], 0xfff1a8, 1.4);
    w.balls.n = 0;
    // Fruit still in the air pops too, instead of freezing mid-fall.
    for (const d of w.drops) for (let k = 0; k < 24; k++) fx.shards(d.x, d.y, fruitFor(d.mult).color, 1.6);
    w.drops = [];
    // Coins still falling (the finale shakes many loose) are banked, not lost.
    for (const c of w.coins) for (let k = 0; k < 8; k++) fx.shards(c.x, c.y, 0xf2b705, 1.2);
    w.gold += w.coins.length * COIN_VALUE;
    w.coins = [];
    save = addGold(recordClear(save, level.index, w.score), w.gold);
    writeSave(save);
    checkAchievements(true);
    const full = level.params.lives; // stars are relative to this stage's starting lives
    const stars = w.lives >= full ? 3 : w.lives >= full - 1 ? 2 : 1;
    setTimeout(() => ui.showClear({
      score: w.score,
      stars,
      hasNext: true, // endless
      stats: [
        ['클리어 시간', `${elapsed.toFixed(1)}초`],
        ['최대 공 개수', ui.fmt(w.peakBalls)],
        ['최고 콤보', ui.fmt(w.bestCombo)],
        ['부순 벽돌', ui.fmt(w.broken)],
        ['획득 골드', `🪙 ${ui.fmt(w.gold)}`],
        ['남은 목숨', '♥'.repeat(w.lives)],
      ],
    }), w.finale ? 2600 : 1600); // let the finale fireworks play out first
  } else {
    save = addGold(save, w.gold); // gold caught is kept even when the run ends
    writeSave(save);
    checkAchievements(false);
    setTimeout(() => ui.showOver(w.score), 900);
  }
}

// ---------- input ----------

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const paddlePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.5);
const hit = new THREE.Vector3();

function pointerToField(e) {
  ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, stage.camera);
  return raycaster.ray.intersectPlane(paddlePlane, hit) ? hit.x * stage.reach + COLS / 2 : null;
}

window.addEventListener('pointermove', (e) => {
  if (mode !== 'play') return;
  const x = pointerToField(e);
  if (x !== null) setPaddleX(world, x);
});
window.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (mode !== 'play') return;
  const x = pointerToField(e);
  if (x !== null) setPaddleX(world, x);
  launch(world);
});
window.addEventListener('keydown', (e) => {
  audio.unlock();
  keys.add(e.code);
  if (e.repeat || !world) return; // held keys must not burn every skill charge
  if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
  if (mode !== 'play') return;
  if (e.code === 'Space') { e.preventDefault(); launch(world); }
  if (e.code === 'Digit1' || e.code === 'KeyQ') useSkill(world, 'split');
  if (e.code === 'Digit2' || e.code === 'KeyW') useSkill(world, 'meteor');
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => { keys.clear(); if (mode === 'play') togglePause(); });

// ---------- loop ----------

function keyboardPaddle(dt) {
  const dir = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0);
  if (dir) setPaddleX(world, world.paddle.x + dir * KEY_SPEED * dt);
}

const HINT_ABOVE = 9; // cells above the paddle where the launch hint floats

function hud() {
  const g = world.grid;
  if (world.state === 'ready') {
    const at = stage.project(COLS / 2, PADDLE_Y + HINT_ABOVE, 1);
    ui.placeHint(at.x, at.y);
  }
  ui.setHud({
    score: world.score,
    balls: world.state === 'ready' ? 1 : world.balls.n,
    progress: g.total ? 1 - g.remaining / g.total : 1,
    lives: world.lives,
    charges: world.charges,
    ready: world.state === 'ready',
    muted: audio.isMuted(),
    gold: save.gold + world.gold,
  });
}

let last = performance.now();
function frame(now) {
  const rawDt = (now - last) / 1000;
  const dt = Math.min(MAX_DT, rawDt);
  last = now;
  audio.frame();
  const scale = director.tick(dt);
  if (world && (mode === 'play' || mode === 'outro')) {
    if (mode === 'play') {
      keyboardPaddle(dt);
      stepWorld(world, dt * scale);
      elapsed += dt * scale;
      director.handle(drainEvents(world), world);
      if (world.state === 'clear') finishLevel(true);
      else if (world.state === 'over') finishLevel(false);
    }
    const resting = world.state === 'ready' ? { x: world.paddle.x, y: PADDLE_Y + PADDLE_H / 2 + BALL_R } : null;
    balls3d.update(world.balls, resting);
    trails3d.update(world.balls);
    drops3d.update(world.drops, now / 1000);
    coins3d.update(world.coins, now / 1000);
    units3d.update(world.units, world.shells, ballInside(world), now / 1000, dt);
    // A stunned paddle flickers red.
    const stunned = world.stun > 0 && Math.sin(now / 40) > 0;
    stage.paddle.set(toWorldX(world.paddle.x), world.paddle.w, stunned ? STUN_HEX : PADDLE_HEX);
    hudTimer -= dt;
    if (hudTimer <= 0 && mode === 'play') { hud(); checkAchievements(false); hudTimer = 0.08; }
    // Only real-time play frames judge performance (menus and slow-mo don't count).
    if (mode === 'play' && scale === 1) {
      const lv = quality.sample(rawDt);
      if (lv !== null) applyQuality(lv);
    } else quality.reset();
  }
  bricks.update(now / 1000);
  beacon.update(now / 1000);
  fx.update(dt * (mode === 'outro' ? 0.6 : scale));
  stage.render(dt, world ? world.paddle.x : COLS / 2);
  requestAnimationFrame(frame);
}

/** Title screen with the latest unlocked stage as an untouched backdrop. */
function showMenu() {
  mode = 'title';
  const preview = getLevel(save.unlocked - 1);
  const backdrop = createWorld(preview.lines, {
    box: preview.box, holes: preview.holes, brickHp: preview.brickHp, paddleW: preview.params.paddleW,
  });
  bricks.setLevel(backdrop.grid, preview.palette);
  beacon.setLevel(backdrop.grid);
  photo.setLevel(preview);
  drops3d.update([], 0);
  coins3d.reset();
  coins3d.update([], 0);
  units3d.setLevel(backdrop.units);
  units3d.update(backdrop.units, [], false, 0, 0);
  balls3d.update(backdrop.balls, null);
  trails3d.update(backdrop.balls);
  ui.showTitle(save);
}

showMenu();
requestAnimationFrame(frame);
// The first frame is on screen: lift the loading screen (see index.html / boot.js).
requestAnimationFrame(() => {
  const splash = document.getElementById('splash');
  if (!splash) return;
  splash.classList.add('gone');
  setTimeout(() => splash.remove(), 500);
});
document.getElementById('app-version').textContent = `v${__APP_VERSION__}`;

// Dev-only handle for browser E2E checks; stripped from production builds.
if (import.meta.env.DEV) window.__breaker = { get world() { return world; }, stage };
