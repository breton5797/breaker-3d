// Camera motion for impacts, kept free of Three.js so it can be tested.
// - shake: "trauma" that decays; the offset is smooth noise (summed sines with
//   random phases), so the view rattles instead of jumping every frame.
// - kick: a directional push on a damped spring that settles back to rest.

export const SHAKE_MAX = 2.5;
const DECAY = 3.2; // trauma lost per second
const STIFF = 260; // spring stiffness
const DAMP = 22; // spring damping
const FREQ = [17.3, 23.9, 31.1]; // noise frequencies (rad/s), incommensurate
const KICK_MAX = 40; // spring velocity cap, so a pile of kicks in one frame stays one solid punch
const clamp = (v) => Math.max(-KICK_MAX, Math.min(KICK_MAX, v));

/** Small seeded PRNG so tests are repeatable. */
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/**
 * @param {{ seed?: number, reduced?: boolean }} [opts] reduced: honour prefers-reduced-motion
 */
export function createCamFx({ seed = Date.now(), reduced = false } = {}) {
  const rand = rng(seed);
  const phase = Array.from({ length: 9 }, () => rand() * Math.PI * 2);
  const gain = reduced ? 0.35 : 1;
  let trauma = 0;
  let t = 0;
  const pos = { x: 0, y: 0, z: 0 };
  const vel = { x: 0, y: 0, z: 0 };
  const offset = { x: 0, y: 0, z: 0 };

  const noise = (k) => FREQ.reduce((a, f, j) => a + Math.sin(t * f + phase[k * 3 + j]), 0) / FREQ.length;

  return {
    shake(amount) { trauma = Math.min(SHAKE_MAX, trauma + amount); },
    /** Instant push (world units per second) in a direction. */
    kick(x, y, z) { vel.x = clamp(vel.x + x * 12); vel.y = clamp(vel.y + y * 12); vel.z = clamp(vel.z + z * 12); },
    step(dt) {
      t += dt;
      trauma = Math.max(0, trauma - DECAY * dt);
      for (const k of ['x', 'y', 'z']) {
        vel[k] += (-STIFF * pos[k] - DAMP * vel[k]) * dt;
        pos[k] += vel[k] * dt;
      }
      // Part squared: small knocks stay subtle, big ones really rattle.
      const amp = (trauma * 0.5 + trauma * trauma * 0.2) * gain;
      offset.x = pos.x * gain + noise(0) * amp;
      offset.y = pos.y * gain + noise(1) * amp;
      offset.z = pos.z * gain + noise(2) * amp * 0.5;
    },
    get offset() { return { ...offset }; },
    get trauma() { return trauma; },
  };
}
