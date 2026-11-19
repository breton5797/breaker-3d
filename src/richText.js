// Text with icons in place of emoji, for the UI (split out of ui.js, 2026-11-19).
import { artUrl } from './art.js';
import { iconArt, splitIcons } from './icons.js';

/** A fruit (or other emoji) inline in text: its picture when it has one, the emoji if that fails to load. */
export function emojiSpan({ emoji, art }) {
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
export const richParts = (text) => splitIcons(text).map((p) => (typeof p === 'string' ? document.createTextNode(p) : emojiSpan(p)));

/** Like `el.textContent = text`, with icons in place of emoji. */
export const setRich = (el, text) => el.replaceChildren(...richParts(text));

/** A list of bonus lines (clear / game over), each with its icons. */
export const bonusList = (list, lines) => list.replaceChildren(...lines.map((line) => { const li = document.createElement('li'); setRich(li, line); return li; }));

/** Swaps the emoji written straight into index.html for icons (text nodes only, markup untouched). */
export function iconifyStatic(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    if (splitIcons(node.data).some((p) => typeof p !== 'string')) node.replaceWith(...richParts(node.data));
  }
}
