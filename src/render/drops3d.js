import * as THREE from 'three';
import { CELL, COLS, ITEM_MULT } from '../sim/constants.js';
import { fruitTexture } from './bricks.js';
import { fruitFor } from '../fruits.js';
import { toWorldX, toWorldY } from './stage.js';

const POOL = 64;

/** Soft dark ellipse painted on the table under a falling fruit. */
function shadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(0,0,0,0.55)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/** Falling fruit: the fruit alone (no coin), spinning gently, with its shadow on the table. */
export function createDrops3d(scene) {
  const materials = Object.fromEntries(Object.values(ITEM_MULT).map((mult) => [
    mult,
    new THREE.SpriteMaterial({ map: fruitTexture(fruitFor(mult).emoji, 128, false), depthWrite: false }),
  ]));
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false });
  const shadowGeo = new THREE.PlaneGeometry(1, 1);
  const items = Array.from({ length: POOL }, () => {
    const sprite = new THREE.Sprite(materials[5]);
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    sprite.visible = false;
    shadow.visible = false;
    sprite.renderOrder = 3;
    scene.add(sprite, shadow);
    return { sprite, shadow };
  });

  /** @param {{x:number,y:number,mult:number}[]} drops */
  function update(drops, time) {
    items.forEach(({ sprite, shadow }, k) => {
      const d = drops[k];
      sprite.visible = shadow.visible = Boolean(d);
      if (!d) return;
      sprite.material = materials[d.mult] ?? materials[5];
      const size = 5 + Math.log10(d.mult) * 1.8;
      sprite.scale.set(size, size, 1);
      sprite.material.rotation = Math.sin(time * 4) * 0.25; // shared per fruit type, so all wobble together
      sprite.position.set(toWorldX(d.x), toWorldY(d.y), 4 + Math.sin(time * 6 + k) * 0.4);
      shadow.position.set(toWorldX(d.x) + 1.2, toWorldY(d.y) + 1.6, 0.04);
      shadow.scale.set(size * 0.8, size * 0.5, 1);
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
