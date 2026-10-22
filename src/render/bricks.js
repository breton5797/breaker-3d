import * as THREE from 'three';
import { COLS, ROWS, CELL } from '../sim/constants.js';
import { toWorldX, toWorldY } from './stage.js';

// Glow tint (HDR, > 1 blooms) and label for each special cell.
export const SPECIALS = {
  [CELL.SPLIT2]: { tint: [0.4, 1.6, 2.6], label: '×2', bg: '#1e7bff' },
  [CELL.SPLIT3]: { tint: [0.3, 2.4, 1.6], label: '×3', bg: '#10c27a' },
  [CELL.SPLIT5]: { tint: [2.6, 0.6, 2.4], label: '×5', bg: '#c23ad6' },
  [CELL.BOMB]: { tint: [2.6, 0.9, 0.3], label: 'bomb', bg: '#e0561c' },
  [CELL.LASER_H]: { tint: [2.4, 0.4, 0.6], label: '⟷', bg: '#e02a5a' },
  [CELL.LASER_V]: { tint: [2.4, 0.4, 0.6], label: '↕', bg: '#e02a5a' },
  [CELL.GOLD]: { tint: [2.8, 2.0, 0.4], label: '★', bg: '#e8a80c' },
  [CELL.FIRE]: { tint: [2.8, 1.0, 0.2], label: '🔥', bg: '#ff6a00' },
  [CELL.ITEM5]: { tint: [0.6, 2.4, 1.2], label: '×5', bg: '#12b85a' },
  [CELL.ITEM10]: { tint: [0.5, 1.6, 2.8], label: '×10', bg: '#1a7cff' },
  [CELL.ITEM20]: { tint: [1.8, 0.7, 2.8], label: '×20', bg: '#9b3dff' },
  [CELL.ITEM30]: { tint: [2.8, 0.6, 1.6], label: '×30', bg: '#ff2f8e' },
  [CELL.ITEM50]: { tint: [2.8, 1.2, 0.3], label: '×50', bg: '#ff7a00' },
  [CELL.ITEM100]: { tint: [3.0, 2.4, 0.5], label: '×100', bg: '#ffc400' },
};

const STEEL = new THREE.Color(0x6c7a96);
const ICON_SCALE = 1.8; // special blocks are drawn bigger than one fine cell so icons stay legible
const HARD_SHINE = new THREE.Color(0xffffff);

function iconTexture({ label, bg }) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 64, 64);
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  g.lineWidth = 5;
  g.strokeRect(3, 3, 58, 58);
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (label === 'bomb') {
    g.beginPath(); g.arc(30, 36, 17, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffd34d';
    g.beginPath(); g.arc(46, 14, 7, 0, Math.PI * 2); g.fill();
  } else {
    g.font = `900 ${label[0] === '×' ? (label.length > 3 ? 22 : label.length > 2 ? 28 : 34) : 40}px system-ui, sans-serif`;
    g.fillText(label, 32, 35);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const tmp = new THREE.Object3D();
const hidden = new THREE.Matrix4().makeScale(0, 0, 0);

export function createBricks(scene) {
  const total = COLS * ROWS;
  const geo = new THREE.BoxGeometry(0.9, 0.9, 1);
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.05, envMapIntensity: 0.35 });
  const mesh = new THREE.InstancedMesh(geo, mat, total);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(mesh);

  const iconGeo = new THREE.BoxGeometry(0.92, 0.92, 1.1);
  const specialMeshes = Object.fromEntries(Object.entries(SPECIALS).map(([type, spec]) => {
    const m = new THREE.InstancedMesh(iconGeo, new THREE.MeshBasicMaterial({
      map: iconTexture(spec), color: new THREE.Color(...spec.tint).multiplyScalar(0.3).addScalar(0.75), toneMapped: false,
    }), total);
    m.count = 0;
    scene.add(m);
    return [type, m];
  }));

  let palette = [];
  let slotOf = new Int32Array(total).fill(-1); // cell -> special instance slot
  let specialCells = {}; // type -> cell indices (slot order)
  const baseColor = new THREE.Color();

  function brickColor(grid, i) {
    if (grid.cells[i] === CELL.STEEL) return STEEL;
    baseColor.set(palette[grid.color[i] % palette.length]);
    // Tougher bricks gleam a little and dull with every hit.
    return grid.hp[i] > 1 ? baseColor.clone().lerp(HARD_SHINE, Math.min(0.15, 0.05 * (grid.hp[i] - 1))) : baseColor;
  }

  function place(m, slot, i, scale = 1) {
    tmp.position.set(toWorldX((i % COLS) + 0.5), toWorldY(Math.floor(i / COLS) + 0.5), 0.5);
    tmp.rotation.set(0, 0, 0);
    tmp.scale.setScalar(scale);
    tmp.updateMatrix();
    m.setMatrixAt(slot, tmp.matrix);
  }

  /** Rebuilds every instance for a new level. */
  function setLevel(grid, pal) {
    palette = pal;
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
      cells.forEach((i, slot) => place(m, slot, i, ICON_SCALE));
      m.instanceMatrix.needsUpdate = true;
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
  }

  /** Hides a destroyed cell. `type` is the cell type it had. */
  function remove(i, type) {
    if (type === CELL.BRICK) {
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
  function dent(grid, i) {
    mesh.setColorAt(i, brickColor(grid, i));
    mesh.instanceColor.needsUpdate = true;
  }

  /** Specials breathe so they read as "something will happen". */
  function update(time) {
    for (const [type, m] of Object.entries(specialMeshes)) {
      if (!m.count) continue;
      const cells = specialCells[type];
      const s = ICON_SCALE * (1 + Math.sin(time * 6 + Number(type)) * 0.07);
      for (let slot = 0; slot < m.count; slot++) {
        if (slotOf[cells[slot]] === slot) place(m, slot, cells[slot], s);
      }
      m.instanceMatrix.needsUpdate = true;
    }
  }

  return { setLevel, remove, dent, update, colorOf: (i) => palette[i % palette.length] };
}
