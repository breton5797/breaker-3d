import { describe, it, expect, afterEach } from 'vitest';
import { createAudio } from '../src/audio.js';

// The game's own sound for the daily shorts (owner, 2026-11-17: "영상에 음성이 나오게"): audio.stream()
// gives the mixed output as a MediaStream so the recorder can capture it.
class Node { connect(n) { (this.out ??= []).push(n); return n; } }
class FakeCtx {
  constructor() { this.state = 'running'; this.sampleRate = 8000; this.destination = new Node(); }
  createDynamicsCompressor() { const n = new Node(); n.threshold = { value: 0 }; n.ratio = { value: 0 }; return n; }
  createGain() { const n = new Node(); n.gain = { value: 0 }; return n; }
  createBuffer(c, len) { return { getChannelData: () => new Float32Array(len) }; }
  createMediaStreamDestination() { const n = new Node(); n.stream = { id: 'tap' }; return n; }
}
afterEach(() => { delete globalThis.window; });

describe('audio.stream()', () => {
  it('returns the mixed output as a MediaStream (the same one each call)', () => {
    globalThis.window = { AudioContext: FakeCtx };
    const a = createAudio();
    const s = a.stream();
    expect(s).toEqual({ id: 'tap' });
    expect(a.stream()).toBe(s);
  });

  it('is null where WebAudio is missing', () => {
    globalThis.window = {};
    expect(createAudio().stream()).toBeNull();
  });
});
