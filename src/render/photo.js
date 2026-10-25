import * as THREE from 'three';
import { toWorldX, toWorldY } from './stage.js';

const BASE = import.meta.env.BASE_URL;
const DIM = 0.82; // keep the photo a touch darker than the bricks so they stay readable

/**
 * The real photo of the stage's landmark, laid on the table inside the steel
 * box under the bricks (matte, lit like everything else). Breaking bricks
 * uncovers it. Photos are optional: until one loads, or if it fails to, the
 * table simply shows through.
 */
export function createPhoto(scene) {
  // The photo lies a hair above the gridded table; the polygon offset keeps the
  // table's grid lines from z-fighting through it at the far end of the field.
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  mesh.receiveShadow = true;
  mesh.visible = false;
  scene.add(mesh);
  const loader = new THREE.TextureLoader();
  const cache = new Map();
  let want = null;

  /** Crops the texture to cover a w x h area without stretching. */
  function cover(tex, w, h) {
    const img = tex.image.width / tex.image.height;
    const box = w / h;
    if (img > box) { tex.repeat.set(box / img, 1); tex.offset.set((1 - box / img) / 2, 0); }
    else { tex.repeat.set(1, img / box); tex.offset.set(0, (1 - img / box) / 2); }
  }

  /** @param {{ photo?: string, photoTint?: string, box?: {left:number,right:number,bottom:number,top:number} }} level */
  function setLevel(level) {
    const b = level.box;
    want = b && level.photo ? level.photo : null;
    mesh.visible = false;
    if (!want) return;
    const w = b.right - b.left - 1;
    const h = b.top - b.bottom - 1;
    mesh.scale.set(w, h, 1);
    mesh.position.set(toWorldX(b.left + 1 + w / 2), toWorldY(b.bottom + 1 + h / 2), -0.01);
    mat.color.set(level.photoTint ?? '#ffffff').multiplyScalar(DIM);
    const id = want;
    const show = (tex) => {
      if (want !== id) return; // the player already moved on to another stage
      cover(tex, w, h);
      mat.map = tex;
      mat.needsUpdate = true;
      mesh.visible = true;
    };
    if (cache.has(id)) { show(cache.get(id)); return; }
    loader.load(`${BASE}landmarks/${id}.jpg`, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      cache.set(id, tex);
      show(tex);
    });
  }

  return { setLevel };
}
