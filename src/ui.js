import { levelName } from './sim/levels.js';
import { LAP } from './sim/maps.js';
import { ACHIEVEMENTS } from './achievements.js';
import { clearTimeline, countUp, SCORE_COUNT_MS } from './clearSequence.js';
import { artUrl, bossArt, fruitArt } from './art.js';
import { FRUITS } from './fruits.js';
import { iconArt, splitIcons } from './icons.js';
import { totalStars, nextGoals, dailyStatus, chestProgress, today } from './meta.js';
import { bossDex, travelAlbum, collectionCounts } from './collection.js';
import { renderBossDex, renderTravel, renderChapters } from './collectionView.js';

const GRID_AHEAD = 10; // locked stages shown past the newest unlocked one

const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.floor(n).toLocaleString('ko-KR');

/** A fruit (or other emoji) inline in text: its picture when it has one, the emoji if that fails to load. */
function emojiSpan({ emoji, art }) {
  const span = document.createElement('span');
  span.className = 'toast-emoji';
  span.setAttribute('aria-hidden', 'true'); // decoration: the words or aria-label next to it carry the meaning
  const pic = art ?? iconArt(emoji);
  if (!pic) { span.textContent = emoji; return span; }
  const img = document.createElement('img');
  img.className = 'art-icon';
  img.src = artUrl(pic);
  img.alt = '';
  img.onerror = () => { span.textContent = emoji; };
  span.append(img);
  return span;
}

/** @param {string} text @returns {(Text | HTMLElement)[]} the text with each known emoji drawn as its icon */
const richParts = (text) => splitIcons(text).map((p) => (typeof p === 'string' ? document.createTextNode(p) : emojiSpan(p)));

/** Like `el.textContent = text`, with icons in place of emoji. */
const setRich = (el, text) => el.replaceChildren(...richParts(text));

/** Swaps the emoji written straight into index.html for icons (text nodes only, markup untouched). */
function iconifyStatic(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    if (splitIcons(node.data).some((p) => typeof p !== 'string')) node.replaceWith(...richParts(node.data));
  }
}

/** Unlocked achievements that still exist (old or tampered saves may hold unknown ids). */
const ownedCount = (save) => ACHIEVEMENTS.filter((a) => save.achievements.includes(a.id)).length;

const SCREENS = ['screen-title', 'screen-clear', 'screen-over', 'screen-pause', 'screen-achv', 'screen-credits', 'screen-collection'];
const SUBSCREENS = ['screen-achv', 'screen-credits', 'screen-collection']; // lists opened from the title (Esc / back closes them)

/**
 * DOM layer. All dynamic text goes through textContent.
 * @param {{ onPlay:(i:number)=>void, onNext:()=>void, onRetry:()=>void, onMenu:()=>void,
 *   onSkill:(name:string)=>void, onMute:()=>void, onPause:()=>void, onResume:()=>void,
 *   onAchievements:()=>void, onCredits:()=>void, sfx:(name:string, ...args:unknown[])=>void,
 *   impact:(kind:'slam'|'star')=>void }} h sfx plays a named sound (audio.js); impact shakes and buzzes
 */
