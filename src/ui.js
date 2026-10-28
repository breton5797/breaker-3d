import { levelName } from './sim/levels.js';
import { LAP } from './sim/maps.js';
import { ACHIEVEMENTS } from './achievements.js';
import { clearTimeline, countUp, SCORE_COUNT_MS } from './clearSequence.js';
import { artUrl } from './art.js';

const GRID_AHEAD = 10; // locked stages shown past the newest unlocked one

const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.floor(n).toLocaleString('ko-KR');

/** A fruit (or other emoji) inline in text: its picture when it has one, the emoji if that fails to load. */
function emojiSpan({ emoji, art }) {
  const span = document.createElement('span');
  span.className = 'toast-emoji';
  if (!art) { span.textContent = emoji; return span; }
  const img = document.createElement('img');
  img.className = 'art-icon';
  img.src = artUrl(art);
  img.alt = '';
  img.onerror = () => { span.textContent = emoji; };
  span.append(img);
  return span;
}

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
  bind('btn-revive', h.onRevive);
  bind('btn-double-gold', h.onDoubleGold);
  bind('btn-remove-ads', h.onRemoveAds);
  bind('btn-restore', h.onRestore);
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
    if (!on) setBoss(null);
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
    // Number and name on their own lines, so a long name ("자유의 여신상 · 노을") isn't cut off on a phone.
    const no = document.createElement('small');
    no.className = 'stage-no';
    no.textContent = `STAGE ${level.index + 1}`;
    $('stage-name').replaceChildren(no, document.createTextNode(level.name));
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
    const rows = LAP.filter((m) => credits[m.id]).map((m) => {
      const c = credits[m.id];
      const li = document.createElement('li');
      const name = document.createElement('b');
      name.textContent = m.name;
      const link = document.createElement('a');
      link.href = c.source;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = c.artist;
      const line = document.createElement('span');
      line.append(link, ' · ');
      // The licence itself, linked when it has a deed (CC licences ask for the link).
      if (c.licenseUrl) {
        const lic = document.createElement('a');
        lic.href = c.licenseUrl;
        lic.target = '_blank';
        lic.rel = 'noopener noreferrer license';
        lic.textContent = c.license;
        line.append(lic);
      } else line.append(c.license);
      li.append(name, line);
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
   *   `{ emoji, art? }` keeps its own colours instead of the toast's gradient fill
   *   (shown as the `art` picture when given, see emojiSpan)
   */
  const TOAST_MAX = 2;
  const TOAST_BAND = 112; // px of room the toast stack wants above the board
  function toast(content, cls = '') {
    const el = document.createElement('div');
    el.className = `toast ${cls}`;
    const parts = Array.isArray(content) ? content : [content];
    el.append(...parts.map((part) => {
      if (typeof part === 'string') return document.createTextNode(part);
      if (part.emoji) return emojiSpan(part);
      const span = document.createElement('small');
      span.className = 'toast-badge';
      span.textContent = part.small;
      return span;
    }));
    // The big payoffs (stun, shield down, KO) stay up longer and are never pushed out.
    const critical = /\b(neon-burst|critical)\b/.test(cls);
    if (critical) el.classList.add('critical');
    $('toasts').append(el);
    setTimeout(() => el.remove(), critical ? 2000 : 1400);
    // At most TOAST_MAX at once, so the board stays visible: the oldest ordinary one goes first.
    while ($('toasts').children.length > TOAST_MAX) {
      const all = [...$('toasts').children];
      (all.find((t) => !t.classList.contains('critical')) ?? all[0]).remove();
    }
  }

  /**
   * Puts the toasts in the empty band between the HUD (and boss bar) and the top
   * of the board, and keeps the boss bar off the board on wide screens.
   * @param {number} boardTop screen y of the board's top edge (px)
   * @param {number} lowY screen y of the open lane above the paddle (px): the fallback spot
   */
  function layoutOverlays(boardTop, lowY) {
    const hud = $('hud').getBoundingClientRect().bottom;
    const bar = $('boss-bar');
    const barH = bar.offsetHeight || 34;
    // The bar sits just above the board when there is room, never under the HUD.
    const barTop = Math.max(hud + 4, Math.min(hud + 52, boardTop - barH - 6));
    bar.style.top = `${barTop}px`;
    // Phones have a band above the board; wide screens fill the height with the board,
    // so there the toasts go to the open lane above the paddle instead of over the boss.
    const band = boardTop - (barTop + barH + 6);
    $('toasts').style.top = `${band >= TOAST_BAND * 0.7 ? Math.max(barTop + barH + 6, boardTop - TOAST_BAND) : lowY - TOAST_BAND}px`;
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
        if (part.emoji) { row.append(emojiSpan(part)); return; }
        const span = document.createElement('span');
        span.className = part.small ? 'floater-small' : 'floater-big';
        span.textContent = part.small ?? part.big;
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

  /** Makes the meteor button pulse (a hint while no ball has got in yet). */
  function meteorHint(on) { $('skill-meteor').classList.toggle('hint-pulse', on); }

  /** A white flash over everything for a knockout. */
  function screenFlash() { replay($('flash'), 'on'); }

  /** Vibration switch on the pause screen; hidden where the browser can't vibrate (iOS). */
  function setVibe(supported, on) {
    const el = $('btn-vibe');
    el.hidden = !supported;
    el.textContent = on ? '📳 진동 켜짐' : '📴 진동 꺼짐';
  }

  /** Boss health bar: name and the core's remaining share (0..1); null hides it. */
  let bossShare = 1;
  let joltAt = 0;
  function setBoss(name, share = 1) {
    $('boss-bar').hidden = name === null;
    if (name === null) { bossShare = 1; return; }
    $('boss-name').textContent = name;
    $('boss-fill').style.width = `${Math.max(0, Math.min(1, share)) * 100}%`;
    // The bar jolts as it drops (at most a few times a second; it updates every frame).
    const now = performance.now();
    if (share < bossShare && now - joltAt > 180) { replay($('boss-bar'), 'jolt'); joltAt = now; }
    bossShare = share;
  }

  /** The boss bar flashes white when hits bounce off the core's shield. */
  function bossShield() {
    const el = $('boss-bar');
    if (el.hidden || el.classList.contains('shield')) return;
    el.classList.add('shield');
    setTimeout(() => el.classList.remove('shield'), 160);
  }

  /** Finale banner with a live brick countdown; pass null to hide it. */
  /** @param {number|null} left bricks left, or null to hide @param {{x:number,y:number}|null} at screen point */
  function setFinale(left, at = null) {
    const el = $('finale-banner');
    el.hidden = left === null;
    if (left === null) return;
    $('finale-left').textContent = fmt(left);
    if (at) {
      el.style.left = `${at.x}px`;
      el.style.top = `${at.y}px`;
    }
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
  function showClear({ score, stars, stats, hasNext, goldOffer = null }) {
    playing(false);
    setReward('btn-double-gold', goldOffer, '골드 2배');
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

  /** A reward button: hidden when not offered, "watch an ad" or free when ads were removed. */
  function setReward(id, offer, label) {
    const el = $(id);
    el.hidden = !offer;
    el.disabled = false;
    el.textContent = offer === 'ad' ? `📺 광고 보고 ${label}` : `🎁 ${label}`;
  }

  /** While a rewarded ad loads and plays: the button waits; afterwards it says what happened. */
  function rewardState(id, state, doneLabel = '') {
    const el = $(id);
    el.disabled = state !== 'ready';
    if (state === 'loading') el.textContent = '광고 불러오는 중…';
    if (state === 'done') el.textContent = `✓ ${doneLabel}`;
    if (state === 'failed') { el.disabled = false; el.textContent = '광고를 불러오지 못했어요 · 다시 시도'; }
  }

  /** Title-screen purchase buttons; hidden where there is no store (web). */
  function setStore({ available, price, adsRemoved }) {
    $('btn-remove-ads').hidden = !available || adsRemoved;
    $('btn-restore').hidden = !available || adsRemoved;
    $('btn-remove-ads').textContent = `🚫 광고 제거${price ? ` · ${price}` : ''}`;
  }

  /** Back to the board after a revive. */
  function resumePlay() {
    show(null);
    playing(true);
  }

  function showOver(score, reviveOffer = null) {
    playing(false);
    $('over-score').textContent = fmt(score);
    setReward('btn-revive', reviveOffer, '이어하기 ♥+1');
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
    rewardState,
    setStore,
    resumePlay,
    placeHint,
    setFullscreen,
    setBoss,
    bossShield,
    screenFlash,
    meteorHint,
    layoutOverlays,
    setVibe,
    setPhotoCredit,
    floatAt,
    setFinale,
    fmt,
  };
}
