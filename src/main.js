import * as THREE from 'three';
import { COLS, ROWS, PADDLE_Y, PADDLE_H, BALL_R, COIN_VALUE } from './sim/constants.js';
import { predictPath } from './sim/aim.js';
import { aimStep } from './aimInput.js';
import { GUARD_FLOOR } from './sim/boss.js';
import { getLevel } from './sim/levels.js';
import { t, detectLanguage, setLanguage } from './i18n.js';
import { stageTitleAt, bossBarName, stageBossName, bossName, chapterName, achievementName } from './names.js';
import { createWorld, stepWorld, drainEvents, launch, setPaddleX, useSkill, revive } from './sim/world.js';
import { ballInside } from './sim/units.js';
import { createStage, toWorldX } from './render/stage.js';
import { createBricks } from './render/bricks.js';
import { createBalls3d } from './render/balls3d.js';
import { createAimGuide } from './render/aimGuide.js';
import { createFx } from './render/fx.js';
import { createDrops3d, createBeacon } from './render/drops3d.js';
import { createPhoto } from './render/photo.js';
import { createCoins3d } from './render/coins3d.js';
import { createUnits3d } from './render/units3d.js';
import { createTrails3d } from './render/trails3d.js';
import { createGimmicks3d } from './render/gimmicks3d.js';
import { createBoss3d, ENTRY_TIME } from './render/boss3d.js';
import { createTimers } from './timers.js';
import { createHaptics } from './haptics.js';
import { createFullscreen } from './fullscreen.js';
import { bindUiSounds } from './uiSounds.js';
import { createAudio } from './audio.js';
import { createUI } from './ui.js';
import { createDirector } from './director.js';
import { loadSave, writeSave, recordClear, unlockAchievements, addGold } from './storage.js';
import { loadCredits } from './credits.js';
import { fruitFor } from './fruits.js';
import { ACHIEVEMENTS, earned, achievementGold } from './achievements.js';
import {
  recordStars, totalStars, claimChests, dailyBonus, today, recordBeaten, progressShare,
  buyInPlay, SKILL_USES, SKILL_PRICES, refundLoadout, firstClearBonus, chestProgress,
} from './meta.js';
import { createQualityGovernor, QUALITY_LEVELS } from './render/quality.js';
import { Capacitor } from '@capacitor/core';
import { createMonetization } from './monetize/platform.js';
import { rewardOffers } from './monetize/rewards.js';
import { PRODUCT_REMOVE_ADS } from './monetize/store.js';

const BOSS_LANDING_MS = ENTRY_TIME * 1000; // the boss's drop onto the board (boss3d)
const KEY_SPEED = 45; // paddle cells per second with the keyboard
const MAX_DT = 1 / 30;

// The save first, then the language (the player's pick, else the device's) before anything else
// runs: this await is the only one at module level, so nothing below is half-initialised during it.
let save = refundLoadout(loadSave()); // the title's next-stage shop is gone: its charges come back as gold
await setLanguage(detectLanguage(navigator.languages, save.lang));

const stage = createStage(document.getElementById('game'));
const bricks = createBricks(stage.scene);
const trails3d = createTrails3d(stage.scene);
const aimGuide = createAimGuide(stage.scene);
const gimmicks3d = createGimmicks3d(stage.scene);
const boss3d = createBoss3d(stage.scene);
const balls3d = createBalls3d(stage.scene);
const fx = createFx(stage.scene);
const drops3d = createDrops3d(stage.scene);
const beacon = createBeacon(stage.scene);
const photo = createPhoto(stage.scene);
const coins3d = createCoins3d(stage.scene);
const units3d = createUnits3d(stage.scene);
const audio = createAudio();
const haptics = createHaptics();
const { ads, store, ready: monetizationReady } = createMonetization({
  dev: import.meta.env.DEV,
  search: location.search,
  native: Capacitor.isNativePlatform() ? { platform: Capacitor.getPlatform() } : null,
  env: import.meta.env,
});
// The app's ads and store come up a moment after launch: refresh the title's shop button then.
monetizationReady.then(() => { if (mode === 'title') showStore(); });
// This attempt at the current stage: revives used and gold already banked (a game over banks it).
let run = { revivesUsed: 0, goldBanked: 0, goldDoubled: false, clearGold: 0 };
const fullscreen = createFullscreen();
const quality = createQualityGovernor();
const PADDLE_HEX = 0xa9b8dc; // steel; the paddle's satin sheen brightens its top
const STUN_HEX = 0xff3040;

