import * as THREE from 'three';
import { BALL_R, MAX_BALLS, COLS, ROWS } from '../sim/constants.js';

const WHITE = new THREE.Color(1, 1, 1);
const FIRE = new THREE.Color(1, 0.45, 0.08);

/** Instanced glowing balls fed straight from the sim's typed arrays. */
export function createBalls3d(scene) {
  const mesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(BALL_R * 1.8, 10, 8), // drawn larger than the hitbox so it reads on phones
    new THREE.MeshLambertMaterial(),
    MAX_BALLS + 1,
  );
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  for (let i = 0; i <= MAX_BALLS; i++) mesh.setColorAt(i, WHITE);
  scene.add(mesh);
  const m = mesh.instanceMatrix.array;
  const colors = mesh.instanceColor.array;
  const fireFlags = new Uint8Array(MAX_BALLS + 1);

  function write(slot, x, y, onFire) {
    const o = slot * 16;
    m[o] = 1; m[o + 5] = 1; m[o + 10] = 1; m[o + 15] = 1;
    m[o + 12] = x - COLS / 2;
    m[o + 13] = y - ROWS / 2;
    m[o + 14] = 0.5;
    if (fireFlags[slot] !== onFire) {
      fireFlags[slot] = onFire;
      const c = onFire ? FIRE : WHITE;
      colors[slot * 3] = c.r; colors[slot * 3 + 1] = c.g; colors[slot * 3 + 2] = c.b;
      mesh.instanceColor.needsUpdate = true;
    }
  }

  /**
   * @param {ReturnType<import('../sim/balls.js').createBalls>} b
   * @param {{x:number,y:number}|null} resting ball sitting on the paddle before launch
   */
  function update(b, resting) {
    for (let i = 0; i < b.n; i++) write(i, b.x[i], b.y[i], b.fire[i] > 0 ? 1 : 0);
    let count = b.n;
    if (resting) write(count++, resting.x, resting.y, 0);
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
  }

  return { update };
}
