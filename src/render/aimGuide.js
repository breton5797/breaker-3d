import * as THREE from 'three';
import { toWorldX, toWorldY } from './stage.js';

// The aim guide while the ball waits on the paddle: a dotted line along the
// flight aim.js predicts, bouncing off the walls. White while it misses, gold
// (with a ring at the spot) when the shot gets into the box. Flat, unlit dots:
// no glow, in keeping with the matte board.

const GAP = 1.4; // cells between dots
const MAX_DOTS = 160;
const Z = 0.5; // the balls' height above the table
const MISS = new THREE.Color(0xe8f1ff);
const HIT = new THREE.Color(0xffc93c);

/**
 * Even spacing along a polyline.
 * @param {number[][]} points [x, y] field cells
 * @param {number} gap
 * @returns {number[][]} dot centres from the first point on
 */
export function dotsAlong(points, gap = GAP) {
  const out = [];
  let carry = 0; // distance into the current segment where the next dot falls
  for (let k = 1; k < points.length && out.length < MAX_DOTS; k++) {
    const [x0, y0] = points[k - 1];
    const [x1, y1] = points[k];
    const len = Math.hypot(x1 - x0, y1 - y0);
    let d = carry;
    for (; d <= len && out.length < MAX_DOTS; d += gap) {
      const t = len ? d / len : 0;
      out.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]);
    }
    carry = d - len;
  }
  return out;
}

export function createAimGuide(scene) {
  const dotGeo = new THREE.CircleGeometry(0.45, 10);
  const dots = new THREE.InstancedMesh(dotGeo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }), MAX_DOTS);
  dots.frustumCulled = false;
  dots.count = 0;
  for (let i = 0; i < MAX_DOTS; i++) dots.setColorAt(i, MISS);
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.6, 24), new THREE.MeshBasicMaterial({ color: HIT, transparent: true, opacity: 0.9, depthWrite: false }));
  ring.visible = false;
  scene.add(dots, ring);
  const m = new THREE.Matrix4();
  const tint = new THREE.Color();
  let lastKey = '';

  return {
    /** @param {{ points: number[][], entered: boolean }|null} path null hides the guide */
    show(path) {
      if (!path) { dots.count = 0; ring.visible = false; lastKey = ''; return; }
      const key = `${path.entered}:${path.points.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(';')}`;
      if (key === lastKey) return; // same aim as last frame: nothing to redraw
      lastKey = key;
      const at = dotsAlong(path.points);
      const base = path.entered ? HIT : MISS;
      at.forEach(([x, y], i) => {
        m.makeTranslation(toWorldX(x), toWorldY(y), Z);
        dots.setMatrixAt(i, m);
        // Fades out along a miss; a shot that gets in stays bright all the way.
        tint.copy(base).multiplyScalar(path.entered ? 1 : 1 - 0.65 * (i / at.length));
        dots.setColorAt(i, tint);
      });
      dots.count = at.length;
      dots.instanceMatrix.needsUpdate = true;
      dots.instanceColor.needsUpdate = true;
      const end = path.points.at(-1);
      ring.visible = path.entered;
      if (path.entered) ring.position.set(toWorldX(end[0]), toWorldY(end[1]), Z);
    },
  };
}