let saveWarned = false;
/** Saves progress; the first time it cannot (private mode, full storage) the player is told once. */
function persist() {
  if (writeSave(save) || saveWarned) return;
  saveWarned = true;
  ui.toast(t('stage.saveFail'), 'small danger');
}
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
  onSkill: (name) => trySkill(name),
  onMute: () => {
    audio.unlock();
    audio.setMuted(!audio.isMuted());
    save = { ...save, muted: audio.isMuted() };
    persist();
    if (!audio.isMuted()) audio.toggle(); // sound just came back: let it be heard
  },
  onVibe: () => {
    haptics.setEnabled(!haptics.enabled);
    save = { ...save, vibrate: haptics.enabled };
    persist();
    ui.setVibe(haptics.supported, haptics.enabled);
    haptics.play('launch'); // a little buzz confirms it's on
  },
  onFullscreen: () => { fullscreen.toggle(); },
  sfx: (name, ...args) => audio[name]?.(...args),
  impact: (kind) => {
    stage.shake(kind === 'slam' ? 0.7 : 0.25);
    haptics.play(kind === 'slam' ? 'boom' : 'coin');
  },
  onRevive: () => rewardThen('btn-revive', 'revive', reviveRun),
  onDoubleGold: () => rewardThen('btn-double-gold', 'doubleGold', doubleClearGold),
  onRemoveAds: () => buyRemoveAds(),
  onRestore: () => restorePurchases(),
  onPause: () => togglePause(),
  onResume: () => togglePause(),
  onAchievements: () => ui.showAchievements(save),
  onPickSplit: (mult) => pickSplit(mult),
  onClosePicker: () => closePicker(),
  onCredits: () => ui.showCredits(credits),
  onCollection: () => ui.showCollection(save, 'boss'),
  onLanguage: async (code) => {
    save = { ...save, lang: code }; // '' = follow the device
    persist();
    await setLanguage(detectLanguage(navigator.languages, code));
    ui.relocalize(code);
    if (mode === 'title') showMenu();
  },
  later: (fn, ms) => stageTimers.later(fn, ms), // stage-bound delays (cancelled when the stage is left)
});
ui.relocalize(save.lang); // the language pickers show the saved choice ('' = device)
// Every button press clicks (the press itself unlocks audio on the first tap).
bindUiSounds(document, (name) => { audio.unlock(); audio[name]?.(); });
const director = createDirector({
  stage, bricks, fx, audio, ui, units3d, coins3d, haptics, gimmicks3d, boss3d,
  canAfford: (price) => save.gold + (world?.gold ?? 0) >= price, // the meteor hint only points at a meteor the coins cover
});
ui.setVibe(haptics.supported, haptics.enabled);
// An app is already full screen: no button there.
ui.setFullscreen(fullscreen.supported && !Capacitor.isNativePlatform(), fullscreen.active);
// Esc or the system back gesture also leaves fullscreen; keep the labels and the framing in step.
fullscreen.onChange((on) => { ui.setFullscreen(fullscreen.supported && !Capacitor.isNativePlatform(), on); stage.resize(); layoutOverlays(); });

/** Toasts and the boss bar go in the band above the board; it moves with the screen shape. */
function layoutOverlays() {
  if (!level?.box) return;
  requestAnimationFrame(() => ui.layoutOverlays(
    stage.project(COLS / 2, level.box.top + 1, 0).y,
    stage.project(COLS / 2, level.box.bottom, 0).y,
    stage.project(COLS / 2, PADDLE_Y + PADDLE_H, 0).y,
  ));
}
window.addEventListener('resize', layoutOverlays);

// Stage-intro tips and achievement toasts: called off when the stage is left.
const stageTimers = createTimers();

let usedSkills = { split: 0, meteor: 0 }; // skills bought and fired this stage (SKILL_USES each)
let stageAchievements = []; // ids unlocked during this stage, listed on the clear screen
let picking = false; // the split picker is open: the stage holds still while you choose

