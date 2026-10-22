import { LEVELS } from './sim/levels.js';

const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.floor(n).toLocaleString('ko-KR');

const SCREENS = ['screen-title', 'screen-clear', 'screen-over', 'screen-pause'];

/**
 * DOM layer. All dynamic text goes through textContent.
 * @param {{ onPlay:(i:number)=>void, onNext:()=>void, onRetry:()=>void, onMenu:()=>void,
 *   onSkill:(name:string)=>void, onMute:()=>void, onPause:()=>void, onResume:()=>void }} h
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
    $('skills').hidden = !on;
    if (!on) $('hint').hidden = true;
  }

  function showTitle(save) {
    playing(false);
    const grid = $('stage-grid');
    grid.replaceChildren();
    const count = Math.max(LEVELS.length + 1, Math.min(save.unlocked, 99));
    for (let i = 0; i < count; i++) {
      const b = document.createElement('button');
      b.className = 'stage-btn';
      b.disabled = i >= save.unlocked;
      const num = document.createElement('b');
      num.textContent = i < LEVELS.length ? `STAGE ${i + 1}` : `∞ ${i - LEVELS.length + 1}`;
      const name = document.createElement('span');
      name.textContent = i < LEVELS.length ? LEVELS[i].name : '무한 모드';
      b.append(num, name);
      if (save.best[i]) {
        const best = document.createElement('small');
        best.textContent = `★ ${fmt(save.best[i])}`;
        b.append(best);
      }
      b.addEventListener('click', (e) => { e.stopPropagation(); h.onPlay(i); });
      grid.append(b);
    }
    $('btn-start').onclick = (e) => { e.stopPropagation(); h.onPlay(Math.max(0, save.unlocked - 1)); };
    show('screen-title');
  }

  function startStage(level) {
    show(null);
    playing(true);
    $('stage-name').textContent = `${level.index + 1}. ${level.name}`;
    lastBalls = 0;
    toast(level.name, 'mega');
    setTimeout(() => toast(level.subtitle, 'small'), 250);
    setTimeout(() => toast('미션: 빛나는 구멍으로 공을 넣어라!', 'small'), 1300);
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

  function toast(text, cls = '') {
    const el = document.createElement('div');
    el.className = `toast ${cls}`;
    el.textContent = text;
    $('toasts').append(el);
    setTimeout(() => el.remove(), 1400);
    const all = $('toasts').children;
    if (all.length > 4) all[0].remove();
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
    fmt,
  };
}
