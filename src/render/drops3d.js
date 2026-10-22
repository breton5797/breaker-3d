import * as THREE from 'three';
import { CELL, COLS, ITEM_MULT } from '../sim/constants.js';
import { SPECIALS } from './bricks.js';
import { toWorldX, toWorldY } from './stage.js';

const POOL = 64;

/** Round glowing token with the multiplier written on it. */
function tokenTexture(label, bg) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  // Flat coin: solid disc with a dark rim, no glow halo.
  g.fillStyle = '#10131f';
  g.beginPath(); g.arc(64, 64, 62, 0, Math.PI * 2); g.fill();
  g.fillStyle = bg;
  g.beginPath(); g.arc(64, 64, 56, 0, Math.PI * 2); g.fill();
  g.lineWidth = 6;
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.beginPath(); g.arc(64, 64, 46, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#fff';
  g.strokeStyle = 'rgba(0,0,0,0.55)';
  g.lineWidth = 6;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `900 ${label.length > 3 ? 40 : 48}px system-ui, sans-serif`;
  g.strokeText(label, 64, 68);
  g.fillText(label, 64, 68);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Falling multiplier capsules, drawn as camera-facing glowing tokens. */
export function createDrops3d(scene) {
  const materials = Object.fromEntries(Object.entries(ITEM_MULT).map(([type, mult]) => {
    const spec = SPECIALS[type];
    return [mult, new THREE.SpriteMaterial({
      map: tokenTexture(`×${mult}`, spec.bg),
      depthWrite: false,
    })];
  }));
  const sprites = Array.from({ length: POOL }, () => {
    const s = new THREE.Sprite(materials[5]);
    s.visible = false;
    scene.add(s);
    return s;
  });

  /** @param {{x:number,y:number,mult:number}[]} drops */
  function update(drops, time) {
    sprites.forEach((s, k) => {
      const d = drops[k];
      s.visible = Boolean(d);
      if (!d) return;
      s.material = materials[d.mult] ?? materials[5];
      const size = 3.8 + Math.log10(d.mult) * 1.5 + Math.sin(time * 10 + k) * 0.25;
      s.scale.set(size, size, 1);
      s.position.set(toWorldX(d.x), toWorldY(d.y), 2.2);
    });
  }

  return { update };
}

/** Pulsing light-pillar under the entrance hole so players know where to aim. */
export function createBeacon(scene) {
  const mat = new THREE.MeshBasicMaterial({
    color: 0x2fc6e0, transparent: true, depthWrite: false,
  });
  const beam = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  scene.add(beam);
  let hole = null;

  /** Finds the entrance: the gap in the sealed floor row the sim detected. */
  function setLevel(grid) {
    hole = null;
    const r = grid.floorRow;
    if (r >= 0) {
      const gaps = [];
      for (let c = 0; c < COLS; c++) if (grid.cells[r * COLS + c] !== CELL.STEEL) gaps.push(c);
      if (gaps.length) hole = { c: gaps[0], w: gaps.length, r };
    }
    beam.visible = Boolean(hole);
    if (!hole) return;
    beam.position.set(toWorldX(hole.c + hole.w / 2), toWorldY(hole.r - 6), 0.08);
    beam.scale.set(hole.w, 12, 1);
  }

  function update(time) {
    if (hole) mat.opacity = 0.25 + 0.2 * Math.sin(time * 5);
  }

  return { setLevel, update };
}
