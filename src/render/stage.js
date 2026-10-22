import * as THREE from 'three';
import { COLS, ROWS, PADDLE_Y, PADDLE_H } from '../sim/constants.js';

const FOV = 42;
const TILT = 0.5; // radians the table leans away from the viewer

// No glow, bloom or reflections: everything is matte and lit by a soft sky
// light plus one angled sun, so depth reads from face shading alone.

/** Sim cell coords -> world coords (field centred on the origin, z up out of the table). */
export const toWorldX = (x) => x - COLS / 2;
export const toWorldY = (y) => y - ROWS / 2;

function makeFloorTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#0b0f1f';
  g.fillRect(0, 0, 512, 512);
  g.strokeStyle = 'rgba(90,120,255,0.18)';
  g.lineWidth = 2;
  for (let i = 0; i <= 512; i += 64) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(512, i); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(COLS / 8, ROWS / 8);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildArena(scene) {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(COLS + 2, ROWS + 2),
    new THREE.MeshLambertMaterial({ map: makeFloorTexture() }),
  );
  floor.position.z = -0.02;
  scene.add(floor);

  const rail = new THREE.MeshLambertMaterial({ color: 0x5a6fd8 });
  const side = new THREE.BoxGeometry(0.35, ROWS + 0.7, 1.2);
  const top = new THREE.BoxGeometry(COLS + 0.7, 0.35, 1.2);
  [[-COLS / 2 - 0.18, 0, side], [COLS / 2 + 0.18, 0, side], [0, ROWS / 2 + 0.18, top]].forEach(([x, y, geo]) => {
    const m = new THREE.Mesh(geo, rail);
    m.position.set(x, y, 0.6);
    scene.add(m);
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
  scene.add(paddle);
  return { paddle };
}

/** @param {HTMLCanvasElement} canvas */
export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070f);
  scene.fog = new THREE.Fog(0x05070f, 180, 400);

  scene.add(new THREE.HemisphereLight(0xeef2ff, 0x50506a, 3.4));
  const key = new THREE.DirectionalLight(0xffffff, 3.0);
  key.position.set(-40, -60, 120);
  scene.add(key);

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
  };
}