export function createUI(h) {
  iconifyStatic(document.body);
  const titleArt = $('title-art');
  titleArt.onload = () => { titleArt.hidden = false; };
  titleArt.src = artUrl('ui/title.webp');
  const overlay = $('overlay');
  let lastBalls = 0;
  let shownGold = null; // HUD values last drawn, so icons aren't rebuilt every frame
  let shownMuted = null;
  const shownCounts = { split: null, meteor: null };
  let sequence = []; // timers of the clear-screen choreography still pending
  let finishSequence = null; // jumps the choreography to its end (tap to skip)
  let lastSave = null; // the save the title was last drawn with (the collection tabs redraw from it)
  let collectionTab = 'boss';

  function stopSequence() {
    sequence.forEach(clearTimeout);
    sequence = [];
    finishSequence = null;
  }

  const bind = (id, fn) => $(id).addEventListener('click', (e) => { e.stopPropagation(); fn(); });
  // Delayed UI bits belong to the stage (main.js cancels them when it is left); plain setTimeout without a host.
  const later = h.later ?? ((fn, ms) => setTimeout(fn, ms));
  bind('btn-next', h.onNext);
  bind('btn-retry', h.onRetry);
  bind('btn-over-retry', h.onRetry);
  bind('btn-menu', h.onMenu);
  bind('btn-over-menu', h.onMenu);
  bind('btn-pause-menu', h.onMenu);
  bind('btn-resume', h.onResume);
  bind('btn-achv', h.onAchievements);
  [2, 3, 4, 5].forEach((m) => bind(`pick-split-${m}`, () => h.onPickSplit(m)));
  bind('pick-close', h.onClosePicker);
  bind('btn-achv-back', h.onMenu);
  bind('btn-achv-close', h.onMenu);
  bind('btn-credits', h.onCredits);
  bind('btn-credits-back', h.onMenu);
  bind('btn-credits-close', h.onMenu);
  bind('btn-collection', h.onCollection);
  bind('btn-collection-back', h.onMenu);
  bind('btn-collection-close', h.onMenu);
  bind('collection-tab-boss', () => showCollection(lastSave, 'boss'));
  bind('collection-tab-travel', () => showCollection(lastSave, 'travel'));
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
  ['hud', 'skills', 'overlay', 'split-picker'].forEach((id) => $(id).addEventListener('pointerdown', (e) => e.stopPropagation()));

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
    if (!on) { clearTimeout(cardTimer); $('boss-card').hidden = true; }
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
        // Best star count for the stage (★★☆), so replaying for three stars has a target.
        const row = document.createElement('small');
        row.className = 'stars-row';
        const got = save.stars?.[i] ?? 1;
        row.append(...[0, 1, 2].map((k) => {
          const star = document.createElement('span');
          star.textContent = '★';
          if (k >= got) star.className = 'dim';
          return star;
        }));
        b.append(row);
      }
      b.addEventListener('click', (e) => { e.stopPropagation(); h.onPlay(i); });
      grid.append(b);
    }
    const next = save.unlocked - 1;
    $('btn-start').textContent = next > 0 ? `STAGE ${next + 1} 이어하기` : '시작하기';
    $('btn-start').onclick = (e) => { e.stopPropagation(); h.onPlay(Math.max(0, next)); };
    lastSave = save;
    setRich($('btn-achv'), `🏆 업적 ${ownedCount(save)} / ${ACHIEVEMENTS.length}`);
    const counts = collectionCounts(save);
    setRich($('btn-collection'), `👾 도감 ${counts.bosses.have}/${counts.bosses.total} · 🌍 여행 ${counts.maps.have}/${counts.maps.total}`);
    setRich($('title-gold'), `🪙 ${fmt(save.gold)} 골드 · ⭐ ${fmt(totalStars(save))}`);
    // What is ahead and what coming back pays, in plain words (no "lose it" pressure).
    const g = nextGoals(Math.max(0, next));
    const chapterLine = g.toChapter === null ? '' : ` · ✨ ${g.chapterName}까지 ${g.toChapter === 0 ? '다음 판' : `${g.toChapter}판`}`;
    const d = dailyStatus(save, today());
    const dailyLine = d.claimed
      ? `📅 오늘의 첫 클리어 보너스 받음 · ${d.streak}일 연속`
      : `📅 오늘 첫 클리어 +${fmt(d.nextGold)} 골드${d.streak ? ` · ${d.streak}일 연속 이어가기` : ''}`;
    const chest = chestProgress(save);
    const lines = [[emojiSpan({ emoji: '👾', art: bossArt(g.bossKind) }), ...richParts(toBossLine(g) + chapterLine)], richParts(dailyLine), richParts(`🎁 다음 별 상자까지 ★${chest.toNext}`)];
    $('title-goals').replaceChildren(...lines.map((parts) => {
      const b = document.createElement('b');
      b.replaceChildren(...parts);
      return b;
    }));
    show('screen-title');
    // Back from a stage the panel may still be scrolled; and the grid can only be scrolled once it is
    // visible (a hidden element has no size), so the newest unlocked stage is brought into view next frame.
    $('screen-title').scrollTop = 0;
    requestAnimationFrame(() => {
      const current = grid.children[save.unlocked - 1];
      if (current) grid.scrollTop = current.offsetTop - grid.offsetTop - grid.clientHeight / 2;
    });
  }

  /** "석상 거인까지 3판" / "다음 판이 대형 보스 석상 거인!" (drawn after the boss's portrait) */
  const toBossLine = (g) => (g.toBoss === 0 ? ` 다음 판이 대형 보스 ${g.bossName}!` : ` ${g.bossName}까지 ${g.toBoss}판`);

  /**
   * The collection: the boss dex (portraits, grey until beaten, the stage each was first beaten on)
   * or the travel album (every map of the lap with its best stars and sunset/night stamps), with
   * the chapter progress bars above either.
   * @param {object} save @param {'boss'|'travel'} [tab]
   */
  function showCollection(save, tab = collectionTab) {
    collectionTab = tab;
    lastSave = save;
    const counts = collectionCounts(save);
    $('collection-tab-boss').classList.toggle('on', tab === 'boss');
    $('collection-tab-travel').classList.toggle('on', tab === 'travel');
    setRich($('collection-tab-boss'), `👾 보스 도감 ${counts.bosses.have}/${counts.bosses.total}`);
    setRich($('collection-tab-travel'), `🌍 여행 앨범 ${counts.maps.have}/${counts.maps.total}`);
    renderChapters($('collection-chapters'), counts.chapters);
    if (tab === 'boss') renderBossDex($('collection-list'), bossDex(save));
    else renderTravel($('collection-list'), travelAlbum(save));
    $('screen-collection').scrollTop = 0;
    show('screen-collection');
  }

  /**
   * The split picker: each multiplier's coin price, greyed out when the coins don't cover it.
   * @param {Record<string, {price:number, can:boolean}>|null} offers null closes it
   */
  function showSplitPicker(offers) {
    const el = $('split-picker');
    el.hidden = !offers;
    if (!offers) return;
    for (const [mult, { price, can }] of Object.entries(offers)) {
      const btn = $(`pick-split-${mult}`);
      setRich(btn.querySelector('small'), `🪙${price}`);
      btn.disabled = !can;
    }
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
    // One card: the name with its subtitle right under it; the mission line only while the game is new.
    toast(level.name, 'mega');
    toast(level.subtitle, 'small');
    if (level.index < 10) later(() => toast('미션: 빛나는 구멍으로 공을 넣어라!', 'small'), 1500);
  }

  /** Achievement list: each with its gold, the countable ones with their progress, and the gold still to earn. */
  function showAchievements(save) {
    const owned = new Set(save.achievements);
    // The save as a run's stats, for the progress counters (stages cleared, stars, streak, bosses).
    const stats = { stage: Math.max(0, save.unlocked - 2), cleared: save.unlocked > 1, totalStars: totalStars(save), streak: save.daily?.streak ?? 0, beaten: save.beaten ?? [] };
    const left = ACHIEVEMENTS.filter((a) => !owned.has(a.id)).reduce((sum, a) => sum + a.gold, 0);
    setRich($('achv-count'), `${ownedCount(save)} / ${ACHIEVEMENTS.length} · 남은 보상 🪙 ${fmt(left)}`);
    $('achv-list').replaceChildren(...ACHIEVEMENTS.map((a) => {
      const li = document.createElement('li');
      const has = owned.has(a.id);
      li.className = has ? '' : 'locked';
      const icon = document.createElement('span');
      icon.className = 'icon';
      icon.replaceChildren(emojiSpan({ emoji: a.icon }));
      const name = document.createElement('b');
      name.textContent = a.name;
      const desc = document.createElement('small');
      const prog = !has && a.progress ? a.progress(stats) : null;
      desc.textContent = prog ? `${a.desc} · ${fmt(prog[0])}/${fmt(prog[1])}` : a.desc;
      const gold = document.createElement('small');
      gold.className = 'achv-gold';
      setRich(gold, `${has ? '✓' : '+'}${fmt(a.gold)}🪙`);
      li.append(icon, name, desc, gold);
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
    if (credit) setRich(el, `📷 ${credit.artist} · ${credit.license}`);
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
    // Skills are bought per use: the badge shows the coin price (split: from its cheapest multiplier),
    // or 0 once this stage's uses are spent.
    for (const kind of ['split', 'meteor']) {
      const offer = s.prices?.[kind];
      const text = offer?.left > 0 ? `🪙${offer.price}${kind === 'split' ? '~' : ''}` : '0';
      if (shownCounts[kind] !== text) { shownCounts[kind] = text; setRich($(`count-${kind}`), text); }
      $(`count-${kind}`).classList.toggle('price', offer?.left > 0);
      $(`skill-${kind}`).disabled = !offer?.can || (kind === 'split' && s.ready);
    }
    $('hint').hidden = !s.ready;
    if (s.muted !== shownMuted) {
      shownMuted = s.muted;
      setRich($('btn-mute'), s.muted ? '🔇' : '🔊');
      $('btn-mute').setAttribute('aria-pressed', String(s.muted));
    }
    if (s.gold !== shownGold) { shownGold = s.gold; setRich($('gold'), `🪙 ${fmt(s.gold)}`); }
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
    el.append(...parts.flatMap((part) => {
      if (typeof part === 'string') return richParts(part);
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
    // At most TOAST_MAX at once (one in a short lane), so the board stays visible: the oldest ordinary one goes first.
    const max = $('toasts').classList.contains('one') ? 1 : TOAST_MAX;
    while ($('toasts').children.length > max) {
      const all = [...$('toasts').children];
      (all.find((t) => !t.classList.contains('critical')) ?? all[0]).remove();
    }
  }

  /**
   * Puts the toasts in the empty band between the HUD (and boss bar) and the top of the
   * board. Where that band is too small (wide screens fill the height with the board) they
   * go to the lane between the box floor and the paddle instead; when there is no room above
   * the board at all (a phone on its side) the boss bar moves down to that lane too.
   * @param {number} boardTop screen y of the board's top edge (px)
   * @param {number} boxBottom screen y of the box floor (px)
   * @param {number} paddleTop screen y of the paddle's top (px)
   */
  function layoutOverlays(boardTop, boxBottom, paddleTop) {
    const hud = $('hud').getBoundingClientRect().bottom;
    const bar = $('boss-bar');
    const toasts = $('toasts');
    const compact = boardTop - hud < (bar.offsetHeight || 34) + 12;
    bar.classList.toggle('lane', compact);
    toasts.classList.toggle('one', compact); // one toast at a time: the lane is short
    const barH = bar.offsetHeight || 34; // measured after the class change (the lane bar is smaller)
    const laneTop = boxBottom + 10;
    if (compact) {
      // The bar hugs the paddle; the toasts take the rest of the lane above it.
      const barAt = Math.max(laneTop, paddleTop - barH - 6);
      bar.style.top = `${barAt}px`;
      toasts.style.top = `${laneTop}px`;
      toasts.style.setProperty('--band', `${Math.max(36, barAt - laneTop)}px`);
      return;
    }
    // The bar sits just above the board when there is room, never under the HUD.
    const barTop = Math.max(hud + 4, Math.min(hud + 52, boardTop - barH - 6));
    bar.style.top = `${barTop}px`;
    const band = boardTop - (barTop + barH + 6);
    const above = band >= TOAST_BAND * 0.7;
    const top = above ? Math.max(barTop + barH + 10, boardTop - TOAST_BAND) : laneTop; // +10: the exit drift (8px) stays clear of the bar
    toasts.style.top = `${top}px`;
    // The toasts shrink to the room they have (style.css reads --band).
    toasts.style.setProperty('--band', `${Math.max(36, above ? boardTop - top : paddleTop - 6 - top)}px`);
  }

  /** Leaves the achievements, credits or collection list for the title (Esc / back). @returns {boolean} whether one was open */
  function closeSubscreen() {
    if (SUBSCREENS.every((id) => $(id).hidden)) return false;
    h.onMenu();
    return true;
  }

  /** Bounces the HUD gold counter (a coin was just banked). */
  function pumpGold() {
    const el = $('gold');
    el.classList.remove('pump');
    void el.offsetWidth; // restart the animation
    el.classList.add('pump');
  }

  const CARD_MS = { intro: 1900, down: 2100 };
  let cardTimer = 0;
  let cardName = ''; // the boss named by its entrance card, for its KO card
  /** Slides the boss card away (its time is up; taps go through it to the game). */
  function hideBossCard() {
    const card = $('boss-card');
    if (card.hidden || card.classList.contains('out')) return;
    clearTimeout(cardTimer);
    card.classList.add('out');
    cardTimer = setTimeout(() => { card.hidden = true; }, 300);
  }

  /**
   * The boss's card: its portrait and name as it arrives, or with a KO stamp when beaten.
   * @param {{ kind:string, name?:string, big?:boolean, mode:'intro'|'down' }} info (name: the last card's when left out)
   */
  function bossCard({ kind, name = cardName, big = false, mode }) {
    cardName = name;
    const card = $('boss-card');
    clearTimeout(cardTimer);
    const art = $('boss-card-art');
    art.hidden = false;
    art.onerror = () => { art.hidden = true; };
    art.src = artUrl(bossArt(kind));
    $('boss-card-tag').textContent = mode === 'down' ? 'DEFEATED' : big ? 'WARNING' : 'BOSS';
    $('boss-card-name').textContent = name;
    $('boss-card-stamp').textContent = mode === 'down' ? '격파!' : '';
    card.className = `boss-card ${mode}${big ? ' big' : ''}`;
    card.hidden = false;
    void card.offsetWidth; // restart the slide-in
    cardTimer = setTimeout(hideBossCard, CARD_MS[mode]);
  }

  /** Coins and fruit pour down the screen (a boss just fell). */
  function shower(count = 28) {
    const layer = $('shower');
    const pics = ['ui/coin.webp', ...FRUITS.map((f) => fruitArt(f.id))];
    for (let k = 0; k < count; k++) {
      const img = document.createElement('img');
      img.alt = '';
      img.src = artUrl(pics[k % 3 === 0 ? 0 : 1 + Math.floor(Math.random() * FRUITS.length)]);
      img.style.left = `${Math.random() * 96}%`;
      img.style.animationDuration = `${1.1 + Math.random() * 0.9}s`;
      img.style.animationDelay = `${Math.random() * 0.6}s`;
      img.style.setProperty('--spin', `${(Math.random() < 0.5 ? -1 : 1) * (180 + Math.random() * 540)}deg`);
      img.addEventListener('animationend', () => img.remove());
      layer.append(img);
    }
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
        if (typeof part === 'string') { row.append(...richParts(part)); return; }
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
      setRich(el, `⛶ ${on ? '전체 화면 끄기' : '전체 화면'}`);
    });
  }

  /** Pins the serve hint at a screen point (just above the paddle), with its text (how to aim, or the angle). */
  function placeHint(x, y, text) {
    const el = $('hint');
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    if (text && el.textContent !== text) el.textContent = text;
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
    setRich(el, on ? '📳 진동 켜짐' : '📴 진동 꺼짐');
  }

  /** Boss health bar: name and the core's remaining share (0..1); null hides it. */
  let bossShare = 1;
  let joltAt = 0;
  /**
   * @param {string|null} name null hides the bar
   * @param {number} share health left (0..1)
   * @param {number} guard the protected share, drawn blue-green on the right (it drains last)
   */
  function setBoss(name, share = 1, guard = 0) {
    $('boss-bar').hidden = name === null;
    if (name === null) { bossShare = 1; return; }
    $('boss-name').textContent = name;
    const left = Math.max(0, Math.min(1, share));
    $('boss-fill').style.width = `${Math.max(0, left - guard) * 100}%`;
    $('boss-guard').style.width = `${Math.min(left, guard) * 100}%`;
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
  function showClear({ score, stars, stats, hasNext, goldOffer = null, newBest = false, bonus = [], next = null, meta = '' }) {
    playing(false);
    $('clear-best').hidden = !newBest;
    $('clear-meta').hidden = !meta;
    setRich($('clear-meta'), meta);
    $('clear-bonus').replaceChildren(...bonus.map((line) => {
      const li = document.createElement('li');
      setRich(li, line); // the coin and calendar as the game's icons, not the OS emoji
      return li;
    }));
    const nextEl = $('clear-next');
    if (next) {
      const name = document.createElement('b');
      name.textContent = next.name;
      nextEl.replaceChildren('NEXT ▶ ', name, next.boss ? ` · ${next.boss}` : '');
    } else nextEl.replaceChildren();
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
      setRich(dd, v);
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
    setRich(el, offer === 'ad' ? `📺 광고 보고 ${label}` : `🎁 ${label}`);
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
    setRich($('btn-remove-ads'), `🚫 광고 제거${price ? ` · ${price}` : ''}`);
  }

  /** Back to the board after a revive. */
  function resumePlay() {
    show(null);
    playing(true);
  }

  /**
   * @param {{ gold?:number, total?:number, best?:number, tip?:string }} [extra] what the run kept (coins banked,
   *   the total), the stage's best score so far, and one thing to try next time
   */
  function showOver(score, reviveOffer = null, progress = null, extra = {}) {
    playing(false);
    $('over-score').textContent = fmt(score);
    // How close it was: a reason to try again.
    const share = document.createElement('b');
    share.textContent = `${progress ?? 0}%`;
    $('over-progress').replaceChildren('벽돌 ', share, ' 깼어요', ...(extra.best > 0 ? [` · 이 판 최고 ${fmt(extra.best)}점`] : []));
    $('over-progress').hidden = progress === null;
    $('over-gold').hidden = extra.gold === undefined;
    if (extra.gold !== undefined) setRich($('over-gold'), `🪙 +${fmt(extra.gold)} 저장됨 · 보유 ${fmt(extra.total ?? 0)}`);
    $('over-tip').hidden = !extra.tip;
    if (extra.tip) setRich($('over-tip'), `🎯 ${extra.tip}`);
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
    bossCard,
    showSplitPicker,
    hideBossCard,
    shower,
    toast,
    showClear,
    showOver,
    showPause: (on) => show(on ? 'screen-pause' : null),
    showAchievements,
    showCollection,
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
    closeSubscreen,
    setVibe,
    setPhotoCredit,
    floatAt,
    setFinale,
    fmt,
  };
}
