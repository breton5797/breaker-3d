import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { cleanCredit } from '../src/credits.js';
import { OWN_BACKDROP } from '../src/sim/maps.js';

const ok = { artist: 'Jane Doe', license: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:X.jpg' };

describe('photo credits', () => {
  it('keeps a valid entry', () => {
    expect(cleanCredit(ok)).toEqual(ok);
  });

  it('rejects links that are not Commons file pages', () => {
    expect(cleanCredit({ ...ok, source: 'javascript:alert(1)' })).toBeNull();
    expect(cleanCredit({ ...ok, source: 'https://evil.example/wiki/File:X.jpg' })).toBeNull();
  });

  it('rejects non-free or missing licences and missing authors', () => {
    expect(cleanCredit({ ...ok, license: 'All rights reserved' })).toBeNull();
    expect(cleanCredit({ ...ok, artist: '' })).toBeNull();
    expect(cleanCredit(null)).toBeNull();
  });

  it('keeps a Creative Commons licence link, drops any other link', () => {
    const url = 'https://creativecommons.org/licenses/by-sa/4.0';
    expect(cleanCredit({ ...ok, licenseUrl: url }).licenseUrl).toBe(url);
    expect(cleanCredit({ ...ok, licenseUrl: 'http://creativecommons.org/publicdomain/zero/1.0/deed.en' }).licenseUrl)
      .toBe('http://creativecommons.org/publicdomain/zero/1.0/deed.en');
    expect(cleanCredit({ ...ok, licenseUrl: 'https://evil.example/licenses/by/4.0' }).licenseUrl).toBeUndefined();
    expect(cleanCredit({ ...ok, licenseUrl: 'javascript:alert(1)' }).licenseUrl).toBeUndefined();
  });

  it('every shipped CC photo carries a link to its licence (CC requires it)', () => {
    const credits = JSON.parse(readFileSync(new URL('../public/landmarks/credits.json', import.meta.url), 'utf8'));
    for (const [id, c] of Object.entries(credits)) {
      if (/^cc/i.test(c.license)) expect(cleanCredit(c).licenseUrl, id).toMatch(/^https?:\/\/creativecommons\.org\//);
    }
  });

  // Licence audit (owner, 2026-11-07): CC BY / BY-SA photos can't ship under app-store DRM. Every
  // photo file is either credited public domain / CC0, or our own generated art (Higgsfield: the
  // animal scenes, scripts/art/hf-animals.jsonl, and the backdrops, scripts/art/hf-backdrops.jsonl).
  it('ships only public-domain / CC0 photos, and no picture file without a credit unless it is our own art', () => {
    const credits = JSON.parse(readFileSync(new URL('../public/landmarks/credits.json', import.meta.url), 'utf8'));
    for (const [id, c] of Object.entries(credits)) expect(c.license, id).toMatch(/^(public domain|cc0)$/i);
    const OWN_ART = new Set(['cat', 'dog', 'lion', 'panda', 'penguin', 'rabbit', ...OWN_BACKDROP]);
    for (const id of OWN_BACKDROP) expect(credits[id], id).toBeUndefined();
    const files = readdirSync(new URL('../public/landmarks/', import.meta.url)).filter((f) => f.endsWith('.jpg'));
    for (const f of files) {
      const id = f.slice(0, -4);
      expect(Boolean(credits[id]) || OWN_ART.has(id), `${f} has no credit`).toBe(true);
    }
  });

  it('every shipped credit passes the check', () => {
    const credits = JSON.parse(readFileSync(new URL('../public/landmarks/credits.json', import.meta.url), 'utf8'));
    for (const c of Object.values(credits)) expect(cleanCredit(c)).not.toBeNull();
  });
});
