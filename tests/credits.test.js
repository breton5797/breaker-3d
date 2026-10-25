import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { cleanCredit } from '../src/credits.js';

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

  it('every shipped credit passes the check', () => {
    const credits = JSON.parse(readFileSync(new URL('../public/landmarks/credits.json', import.meta.url), 'utf8'));
    for (const c of Object.values(credits)) expect(cleanCredit(c)).not.toBeNull();
  });
});
