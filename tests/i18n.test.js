import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import ko from '../src/locales/ko.js';
import { LANGUAGES, detectLanguage, setLanguage, t, lang, locale, isLanguage, DEFAULT_LANGUAGE } from '../src/i18n.js';
import { stageTitleAt, mapName, bossName, achievementName, achievementDesc, bossBarName, stageTitle } from '../src/names.js';
import { getLevel } from '../src/sim/levels.js';
import { stageOfContent } from '../src/sim/sequence.js';
import { LAP } from '../src/sim/maps.js';
import { ACHIEVEMENTS } from '../src/achievements.js';
import { loadSave } from '../src/storage.js';
import { ICONS } from '../src/icons.js';

// PLAN v38 PR-D: the game in the device's language (14 languages), Korean as the source.

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
const EMOJI = /\p{Extended_Pictographic}/gu;
// Plain glyphs styled by CSS, not pictures (see icons.js): they need no icon.
const GLYPHS = new Set(['▶', '◀', '★', '☆', '♥', '✓', '—', '…', '·', '×', '●', '▮', '⟷', '↕', '©', '®', '™']);
const pictures = (s) => (s.match(EMOJI) ?? []).filter((e) => !GLYPHS.has(e));

beforeEach(async () => { await setLanguage('ko'); });

describe('the language list', () => {
  it('covers the 14 languages asked for, Korean first, each with a native name and a number locale', () => {
    const codes = LANGUAGES.map((l) => l.code);
    expect(codes).toEqual(['ko', 'en', 'vi', 'hi', 'ja', 'zh', 'es', 'pt', 'id', 'th', 'de', 'fr', 'ru', 'tr']);
    for (const l of LANGUAGES) { expect(l.name.length).toBeGreaterThan(1); expect(l.locale).toMatch(/^[a-z]{2}-[A-Z]{2}$/); }
    expect(DEFAULT_LANGUAGE).toBe('en');
  });

  it('has a dictionary file for every language and none for anything else', () => {
    const files = readdirSync(new URL('../src/locales/', import.meta.url)).map((f) => f.replace(/\.js$/, '')).sort();
    expect(files).toEqual(LANGUAGES.map((l) => l.code).sort());
  });
});

// Every dictionary module, by language code (Vite resolves the glob at build time).
const DICTS = Object.fromEntries(Object.entries(import.meta.glob('../src/locales/*.js', { eager: true })).map(([path, m]) => [path.match(/([a-z]+)\.js$/)[1], m.default]));

describe('every dictionary matches the Korean source', () => {
  const codes = LANGUAGES.map((l) => l.code).filter((c) => c !== 'ko');
  for (const code of codes) {
    it(`${code}: same keys, no empty values, same placeholders, no stray emoji, nothing left in Korean`, () => {
      const dict = DICTS[code];
      expect(dict, `src/locales/${code}.js (export default {...})`).toBeTruthy();
      expect(Object.keys(dict).sort()).toEqual(Object.keys(ko).sort());
      const koEmoji = new Set(pictures(Object.values(ko).join('')));
      for (const [k, v] of Object.entries(dict)) {
        expect(typeof v, k).toBe('string');
        expect(v.trim().length, k).toBeGreaterThan(0);
        expect(placeholders(v), k).toBe(placeholders(ko[k]));
        for (const e of pictures(v)) expect(koEmoji.has(e), `${code} ${k}: emoji ${e}`).toBe(true);
        if (!/^map\.hangul/.test(k)) expect(/[가-힣]/.test(v), `${code} ${k} still Korean`).toBe(false);
      }
    });
  }

  it('every emoji in the dictionaries has a clay icon (icons.js), like the rest of the UI', () => {
    for (const e of new Set(pictures(Object.values(ko).join('')))) expect(ICONS[e], e).toBeTruthy();
  });
});

describe('choosing a language', () => {
  it('follows the device: ko-KR -> ko, en-GB -> en, pt-BR -> pt, zh-TW -> zh; unknown -> English', () => {
    expect(detectLanguage(['ko-KR', 'en-US'])).toBe('ko');
    expect(detectLanguage(['en-GB'])).toBe('en');
    expect(detectLanguage(['vi-VN'])).toBe('vi');
    expect(detectLanguage(['hi-IN', 'en-IN'])).toBe('hi');
    expect(detectLanguage(['pt-BR'])).toBe('pt');
    expect(detectLanguage(['zh-TW', 'zh'])).toBe('zh');
    expect(detectLanguage(['xx-YY'])).toBe('en');
    expect(detectLanguage([])).toBe('en');
    expect(detectLanguage(undefined)).toBe('en');
  });

  it("the player's own pick wins over the device; an invalid pick is ignored", () => {
    expect(detectLanguage(['ko-KR'], 'ja')).toBe('ja');
    expect(detectLanguage(['ko-KR'], 'xx')).toBe('ko');
    expect(detectLanguage(['ko-KR'], '')).toBe('ko');
    expect(isLanguage('tr')).toBe(true);
    expect(isLanguage('kr')).toBe(false);
  });

  it('the save keeps the pick, validated', () => {
    globalThis.localStorage = { getItem: () => JSON.stringify({ lang: 'fr' }), setItem() {}, removeItem() {} };
    expect(loadSave().lang).toBe('fr');
    globalThis.localStorage = { getItem: () => JSON.stringify({ lang: 'klingon' }), setItem() {}, removeItem() {} };
    expect(loadSave().lang).toBe('');
    globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
    expect(loadSave().lang).toBe('');
  });
});

