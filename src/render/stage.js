import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { COLS, ROWS, PADDLE_Y, PADDLE_H } from '../sim/constants.js';
import { createCamFx } from './camfx.js';

const FOV = 42;
export const TILT = 0.5; // radians the table leans away from the viewer

// No glow, bloom or reflections: everything is matte and lit by a soft sky
// light plus one angled sun. Depth reads from face shading and soft shadows.

/** Sim cell coords -> world coords (field centred on the origin, z up out of the table). */
export const toWorldX = (x) => x - COLS / 2;
export const toWorldY = (y) => y - ROWS / 2;

function makeFloorTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#141a33';
  g.fillRect(0, 0, 512, 512);
  g.strokeStyle = 'rgba(140,160,255,0.07)';
  g.lineWidth = 1;
  for (let i = 0; i <= 512; i += 16) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(512, i); g.stroke();
  }
  g.strokeStyle = 'rgba(140,160,255,0.16)';
  g.lineWidth = 2;
  for (let i = 0; i <= 512; i += 128) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(512, i); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(COLS / 32, ROWS / 32);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildArena(scene) {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(COLS + 2, ROWS + 2),
    new THREE.MeshLambertMaterial({ map: makeFloorTexture() }),
  );
  floor.position.z = -0.02;
  floor.receiveShadow = true;
  scene.add(floor);

  // Chunky two-tone frame: a dark base with a lighter cap reads as a solid rim.
  const railBase = new THREE.MeshLambertMaterial({ color: 0x2a3366 });
  const railCap = new THREE.MeshLambertMaterial({ color: 0x8a9cff });
  const W = 1.4;
  [[-COLS / 2 - W / 2, 0, W, ROWS + W * 2], [COLS / 2 + W / 2, 0, W, ROWS + W * 2], [0, ROWS / 2 + W / 2, COLS, W]]
    .forEach(([x, y, w, h]) => {
      const base = new THREE.Mesh(new THREE.BoxGeometry(w, h, 2), railBase);
      base.position.set(x, y, 1);
      base.castShadow = true;
      base.receiveShadow = true;
      const cap = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, h, 0.3), railCap);
      cap.position.set(x, y, 2.1);
      scene.add(base, cap);
    });

  // Danger line under the paddle.
  const danger = new THREE.Mesh(
    new THREE.PlaneGeometry(COLS, 0.12),
    new THREE.MeshBasicMaterial({ color: 0xc23a55, transparent: true, opacity: 0.6 }),
  );
  danger.position.set(0, toWorldY(0.4), 0.02);
  scene.add(danger);

  return { paddle: buildPaddle(scene) };
}

const CAP_LEN = 1.6; // length of each red end cap (cells)
const BODY_H = 1.8; // height of the bar above the table (the camera sees its front face)
const CAP_R = 0.95;

/**
 * A chunky three-piece paddle: a rounded metal body with a raised stripe and
 * a darker belly, and red end caps with dark joint rings. The body and caps
 * get a faint satin sheen (a soft surface highlight, no glow) so their curves
 * read from the near-overhead camera; the body stretches with the paddle
 * width, the caps don't.
 */
