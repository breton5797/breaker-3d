import * as THREE from 'three';
import { COLS, ROWS, PADDLE_Y, PADDLE_H } from '../sim/constants.js';

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

  const paddle = new THREE.Mesh(
    new THREE.CapsuleGeometry(PADDLE_H / 2, 1, 6, 16), // length 1 + PADDLE_H, stretched to the paddle width
    new THREE.MeshLambertMaterial({ color: 0xc4d2ff }),
  );
  paddle.rotation.z = Math.PI / 2;
  paddle.position.set(0, toWorldY(PADDLE_Y), 0.5);
  paddle.castShadow = true;
  scene.add(paddle);
  return { paddle };
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
  let shakeAmp = 0;
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
    shakeAmp = Math.max(0, shakeAmp - dt * 3.5);
    const sway = toWorldX(paddleX) * 0.08;
    const d = dist * zoom;
    const sx = (Math.random() - 0.5) * shakeAmp;
    const sy = (Math.random() - 0.5) * shakeAmp;
    camera.position.set(sway + sx, -Math.sin(TILT) * d + sy, Math.cos(TILT) * d);
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
    shake: (amount) => { shakeAmp = Math.min(2.5, shakeAmp + amount); },
    setZoom: (z) => { zoom = z; },
    /** Screen position (CSS px) of a sim point at height z above the table. */
    project: (x, y, z = 1) => {
      const v = new THREE.Vector3(toWorldX(x), toWorldY(y), z).project(camera);
      return { x: ((v.x + 1) / 2) * window.innerWidth, y: ((1 - v.y) / 2) * window.innerHeight };
    },
  };
}
