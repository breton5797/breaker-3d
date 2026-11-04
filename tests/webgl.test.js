import { describe, it, expect } from 'vitest';
import { hasWebGL, webglReport } from '../src/webgl.js';

const doc = (contexts) => ({ createElement: () => ({ getContext: (k) => (contexts.includes(k) ? {} : null) }) });

describe('WebGL check', () => {
  it('accepts WebGL 2', () => expect(hasWebGL(doc(['webgl2']))).toBe(true));
  it('accepts WebGL 1', () => expect(hasWebGL(doc(['webgl']))).toBe(true));
  it('accepts the old experimental-webgl name', () => expect(hasWebGL(doc(['experimental-webgl']))).toBe(true));
  it('rejects a browser with neither', () => expect(hasWebGL(doc([]))).toBe(false));
  it('rejects a browser where asking throws (blocked by policy)', () => {
    expect(hasWebGL({ createElement: () => ({ getContext: () => { throw new Error('blocked'); } }) })).toBe(false);
  });
});

describe('WebGL failure reason (shown on the error screen)', () => {
  const failingDoc = (statusMessage) => ({
    createElement: () => {
      const handlers = {};
      return {
        addEventListener: (type, fn) => { handlers[type] = fn; },
        getContext: () => {
          handlers.webglcontextcreationerror?.({ statusMessage });
          return null;
        },
      };
    },
  });

  it('reports which version works when one does', () => {
    expect(webglReport(doc(['webgl']))).toEqual({ ok: true, version: 'webgl', reason: '' });
  });
  it('passes on the browser status message when no context can be made', () => {
    expect(webglReport(failingDoc('GPU process crashed'))).toEqual({ ok: false, version: '', reason: 'GPU process crashed' });
  });
  it('passes on the thrown error when asking throws', () => {
    const r = webglReport({ createElement: () => ({ getContext: () => { throw new Error('blocked'); } }) });
    expect(r).toEqual({ ok: false, version: '', reason: 'blocked' });
  });
  it('says no context when the browser gives no reason', () => {
    expect(webglReport(doc([])).reason).toBe('no context');
  });
});
