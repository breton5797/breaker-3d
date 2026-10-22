import * as THREE from 'three';
import { CELL, COLS, ROWS, ITEM_MULT } from '../sim/constants.js';
import { SPECIALS } from './bricks.js';
import { toWorldX, toWorldY } from './stage.js';

const POOL = 64;

/** Round glowing token with the multiplier written on it. */
function tokenTexture(label, bg) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 54, 10, 64, 64, 62);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.35, bg);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.beginPath(); g.arc(64, 64, 62, 0, Math.PI * 2); g.fill();
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
      color: new THREE.Color(1.5, 1.5, 1.5),
      toneMapped: false,
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
      const size = 2.2 + Math.log10(d.mult) * 0.9 + Math.sin(time * 10 + k) * 0.15;
      s.scale.set(size, size, 1);
      s.position.set(toWorldX(d.x), toWorldY(d.y), 2.2);
    });
  }

  return { update };
}

/** Pulsing light-pillar under the entrance hole so players know where to aim. */
export function createBeacon(scene) {
  const mat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0.4, 2.2, 2.6), toneMapped: false, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const beam = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  scene.add(beam);
  let hole = null;

  /** Finds the entrance: the gap in the lowest steel row. */
  function setLevel(grid) {
    hole = null;
    for (let r = 0; r < ROWS && !hole; r++) {
      let steel = 0;
      const gaps = [];
      for (let c = 0; c < COLS; c++) {
        const t = grid.cells[r * COLS + c];
        if (t === CELL.STEEL) steel++;
        else gaps.push(c);
      }
      if (steel >= COLS - 3 && gaps.length) hole = { c: gaps[0], w: gaps.length, r };
    }
    beam.visible = Boolean(hole);
    if (!hole) return;
    beam.position.set(toWorldX(hole.c + hole.w / 2), toWorldY(hole.r - 2.5), 0.08);
    beam.scale.set(hole.w, 6, 1);
  }

  function update(time) {
    if (hole) mat.opacity = 0.25 + 0.2 * Math.sin(time * 5);
  }

  return { setLevel, update };
}
