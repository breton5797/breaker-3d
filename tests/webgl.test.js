import { describe, it, expect } from 'vitest';
import { hasWebGL } from '../src/webgl.js';

const doc = (contexts) => ({ createElement: () => ({ getContext: (k) => (contexts.includes(k) ? {} : null) }) });

describe('WebGL check', () => {
  it('accepts WebGL 2', () => expect(hasWebGL(doc(['webgl2']))).toBe(true));
  it('accepts WebGL 1', () => expect(hasWebGL(doc(['webgl']))).toBe(true));
  it('rejects a browser with neither', () => expect(hasWebGL(doc([]))).toBe(false));
  it('rejects a browser where asking throws (blocked by policy)', () => {
    expect(hasWebGL({ createElement: () => ({ getContext: () => { throw new Error('blocked'); } }) })).toBe(false);
  });
});
