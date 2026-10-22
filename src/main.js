import * as THREE from 'three';
import { COLS, PADDLE_Y, PADDLE_H, BALL_R, START_LIVES } from './sim/constants.js';
import { getLevel, LEVELS } from './sim/levels.js';
import { createWorld, stepWorld, drainEvents, launch, setPaddleX, useSkill } from './sim/world.js';
import { ballInside } from './sim/units.js';
import { createStage, toWorldX } from './render/stage.js';
import { createBricks } from './render/bricks.js';
import { createBalls3d } from './render/balls3d.js';
import { createFx } from './render/fx.js';
import { createDrops3d, createBeacon } from './render/drops3d.js';
import { createUnits3d } from './render/units3d.js';
import { createAudio } from './audio.js';
import { createUI } from './ui.js';
import { createDirector } from './director.js';
import { loadSave, writeSave, recordClear } from './storage.js';

const KEY_SPEED = 45; // paddle cells per second with the keyboard
const MAX_DT = 1 / 30;

const stage = createStage(document.getElementById('game'));
const bricks = createBricks(stage.scene);
const balls3d = createBalls3d(stage.scene);
const fx = createFx(stage.scene);
const drops3d = createDrops3d(stage.scene);
const beacon = createBeacon(stage.scene);
const units3d = createUnits3d(stage.scene);
const audio = createAudio();

let save = loadSave();
audio.setMuted(save.muted);

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
  onMenu: () => showMenu(),
  onSkill: (name) => world && mode === 'play' && useSkill(world, name),
  onMute: () => {
    audio.unlock();
    audio.setMuted(!audio.isMuted());
    save = { ...save, muted: audio.isMuted() };
    writeSave(save);
  },
  onPause: () => togglePause(),
  onResume: () => togglePause(),
});
const director = createDirector({ stage, bricks, fx, audio, ui, units3d });

function startLevel(i) {
  level = getLevel(i);
  world = createWorld(level.lines);
  bricks.setLevel(world.grid, level.palette);
  beacon.setLevel(world.grid);
  units3d.setLevel(world.units);
  director.reset();
  stage.setZoom(1);
  elapsed = 0;
  mode = 'play';
  ui.startStage(level);
  if (world.units.length) {
    const top = Math.max(...world.units.map((u) => u.tier));
    setTimeout(() => ui.toast(`적 유닛 최고 Lv.${top} · ${world.units.length}기 매복`, 'small danger'), 2300);
  }
}

function togglePause() {
  if (mode === 'play') { mode = 'paused'; ui.showPause(true); }
  else if (mode === 'paused') { mode = 'play'; ui.showPause(false); }
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
    save = recordClear(save, level.index, w.score);
    writeSave(save);
    const stars = w.lives >= START_LIVES ? 3 : w.lives >= 2 ? 2 : 1;
    setTimeout(() => ui.showClear({
      score: w.score,
      stars,
      hasNext: true,
      stats: [
        ['클리어 시간', `${elapsed.toFixed(1)}초`],
        ['최대 공 개수', ui.fmt(w.peakBalls)],
        ['최고 콤보', ui.fmt(w.bestCombo)],
        ['부순 벽돌', ui.fmt(w.broken)],
        ['남은 목숨', '♥'.repeat(w.lives)],
      ],
    }), 1600);
  } else {
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
  return raycaster.ray.intersectPlane(paddlePlane, hit) ? hit.x + COLS / 2 : null;
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

function hud() {
  const g = world.grid;
  ui.setHud({
    score: world.score,
    balls: world.state === 'ready' ? 1 : world.balls.n,
    progress: g.total ? 1 - g.remaining / g.total : 1,
    lives: world.lives,
    charges: world.charges,
    ready: world.state === 'ready',
    muted: audio.isMuted(),
  });
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(MAX_DT, (now - last) / 1000);
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
    drops3d.update(world.drops, now / 1000);
    units3d.update(world.units, world.shells, ballInside(world), now / 1000, dt);
    // A stunned paddle flickers red.
    const stunned = world.stun > 0 && Math.sin(now / 40) > 0;
    stage.paddle.material.emissive.setHex(stunned ? 0xff2030 : 0x4060ff);
    stage.paddle.position.x = toWorldX(world.paddle.x);
    stage.paddle.scale.y = world.paddle.w / 1.7;
    hudTimer -= dt;
    if (hudTimer <= 0 && mode === 'play') { hud(); hudTimer = 0.08; }
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
  const preview = getLevel(Math.min(save.unlocked - 1, LEVELS.length - 1));
  const backdrop = createWorld(preview.lines);
  bricks.setLevel(backdrop.grid, preview.palette);
  beacon.setLevel(backdrop.grid);
  drops3d.update([], 0);
  units3d.setLevel(backdrop.units);
  units3d.update(backdrop.units, [], false, 0, 0);
  balls3d.update(backdrop.balls, null);
  ui.showTitle(save);
}

showMenu();
requestAnimationFrame(frame);

// Dev-only handle for browser E2E checks; stripped from production builds.
if (import.meta.env.DEV) window.__breaker = { get world() { return world; } };
