import * as THREE from 'three';
import { COLS, ROWS, BOMB_RADIUS, PADDLE_Y } from '../sim/constants.js';
import { toWorldX, toWorldY } from './stage.js';

const DEBRIS = 4000;
const GRAVITY = -42;
const tmp = new THREE.Object3D();
const color = new THREE.Color();

/** Brick shards that leap off the table, tumble, bounce once and shrink away. */
function createDebris(scene) {
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.42, 0.42, 0.42),
    new THREE.MeshLambertMaterial(),
    DEBRIS,
  );
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  mesh.count = DEBRIS;
  for (let i = 0; i < DEBRIS; i++) {
    mesh.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0));
    mesh.setColorAt(i, color.set(0xffffff));
  }
  scene.add(mesh);
  const p = {
    x: new Float32Array(DEBRIS), y: new Float32Array(DEBRIS), z: new Float32Array(DEBRIS),
    vx: new Float32Array(DEBRIS), vy: new Float32Array(DEBRIS), vz: new Float32Array(DEBRIS),
    rx: new Float32Array(DEBRIS), ry: new Float32Array(DEBRIS), life: new Float32Array(DEBRIS),
  };
  let next = 0;
  let live = 0;

  function spawn(x, y, hex, power = 1) {
    const i = next;
    next = (next + 1) % DEBRIS;
    if (p.life[i] <= 0) live++;
    p.x[i] = toWorldX(x); p.y[i] = toWorldY(y); p.z[i] = 0.6;
    const a = Math.random() * Math.PI * 2;
    const s = (2 + Math.random() * 7) * power;
    p.vx[i] = Math.cos(a) * s; p.vy[i] = Math.sin(a) * s;
    p.vz[i] = (8 + Math.random() * 14) * power;
    p.rx[i] = Math.random() * 6; p.ry[i] = Math.random() * 6;
    p.life[i] = 1 + Math.random() * 0.6;
    mesh.setColorAt(i, color.set(hex));
    mesh.instanceColor.needsUpdate = true;
  }

  function update(dt) {
    if (!live) return;
    live = 0;
    for (let i = 0; i < DEBRIS; i++) {
      if (p.life[i] <= 0) continue;
      p.life[i] -= dt;
      if (p.life[i] <= 0) { mesh.setMatrixAt(i, tmp.matrix.makeScale(0, 0, 0)); continue; }
      live++;
      p.vz[i] += GRAVITY * dt;
      p.x[i] += p.vx[i] * dt; p.y[i] += p.vy[i] * dt; p.z[i] += p.vz[i] * dt;
      if (p.z[i] < 0.2 && p.vz[i] < 0) { p.z[i] = 0.2; p.vz[i] *= -0.35; p.vx[i] *= 0.6; p.vy[i] *= 0.6; }
      tmp.position.set(p.x[i], p.y[i], p.z[i]);
      tmp.rotation.set(p.rx[i] * p.life[i] * 3, p.ry[i] * p.life[i] * 3, 0);
      tmp.scale.setScalar(Math.min(1, p.life[i] * 1.5));
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
  return { spawn, update };
}

/** Small pool of short-lived meshes (rings, beams) that animate then hide. */
function createPool(scene, size, makeMesh) {
  const items = Array.from({ length: size }, () => {
    const mesh = makeMesh();
    mesh.visible = false;
    scene.add(mesh);
    return { mesh, t: 0, dur: 1, anim: null };
  });
  let k = 0;
  return {
    fire(dur, anim) {
      const it = items[k];
      k = (k + 1) % size;
      it.mesh.visible = true;
      it.t = 0;
      it.dur = dur;
      it.anim = anim;
      anim(it.mesh, 0);
    },
    update(dt) {
      for (const it of items) {
        if (!it.mesh.visible) continue;
        it.t += dt;
        const u = it.t / it.dur;
        if (u >= 1) { it.mesh.visible = false; continue; }
        it.anim(it.mesh, u);
      }
    },
  };
}

// Flat, non-glowing translucent shapes for rings and beams.
const flat = (r, g, b) => new THREE.MeshBasicMaterial({
  color: new THREE.Color(r, g, b), transparent: true, depthWrite: false,
});

export function createFx(scene) {
  const debris = createDebris(scene);
  const ringGeo = new THREE.RingGeometry(0.8, 1, 48);
  const rings = createPool(scene, 32, () => new THREE.Mesh(ringGeo, flat(1, 0.55, 0.15)));
  const beams = createPool(scene, 24, () => new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), flat(1, 0.3, 0.45)));
  // Lightning: each bolt is a zig-zag chain of thin flat segments (no glow).
  const BOLT_SEGMENTS = 7;
  const segGeo = new THREE.BoxGeometry(1, 1, 1);
  const bolts = createPool(scene, 28, () => {
    const g = new THREE.Group();
    for (let k = 0; k < BOLT_SEGMENTS; k++) g.add(new THREE.Mesh(segGeo, flat(0.75, 0.9, 1)));
    return g;
  });
  // Scorch: a dark matte disc left on the table by a bomb, fading out (darkening, never glowing).
  const scorchGeo = new THREE.CircleGeometry(1, 32);
  const scorches = createPool(scene, 16, () => new THREE.Mesh(scorchGeo, new THREE.MeshBasicMaterial({
    color: 0x0a0806, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
  })));
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();

  /** Zig-zag bolt from the top rail down to (x, y) in sim coords. */
  function bolt(x, y) {
    const pts = [];
    for (let k = 0; k <= BOLT_SEGMENTS; k++) {
      const t = k / BOLT_SEGMENTS;
      const jitter = k === 0 || k === BOLT_SEGMENTS ? 0 : (Math.random() - 0.5) * 6;
      pts.push(new THREE.Vector3(toWorldX(x + jitter), toWorldY(ROWS + (y - ROWS) * t), 1.2 + (1 - t) * 6));
    }
    bolts.fire(0.28, (g, u) => {
      g.children.forEach((seg, k) => {
        a.copy(pts[k]);
        b.copy(pts[k + 1]);
        seg.position.copy(a).add(b).multiplyScalar(0.5);
        seg.lookAt(b);
        const w = 0.45 * (1 - u);
        seg.scale.set(w, w, a.distanceTo(b));
        seg.material.opacity = 1 - u * u;
        seg.material.color.setRGB(0.75 + 0.25 * (1 - u), 0.9, 1);
      });
    });
  }

  function ring(x, y, radius, rgb, dur = 0.5) {
    rings.fire(dur, (m, u) => {
      m.position.set(toWorldX(x), toWorldY(y), 0.9);
      m.scale.setScalar(0.3 + radius * Math.sqrt(u));
      m.material.color.setRGB(...rgb);
      m.material.opacity = 1 - u;
    });
  }

  function beam(x, y, w, h, rgb, dur = 0.35) {
    beams.fire(dur, (m, u) => {
      m.position.set(toWorldX(x), toWorldY(y), 0.9);
      const pinch = 1 - u * u;
      m.scale.set(w === COLS ? COLS : w * pinch, h === ROWS ? ROWS : h * pinch, 0.6 * pinch);
      m.material.color.setRGB(...rgb);
      m.material.opacity = 1 - u;
    });
  }

  function scorch(x, y, radius) {
    const turn = Math.random() * Math.PI;
    scorches.fire(1.8, (m, u) => {
      m.position.set(toWorldX(x), toWorldY(y), 0.03);
      m.rotation.z = turn;
      m.scale.set(radius * (0.8 + 0.2 * Math.min(1, u * 8)), radius * 0.85, 1);
      m.material.opacity = 0.5 * (1 - u) ** 1.5;
    });
  }

  return {
    shards: debris.spawn,
    /** @param {boolean} [full] scorch, dust and the inner ring too (the director budgets these per frame) */
    boom: (c, r, full = true) => {
      ring(c + 0.5, r + 0.5, BOMB_RADIUS * 1.3, [1, 0.45, 0.1], 0.55);
      if (!full) return;
      ring(c + 0.5, r + 0.5, BOMB_RADIUS * 0.7, [1, 0.85, 0.5], 0.3);
      scorch(c + 0.5, r + 0.5, BOMB_RADIUS * 0.9);
      // Dust: dull grey grit that hops low and settles.
      for (let k = 0; k < 14; k++) debris.spawn(c + 0.5, r + 0.5, k % 2 ? 0x6b6258 : 0x8d8478, 0.6);
    },
    /** An armoured brick chipped: two pale flecks. */
    chip: (c, r) => { for (let k = 0; k < 2; k++) debris.spawn(c + 0.5, r + 0.5, 0xd9dde8, 0.55); },
    split: (c, r, n) => ring(c + 0.5, r + 0.5, 2 + n * 0.5, n >= 5 ? [0.85, 0.2, 0.8] : [0.15, 0.75, 0.9], 0.35),
    gold: (c, r) => ring(c + 0.5, r + 0.5, 5, [1, 0.75, 0.15], 0.6),
    catchBurst: (x, mult) => {
      const size = 5 + Math.log10(mult) * 7;
      ring(x, PADDLE_Y, size, [0.2, 0.85, 1], 0.6);
      ring(x, PADDLE_Y, size * 1.6, [1, 0.75, 0.2], 0.9);
      for (let k = 0; k < Math.min(120, mult * 2); k++) debris.spawn(x, PADDLE_Y, 0xfff1a8, 1.5);
    },
    /** Coin caught: a gold ring snaps out from the paddle and a spray of gold chips flies up. */
    coinBurst: (x) => {
      ring(x, PADDLE_Y, 6, [1, 0.78, 0.15], 0.5);
      ring(x, PADDLE_Y, 11, [1, 0.9, 0.5], 0.85);
      for (let k = 0; k < 40; k++) debris.spawn(x, PADDLE_Y + 0.5, k % 3 ? 0xf4c21f : 0xfff1a8, 1.2 + Math.random());
    },
    laser: (axis, c, r) => (axis === 'h'
      ? beam(COLS / 2, r + 0.5, COLS, 1, [1, 0.2, 0.3])
      : beam(c + 0.5, ROWS / 2, 1, ROWS, [1, 0.2, 0.3])),
    zap: (c, r, hex) => {
      bolt(c + 0.5, r + 0.5);
      ring(c + 0.5, r + 0.5, 2.4, [0.55, 0.8, 1], 0.35);
      for (let k = 0; k < 8; k++) debris.spawn(c + 0.5, r + 0.5, hex, 1.7);
    },
    /** A burst of coloured shards and two rings, for the finale fireworks. */
    firework: (x, y, hex, rgb) => {
      ring(x, y, 7, rgb, 0.7);
      ring(x, y, 11, [1, 1, 1], 0.9);
      for (let k = 0; k < 70; k++) debris.spawn(x, y, hex, 2.2);
    },
    update(dt) {
      debris.update(dt);
      rings.update(dt);
      beams.update(dt);
      bolts.update(dt);
      scorches.update(dt);
    },
  };
}
