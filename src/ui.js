import { levelName } from './sim/levels.js';
import { ACHIEVEMENTS } from './achievements.js';

const GRID_AHEAD = 10; // locked stages shown past the newest unlocked one

const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.floor(n).toLocaleString('ko-KR');

/** Unlocked achievements that still exist (old or tampered saves may hold unknown ids). */
const ownedCount = (save) => ACHIEVEMENTS.filter((a) => save.achievements.includes(a.id)).length;

const SCREENS = ['screen-title', 'screen-clear', 'screen-over', 'screen-pause', 'screen-achv'];

/**
 * DOM layer. All dynamic text goes through textContent.
 * @param {{ onPlay:(i:number)=>void, onNext:()=>void, onRetry:()=>void, onMenu:()=>void,
 *   onSkill:(name:string)=>void, onMute:()=>void, onPause:()=>void, onResume:()=>void,
 *   onAchievements:()=>void }} h
 */
export function createUI(h) {
  const overlay = $('overlay');
  let lastBalls = 0;

  const bind = (id, fn) => $(id).addEventListener('click', (e) => { e.stopPropagation(); fn(); });
  bind('btn-next', h.onNext);
  bind('btn-retry', h.onRetry);
  bind('btn-over-retry', h.onRetry);
  bind('btn-menu', h.onMenu);
  bind('btn-over-menu', h.onMenu);
  bind('btn-pause-menu', h.onMenu);
  bind('btn-resume', h.onResume);
  bind('btn-achv', h.onAchievements);
  bind('btn-achv-back', h.onMenu);
  bind('btn-mute', h.onMute);
  bind('btn-pause', h.onPause);
  bind('skill-split', () => h.onSkill('split'));
  bind('skill-meteor', () => h.onSkill('meteor'));
  // Taps on HUD controls must not also launch the ball.
  ['hud', 'skills', 'overlay'].forEach((id) => $(id).addEventListener('pointerdown', (e) => e.stopPropagation()));

  function show(screen) {
    overlay.hidden = !screen;
    overlay.classList.toggle('clear-bg', screen === 'screen-clear');
    SCREENS.forEach((s) => { $(s).hidden = s !== screen; });
  }

  function playing(on) {
    $('hud').hidden = !on;
    if (!on) setFinale(null);
    $('skills').hidden = !on;
    if (!on) $('hint').hidden = true;
  }

  function showTitle(save) {
    playing(false);
    const grid = $('stage-grid');
    grid.replaceChildren();
    const shown = Math.max(30, save.unlocked + GRID_AHEAD);
    for (let i = 0; i < shown; i++) {
      const b = document.createElement('button');
      b.className = 'stage-btn';
      b.disabled = i >= save.unlocked;
      b.title = levelName(i);
      b.setAttribute('aria-label', `스테이지 ${i + 1}${b.disabled ? ' (잠김)' : ''}`);
      const num = document.createElement('b');
      num.textContent = String(i + 1);
      b.append(num);
      if (save.best[i]) {
        const best = document.createElement('small');
        best.textContent = '★';
        b.append(best);
      }
      b.addEventListener('click', (e) => { e.stopPropagation(); h.onPlay(i); });
      grid.append(b);
    }
    // Keep the newest unlocked stage in view inside the scrolling grid.
    const current = grid.children[save.unlocked - 1];
    if (current) grid.scrollTop = current.offsetTop - grid.offsetTop - grid.clientHeight / 2;
    const next = save.unlocked - 1;
    $('btn-start').textContent = next > 0 ? `STAGE ${next + 1} 이어하기` : '시작하기';
    $('btn-start').onclick = (e) => { e.stopPropagation(); h.onPlay(Math.max(0, next)); };
    $('btn-achv').textContent = `🏆 업적 ${ownedCount(save)} / ${ACHIEVEMENTS.length}`;
    show('screen-title');
  }

  function startStage(level) {
    show(null);
    playing(true);
    $('stage-name').textContent = `STAGE ${level.index + 1} · ${level.name}`;
    lastBalls = 0;
    toast(level.name, 'mega');
    setTimeout(() => toast(level.subtitle, 'small'), 250);
    setTimeout(() => toast('미션: 빛나는 구멍으로 공을 넣어라!', 'small'), 1300);
  }

  /** Achievement collection: unlocked first in list order, locked ones greyed out. */
  function showAchievements(save) {
    const owned = new Set(save.achievements);
    $('achv-count').textContent = `${ownedCount(save)} / ${ACHIEVEMENTS.length}`;
    $('achv-list').replaceChildren(...ACHIEVEMENTS.map((a) => {
      const li = document.createElement('li');
      li.className = owned.has(a.id) ? '' : 'locked';
      const icon = document.createElement('span');
      icon.className = 'icon';
      icon.textContent = a.icon;
      const name = document.createElement('b');
      name.textContent = a.name;
      const desc = document.createElement('small');
      desc.textContent = a.desc;
      li.append(icon, name, desc);
      return li;
    }));
    show('screen-achv');
  }

  /** @param {{score:number, balls:number, progress:number, lives:number, charges:{split:number,meteor:number}, ready:boolean, muted:boolean}} s */
  function setHud(s) {
    $('score').textContent = fmt(s.score);
    const ballEl = $('ball-count');
    ballEl.textContent = fmt(s.balls);
    if (s.balls > lastBalls * 1.5 && s.balls > 4) {
      ballEl.parentElement.classList.remove('pump');
      void ballEl.offsetWidth; // restart the animation
      ballEl.parentElement.classList.add('pump');
    }
    lastBalls = s.balls;
    $('progress-bar').style.width = `${Math.round(s.progress * 100)}%`;
    $('lives').textContent = '♥'.repeat(Math.max(0, s.lives));
    $('count-split').textContent = String(s.charges.split);
    $('count-meteor').textContent = String(s.charges.meteor);
    $('skill-split').disabled = s.charges.split <= 0 || s.ready;
    $('skill-meteor').disabled = s.charges.meteor <= 0;
    $('hint').hidden = !s.ready;
    $('btn-mute').textContent = s.muted ? '🔇' : '🔊';
  }

  /**
   * @param {string | (string | { small: string } | { emoji: string })[]} content plain
   *   text, or parts: `{ small }` is a little badge (a fruit's multiplier) and
   *   `{ emoji }` keeps its own colours instead of the toast's gradient fill
   */
  function toast(content, cls = '') {
    const el = document.createElement('div');
    el.className = `toast ${cls}`;
    const parts = Array.isArray(content) ? content : [content];
    el.append(...parts.map((part) => {
      if (typeof part === 'string') return document.createTextNode(part);
      const span = document.createElement(part.small ? 'small' : 'span');
      span.className = part.small ? 'toast-badge' : 'toast-emoji';
      span.textContent = part.small ?? part.emoji;
      return span;
    }));
    $('toasts').append(el);
    setTimeout(() => el.remove(), 1400);
    const all = $('toasts').children;
    if (all.length > 4) all[0].remove();
  }

  /** Small label that pops up at a screen point and floats away (e.g. over the paddle). */
  function floatAt(x, y, lines, cls = '') {
    const el = document.createElement('div');
    el.className = `floater ${cls}`;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    lines.forEach((parts) => {
      const row = document.createElement('div');
      parts.forEach((part) => {
        if (typeof part === 'string') { row.append(document.createTextNode(part)); return; }
        const span = document.createElement('span');
        span.className = part.emoji ? 'toast-emoji' : part.small ? 'floater-small' : 'floater-big';
        span.textContent = part.emoji ?? part.small ?? part.big;
        row.append(span);
      });
      el.append(row);
    });
    $('floaters').append(el);
    setTimeout(() => el.remove(), 1300);
  }

  /** Finale banner with a live brick countdown; pass null to hide it. */
  function setFinale(left) {
    $('finale-banner').hidden = left === null;
    if (left !== null) $('finale-left').textContent = fmt(left);
  }

  function showClear({ score, stars, stats, hasNext }) {
    playing(false);
    $('clear-score').textContent = fmt(score);
    const starsEl = $('stars');
    starsEl.replaceChildren(...[0, 1, 2].map((k) => {
      const s = document.createElement('span');
      s.textContent = '★';
      if (k < stars) { s.className = 'on'; s.style.animationDelay = `${0.2 + k * 0.18}s`; }
      return s;
    }));
    const dl = $('clear-stats');
    dl.replaceChildren(...stats.flatMap(([k, v]) => {
      const dt = document.createElement('dt');
      dt.textContent = k;
      const dd = document.createElement('dd');
      dd.textContent = v;
      return [dt, dd];
    }));
    $('btn-next').hidden = !hasNext;
    show('screen-clear');
  }

  function showOver(score) {
    playing(false);
    $('over-score').textContent = fmt(score);
    show('screen-over');
  }

  return {
    showTitle,
    startStage,
    setHud,
    toast,
    showClear,
    showOver,
    showPause: (on) => show(on ? 'screen-pause' : null),
    showAchievements,
    floatAt,
    setFinale,
    fmt,
  };
}
