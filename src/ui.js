import { levelName, LEVELS } from './sim/levels.js';
import { ACHIEVEMENTS } from './achievements.js';
import { clearTimeline, countUp, SCORE_COUNT_MS } from './clearSequence.js';

const GRID_AHEAD = 10; // locked stages shown past the newest unlocked one

const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.floor(n).toLocaleString('ko-KR');

/** Unlocked achievements that still exist (old or tampered saves may hold unknown ids). */
const ownedCount = (save) => ACHIEVEMENTS.filter((a) => save.achievements.includes(a.id)).length;

const SCREENS = ['screen-title', 'screen-clear', 'screen-over', 'screen-pause', 'screen-achv', 'screen-credits'];

/**
 * DOM layer. All dynamic text goes through textContent.
 * @param {{ onPlay:(i:number)=>void, onNext:()=>void, onRetry:()=>void, onMenu:()=>void,
 *   onSkill:(name:string)=>void, onMute:()=>void, onPause:()=>void, onResume:()=>void,
 *   onAchievements:()=>void, onCredits:()=>void, sfx:(name:string, ...args:unknown[])=>void,
 *   impact:(kind:'slam'|'star')=>void }} h sfx plays a named sound (audio.js); impact shakes and buzzes
 */
export function createUI(h) {
  const overlay = $('overlay');
  let lastBalls = 0;
  let sequence = []; // timers of the clear-screen choreography still pending
  let finishSequence = null; // jumps the choreography to its end (tap to skip)

  function stopSequence() {
    sequence.forEach(clearTimeout);
    sequence = [];
    finishSequence = null;
  }

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
  bind('btn-credits', h.onCredits);
  bind('btn-credits-back', h.onMenu);
  bind('btn-mute', h.onMute);
  bind('btn-pause', h.onPause);
  bind('btn-vibe', h.onVibe);
  bind('btn-full', h.onFullscreen);
  bind('btn-full-pause', h.onFullscreen);
  bind('skill-split', () => h.onSkill('split'));
  bind('skill-meteor', () => h.onSkill('meteor'));
  // Taps on HUD controls must not also launch the ball.
  ['hud', 'skills', 'overlay'].forEach((id) => $(id).addEventListener('pointerdown', (e) => e.stopPropagation()));

  function show(screen) {
    stopSequence();
    overlay.hidden = !screen;
    overlay.classList.toggle('clear-bg', screen === 'screen-clear');
    SCREENS.forEach((s) => { $(s).hidden = s !== screen; });
  }

  function playing(on) {
    $('hud').hidden = !on;
    if (!on) setFinale(null);
    $('skills').hidden = !on;
    if (!on) { $('hint').hidden = true; $('photo-credit').hidden = true; }
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
    $('title-gold').textContent = `🪙 ${fmt(save.gold)} 골드`;
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

  /** Credits screen: one row per landmark photo (author, licence, link to its Commons page). */
  function showCredits(credits) {
    const rows = LEVELS.filter((m) => credits[m.id]).map((m) => {
      const c = credits[m.id];
      const li = document.createElement('li');
      const name = document.createElement('b');
      name.textContent = m.name;
      const link = document.createElement('a');
      link.href = c.source;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = `${c.artist} · ${c.license}`;
      li.append(name, link);
      return li;
    });
    if (!rows.length) {
      const li = document.createElement('li');
      li.textContent = '사진 정보를 불러오지 못했습니다.';
      rows.push(li);
    }
    $('credits-list').replaceChildren(...rows);
    show('screen-credits');
  }

  /** Small caption naming the photographer of the current background (null hides it). */
  function setPhotoCredit(credit) {
    const el = $('photo-credit');
    el.hidden = !credit;
    if (credit) el.textContent = `📷 ${credit.artist} · ${credit.license}`;
  }

  /** @param {{score:number, balls:number, progress:number, lives:number, charges:{split:number,meteor:number}, ready:boolean, muted:boolean, gold:number}} s */
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
    $('gold').textContent = `🪙 ${fmt(s.gold)}`;
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

  /** Bounces the HUD gold counter (a coin was just banked). */
  function pumpGold() {
    const el = $('gold');
    el.classList.remove('pump');
    void el.offsetWidth; // restart the animation
    el.classList.add('pump');
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

  /** Fullscreen buttons (title + pause); hidden where the browser can't do it (iPhone). */
  function setFullscreen(supported, on) {
    document.querySelectorAll('.fs-btn').forEach((el) => {
      el.hidden = !supported;
      el.setAttribute('aria-pressed', String(on));
      el.innerHTML = `<span aria-hidden="true">⛶</span> ${on ? '전체 화면 끄기' : '전체 화면'}`;
    });
  }

  /** Pins the "tap to launch" hint at a screen point (just above the paddle). */
  function placeHint(x, y) {
    const el = $('hint');
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }

  /** Red edges pulse in when the player is hurt (a darkening vignette, not a glow). */
  function damageFlash(heavy) {
    const el = $('damage');
    el.classList.remove('hurt', 'heavy');
    void el.offsetWidth; // restart the animation
    el.classList.add('hurt');
    if (heavy) el.classList.add('heavy');
  }

  /** Vibration switch on the pause screen; hidden where the browser can't vibrate (iOS). */
  function setVibe(supported, on) {
    const el = $('btn-vibe');
    el.hidden = !supported;
    el.textContent = on ? '📳 진동 켜짐' : '📴 진동 꺼짐';
  }

  /** Finale banner with a live brick countdown; pass null to hide it. */
  function setFinale(left) {
    $('finale-banner').hidden = left === null;
    if (left !== null) $('finale-left').textContent = fmt(left);
  }

  /** Restarts a one-shot CSS animation class on an element. */
  function replay(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  /**
   * Stage clear: the panel slams in, stars pop one by one, the score rolls up,
   * stat rows tick in, then the buttons arrive and "next" starts to pulse.
   * A tap on the panel skips to the end.
   */
  function showClear({ score, stars, stats, hasNext }) {
    playing(false);
    const panel = $('screen-clear');
    const scoreEl = $('clear-score');
    scoreEl.textContent = '0';
    const starEls = [0, 1, 2].map(() => {
      const s = document.createElement('span');
      s.textContent = '★';
      return s;
    });
    $('stars').replaceChildren(...starEls);
    const rows = stats.map(([k, v]) => {
      const dt = document.createElement('dt');
      dt.textContent = k;
      const dd = document.createElement('dd');
      dd.textContent = v;
      return [dt, dd];
    });
    $('clear-stats').replaceChildren(...rows.flat());
    $('btn-next').hidden = !hasNext;
    $('btn-next').classList.remove('pulse');
    const actions = document.querySelectorAll('.clear-actions');
    actions.forEach((el) => el.classList.add('pending'));
    show('screen-clear');
    replay(panel, 'slam');

    let scoreRaf = 0;
    const steps = {
      slam: () => { h.sfx('clearSlam'); h.impact('slam'); },
      star: (e) => {
        const el = starEls[e.index];
        el.className = e.earned ? 'on' : 'dim';
        h.sfx('star', e.index, e.earned);
        if (e.earned) h.impact('star');
      },
      score: () => {
        const start = performance.now();
        let lastTick = 0;
        const roll = (now) => {
          const t = now - start;
          scoreEl.textContent = fmt(countUp(score, t, SCORE_COUNT_MS));
          if (t - lastTick > 70 && t < SCORE_COUNT_MS) { lastTick = t; h.sfx('tick', Math.floor(t / 70)); }
          if (t < SCORE_COUNT_MS) scoreRaf = requestAnimationFrame(roll);
          else replay(scoreEl, 'landed');
        };
        scoreRaf = requestAnimationFrame(roll);
      },
      stat: (e) => { rows[e.index].forEach((el) => el.classList.add('in')); h.sfx('tick', e.index); },
      buttons: () => {
        actions.forEach((el) => el.classList.remove('pending'));
        if (hasNext) $('btn-next').classList.add('pulse');
        h.sfx('buttonsIn');
      },
    };
    const timeline = clearTimeline({ stars, statCount: rows.length });
    sequence = timeline.map((e) => setTimeout(() => steps[e.kind](e), e.at));
    // Tap to skip: everything lands at once (quietly), buttons ready.
    finishSequence = () => {
      sequence.forEach(clearTimeout);
      sequence = [];
      cancelAnimationFrame(scoreRaf);
      scoreEl.textContent = fmt(score);
      starEls.forEach((el, k) => { el.className = k < stars ? 'on' : 'dim'; });
      rows.flat().forEach((el) => el.classList.add('in'));
      actions.forEach((el) => el.classList.remove('pending'));
      if (hasNext) $('btn-next').classList.add('pulse');
      finishSequence = null;
    };
  }

  // Tapping the clear panel (not a button) while it is still playing skips to the end.
  $('screen-clear').addEventListener('click', (e) => {
    if (finishSequence && !(e.target instanceof Element && e.target.closest('button'))) finishSequence();
  });

  function showOver(score) {
    playing(false);
    $('over-score').textContent = fmt(score);
    show('screen-over');
    replay($('screen-over'), 'drop');
    $('btn-over-retry').classList.add('pulse');
    h.sfx('gameOver');
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
    showCredits,
    pumpGold,
    damageFlash,
    placeHint,
    setFullscreen,
    setVibe,
    setPhotoCredit,
    floatAt,
    setFinale,
    fmt,
  };
}
