import * as THREE from 'three';
import { toWorldX, toWorldY } from './stage.js';

const POOL = 160;
const GOLD = 0xf2b705;
const RIM = 0xb07f00;

/** Falling gold coins: matte discs that spin as they drop (instanced). */
export function createCoins3d(scene) {
  const geo = new THREE.CylinderGeometry(0.75, 0.75, 0.22, 20);
  const mat = new THREE.MeshLambertMaterial({ color: GOLD });
  const rimMat = new THREE.MeshLambertMaterial({ color: RIM });
  const faces = new THREE.InstancedMesh(geo, [rimMat, mat, mat], POOL);
  faces.castShadow = true;
  faces.frustumCulled = false;
  faces.count = 0;
  scene.add(faces);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const pos = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);

  /** @param {{x:number,y:number}[]} coins @param {number} time seconds */
  function update(coins, time) {
    const n = Math.min(POOL, coins.length);
    for (let i = 0; i < n; i++) {
      const c = coins[i];
      e.set(Math.PI / 2, time * 6 + i, 0, 'YXZ'); // face the camera, then flip about the field's vertical axis
      q.setFromEuler(e);
      pos.set(toWorldX(c.x), toWorldY(c.y), 1.2);
      m.compose(pos, q, one);
      faces.setMatrixAt(i, m);
    }
    faces.count = n;
    faces.instanceMatrix.needsUpdate = true;
  }

  return { update };
}