function buildPaddle(scene) {
  const group = new THREE.Group();
  group.position.set(0, toWorldY(PADDLE_Y), 0);
  const satin = { specular: 0x3a3f4a, shininess: 28 };
  const bodyMat = new THREE.MeshPhongMaterial({ color: 0xc4d2ff, ...satin });
  const body = new THREE.Mesh(new RoundedBoxGeometry(1, PADDLE_H * 1.2, BODY_H, 4, 0.56), bodyMat);
  body.position.z = BODY_H / 2;
  const belly = new THREE.Mesh(new RoundedBoxGeometry(1, PADDLE_H * 1.26, BODY_H * 0.3, 2, 0.12), new THREE.MeshLambertMaterial({ color: 0x55607e }));
  belly.position.z = BODY_H * 0.2;
  const stripe = new THREE.Mesh(new RoundedBoxGeometry(1, PADDLE_H * 0.4, 0.22, 2, 0.08), new THREE.MeshLambertMaterial({ color: 0x39c6e6 }));
  stripe.position.z = BODY_H + 0.04;
  const capGeo = new THREE.CylinderGeometry(CAP_R, CAP_R, CAP_LEN, 24);
  const capMat = new THREE.MeshPhongMaterial({ color: 0xd8463c, ...satin });
  const ringGeo = new THREE.CylinderGeometry(CAP_R + 0.05, CAP_R + 0.05, 0.18, 24);
  const ringMat = new THREE.MeshLambertMaterial({ color: 0x2c3148 });
  const caps = [-1, 1].map((side) => {
    const cap = new THREE.Group();
    const shell = new THREE.Mesh(capGeo, capMat);
    shell.rotation.z = Math.PI / 2; // cylinder axis along the paddle
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.z = Math.PI / 2;
    ring.position.x = -side * (CAP_LEN / 2);
    cap.add(shell, ring);
    cap.position.z = CAP_R;
    cap.userData.side = side;
    return cap;
  });
  group.add(body, belly, stripe, ...caps);
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  scene.add(group);

  /** @param {number} x world x @param {number} width cells @param {number} color body colour (hex) */
  function set(x, width, color) {
    group.position.x = x;
    const len = Math.max(0.6, width - CAP_LEN * 2 + 0.6);
    body.scale.x = len;
    belly.scale.x = len;
    stripe.scale.x = Math.max(0.3, len * 0.7);
    for (const cap of caps) cap.position.x = cap.userData.side * (width / 2 - CAP_LEN / 2);
    bodyMat.color.setHex(color);
  }
  set(0, 12, 0xc4d2ff); // title-screen default until a stage sets the real width

  // Squash spring: a hit presses the bar down and flat, then it bounces back.
  let squash = 0;
  let squashVel = 0;
  let wobble = 0;
  let clock = 0;
  /** @param {number} amount 0..1 how hard the paddle was hit */
  function punch(amount) { squashVel = Math.min(12, squashVel + Math.min(1, amount) * 9); }
  /** Rocks the bar side to side for a moment (stunned). */
  function shakeOff(amount) { wobble = Math.min(1, wobble + amount); }
  function update(dt) {
    clock += dt;
    squashVel += (-220 * squash - 16 * squashVel) * dt;
    squash += squashVel * dt;
    wobble = Math.max(0, wobble - dt * 1.6);
    const k = Math.max(-0.35, Math.min(0.45, squash));
    group.scale.set(1 + k * 0.08, 1 + k * 0.25, 1 - k * 0.4);
    group.position.z = -k * 0.3;
    group.rotation.y = Math.sin(clock * 38) * wobble * 0.12;
  }
  return { set, punch, shakeOff, update };
}

/** Vertical backdrop gradient behind the table (deep navy to near-black). */
function backdropTexture() {
  const c = document.createElement('canvas');
  c.width = 2;
  c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#1b2350');
  grad.addColorStop(0.55, '#0b1028');
  grad.addColorStop(1, '#04060e');
  g.fillStyle = grad;
  g.fillRect(0, 0, 2, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** @param {HTMLCanvasElement} canvas */
export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = backdropTexture();

  scene.add(new THREE.HemisphereLight(0xeef2ff, 0x50506a, 3.4));
  const key = new THREE.DirectionalLight(0xffffff, 3.0);
  key.position.set(-40, -60, 120);
  // Soft shadows across the whole table; the shadow camera frames the field.
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 3;
  Object.assign(key.shadow.camera, {
    left: -COLS / 2 - 8, right: COLS / 2 + 8, top: ROWS / 2 + 8, bottom: -ROWS / 2 - 8, near: 1, far: 400,
  });
  scene.add(key, key.target);

  const arena = buildArena(scene);
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 800);

  let dist = 80;
  const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const camFx = createCamFx({ reduced });
  let zoom = 1;
  const look = new THREE.Vector3();

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const t = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    // Fit the tilted field: height is foreshortened by cos(TILT), width must fit the aspect.
    const byH = ((ROWS / 2) * Math.cos(TILT) * 1.12) / t + (ROWS / 2) * Math.sin(TILT);
    const byW = ((COLS / 2) * 1.08) / (t * camera.aspect) + (ROWS / 2) * Math.sin(TILT);
    dist = Math.max(byH, byW);
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  /**
   * @param {number} dt real seconds
   * @param {number} paddleX sim paddle x (for the camera sway)
   */
  function render(dt, paddleX) {
    camFx.step(dt);
    arena.paddle.update(dt);
    const sway = toWorldX(paddleX) * 0.08;
    const d = dist * zoom;
    const o = camFx.offset;
    camera.position.set(sway + o.x, -Math.sin(TILT) * d + o.y, Math.cos(TILT) * d + o.z);
    look.set(sway * 0.5, -1.5, 0);
    camera.lookAt(look);
    renderer.render(scene, camera);
  }

  return {
    scene,
    camera,
    renderer,
    paddle: arena.paddle,
    render,
    resize,
    shake: (amount) => camFx.shake(amount),
    /** Directional punch of the camera (world units/s); it springs back on its own. */
    kick: (x, y, z) => camFx.kick(x, y, z),
    setZoom: (z) => { zoom = z; },
    /** @param {{ shadows:boolean, pixelRatio:number }} q a QUALITY_LEVELS entry */
    setQuality: (q) => {
      key.castShadow = q.shadows;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, q.pixelRatio));
      resize();
    },
    /** Screen position (CSS px) of a sim point at height z above the table. */
    project: (x, y, z = 1) => {
      const v = new THREE.Vector3(toWorldX(x), toWorldY(y), z).project(camera);
      return { x: ((v.x + 1) / 2) * window.innerWidth, y: ((1 - v.y) / 2) * window.innerHeight };
    },
  };
}
