import * as THREE from 'three';
import { BOSS_MODELS, artUrl } from '../art.js';
import { fitScale, lruTouch } from './bossFit.js';

// Loads the generated boss bodies (one GLB per kind) and hands out ready-to-use
// copies: turned to face the camera, centred, sized to the boss, and repainted
// matte (no metal shine, no lit maps) so they sit with the rest of the board.
// The loader is fetched only when the first boss appears. A model that fails
// to load is remembered as missing, so the simple-shape boss just stays.

// How each model is turned so it reads from the near-overhead camera (world
// +Z), and how shiny it may be. Models come Y-up. The standing giants face
// sideways (+X), so a quarter turn shows their front with the head toward
// the top of the screen; the kraken (tentacles spread flat) and the saucer
// are tipped so we look down on them.
const LOOK = {
  colossus: { rot: [0, -Math.PI / 2, 0], metal: 0 },
  kraken: { rot: [Math.PI / 2, 0, 0], metal: 0 },
  golem: { rot: [0, -Math.PI / 2, 0], metal: 0 },
  mothership: { rot: [Math.PI / 2, 0, 0], metal: 0.35 },
  // Map bosses face the camera like the giants unless listed: low, wide crawlers read better from above.
  ironSpider: { rot: [Math.PI / 2, -Math.PI / 2, 0], metal: 0.2 },
  scorpion: { rot: [Math.PI / 2, -Math.PI / 2, 0], metal: 0 },
  scarab: { rot: [Math.PI / 2, -Math.PI / 2, 0], metal: 0.2 },
  mosasaur: { rot: [Math.PI / 2, -Math.PI / 2, 0], metal: 0 },
  giantIsopod: { rot: [Math.PI / 2, -Math.PI / 2, 0], metal: 0 },
  mosaicSalamander: { rot: [Math.PI / 2, -Math.PI / 2, 0], metal: 0 },
  ringBeast: { rot: [0.6, -Math.PI / 2, 0], metal: 0 }, // tipped so its ring shows
  bronzeHorse: { rot: [0, 0, 0], metal: 0.2 }, // in profile: a rearing horse is a narrow sliver head-on
};

const cache = new Map(); // kind -> Promise<THREE.Object3D|null>
let recent = []; // kinds by last use; only the newest KEEP stay in memory
const KEEP = 2; // the boss on screen and the one before (its wreck may still be falling)
let loader = null;

/** Frees a template's GPU memory (geometry, materials, textures): ~3-4 MB per boss. */
function release(kind) {
  const entry = cache.get(kind);
  cache.delete(kind);
  entry?.then((tpl) => tpl?.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.dispose();
    o.material.map?.dispose();
    o.material.normalMap?.dispose();
    o.material.dispose();
  }));
}

async function getLoader() {
  if (!loader) {
    const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([
      import('three/examples/jsm/loaders/GLTFLoader.js'),
      import('three/examples/jsm/libs/meshopt_decoder.module.js'), // the map bosses are meshopt-packed
    ]);
    loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  }
  return loader;
}

/** Matte copy of a generated material: keeps the colour and bump detail, drops shine and glow. */
function matteFrom(src, metal) {
  return new THREE.MeshStandardMaterial({
    map: src.map ?? null,
    normalMap: src.normalMap ?? null,
    roughness: 0.85,
    metalness: metal,
    side: THREE.FrontSide,
  });
}

/** Turned, centred and matte template for one kind; geometry is shared by every copy. */
function prepare(scene, kind) {
  const look = LOOK[kind] ?? LOOK.colossus;
  const turned = new THREE.Group();
  turned.rotation.set(...look.rot);
  turned.add(scene);
  scene.traverse((o) => {
    if (!o.isMesh) return;
    o.material = matteFrom(o.material, look.metal);
    o.castShadow = true;
    o.userData.sharedGeometry = true;
  });
  const box = new THREE.Box3().setFromObject(turned);
  const centre = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const holder = new THREE.Group();
  holder.add(turned);
  turned.position.sub(centre);
  holder.userData.size = { x: size.x, y: size.y };
  return holder;
}

/**
 * Loads (once) the model for a boss kind.
 * @param {string} kind
 * @returns {Promise<THREE.Object3D|null>} the template, or null when there is none
 */
export function loadBossModel(kind) {
  const touched = lruTouch(recent, kind, KEEP);
  recent = touched.list;
  touched.evicted.forEach(release);
  if (!cache.has(kind)) {
    const path = BOSS_MODELS[kind];
    cache.set(kind, !path ? Promise.resolve(null) : getLoader()
      .then((l) => l.loadAsync(artUrl(path)))
      .then((gltf) => prepare(gltf.scene, kind))
      .catch(() => null));
  }
  return cache.get(kind);
}

/**
 * A copy of a loaded template sized to a boss of radius r. Each copy gets its
 * own materials (the boss reddens and blinks), but shares the geometry.
 * @param {THREE.Object3D} template
 * @param {number} r
 * @returns {THREE.Group}
 */
export function bossCopy(template, r) {
  const copy = template.clone(true);
  copy.traverse((o) => { if (o.isMesh) o.material = o.material.clone(); });
  copy.scale.setScalar(fitScale(template.userData.size, r));
  const g = new THREE.Group();
  g.add(copy);
  return g;
}
