import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { COLS, ROWS } from '../sim/constants.js';

// The room around the board: the board is a thick slab standing over a dark
// floor, lit by a soft overhead spot that falls off into the room. Everything
// stays matte; depth comes from the slab's sides, its soft shadow on the floor
// and fog swallowing the far floor. No glow, bloom or additive light.

export const ROOM_COLOR = 0x06080f; // fog and background (the dark of the room)
export const SLAB_DEPTH = 4; // board thickness below the playing surface
export const FLOOR_Z = -30; // the floor, well below the board
export const RAIL_W = 1.4;
const APRON = 2.5; // extra board in front of the open bottom edge
const LIP = 1.2; // board beyond the rails at the sides and back
const GLOOM_R = 170; // floor radius the overhead spot still reaches

/** Board outline (world units) including rails, apron and lip. */
export const BOARD = Object.freeze({
  left: -COLS / 2 - RAIL_W - LIP,
  right: COLS / 2 + RAIL_W + LIP,
  near: -ROWS / 2 - APRON,
  far: ROWS / 2 + RAIL_W + LIP,
});

/** Dark polished-concrete tiles with faint mottling. */
function floorTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#585b65';
  g.fillRect(0, 0, 512, 512);
  for (let k = 0; k < 2600; k++) {
    const l = 80 + Math.random() * 50;
    g.fillStyle = `rgba(${l},${l + 2},${l + 8},0.35)`;
    const r = 1 + Math.random() * 6;
    g.fillRect(Math.random() * 512, Math.random() * 512, r, r);
  }
  g.strokeStyle = 'rgba(10,10,14,0.7)';
  g.lineWidth = 3;
  for (let i = 0; i <= 512; i += 128) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(512, i); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** A soft rounded-rectangle shadow (blurred on a canvas), laid on the floor under the board. */
function softShadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.filter = 'blur(26px)';
  g.fillStyle = 'rgba(0,0,0,0.92)';
  g.fillRect(56, 56, 144, 144);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Radial gloom: clear in the middle, near-black at the rim (the room beyond the spot's reach). */
function gloomTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(6,8,15,0)');
  grad.addColorStop(0.45, 'rgba(6,8,15,0.15)');
  grad.addColorStop(0.75, 'rgba(6,8,15,0.7)');
  grad.addColorStop(1, 'rgba(6,8,15,1)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * @param {THREE.Scene} scene
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Vector3} lightDir direction the key light travels (for the floor shadow offset)
 */
export function buildRoom(scene, renderer, lightDir) {
  scene.background = new THREE.Color(ROOM_COLOR);
  scene.fog = new THREE.Fog(ROOM_COLOR, 100, 300);

  // Soft image-based light for the steel and painted parts (Standard materials only).
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  pmrem.dispose();

  const w = BOARD.right - BOARD.left;
  const h = BOARD.far - BOARD.near;
  const cx = (BOARD.left + BOARD.right) / 2;
  const cy = (BOARD.near + BOARD.far) / 2;

  // The board: a thick slab with softened edges; its top sits just under the table surface.
  const slab = new THREE.Mesh(
    new RoundedBoxGeometry(w, h, SLAB_DEPTH, 3, 0.9),
    new THREE.MeshStandardMaterial({ color: 0x1d2445, roughness: 0.55, metalness: 0.25 }),
  );
  slab.position.set(cx, cy, -SLAB_DEPTH / 2 - 0.06);
  slab.receiveShadow = true;
  scene.add(slab);
  // A thin brushed-steel band around the slab's waist catches the light along its edge.
  const band = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.2, h + 0.2, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x8b93a8, roughness: 0.35, metalness: 0.8 }),
  );
  band.position.set(cx, cy, -SLAB_DEPTH * 0.72);
  scene.add(band);

  // The floor far below, tiled; fog fades it into the dark of the room.
  const floorTex = floorTexture();
  const FLOOR = 1400;
  floorTex.repeat.set(FLOOR / 40, FLOOR / 40);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(FLOOR, FLOOR),
    new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.82, metalness: 0.05 }),
  );
  floor.position.z = FLOOR_Z;
  scene.add(floor);

  // The board's shadow on the floor, pushed along the light direction by the drop height.
  const drop = SLAB_DEPTH + (0 - FLOOR_Z);
  const k = drop / Math.max(0.2, -lightDir.z);
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 1.25 * (256 / 144), h * 1.25 * (256 / 144)),
    new THREE.MeshBasicMaterial({
      map: softShadowTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    }),
  );
  shadow.position.set(cx + lightDir.x * k * 0.5, cy + lightDir.y * k * 0.5, FLOOR_Z + 0.05);
  shadow.renderOrder = 1;
  // Past the spot's pool the floor sinks into the dark of the room.
  const gloom = new THREE.Mesh(
    new THREE.PlaneGeometry(2 * GLOOM_R, 2 * GLOOM_R),
    new THREE.MeshBasicMaterial({
      map: gloomTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }),
  );
  gloom.position.set(cx, cy, FLOOR_Z + 0.03);
  // Everything outside the gloom disc is fully dark too.
  const rim = new THREE.Mesh(
    new THREE.RingGeometry(GLOOM_R - 1, 1400, 64),
    new THREE.MeshBasicMaterial({ color: ROOM_COLOR, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  );
  rim.position.copy(gloom.position);
  gloom.renderOrder = 2;
  scene.add(shadow, gloom, rim);

  // Overhead spot: a pool of light on the board that falls off across the floor.
  const spot = new THREE.SpotLight(0xfff4e6, 2.2, 0, Math.PI / 5.2, 0.75, 0);
  spot.position.set(0, -25, 210);
  spot.target.position.set(0, 4, 0);
  scene.add(spot, spot.target);

  /** Fog follows the camera distance so the board stays crisp and the room fades. */
  function setDistance(dist) {
    scene.fog.near = dist + 60; // past the far rail (measured ~dist + 37..50), so the board itself is never fogged
    scene.fog.far = dist * 2.1;
  }

  return { setDistance };
}
