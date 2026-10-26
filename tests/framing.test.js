import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { frameTable, placeCamera } from '../src/render/framing.js';

const BOX = { halfW: 49.4, near: -64, far: 65.4, nearZ: 0, farZ: 2.2 };

/** Projects the table's corners with the camera frameTable chose. */
function corners(aspect, opts = {}) {
  const fov = opts.fov ?? 50;
  const tilt = opts.tilt ?? 0.6;
  const f = frameTable({ fov, aspect, tilt, box: BOX, margin: opts.margin ?? 0.03, insetTop: opts.insetTop ?? 0, insetBottom: opts.insetBottom ?? 0 });
  const cam = new THREE.PerspectiveCamera(fov, aspect, 0.5, 2000);
  placeCamera(cam, f, tilt, 0);
  cam.updateMatrixWorld();
  const pts = [
    [-BOX.halfW, BOX.near, BOX.nearZ], [BOX.halfW, BOX.near, BOX.nearZ],
    [-BOX.halfW, BOX.far, BOX.farZ], [BOX.halfW, BOX.far, BOX.farZ],
  ].map(([x, y, z]) => new THREE.Vector3(x, y, z).project(cam));
  return { f, pts };
}

describe('table framing', () => {
  for (const [name, aspect] of [['phone portrait', 430 / 900], ['tablet', 0.75], ['desktop', 1440 / 900], ['ultrawide', 2.4]]) {
    it(`fits the whole table on a ${name} screen`, () => {
      const { pts } = corners(aspect);
      for (const p of pts) {
        expect(Math.abs(p.x)).toBeLessThanOrEqual(0.97 + 1e-3);
        expect(Math.abs(p.y)).toBeLessThanOrEqual(0.97 + 1e-3);
      }
    });

    it(`fills the ${name} screen (the tight side touches the margin)`, () => {
      const { pts } = corners(aspect);
      const maxX = Math.max(...pts.map((p) => Math.abs(p.x)));
      const ys = pts.map((p) => p.y);
      const spanY = Math.max(...ys) - Math.min(...ys);
      expect(Math.max(maxX, spanY / 2)).toBeGreaterThan(0.95);
    });
  }

  it('centres the table vertically', () => {
    const { pts } = corners(1440 / 900);
    const ys = pts.map((p) => p.y);
    expect(Math.abs(Math.max(...ys) + Math.min(...ys))).toBeLessThan(0.02);
  });

  it('keeps the table clear of HUD insets', () => {
    // 10% of the screen reserved at the top, 8% at the bottom (in NDC: 0.2 and 0.16).
    const { pts } = corners(1440 / 900, { insetTop: 0.1, insetBottom: 0.08 });
    for (const p of pts) {
      expect(p.y).toBeLessThanOrEqual(1 - 0.2 - 0.03 + 1e-3);
      expect(p.y).toBeGreaterThanOrEqual(-1 + 0.16 + 0.03 - 1e-3);
    }
  });

  it('can sit the table on the bottom inset (tall screens: near the thumb, room visible above)', () => {
    const fov = 50;
    const tilt = 0.6;
    const f = frameTable({ fov, aspect: 430 / 900, tilt, box: BOX, margin: 0.03, insetBottom: 0.1, align: 'bottom' });
    const cam = new THREE.PerspectiveCamera(fov, 430 / 900, 0.5, 2000);
    placeCamera(cam, f, tilt, 0);
    cam.updateMatrixWorld();
    const ys = [[BOX.halfW, BOX.near, BOX.nearZ], [BOX.halfW, BOX.far, BOX.farZ]].map(([x, y, z]) => new THREE.Vector3(x, y, z).project(cam).y);
    expect(Math.min(...ys)).toBeCloseTo(-1 + 0.2 + 0.03, 2);
    expect(Math.max(...ys)).toBeLessThan(0.97);
  });

  it('a wider screen does not push the camera further away', () => {
    expect(corners(2.4).f.dist).toBeLessThanOrEqual(corners(1.6).f.dist + 1e-6);
  });
});