describe('t()', () => {
  it('translates, fills placeholders with locale-formatted numbers, and falls back to Korean then the key', async () => {
    expect(t('title.start')).toBe('시작하기');
    expect(t('title.continue', { n: 1234 })).toBe('STAGE 1,234 이어하기');
    await setLanguage('en');
    expect(lang()).toBe('en');
    expect(locale()).toBe('en-US');
    expect(t('title.start')).toBe('Play');
    expect(t('clear.achv', { name: 'X', gold: 2500 })).toBe('🏆 X +2,500 gold');
    expect(t('no.such.key')).toBe('no.such.key');
    await setLanguage('de');
    expect(t('title.continue', { n: 1234 })).toContain('1.234');
    expect(await setLanguage('nope')).toBe('en'); // an unknown code lands on the default
  });
});

describe('names in the current language', () => {
  it('maps, variants, bosses and achievements read in Korean by default and in English after switching', async () => {
    expect(stageTitleAt(0)).toBe('기자 피라미드');
    expect(stageTitleAt(9)).toBe('BOSS · 석상 거인');
    expect(stageTitleAt(stageOfContent(LAP.length))).toBe('기자 피라미드 · 노을');
    expect(stageTitleAt(stageOfContent(2 * LAP.length))).toBe('기자 피라미드 · 밤');
    const lvl = getLevel(0);
    expect(lvl.id).toBe('giza');
    expect(stageTitle(lvl)).toBe(lvl.name);
    expect(bossBarName(lvl)).toBe(lvl.bossName);
    expect(bossBarName(getLevel(9))).toBe('석상 거인');
    await setLanguage('en');
    expect(stageTitleAt(0)).toBe('Pyramids of Giza');
    expect(stageTitleAt(9)).toBe('BOSS · Stone Colossus');
    expect(stageTitleAt(stageOfContent(LAP.length))).toBe('Pyramids of Giza · Sunset');
    expect(mapName('num1')).toBe('Number 1');
    expect(bossName('mummy')).toBe('Mummy Pharaoh');
    const lap = ACHIEVEMENTS.find((a) => a.id === 'lap_one');
    expect(achievementName(lap)).toBe('Round the World');
    expect(achievementDesc(lap)).toContain('66');
    expect(achievementDesc(ACHIEVEMENTS.find((a) => a.id === 'balls_max'))).toContain('4,000');
  });

  it('every map, boss, fruit, unit tier and achievement has its name keys', () => {
    for (const m of LAP) { expect(ko[`map.${m.id}.name`], m.id).toBeTruthy(); expect(ko[`map.${m.id}.sub`], m.id).toBeTruthy(); }
    for (const a of ACHIEVEMENTS) { expect(ko[`achv.${a.id}.name`], a.id).toBe(a.name); }
    for (let i = 0; i < 60; i++) {
      const lvl = getLevel(i);
      if (lvl.boss) expect(ko[`boss.${lvl.boss.kind}`], lvl.boss.kind).toBeTruthy();
    }
  });
});

describe('the page', () => {
  it('every data-i18n key in index.html exists, and the eyebrow labels/buttons are keyed', () => {
    const html = read('index.html');
    const keys = [...html.matchAll(/data-i18n(?:-aria|-title)?="([^"]+)"/g)].map((m) => m[1]);
    expect(keys.length).toBeGreaterThan(40);
    for (const k of keys) expect(ko[k], k).toBeTruthy();
    for (const k of ['title.start', 'clear.next', 'over.retry', 'pause.resume', 'achv.title', 'coll.title', 'legend.hole', 'title.controls', 'legal.privacy']) expect(keys).toContain(k);
    expect(html).toContain('id="lang-select"');
    expect(html).toMatch(/<title>BREAKER 3D[^<]*Brick Breaker/);
  });

  it('the UI applies the static text and refreshes on a language change; boot messages are bilingual without the dictionary', () => {
    const ui = read('src/ui.js');
    expect(ui).toMatch(/applyStatic\(document\.body\)/);
    expect(ui).toMatch(/function relocalize\(/);
    expect(ui).toMatch(/toLocaleString\(locale\(\)\)/);
    const main = read('src/main.js');
    expect(main).toMatch(/await setLanguage\(detectLanguage\(navigator\.languages, save\.lang\)\)/);
    expect(main).toMatch(/onLanguage:/);
    const boot = read('src/boot.js');
    expect(boot).toMatch(/startsWith\('ko'\)/);
    expect(boot).toMatch(/Reload/);
  });

  it('no Korean UI text is left hard-coded in the UI, loop and director (names and tests aside)', () => {
    for (const f of ['src/ui.js', 'src/main.js', 'src/director.js', 'src/collectionView.js']) {
      const lines = read(f).split('\n').filter((l) => /[가-힣]/.test(l) && !/^\s*(\/\/|\*|\/\*)/.test(l));
      expect(lines, `${f}: ${lines.join(' | ')}`).toEqual([]);
    }
  });
});