/** Can this skill fire right now? (A split needs balls in flight; a meteor works before the serve too.) */
const canFire = (kind) => (kind === 'split' ? world.state === 'play' && world.balls.n > 0 : world.state === 'play' || world.state === 'ready');
const BUY_GAP = 250; // ms between two buys, so a double tap doesn't spend both uses at once
let lastBuy = 0;

/** Buys one use of a skill with coins (this stage's first, then banked) and fires it. Never charges for a skill that can't fire. */
function buySkill(kind, mult) {
  if (!world || mode !== 'play') return false;
  if (!canFire(kind)) { ui.toast(t('skill.needBall'), 'small'); return false; }
  const now = performance.now();
  if (now - lastBuy < BUY_GAP) return false;
  const r = buyInPlay(save, world.gold, kind, usedSkills[kind], mult);
  if (!r.ok) {
    ui.toast(usedSkills[kind] >= SKILL_USES ? t('skill.limit', { skill: t(`skill.${kind}`), n: SKILL_USES }) : t('skill.noCoins'), 'small');
    return false;
  }
  save = r.save;
  world.gold = r.live;
  persist();
  world.charges = { ...world.charges, [kind]: world.charges[kind] + 1 };
  usedSkills = { ...usedSkills, [kind]: usedSkills[kind] + 1 };
  lastBuy = now;
  audio.coin();
  haptics.play('coin');
  useSkill(world, kind, mult);
  return true;
}

/** A skill tap: meteor buys and fires at once; split opens the picker of multipliers (x2-x5). */
function trySkill(kind) {
  if (!world || mode !== 'play') return;
  if (kind === 'meteor') { buySkill('meteor'); return; }
  if (picking) { closePicker(); return; }
  if (!canFire('split')) { ui.toast(t('skill.needBall'), 'small'); return; }
  if (usedSkills.split >= SKILL_USES) { ui.toast(t('skill.limit', { skill: t('skill.split'), n: SKILL_USES }), 'small'); return; }
  picking = true;
  ui.showSplitPicker(splitOffers());
}

function pickSplit(mult) {
  if (!picking) return;
  closePicker();
  buySkill('split', mult);
}

function closePicker() {
  picking = false;
  ui.showSplitPicker(null);
}

/** Each split multiplier's price and whether the coins cover it now. */
function splitOffers() {
  const coins = save.gold + world.gold;
  return Object.fromEntries(Object.entries(SKILL_PRICES.split).map(([m, price]) => [m, { price, can: coins >= price }]));
}

/** The skill badges: the cheapest price, whether a use can be bought now, and uses left this stage. */
function skillPrices() {
  const coins = save.gold + world.gold;
  const offer = (kind, price) => ({ price, can: usedSkills[kind] < SKILL_USES && coins >= price, left: SKILL_USES - usedSkills[kind] });
  return { split: offer('split', Math.min(...Object.values(SKILL_PRICES.split))), meteor: offer('meteor', SKILL_PRICES.meteor) };
}

