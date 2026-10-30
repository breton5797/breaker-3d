// Languages. Korean (ko.js) is the source and the fallback; every other locale is a
// module with the same keys, loaded only when chosen (its own chunk). The language
// comes from the save when the player picked one, else from the device (navigator.languages):
// a static site cannot see the visitor's country, and the device language is what they read anyway.
import ko from './locales/ko.js';

/** Supported languages: code (BCP-47 primary subtag), native name, and the locale used for numbers. */
export const LANGUAGES = Object.freeze([
  { code: 'ko', name: '한국어', locale: 'ko-KR' },
  { code: 'en', name: 'English', locale: 'en-US' },
  { code: 'vi', name: 'Tiếng Việt', locale: 'vi-VN' },
  { code: 'hi', name: 'हिन्दी', locale: 'hi-IN' },
  { code: 'ja', name: '日本語', locale: 'ja-JP' },
  { code: 'zh', name: '中文（简体）', locale: 'zh-CN' },
  { code: 'es', name: 'Español', locale: 'es-ES' },
  { code: 'pt', name: 'Português (Brasil)', locale: 'pt-BR' },
  { code: 'id', name: 'Bahasa Indonesia', locale: 'id-ID' },
  { code: 'th', name: 'ไทย', locale: 'th-TH' },
  { code: 'de', name: 'Deutsch', locale: 'de-DE' },
  { code: 'fr', name: 'Français', locale: 'fr-FR' },
  { code: 'ru', name: 'Русский', locale: 'ru-RU' },
  { code: 'tr', name: 'Türkçe', locale: 'tr-TR' },
]);
const CODES = new Set(LANGUAGES.map((l) => l.code));
export const DEFAULT_LANGUAGE = 'en'; // for devices in none of the languages above
export const isLanguage = (code) => CODES.has(code);

// Each locale in its own chunk, fetched when first chosen (every file in src/locales).
const LOADERS = import.meta.glob('./locales/*.js');
const loaderFor = (code) => LOADERS[`./locales/${code}.js`];

let current = 'ko';
let dict = ko;
const listeners = new Set();

/**
 * Which language to show: the player's pick when valid, else the first device language we have
 * (by primary subtag: en-US -> en, zh-TW -> zh, pt-PT -> pt), else English.
 * @param {readonly string[]} languages navigator.languages
 * @param {string} [saved] the code kept in the save ('' or undefined = follow the device)
 */
export function detectLanguage(languages = [], saved = '') {
  if (saved && isLanguage(saved)) return saved;
  for (const tag of languages ?? []) {
    const primary = String(tag).toLowerCase().split('-')[0];
    if (isLanguage(primary)) return primary;
  }
  return DEFAULT_LANGUAGE;
}

/** Loads and switches to a language (Korean needs no load). Listeners (UI) redraw afterwards. */
export async function setLanguage(code) {
  const next = isLanguage(code) ? code : DEFAULT_LANGUAGE;
  const load = next === 'ko' ? null : loaderFor(next);
  dict = load ? { ...ko, ...(await load()).default } : ko; // a missing key (or file) shows the Korean
  current = next;
  if (typeof document !== 'undefined') document.documentElement.lang = next;
  listeners.forEach((fn) => fn(next));
  return next;
}

/** @returns {string} the current language code */
export const lang = () => current;
/** @returns {string} the locale for number formatting (toLocaleString) */
export const locale = () => LANGUAGES.find((l) => l.code === current)?.locale ?? 'en-US';
/** @param {(code:string)=>void} fn called after every language change */
export function onLanguage(fn) { listeners.add(fn); return () => listeners.delete(fn); }

/**
 * A translated string. `{name}` placeholders are filled from params; numbers are formatted for the
 * language. Unknown keys come back as the key itself (so they are easy to spot).
 * @param {string} key
 * @param {Record<string, string|number>} [params]
 */
export function t(key, params) {
  const text = dict[key] ?? ko[key] ?? key;
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (m, name) => {
    const v = params[name];
    if (v === undefined) return m;
    return typeof v === 'number' ? v.toLocaleString(locale()) : String(v);
  });
}

/**
 * Translates the page's static text: elements with data-i18n (text), data-i18n-aria (aria-label)
 * and data-i18n-title (title), plus the document title.
 * @param {ParentNode} root
 */
export function applyStatic(root) {
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria));
  for (const el of root.querySelectorAll('[data-i18n-title]')) el.setAttribute('title', t(el.dataset.i18nTitle));
  if (typeof document !== 'undefined') document.title = t('meta.title');
}

/**
 * Fills language pickers: "auto (device)" first, then every language by its native name.
 * @param {HTMLSelectElement[]} selects @param {string} current '' for auto @param {(code:string)=>void} onChange
 */
export function fillLanguageSelects(selects, current, onChange) {
  for (const sel of selects) {
    if (!sel) continue;
    sel.replaceChildren(...[{ code: '', name: t('lang.auto') }, ...LANGUAGES].map(({ code, name }) => Object.assign(document.createElement('option'), { value: code, textContent: name })));
    sel.value = current ?? '';
    sel.onchange = () => onChange(sel.value);
  }
}
