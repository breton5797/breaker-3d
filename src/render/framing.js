import * as THREE from 'three';

// Camera framing: the closest camera (along the tilted view direction) that
// still shows the whole table, centred between the HUD insets. Solved
// numerically against a real perspective projection, so the near edge's
// perspective widening is accounted for exactly (no fudge margins).

const scratch = new THREE.PerspectiveCamera();
const v = new THREE.Vector3();

/**
 * @param {THREE.PerspectiveCamera} cam
 * @param {{ dist:number, lookY:number }} f a frameTable result
 * @param {number} tilt radians the view leans away from straight down
 * @param {number} sway world x shift (camera follows the paddle a little)
 */
export function placeCamera(cam, f, tilt, sway) {
  cam.position.set(sway, f.lookY - Math.sin(tilt) * f.dist, Math.cos(tilt) * f.dist);
  cam.lookAt(sway * 0.5, f.lookY, 0);
}

/** NDC bounds of the box's four outer corners for a camera at (dist, lookY). */
function bounds(box, tilt, dist, lookY) {
  placeCamera(scratch, { dist, lookY }, tilt, 0);
  scratch.updateMatrixWorld();
  let maxX = 0;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y, z] of [
    [-box.halfW, box.near, box.nearZ], [box.halfW, box.near, box.nearZ],
    [-box.halfW, box.far, box.farZ], [box.halfW, box.far, box.farZ],
  ]) {
    v.set(x, y, z).project(scratch);
    maxX = Math.max(maxX, Math.abs(v.x));
    minY = Math.min(minY, v.y);
    maxY = Math.max(maxY, v.y);
  }
  return { maxX, minY, maxY };
}

/**
 * @param {{ fov:number, aspect:number, tilt:number,
 *   box:{ halfW:number, near:number, far:number, nearZ:number, farZ:number },
 *   margin?:number, insetTop?:number, insetBottom?:number, align?:'centre'|'bottom' }} p
 *   insets are fractions of the screen height kept clear (HUD bars); align 'bottom'
 *   rests the table on the bottom inset instead of centring it
 * @returns {{ dist:number, lookY:number }}
 */
export function frameTable({ fov, aspect, tilt, box, margin = 0.03, insetTop = 0, insetBottom = 0, align = 'centre' }) {
  scratch.fov = fov;
  scratch.aspect = aspect;
  scratch.near = 0.5;
  scratch.far = 5000;
  scratch.updateProjectionMatrix();
  const top = 1 - 2 * insetTop - margin;
  const bottom = -1 + 2 * insetBottom + margin;
  const centre = (top + bottom) / 2;
  const xMax = 1 - margin;

  /** Signed miss of the table's placement at this camera; falls as lookY rises. */
  const miss = (b) => (align === 'bottom' ? b.minY - bottom : (b.minY + b.maxY) / 2 - centre);

  /** lookY that places the table (centred, or resting on the bottom inset) at this distance. */
  function placed(dist) {
    let lo = box.near - 200;
    let hi = box.far + 200;
    for (let k = 0; k < 40; k++) {
      const mid = (lo + hi) / 2;
      const b = bounds(box, tilt, dist, mid);
      // Raising the look point moves the table down the screen.
      if (miss(b) > 0) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }

  const fits = (dist) => {
    const lookY = placed(dist);
    const b = bounds(box, tilt, dist, lookY);
    const eps = 1e-6; // bottom alignment lands exactly on the edge; don't fail it on rounding
    return { ok: b.maxX <= xMax + eps && b.maxY <= top + eps && b.minY >= bottom - eps, lookY };
  };

  let lo = 1;
  let hi = 4000;
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2;
    if (fits(mid).ok) hi = mid; else lo = mid;
  }
  return { dist: hi, lookY: fits(hi).lookY };
}
