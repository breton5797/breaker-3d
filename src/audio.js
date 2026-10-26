// Tiny WebAudio synth: everything is generated, no audio files.
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24]; // major pentatonic, 2 octaves
const MAX_VOICES_PER_FRAME = 6;

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let voices = 0;
  let noise = null;

  function unlock() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 6;
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(comp).connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  const ready = () => ctx && !muted && voices < MAX_VOICES_PER_FRAME;

  function tone(freq, dur, type = 'triangle', vol = 0.18, slideTo = null) {
    if (!ready()) return;
    voices++;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function burst(dur, cutoff, vol) {
    if (!ready()) return;
    voices++;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(cutoff, t);
    f.frequency.exponentialRampToValueAtTime(60, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t);
    src.stop(t + dur);
  }

  const note = (step) => 440 * 2 ** ((SCALE[step % SCALE.length] + 12 * Math.floor(step / SCALE.length) - 9) / 12);

  return {
    unlock,
    /** Call once per rendered frame to reset the voice budget. */
    frame() { voices = 0; },
    setMuted(m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 0.5;
    },
    isMuted: () => muted,
    /** Brick pop; pitch climbs with the combo. */
    pop(combo) { tone(note(Math.min(30, Math.floor(combo / 12))) * (1 + Math.random() * 0.02), 0.09, 'triangle', 0.12); },
    paddle() { tone(220, 0.08, 'sine', 0.2, 330); },
    split(n) { tone(n >= 5 ? 1046 : 784, 0.18, 'sine', 0.14, n >= 5 ? 2093 : 1568); },
    boom() { burst(0.5, 1800, 0.7); tone(90, 0.4, 'sine', 0.4, 40); },
    laser() { tone(1400, 0.3, 'sawtooth', 0.08, 200); },
    /** Finale zap; `k` climbs the scale so the sweep sounds like a rising run. */
    zap(k = 0) { tone(note(8 + (k % 16)), 0.12, 'triangle', 0.09, note(8 + (k % 16)) * 0.5); },
    firework() { burst(0.45, 2600, 0.35); tone(note(14), 0.25, 'sine', 0.1, note(19)); },
    gold() { [0, 4, 7].forEach((s, k) => setTimeout(() => tone(note(10 + s), 0.15, 'sine', 0.12), k * 60)); },
    drop() { tone(1568, 0.12, 'sine', 0.1, 2093); },
    /** Bigger multipliers climb higher and longer. */
    collect(mult) {
      const steps = Math.min(8, 2 + Math.round(Math.log2(mult)));
      for (let k = 0; k < steps; k++) {
        setTimeout(() => { voices = 0; tone(note(6 + k * 2), 0.18, 'triangle', 0.16); }, k * 55);
      }
      burst(0.35, 5000, 0.25);
    },
    /** Gold coin caught: a short bright two-note ding. */
    coin() { tone(1760, 0.08, 'sine', 0.1); setTimeout(() => { voices = 0; tone(2349, 0.12, 'sine', 0.09); }, 50); },
    achievement() {
      [0, 4, 7, 12].forEach((s, k) => setTimeout(() => { voices = 0; tone(note(12 + s), 0.25, 'sine', 0.14); }, k * 80));
    },
    shoot() { tone(520, 0.18, 'square', 0.05, 160); },
    stunned() { burst(0.4, 900, 0.5); tone(140, 0.45, 'sawtooth', 0.2, 60); },
    launch() { tone(330, 0.15, 'sine', 0.2, 660); },
    lost() { tone(300, 0.5, 'sawtooth', 0.12, 80); },
    skill() { burst(0.3, 4000, 0.3); tone(440, 0.35, 'square', 0.1, 1760); },
    fanfare() {
      [0, 2, 4, 5, 7, 10].forEach((s, k) => setTimeout(() => { voices = 0; tone(note(5 + s), 0.3, 'triangle', 0.18); }, k * 90));
    },
  };
}
