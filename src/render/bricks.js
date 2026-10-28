import * as THREE from 'three';
import { COLS, ROWS, CELL } from '../sim/constants.js';
import { toWorldX, toWorldY, TILT } from './stage.js';
import { fruitFor, EMOJI_FONT } from '../fruits.js';
import { coinMaterials, coinGeometry } from './coinLook.js';
import { vivid } from './vivid.js';
import { ART, fruitArt } from '../art.js';
import { paintedTexture } from './art.js';

/** Icon spec for a fruit item: the fruit itself, no tile and no number. */
function fruitSpec(mult) {
  const f = fruitFor(mult);
  const c = new THREE.Color(f.color);
  return { tint: [c.r * 2, c.g * 2, c.b * 2], label: '', fruit: f, bg: f.color };
}

// Icon label/background per special cell; tint (scaled down) colours its debris.
export const SPECIALS = {
  [CELL.SPLIT2]: { tint: [0.4, 1.6, 2.6], label: '×2', bg: '#1e7bff' },
  [CELL.SPLIT3]: { tint: [0.3, 2.4, 1.6], label: '×3', bg: '#10c27a' },
  [CELL.SPLIT5]: { tint: [2.6, 0.6, 2.4], label: '×5', bg: '#c23ad6' },
  [CELL.BOMB]: { tint: [2.6, 0.9, 0.3], label: 'bomb', bg: '#e0561c', art: ART.bomb },
  [CELL.LASER_H]: { tint: [2.4, 0.4, 0.6], label: '⟷', bg: '#e02a5a' },
  [CELL.LASER_V]: { tint: [2.4, 0.4, 0.6], label: '↕', bg: '#e02a5a' },
  [CELL.GOLD]: { tint: [2.8, 2.0, 0.4], label: '★', bg: '#e8a80c', art: ART.star },
  [CELL.FIRE]: { tint: [2.8, 1.0, 0.2], label: '🔥', bg: '#ff6a00', art: ART.fire },
  [CELL.COIN]: { tint: [2.8, 2.1, 0.3], label: '', bg: '#c99a06', coin: true },
  // Multiplier items are drawn as fruit (see src/fruits.js), never as numbers.
  [CELL.ITEM5]: fruitSpec(5),
  [CELL.ITEM10]: fruitSpec(10),
  [CELL.ITEM20]: fruitSpec(20),
  [CELL.ITEM30]: fruitSpec(30),
  [CELL.ITEM50]: fruitSpec(50),
  [CELL.ITEM100]: fruitSpec(100),
};

const STEEL = new THREE.Color(0x7a869e);
const ICON_SCALE = 1.8; // special blocks are drawn bigger than one fine cell so icons stay legible
const FRUIT_SCALE = 3.2; // fruit items are the thing to hunt for, so they stand out most
const HARD_SHINE = new THREE.Color(0xffffff);
const POP_TIME = 0.14; // a broken brick swells and blanches, then vanishes
const POP_MAX = 400; // past this many at once, bricks just vanish (big chain reactions)
const FLASH_TIME = 0.12; // an armoured brick blinks pale when a ball chips it

/** Bevel shading baked into a texture: lit top-left edge, shaded bottom-right edge, over the brick's surface. */
function bevelTexture() {
  return paintedTexture(64, (g, n, img) => {
    const e = n * 0.09;
    if (img) g.drawImage(img, 0, 0, n, n);
    else { g.fillStyle = '#ebebeb'; g.fillRect(0, 0, n, n); }
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.fillRect(0, 0, n, e);
    g.fillRect(0, 0, e, n);
    g.fillStyle = 'rgba(70,70,70,0.45)';
    g.fillRect(0, n - e, n, e);
    g.fillRect(n - e, 0, e, n);
  }, ART.brick);
}

function iconTexture({ label, bg, art }) {
  return paintedTexture(64, (g, n, img) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, n, n);
    g.strokeStyle = 'rgba(255,255,255,0.85)';
    g.lineWidth = 5;
    g.strokeRect(3, 3, n - 6, n - 6);
    g.fillStyle = '#fff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if (img) {
      g.drawImage(img, 7, 7, n - 14, n - 14);
    } else if (label === 'bomb') {
      g.beginPath(); g.arc(30, 36, 17, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffd34d';
      g.beginPath(); g.arc(46, 14, 7, 0, Math.PI * 2); g.fill();
    } else {
      g.font = `900 ${label[0] === '×' ? 34 : 40}px system-ui, sans-serif`;
      g.fillText(label, 32, 35);
    }
  }, art ?? null);
}

