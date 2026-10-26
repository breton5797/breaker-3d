import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { frameTable, placeCamera, viewFor, framingBox } from '../src/render/framing.js';

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

describe('per-screen view (tall phones zoom onto the play field)', () => {
  const STEEL = { left: -41, right: 42, bottom: -14, top: 58 }; // the box (world units), rows 50..122
  const HUD = 84;
  const SKILLS = 140;
  const ROWS_HALF = 64;

  /** Camera for a screen, with the paddle (centre px, sim x) pushing the sway. */
  function shoot(w, h, paddleSimX = 48) {
    const v = viewFor(w, h);
    const f = frameTable({
      fov: v.fov, aspect: w / h, tilt: v.tilt, box: framingBox(v), margin: v.margin,
      insetTop: HUD / h, insetBottom: (w < h ? SKILLS : 12) / h, align: v.align,
    });
    const cam = new THREE.PerspectiveCamera(v.fov, w / h, 2, 1500);
    placeCamera(cam, f, v.tilt, (paddleSimX - 48) * v.sway);
    cam.updateMatrixWorld();
    const px = (x, y, z = 1) => { const p = new THREE.Vector3(x, y, z).project(cam); return { x: ((p.x + 1) / 2) * w, y: ((1 - p.y) / 2) * h }; };
    return { v, px };
  }

  const phones = [[360, 780], [390, 844], [432, 927], [768, 1024]];

  for (const [w, h] of phones) {
    it(`${w}x${h}: the whole steel box is on screen, clear of the HUD`, () => {
      const { px } = shoot(w, h);
      for (const [x, y] of [[STEEL.left, STEEL.top], [STEEL.right, STEEL.top], [STEEL.left, STEEL.bottom], [STEEL.right, STEEL.bottom]]) {
        const p = px(x, y);
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(w);
        expect(p.y).toBeGreaterThanOrEqual(HUD);
      }
    });

    it(`${w}x${h}: fills the screen (box spans 78% of the width, or the board reaches the HUD)`, () => {
      const { px } = shoot(w, h);
      const wide = px(STEEL.right, STEEL.top).x - px(STEEL.left, STEEL.top).x > w * 0.78;
      const tall = px(0, ROWS_HALF + 1.4, 2.2).y <= HUD + h * 0.02;
      expect(wide || tall).toBe(true);
    });

    for (const half of [4, 8]) {
      it(`${w}x${h}: a paddle (half width ${half}) pushed to either wall stays fully visible`, () => {
        const right = shoot(w, h, 96 - half);
        expect(right.px(48, 6 - 64 + 0.5, 0.5).x).toBeLessThanOrEqual(w);
        const left = shoot(w, h, half);
        expect(left.px(-48, 6 - 64 + 0.5, 0.5).x).toBeGreaterThanOrEqual(0);
      });
    }
  }

  for (const [w, h] of phones) {
    it(`${w}x${h}: a finger at the screen edge drives the paddle into the wall`, () => {
      for (const side of [1, -1]) {
        const { v } = shoot(w, h);
        const f = frameTable({
          fov: v.fov, aspect: w / h, tilt: v.tilt, box: framingBox(v), margin: v.margin,
          insetTop: HUD / h, insetBottom: (w < h ? SKILLS : 12) / h, align: v.align,
        });
        const cam = new THREE.PerspectiveCamera(v.fov, w / h, 2, 1500);
        placeCamera(cam, f, v.tilt, (side > 0 ? 39 : -39) * v.sway);
        cam.updateMatrixWorld();
        // Ray through the screen edge (1px in) at the paddle's screen height, onto the paddle plane.
        const ray = new THREE.Raycaster();
        const paddleY = new THREE.Vector3(0, 6 - 64, 0.5).project(cam).y;
        ray.setFromCamera(new THREE.Vector2(side * (1 - 2 / w), paddleY), cam);
        const hit = new THREE.Vector3();
        ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.5), hit);
        const simX = 48 + hit.x * v.reach;
        if (side > 0) expect(simX).toBeGreaterThanOrEqual(96 - 9);
        else expect(simX).toBeLessThanOrEqual(9);
      }
    });
  }

  it('wide screens map the finger one-to-one', () => {
    expect(viewFor(1440, 900).reach).toBe(1);
  });

  it('the picture never pans with the paddle, on any screen (the view stays fixed)', () => {
    for (const [w, h] of [...phones, [1440, 900], [900, 430]]) expect(viewFor(w, h).sway).toBe(0);
  });

  it('wide screens keep the full board and the stronger perspective', () => {
    const v = viewFor(1440, 900);
    expect(framingBox(v).halfW).toBeGreaterThan(49);
    expect(v.tilt).toBeGreaterThan(viewFor(390, 844).tilt);
  });
});
