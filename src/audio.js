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
    /** The app went to the background (or came back): silence the whole context meanwhile. */
    sleep(hidden) {
      if (!ctx) return;
      if (hidden) ctx.suspend();
      else ctx.resume();
    },
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
    /** Gold coin caught: a bright "ka-ching" (quick rising run plus a shimmer of noise). */
    coin() {
      [0, 4, 7, 12].forEach((s, k) => setTimeout(() => tone(note(14 + s), 0.12, 'triangle', 0.13), k * 35));
      burst(0.18, 7000, 0.18);
    },
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

    // ---------- menus and screens ----------
    /** Plain button press: a short, soft click. */
    tap() { tone(1200, 0.05, 'sine', 0.12, 900); },
    /** Forward (start, next, retry): a bright two-note "go". */
    confirm() { tone(note(9), 0.08, 'triangle', 0.16); setTimeout(() => { voices = 0; tone(note(12), 0.14, 'triangle', 0.16); }, 60); },
    /** Back to a menu: the same two notes, falling. */
    back() { tone(note(9), 0.08, 'triangle', 0.13); setTimeout(() => { voices = 0; tone(note(5), 0.12, 'triangle', 0.13); }, 60); },
    /** A panel or list sliding open. */
    open() { burst(0.22, 3200, 0.12); tone(500, 0.18, 'sine', 0.08, 900); },
    toggle() { tone(1500, 0.04, 'square', 0.05); setTimeout(() => { voices = 0; tone(1900, 0.05, 'square', 0.05); }, 45); },
    pause() { tone(660, 0.18, 'sine', 0.14, 330); },
    resume() { tone(330, 0.16, 'sine', 0.14, 660); },
    /** Stage start: a rising whoosh under the stage name. */
    stageIntro() {
      burst(0.6, 1800, 0.2);
      tone(220, 0.55, 'sawtooth', 0.05, 880);
      setTimeout(() => { voices = 0; tone(note(12), 0.25, 'triangle', 0.14); }, 480);
    },
    /** Ball or combo milestone toast. */
    milestone() { [0, 7, 12].forEach((s, k) => setTimeout(() => { voices = 0; tone(note(10 + s), 0.12, 'square', 0.06); }, k * 50)); },

    // ---------- bosses and chapter gimmicks ----------
    /** A boss appears: a two-tone siren over a low drone. */
    bossWarn() {
      voices = 0;
      tone(55, 1.4, 'sawtooth', 0.12, 50);
      [0, 1, 2, 3].forEach((k) => setTimeout(() => { voices = 0; tone(k % 2 ? 520 : 700, 0.28, 'square', 0.07); }, k * 300));
    },
    /** A ball hits the boss: a dull metal clank. */
    coreHit() { tone(180 + Math.random() * 30, 0.08, 'square', 0.06, 120); },
    /** The boss falls: a long crash, a low boom and a rising victory chord. */
    bossDown() {
      voices = 0;
      burst(1.2, 4000, 0.6);
      tone(70, 1.0, 'sine', 0.5, 30);
      [0, 4, 7, 12, 16].forEach((s, k) => setTimeout(() => { voices = 0; tone(note(8 + s), 0.5, 'triangle', 0.16); }, 400 + k * 110));
    },
    /** Storm warning: a low rumble building under the doomed column. */
    rumble() { burst(0.9, 300, 0.35); },
    /** The bolt lands: a sharp crack and a rolling boom. */
    thunder() { voices = 0; burst(0.08, 9000, 0.5); burst(1.1, 700, 0.5); tone(60, 0.8, 'sine', 0.3, 35); },

    // ---------- stage clear screen ----------
    /** The clear panel slams in: a low thump, a cymbal-ish wash and a big chord. */
    clearSlam() {
      voices = 0;
      tone(110, 0.45, 'sine', 0.5, 45);
      burst(0.9, 6000, 0.35);
      [0, 4, 7, 12].forEach((s) => tone(note(7 + s), 0.7, 'triangle', 0.1)); // 6 voices in all: exactly the frame budget
    },
    /** Star k (0..2) earned: each rings a step higher. Unearned stars get a dull knock. */
    star(k, earned = true) {
      voices = 0;
      if (!earned) { tone(180, 0.12, 'sine', 0.12, 140); return; }
      tone(note(12 + k * 2), 0.35, 'triangle', 0.17);
      tone(note(16 + k * 2), 0.35, 'sine', 0.08);
      burst(0.12, 8000, 0.1);
    },
    /** Count-up tick (score digits rolling, stat rows landing). */
    tick(k = 0) { voices = 0; tone(1800 + (k % 6) * 120, 0.03, 'square', 0.04); },
    /** The buttons pop in at the end of the clear screen. */
    buttonsIn() { voices = 0; tone(note(14), 0.1, 'triangle', 0.12); setTimeout(() => { voices = 0; tone(note(19), 0.18, 'triangle', 0.12); }, 70); },
    /** Game over: a slow falling minor run and a low thud. */
    gameOver() {
      voices = 0;
      tone(90, 0.6, 'sine', 0.4, 40);
      [12, 10, 7, 3].forEach((s, k) => setTimeout(() => { voices = 0; tone(note(s) * 0.5, 0.4, 'triangle', 0.14); }, 120 + k * 180));
    },
  };
}