function startLevel(i) {
  stageTimers.cancelAll();
  usedSkills = { split: 0, meteor: 0 };
  stageAchievements = [];
  picking = false;
  ui.showSplitPicker(null);
  run = { revivesUsed: 0, goldBanked: 0, goldDoubled: false, clearGold: 0 };
  level = getLevel(i);
  coins3d.reset();
  const p = level.params;
  world = createWorld(level.lines, {
    box: level.box, holes: level.holes,
    brickHp: p.brickHp, lives: p.lives, paddleW: p.paddleW, releaseRate: p.releaseRate,
    dropSpeed: p.dropSpeed, aggression: p.aggression,
    boss: level.boss, theme: level.theme ?? null,
    charges: { split: 0, meteor: 0 }, // no free skills: each use is bought with coins (skill buttons)
  });
  bricks.setLevel(world.grid, level.palette);
  beacon.setLevel(world.grid);
  photo.setLevel(level);
  ui.setPhotoCredit(credits[level.photo] ?? null);
  units3d.setLevel(world.units);
  gimmicks3d.setLevel(world.gimmick);
  boss3d.setBoss(world.boss);
  director.reset();
  stage.setZoom(1);
  layoutOverlays();
  elapsed = 0;
  quality.reset();
  mode = 'play';
  ui.startStage(level);
  if (level.bossStage) audio.bossWarn(); else audio.stageIntro();
  if (level.boss) {
    // The boss drops onto the board (boss3d) and its card slides in: a roar and a thud as it lands.
    const name = stageBossName(level);
    stageTimers.later(() => {
      ui.bossCard({ kind: level.boss.kind, name, big: level.bossStage, mode: 'intro' });
      audio.roar();
      stage.shake(level.bossStage ? 1.8 : 1.2);
      stage.kick(0, 0, -1.5);
      haptics.play(level.bossStage ? 'stun' : 'boom');
    }, BOSS_LANDING_MS);
    // The how-to line only while it is news: the first stages, and the first big bosses.
    if (level.index < 3 || (level.bossStage && level.index < 20)) {
      stageTimers.later(() => ui.toast(level.bossStage ? t('stage.bossTipBig') : t('stage.bossTip'), 'small'), BOSS_LANDING_MS + 2000);
    }
  }
  if (level.chapterStart && level.chapterId) {
    stageTimers.later(() => ui.toast(t('stage.newChapter', { name: chapterName(level.chapterId) }), 'mega'), 400);
    stageTimers.later(() => ui.toast(t(`chapter.tip.${level.chapterId}`), 'small'), 1600);
  }
  // Gimmick and unit tips wait for the first ball to get in (the opening has enough going on).
  const tips = [];
  if (['space', 'sea', 'nature'].includes(level.theme)) tips.push({ text: t(`gimmick.${level.theme}`) });
  if (world.units.length) {
    const top = Math.max(...world.units.map((u) => u.tier));
    tips.push({ text: t('stage.units', { top, n: world.units.length }), cls: 'small danger' });
  }
  director.setEntryTips(tips);
}

/** Unlocks any achievement this run has earned so far and announces it. */
function checkAchievements(cleared) {
  const w = world;
  const stats = {
    stage: level.index, cleared, peakBalls: w.peakBalls, bestCombo: w.bestCombo, bestStreak: w.bestStreak,
    bestFruit: w.bestFruit, topKill: w.topKill,
    livesLost: Math.max(0, level.params.lives - w.lives), elapsed,
    totalStars: totalStars(save), streak: save.daily.streak, beaten: save.beaten,
  };
  const fresh = earned(stats, save.achievements);
  if (!fresh.length) return;
  const reward = achievementGold(fresh);
  save = addGold(unlockAchievements(save, fresh), reward);
  persist();
  stageAchievements = [...stageAchievements, ...fresh];
  audio.achievement();
  haptics.play('achievement');
  // Toasts only in the thick of play: during the finale and the clear they would be lost (or cover the
  // boss), and the clear screen lists everything the stage earned anyway.
  if (cleared || (w.finale && w.boss?.alive)) return;
  fresh.forEach((id, k) => {
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    stageTimers.later(() => ui.toast([{ emoji: '🏆' }, t('achv.unlocked'), { emoji: a.icon }, ` ${achievementName(a)} +${a.gold}🪙`], 'small'), 400 + k * 700);
  });
}

/** Drops one quality step when frames have stayed slow (see render/quality.js). */
function applyQuality(levelIndex) {
  const q = QUALITY_LEVELS[levelIndex];
  balls3d.setShadows(q.ballShadows);
  trails3d.setEnabled(q.trails);
  stage.setQuality(q);
  ui.toast(t('stage.quality'), 'small');
}

/** Leaving a stage mid-run (pause -> menu) keeps the gold caught so far, as a game over does. */
function bankLiveGold() {
  if (!world || (mode !== 'play' && mode !== 'paused') || world.gold <= 0) return;
  save = addGold(save, world.gold);
  persist();
  world.gold = 0;
}