/** Fruit cut-out on a transparent background, optionally with a soft contact shadow at its feet. */
export function fruitTexture(fruit, size = 128, contactShadow = true) {
  return paintedTexture(size, (g, n, img) => {
    if (contactShadow) {
      const shadow = g.createRadialGradient(n / 2, n * 0.88, 2, n / 2, n * 0.88, n * 0.34);
      shadow.addColorStop(0, 'rgba(0,0,0,0.45)');
      shadow.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = shadow;
      g.beginPath();
      g.ellipse(n / 2, n * 0.88, n * 0.34, n * 0.09, 0, 0, Math.PI * 2);
      g.fill();
    }
    if (img) {
      const s = n * 0.8;
      g.drawImage(img, (n - s) / 2, n * 0.46 - s / 2, s, s);
      return;
    }
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `${Math.round(n * 0.72)}px ${EMOJI_FONT}`;
    g.fillText(fruit.emoji, n / 2, n * 0.46);
  }, fruitArt(fruit.id), (tex) => { tex.anisotropy = 4; });
}

const tmp = new THREE.Object3D();
const hidden = new THREE.Matrix4().makeScale(0, 0, 0);

export function createBricks(scene) {
  const total = COLS * ROWS;
  const geo = new THREE.BoxGeometry(0.92, 0.92, 1);
  const mat = new THREE.MeshLambertMaterial({ map: bevelTexture() });
  const mesh = new THREE.InstancedMesh(geo, mat, total);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  const iconGeo = new THREE.BoxGeometry(0.92, 0.92, 1.1);
  // Fruit stands upright on its cell, turned to face the tilted camera.
  const fruitGeo = new THREE.PlaneGeometry(1, 1).rotateX(TILT).translate(0, 0, 0.45);
  // Gold coin bricks are real 3D coins (raised over the wall so their faces show).
  const coinGeo = coinGeometry(0.5, 0.26);
  const COIN_LIFT = 0.35;
  const specialMeshes = Object.fromEntries(Object.entries(SPECIALS).map(([type, spec]) => {
    const material = spec.fruit
      ? new THREE.MeshBasicMaterial({ map: fruitTexture(spec.fruit), transparent: true, depthWrite: false })
      : spec.coin ? coinMaterials() : new THREE.MeshLambertMaterial({ map: iconTexture(spec) });
    const m = new THREE.InstancedMesh(spec.fruit ? fruitGeo : spec.coin ? coinGeo : iconGeo, material, total);
    m.count = 0;
    m.castShadow = !spec.fruit;
    m.renderOrder = spec.fruit ? 2 : 0;
    scene.add(m);
    return [type, m];
  }));

  let palette = [];
  let grid = null;
  let pops = []; // { i, t } broken plain bricks still animating
  let flashes = new Map(); // cell -> seconds of hit flash left
  let lastTime = null;
  const popColor = new THREE.Color();
  let slotOf = new Int32Array(total).fill(-1); // cell -> special instance slot
  let specialCells = {}; // type -> cell indices (slot order)
  const baseColor = new THREE.Color();
  const shinyColor = new THREE.Color();

  function brickColor(grid, i) {
    if (grid.cells[i] === CELL.STEEL) return STEEL;
    baseColor.set(palette[grid.color[i] % palette.length]);
    // Tougher bricks gleam a little and dull with every hit.
    return grid.hp[i] > 1 ? shinyColor.copy(baseColor).lerp(HARD_SHINE, Math.min(0.15, 0.05 * (grid.hp[i] - 1))) : baseColor;
  }

  function place(m, slot, i, scale = 1, lift = 0, turn = 0) {
    tmp.position.set(toWorldX((i % COLS) + 0.5), toWorldY(Math.floor(i / COLS) + 0.5), 0.5 + lift);
    tmp.rotation.set(0, turn, 0);
    tmp.scale.setScalar(scale);
    tmp.updateMatrix();
    m.setMatrixAt(slot, tmp.matrix);
  }

  const isFruit = (type) => Boolean(SPECIALS[type]?.fruit);
  const scaleOf = (type) => (isFruit(type) ? FRUIT_SCALE : ICON_SCALE);

  /** Rebuilds every instance for a new level. */
  function setLevel(g, pal) {
    grid = g;
    palette = pal.map(vivid); // brighter, fresher than the map's own palette (vivid.js)
    pops = [];
    flashes = new Map();
    slotOf = new Int32Array(total).fill(-1);
    specialCells = Object.fromEntries(Object.keys(SPECIALS).map((t) => [t, []]));
    for (let i = 0; i < total; i++) {
      const type = grid.cells[i];
      if (type === CELL.BRICK || type === CELL.STEEL) {
        place(mesh, i, i);
        mesh.setColorAt(i, brickColor(grid, i));
      } else {
        mesh.setMatrixAt(i, hidden);
        mesh.setColorAt(i, STEEL);
        if (SPECIALS[type]) {
          slotOf[i] = specialCells[type].length;
          specialCells[type].push(i);
        }
      }
    }
    for (const [type, m] of Object.entries(specialMeshes)) {
      const cells = specialCells[type];
      m.count = cells.length;
      cells.forEach((i, slot) => place(m, slot, i, scaleOf(type), SPECIALS[type].coin ? COIN_LIFT : 0));
      m.instanceMatrix.needsUpdate = true;
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
  }

  /** Hides a destroyed cell. `type` is the cell type it had. */
  function remove(i, type) {
    if (type === CELL.BRICK) {
      flashes.delete(i);
      if (pops.length < POP_MAX) { pops.push({ i, t: 0 }); return; }
      mesh.setMatrixAt(i, hidden);
      mesh.instanceMatrix.needsUpdate = true;
      return;
    }
    const m = specialMeshes[type];
    const slot = slotOf[i];
    if (m && slot >= 0 && slot < m.count) {
      m.setMatrixAt(slot, hidden);
      m.instanceMatrix.needsUpdate = true;
      slotOf[i] = -1;
    }
  }

  /** A hard brick lost armour: drop its shine. */
  function dent(g, i) {
    grid = g;
    flashes.set(i, FLASH_TIME);
    mesh.setColorAt(i, popColor.copy(brickColor(g, i)).lerp(HARD_SHINE, 0.6));
    mesh.instanceColor.needsUpdate = true;
  }

  /** Swell-and-vanish for broken bricks, and the fading pale blink on chipped ones. */
  function animateHits(dt) {
    if (pops.length) {
      const live = [];
      for (const p of pops) {
        p.t += dt;
        const u = p.t / POP_TIME;
        if (u >= 1) { mesh.setMatrixAt(p.i, hidden); continue; }
        // Up to 1.22x by a third of the way, then shrink to nothing.
        const s = u < 0.33 ? 1 + 0.22 * (u / 0.33) : 1.22 * (1 - (u - 0.33) / 0.67);
        place(mesh, p.i, p.i, s, 0.25 * Math.sin(u * Math.PI));
        mesh.setColorAt(p.i, popColor.set(palette[grid.color[p.i] % palette.length]).lerp(HARD_SHINE, 0.55 * (1 - u)));
        live.push(p);
      }
      pops = live;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
    }
    if (flashes.size) {
      for (const [i, left] of flashes) {
        const next = left - dt;
        const cell = grid.cells[i];
        const solid = cell === CELL.BRICK || cell === CELL.STEEL;
        if (next <= 0 || !solid) {
          flashes.delete(i);
          if (solid) mesh.setColorAt(i, brickColor(grid, i));
          continue;
        }
        flashes.set(i, next);
        mesh.setColorAt(i, popColor.copy(brickColor(grid, i)).lerp(HARD_SHINE, 0.6 * (next / FLASH_TIME)));
      }
      mesh.instanceColor.needsUpdate = true;
    }
  }

  /** Specials breathe, fruit bob gently and coins turn, so they read as "something will happen". */
  function update(time) {
    const dt = lastTime === null ? 0 : Math.min(0.1, Math.max(0, time - lastTime));
    lastTime = time;
    if (grid) animateHits(dt);
    for (const [type, m] of Object.entries(specialMeshes)) {
      if (!m.count) continue;
      const cells = specialCells[type];
      const fruit = isFruit(type);
      const coin = Boolean(SPECIALS[type].coin);
      for (let slot = 0; slot < m.count; slot++) {
        if (slotOf[cells[slot]] !== slot) continue;
        const phase = time * (fruit ? 3 : 6) + slot * 0.7;
        if (coin) {
          // Rock back and forth about the field's vertical axis so the face catches the light.
          place(m, slot, cells[slot], scaleOf(type), COIN_LIFT, Math.sin(time * 2 + slot * 0.9) * 1.1);
          continue;
        }
        const s = scaleOf(type) * (1 + Math.sin(phase) * (fruit ? 0.04 : 0.07));
        place(m, slot, cells[slot], s, fruit ? Math.abs(Math.sin(phase)) * 0.25 : 0);
      }
      m.instanceMatrix.needsUpdate = true;
    }
  }

  return { setLevel, remove, dent, update, colorOf: (i) => palette[i % palette.length] };
}
