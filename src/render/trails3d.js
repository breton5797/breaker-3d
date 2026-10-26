import * as THREE from 'three';
import { BALL_R, COLS, ROWS } from '../sim/constants.js';

const MAX_TRAILS = 600; // only the first balls get a streak; past this the swarm reads as a cloud anyway
const LENGTH = 0.045; // streak length per unit of ball speed (seconds of travel)
const MAX_LEN = 3.2;
const WIDTH = BALL_R * 3.2; // ball diameter as drawn (balls3d draws them 1.8x the hitbox)
const WHITE = new THREE.Color(0.85, 0.9, 1);
const FIRE = new THREE.Color(1, 0.5, 0.12);

/**
 * Tapered flat ribbon lying on the table, head at x = 0, tail at x = -1.
 * Vertex alpha fades it out toward the tail. Plain translucent, no additive
 * blending, so it reads as a motion streak, never a glow.
 */
function streakGeometry() {
  const g = new THREE.BufferGeometry();
  const w = 0.5;
  g.setAttribute('position', new THREE.Float32BufferAttribute([
    0, -w, 0, 0, w, 0, -1, -w * 0.15, 0, -1, w * 0.15, 0,
  ], 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute([
    1, 1, 1, 0.5, 1, 1, 1, 0.5, 1, 1, 1, 0, 1, 1, 1, 0,
  ], 4));
  g.setIndex([0, 2, 1, 1, 2, 3]);
  return g;
}

/** Motion streaks behind the balls, fed straight from the sim's typed arrays. */
export function createTrails3d(scene) {
  const mesh = new THREE.InstancedMesh(
    streakGeometry(),
    new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
    MAX_TRAILS,
  );
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  for (let i = 0; i < MAX_TRAILS; i++) mesh.setColorAt(i, WHITE);
  mesh.count = 0;
  scene.add(mesh);
  const m = mesh.instanceMatrix.array;
  const colors = mesh.instanceColor.array;
  const fireFlags = new Uint8Array(MAX_TRAILS);
  let enabled = true;

  /** @param {ReturnType<import('../sim/balls.js').createBalls>} b */
  function update(b) {
    if (!enabled) { mesh.count = 0; return; }
    const n = Math.min(b.n, MAX_TRAILS);
    for (let i = 0; i < n; i++) {
      const vx = b.vx[i];
      const vy = b.vy[i];
      const speed = Math.hypot(vx, vy) || 1;
      const len = Math.min(MAX_LEN, speed * LENGTH);
      const cx = vx / speed;
      const cy = vy / speed;
      // Column-major matrix: x axis = direction * len, y axis = perpendicular * width.
      const o = i * 16;
      m[o] = cx * len; m[o + 1] = cy * len; m[o + 2] = 0; m[o + 3] = 0;
      m[o + 4] = -cy * WIDTH; m[o + 5] = cx * WIDTH; m[o + 6] = 0; m[o + 7] = 0;
      m[o + 8] = 0; m[o + 9] = 0; m[o + 10] = 1; m[o + 11] = 0;
      m[o + 12] = b.x[i] - COLS / 2; m[o + 13] = b.y[i] - ROWS / 2; m[o + 14] = 0.5; m[o + 15] = 1;
      const fire = b.fire[i] > 0 ? 1 : 0;
      if (fireFlags[i] !== fire) {
        fireFlags[i] = fire;
        const c = fire ? FIRE : WHITE;
        colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
        mesh.instanceColor.needsUpdate = true;
      }
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
  }

  return {
    update,
    setEnabled(on) { enabled = on; if (!on) mesh.count = 0; },
  };
}