function togglePause() {
  // Sounds here (not on the buttons) so P / Esc / window blur get them too.
  if (mode === 'play') { mode = 'paused'; aim = NO_AIM; closePicker(); haptics.stop(); audio.pause(); ui.showPause(true); }
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
    const prevBest = save.best[level.index] ?? 0;
    const full = level.params.lives; // stars are relative to this stage's starting lives
    const stars = w.lives >= full ? 3 : w.lives >= full - 1 ? 2 : 1;
    const firstClear = firstClearBonus(save, level.index); // a stage's first clear pays a little extra (owner, 2026-10-30)
    save = recordStars(addGold(recordClear(save, level.index, w.score), w.gold + firstClear), level.index, stars);
    if (w.boss && !w.boss.alive) save = recordBeaten(save, w.boss.kind, level.index);
    // Stars open chests; the day's first clear pays (and grows the streak).
    const chest = claimChests(save);
    const daily = dailyBonus(chest.save, today());
    save = daily.save;
    persist();
    run.clearGold = w.gold + run.goldBanked; // all gold this attempt (before and after a revive)
    checkAchievements(true);
    const bonus = [
      ...(firstClear ? [t('clear.firstClear', { gold: firstClear })] : []),
      ...(daily.gold ? [t('clear.daily', { gold: daily.gold, n: daily.streak })] : []),
      ...(chest.gold ? [t('clear.chest', { gold: chest.gold })] : []),
      ...stageAchievements.map((id) => ACHIEVEMENTS.find((x) => x.id === id)).filter(Boolean)
        .map((a) => t('clear.achv', { name: achievementName(a), gold: a.gold })),
    ];
    const upcoming = getLevel(level.index + 1);
    setTimeout(() => ui.showClear({
      score: w.score,
      stars,
      hasNext: true, // endless
      goldOffer: offers().doubleGold,
      newBest: prevBest > 0 && w.score > prevBest,
      bonus,
      meta: t('clear.meta', { stars: totalStars(save), n: chestProgress(save).toNext }),
      // A big boss stage is named after its boss already; a map stage names its own boss.
      next: { name: stageTitleAt(level.index + 1), boss: upcoming.bossStage ? null : bossName(upcoming.boss.kind) },
      stats: [
        [t('clear.time'), t('clear.seconds', { s: elapsed.toFixed(1) })],
        [t('clear.peak'), ui.fmt(w.peakBalls)],
        [t('clear.combo'), ui.fmt(w.bestCombo)],
        [t('clear.broken'), ui.fmt(w.broken)],
        [t('clear.gold'), `🪙 ${ui.fmt(run.clearGold)}`],
        [t('clear.lives'), '♥'.repeat(w.lives)],
      ],
    }), w.finale ? 2600 : 1600); // let the finale fireworks play out first
  } else {
    save = addGold(save, w.gold); // gold caught is kept even when the run ends
    persist();
    run.goldBanked += w.gold;
    w.gold = 0; // banked: a revived run must not bank it twice
    checkAchievements(false);
    // What the run still earned, and one thing to try next time.
    const tip = !w.entered ? t('over.tipMeteor', { price: SKILL_PRICES.meteor }) : w.boss ? t('over.tipBoss') : t('over.tipFruit');
    const over = { gold: run.goldBanked, total: save.gold, best: save.best[level.index] ?? 0, tip };
    setTimeout(() => ui.showOver(w.score, offers().revive, progressShare(w.grid), over), 900);
  }
}

// ---------- rewards and the remove-ads purchase ----------

function offers() {
  return rewardOffers({
    adsAvailable: ads.available(),
    adsRemoved: save.adsRemoved,
    revivesUsed: run.revivesUsed,
    goldEarned: run.clearGold,
    goldDoubled: run.goldDoubled,
  });
}

/** Plays a rewarded ad (or skips it once ads were removed), then grants the reward. */
async function rewardThen(buttonId, placement, grant) {
  const via = offers()[placement];
  if (!via) return;
  if (via === 'ad') {
    ui.rewardState(buttonId, 'loading');
    audio.setMuted(true); // the ad brings its own sound
    const earned = await ads.showRewarded(placement);
    audio.setMuted(save.muted);
    if (!earned) { ui.rewardState(buttonId, 'failed'); return; }
  }
  grant(buttonId);
}

function reviveRun() {
  if (!world || !revive(world)) return;
  run.revivesUsed++;
  mode = 'play';
  ui.resumePlay();
  audio.achievement();
  haptics.play('skill');
  ui.toast(t('reward.revived'), 'mega');
}

