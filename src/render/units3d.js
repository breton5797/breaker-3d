import * as THREE from 'three';
import { MAX_SHELLS } from '../sim/constants.js';
import { toWorldX, toWorldY } from './stage.js';

// Body colour per tier: green rookies up to a black-and-gold tier 10.
export const TIER_COLORS = [
  0x46d16a, 0x8ad13c, 0xd8d23a, 0xf0a531, 0xf0702e, 0xe8433f, 0xd9338f, 0x9b3dff, 0x4b3cff, 0x1a1a1a,
];
const UNIT_SCALE = 1.9; // drawn bigger than their one-cell hitbox so they read on phones
const TELEGRAPH = 0.6; // seconds before a volley when the eye flares

function badgeTexture(tier) {
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 48;
  const g = c.getContext('2d');
  g.fillStyle = tier === 10 ? '#ffcf4a' : '#0b0f1f';
  g.beginPath();
  g.roundRect(2, 2, 92, 44, 12);
  g.fill();
  g.lineWidth = 4;
  g.strokeStyle = `#${TIER_COLORS[tier - 1].toString(16).padStart(6, '0')}`;
  g.stroke();
  g.fillStyle = tier === 10 ? '#1a1a1a' : '#fff';
  g.font = '900 30px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(`Lv.${tier}`, 48, 26);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeUnit(tier, badge) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.95, 0.95, 1.5),
    new THREE.MeshLambertMaterial({ color: TIER_COLORS[tier - 1] }),
  );
  body.position.z = 0.75;
  const eye = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0x7a1010 }),
  );
  eye.position.set(0, -0.35, 1.25);
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: badge, depthWrite: false }));
  label.scale.set(1.8, 0.9, 1);
  label.position.set(0, 0.2, 2.4);
  group.add(body, eye, label);
  return { group, body, eye };
}

/** Enemy units sitting in the wall plus the bombs they drop. */
export function createUnits3d(scene) {
  const badges = Array.from({ length: 10 }, (_, k) => badgeTexture(k + 1));
  let views = new Map(); // "c,r" -> view

  const shellMesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.7, 14, 12),
    new THREE.MeshLambertMaterial({ color: 0xe0301e }),
    MAX_SHELLS,
  );
  shellMesh.frustumCulled = false;
  shellMesh.count = 0;
  scene.add(shellMesh);
  const tmp = new THREE.Object3D();

  function clear() {
    views.forEach((v) => scene.remove(v.group));
    views = new Map();
  }

  /** Builds a view for every unit of a new level. */
  function setLevel(units) {
    clear();
    units.forEach((u) => {
      const v = makeUnit(u.tier, badges[u.tier - 1]);
      v.group.position.set(toWorldX(u.c + 0.5), toWorldY(u.r + 0.5), 0);
      v.group.scale.setScalar(UNIT_SCALE);
      scene.add(v.group);
      views.set(`${u.c},${u.r}`, { ...v, tier: u.tier, flash: 0 });
    });
  }

  function hit(c, r) {
    const v = views.get(`${c},${r}`);
    if (v) v.flash = 0.15;
  }

  /**
   * @param {{c:number,r:number,tier:number,cd:number}[]} units living units
   * @param {{x:number,y:number}[]} shells
   * @param {boolean} awake whether units are firing yet
   */
  function update(units, shells, awake, time, dt) {
    const alive = new Set(units.map((u) => `${u.c},${u.r}`));
    views.forEach((v, key) => {
      if (!alive.has(key)) { scene.remove(v.group); views.delete(key); }
    });
    units.forEach((u, k) => {
      const v = views.get(`${u.c},${u.r}`);
      if (!v) return;
      const warn = awake && u.cd < TELEGRAPH;
      // Telegraph: the eye turns bright yellow and blinks before a volley.
      if (warn) v.eye.material.color.setHex(Math.sin(time * 40) > 0 ? 0xffe14a : 0xff3b1f);
      else v.eye.material.color.setHex(awake ? 0xe02020 : 0x5a1010);
      v.eye.scale.setScalar(warn ? 1.5 : 1);
      v.flash = Math.max(0, v.flash - dt);
      v.body.material.color.setHex(v.flash > 0 ? 0xffffff : TIER_COLORS[v.tier - 1]);
      v.group.position.z = Math.sin(time * 3 + k) * 0.12;
    });
    shellMesh.count = shells.length;
    shells.forEach((s, k) => {
      tmp.position.set(toWorldX(s.x), toWorldY(s.y), 1.2);
      tmp.scale.setScalar(1 + Math.sin(time * 20 + k) * 0.15);
      tmp.updateMatrix();
      shellMesh.setMatrixAt(k, tmp.matrix);
    });
    shellMesh.instanceMatrix.needsUpdate = true;
  }

  return { setLevel, update, hit, clear };
}
