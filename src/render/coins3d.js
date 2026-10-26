import * as THREE from 'three';
import { toWorldX, toWorldY } from './stage.js';
import { coinMaterials, coinGeometry } from './coinLook.js';
import { PADDLE_Y } from '../sim/constants.js';

const POOL = 160;
const POPS = 24;
const POP_TIME = 0.55; // seconds a caught coin takes to jump up, spin and vanish

/**
 * Falling gold coins (thick embossed discs that flip as they drop), plus the
 * "pop" when one is caught: a big coin leaps up from the paddle toward the
 * camera, spinning fast and swelling, then shrinks away.
 */
export function createCoins3d(scene) {
  const make = (radius, thickness, count) => {
    const mesh = new THREE.InstancedMesh(coinGeometry(radius, thickness), coinMaterials(), count);
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    mesh.count = 0;
    scene.add(mesh);
    return mesh;
  };
  const faces = make(0.95, 0.38, POOL);
  const popMesh = make(1.3, 0.5, POPS);
  const pops = []; // { x, t0 }
  let clock = 0;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const pos = new THREE.Vector3();
  const scale = new THREE.Vector3();

  /** Drops every pop in flight (new stage, back to the menu). */
  function reset() {
    pops.length = 0;
    popMesh.count = 0;
  }

  /** A coin was just caught at sim x. */
  function pop(x) {
    if (pops.length >= POPS) pops.shift();
    pops.push({ x, t0: clock });
  }

  function drawPops() {
    while (pops.length && clock - pops[0].t0 > POP_TIME) pops.shift();
    pops.forEach((p, i) => {
      const u = (clock - p.t0) / POP_TIME; // 0..1
      const rise = Math.sin((Math.min(1, u * 1.6) * Math.PI) / 2); // fast up, then hangs
      const size = u < 0.7 ? 1 + 0.8 * Math.sin(((u / 0.7) * Math.PI) / 2) : 1.8 * (1 - (u - 0.7) / 0.3);
      e.set(0, u * Math.PI * 6, 0); // three fast turns
      q.setFromEuler(e);
      pos.set(toWorldX(p.x), toWorldY(PADDLE_Y + 2 + rise * 5), 2 + rise * 6);
      m.compose(pos, q, scale.setScalar(Math.max(0.001, size)));
      popMesh.setMatrixAt(i, m);
    });
    popMesh.count = pops.length;
    popMesh.instanceMatrix.needsUpdate = true;
  }

  /** @param {{x:number,y:number}[]} coins @param {number} time seconds */
  function update(coins, time) {
    if (time < clock) reset(); // the clock went back (menu backdrop): nothing in flight is valid
    clock = time;
    const n = Math.min(POOL, coins.length);
    for (let i = 0; i < n; i++) {
      const c = coins[i];
      e.set(0, time * 6 + i, 0); // the disc already faces the camera; flip it about the field's vertical axis
      q.setFromEuler(e);
      pos.set(toWorldX(c.x), toWorldY(c.y), 1.2);
      m.compose(pos, q, scale.setScalar(1));
      faces.setMatrixAt(i, m);
    }
    faces.count = n;
    faces.instanceMatrix.needsUpdate = true;
    drawPops();
  }

  return { update, pop, reset };
}
