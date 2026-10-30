// Draws the collection (collection.js) into the DOM: boss portraits, map cards, chapter bars.
// Everything unmet is shown dim, so the gaps are the goals.

import { artUrl, bossArt } from './art.js';

const BASE = import.meta.env.BASE_URL;

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/** @param {HTMLElement} list @param {ReturnType<import('./collection.js').bossDex>} entries */
export function renderBossDex(list, entries) {
  list.replaceChildren(...entries.map((e) => {
    const li = el('li', `dex-card${e.beaten ? '' : ' dim'}`);
    const img = el('img');
    img.alt = '';
    img.loading = 'lazy';
    img.src = artUrl(bossArt(e.kind));
    img.onerror = () => { img.replaceWith(el('div', 'tile')); };
    li.append(img, el('b', '', e.name), el('small', '', e.beaten ? (e.metAt === null ? '격파' : `${e.metAt + 1}판 격파`) : e.big ? '대형 보스' : '미격파'));
    return li;
  }));
}

/** @param {HTMLElement} list @param {ReturnType<import('./collection.js').travelAlbum>} entries */
export function renderTravel(list, entries) {
  list.replaceChildren(...entries.map((m) => {
    const li = el('li', `dex-card${m.cleared ? '' : ' dim'}`);
    if (m.photo) {
      const img = el('img');
      img.alt = '';
      img.loading = 'lazy';
      img.src = `${BASE}landmarks/${m.photo}.jpg`;
      img.onerror = () => { img.replaceWith(tile(m.palette)); };
      li.append(img);
    } else li.append(tile(m.palette));
    const stars = m.cleared ? '★'.repeat(m.bestStars) + '☆'.repeat(3 - m.bestStars) : '미방문';
    const stamps = m.chapter === 0 ? `${m.stamps.sunset ? ' 🌅' : ''}${m.stamps.night ? ' 🌙' : ''}` : '';
    li.append(el('b', '', m.name), el('small', '', `${stars}${stamps}`));
    return li;
  }));
}

/** A coloured square standing in for a photo (glyph and animal murals, or a photo that failed to load). */
function tile(palette) {
  const t = el('div', 'tile');
  const [a, b, c] = [palette?.[2] ?? '#334', palette?.[4] ?? '#556', palette?.[6] ?? '#778'];
  t.style.background = `linear-gradient(135deg, ${a}, ${b} 55%, ${c})`;
  return t;
}

/** @param {HTMLElement} list @param {{ name:string, have:number, total:number }[]} chapters */
export function renderChapters(list, chapters) {
  list.replaceChildren(...chapters.map((c) => {
    const li = el('li');
    const bar = el('div', 'bar');
    const fill = el('i');
    fill.style.width = `${Math.round((100 * c.have) / Math.max(1, c.total))}%`;
    bar.append(fill);
    li.append(el('span', '', c.name), el('span', '', `${c.have} / ${c.total}`), bar);
    return li;
  }));
}