function doubleClearGold(buttonId) {
  if (run.goldDoubled || run.clearGold <= 0) return;
  run.goldDoubled = true;
  save = addGold(save, run.clearGold);
  persist();
  audio.coin();
  haptics.play('coin');
  ui.rewardState(buttonId, 'done', t('clear.doubled', { gold: run.clearGold }));
  ui.toast([{ emoji: '🪙' }, ` +${ui.fmt(run.clearGold)}`], 'mega');
}

function showStore() {
  ui.setStore({ available: store.available(), price: store.price(PRODUCT_REMOVE_ADS), adsRemoved: save.adsRemoved });
}

function grantRemoveAds() {
  save = { ...save, adsRemoved: true };
  persist();
  showStore();
}

async function buyRemoveAds() {
  if (!(await store.buy(PRODUCT_REMOVE_ADS))) return;
  grantRemoveAds();
  audio.achievement();
  ui.toast(t('store.removed'), 'small');
}

async function restorePurchases() {
  const owned = await store.restore();
  if (owned.includes(PRODUCT_REMOVE_ADS)) {
    grantRemoveAds();
    ui.toast(t('store.restored'), 'small');
  } else ui.toast(t('store.nothing'), 'small');
}

// ---------- input ----------

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const paddlePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.5);
const hit = new THREE.Vector3();

/** Where the pointer is on the board: x for the paddle (with finger reach), and the true x, y. */
function pointerOnBoard(e) {
  ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, stage.camera);
  if (!raycaster.ray.intersectPlane(paddlePlane, hit)) return null;
  return { paddleX: hit.x * stage.reach + COLS / 2, x: hit.x + COLS / 2, y: hit.y + ROWS / 2 };
}
const pointerToField = (e) => pointerOnBoard(e)?.paddleX ?? null;

// Serving: press and the ball stays put while you aim; release fires along the guide.
// Near the paddle the finger moves it; a little above it, it points the aim (aimInput.js).
const NO_AIM = Object.freeze({ angle: 0, held: false, id: null }); // id: the finger (pointer) doing the aiming
let aim = NO_AIM;

function aimAt(e) {
  const p = pointerOnBoard(e);
  if (!p) return;
  const step = aimStep(p, world.paddle.x, aim.angle);
  if (step.paddleX !== null) setPaddleX(world, step.paddleX);
  aim = { ...aim, angle: step.angle };
}

window.addEventListener('pointermove', (e) => {
  if (mode !== 'play') return;
  if (aim.held) { if (e.pointerId === aim.id && world.state === 'ready') aimAt(e); return; }
  const x = pointerToField(e);
  if (x !== null) setPaddleX(world, x);
});
window.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (mode !== 'play') return;
  if (world.state === 'ready') {
    if (aim.held) return; // a second finger never takes over (or resets) the aim
    aim = { angle: 0, held: true, id: e.pointerId };
    aimAt(e);
    return;
  }
  const x = pointerToField(e);
  if (x !== null) setPaddleX(world, x);
});
window.addEventListener('pointerup', (e) => {
  if (!aim.held || e.pointerId !== aim.id) return; // another finger (e.g. one that tapped a button) lifting
  const { angle } = aim;
  aim = NO_AIM;
  if (mode === 'play') launch(world, angle);
});
window.addEventListener('pointercancel', (e) => { if (e.pointerId === aim.id) aim = NO_AIM; });
window.addEventListener('keydown', (e) => {
  audio.unlock();
  keys.add(e.code);
  if (e.code === 'Escape' && mode === 'title' && ui.closeSubscreen()) return; // achievements / credits -> title
  if (e.repeat || !world) return; // held keys must not burn every skill charge
  if (picking) {
    // The split picker is open: 2-5 choose the multiplier, 1 or Esc closes it.
    const mult = { Digit2: 2, Digit3: 3, Digit4: 4, Digit5: 5 }[e.code];
    if (mult) pickSplit(mult);
    else if (e.code === 'Digit1' || e.code === 'Escape') closePicker();
    return;
  }
  if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
  if (mode !== 'play') return;
  if (e.code === 'Space') { e.preventDefault(); launch(world, aim.angle); }
  if (e.code === 'Digit1' || e.code === 'KeyQ') trySkill('split');
  if (e.code === 'Digit2' || e.code === 'KeyW') trySkill('meteor');
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => { keys.clear(); if (mode === 'play') togglePause(); });
// Phones: switching apps or tabs hides the page without a blur. Pause and go quiet until it's back.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { keys.clear(); if (mode === 'play') togglePause(); }
  audio.sleep(document.hidden);
});

// ---------- loop ----------

function keyboardPaddle(dt) {
  const dir = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0);
  if (dir) setPaddleX(world, world.paddle.x + dir * KEY_SPEED * dt);
}

const HINT_ABOVE = 9; // cells above the paddle where the launch hint floats

/** The serve hint in the player's language (aimInput.aimLabel is the Korean original, kept for its tests). */
function aimText(angle, held) {
  if (!held) return t('aim.hint');
  const deg = Math.round((Math.abs(angle) * 180) / Math.PI);
  if (deg === 0) return t('aim.vertical');
  return t('aim.angle', { angle: angle < 0 ? `◀ ${deg}°` : `${deg}° ▶` });
}

function hud() {
  const g = world.grid;
  if (world.state === 'ready') {
    const at = stage.project(COLS / 2, PADDLE_Y + HINT_ABOVE, 1);
    ui.placeHint(at.x, at.y, aimText(aim.angle, aim.held));
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
    prices: skillPrices(),
  });
  const barName = world.boss?.alive ? bossBarName(level) : null;
  ui.setBoss(barName, world.boss ? world.boss.hp / world.boss.hpMax : 1, GUARD_FLOOR);
}

let last = performance.now();
let crashes = 0; // frames in a row that threw
const MAX_CRASHES = 30;

/**
 * One frame, guarded: a single bad frame (an unexpected state somewhere) must not
 * freeze the game for good, so the loop always carries on. Only if every frame
 * keeps failing does the player get the reload notice (progress is saved).
 */
function frame(now) {
  try {
    step(now);
    crashes = 0;
  } catch (err) {
    crashes++;
    last = now;
    if (crashes === 1) console.error(err);
    if (crashes >= MAX_CRASHES) {
      document.getElementById('boot-error-text').textContent = t('boot.crashed');
      document.getElementById('boot-error').hidden = false;
      return;
    }
  }
  requestAnimationFrame(frame);
}

function step(now) {
  const rawDt = (now - last) / 1000;
  const dt = Math.min(MAX_DT, rawDt);
  last = now;
  audio.frame();
  const scale = director.tick(dt);
  if (world && (mode === 'play' || mode === 'outro')) {
    if (mode === 'play' && !picking) {
      keyboardPaddle(dt);
      stepWorld(world, dt * scale);
      elapsed += dt * scale;
      director.handle(drainEvents(world), world);
      if (world.state === 'clear') finishLevel(true);
      else if (world.state === 'over') finishLevel(false);
    }
    const resting = world.state === 'ready' ? { x: world.paddle.x, y: PADDLE_Y + PADDLE_H / 2 + BALL_R } : null;
    aimGuide.show(mode === 'play' && world.state === 'ready' ? predictPath(world, aim.angle) : null);
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
  gimmicks3d.update(now / 1000, dt);
  boss3d.update(world ? world.boss : null, world ? world.paddle.x : 0, now / 1000, dt);
  beacon.update(now / 1000);
  fx.update(dt * (mode === 'outro' ? 0.6 : scale));
  stage.render(dt, world ? world.paddle.x : COLS / 2);
}

/** Title screen with the latest unlocked stage as an untouched backdrop. */
function showMenu() {
  mode = 'title';
  aim = NO_AIM;
  picking = false;
  ui.showSplitPicker(null);
  aimGuide.show(null);
  stageTimers.cancelAll();
  director.reset(); // and the director's own (fireworks, follow-up toasts)
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
  gimmicks3d.setLevel(null);
  boss3d.setBoss(null);
  units3d.update(backdrop.units, [], false, 0, 0);
  balls3d.update(backdrop.balls, null);
  trails3d.update(backdrop.balls);
  ui.showTitle(save);
  showStore();
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
