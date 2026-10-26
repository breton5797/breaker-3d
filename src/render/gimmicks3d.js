import * as THREE from 'three';
import { toWorldX, toWorldY } from './stage.js';

// Visuals for the chapter gimmicks (sim/gimmicks.js). Matte and plain
// translucent, never additive or glowing: wells are pale spinning rings round a
// dark eye (they sit on dark space photos), currents are flowing chevron bands,
// a storm warning is a flickering red column.

const WARN_FLICKER = 18; // flicker speed of the doomed column (rad/s)

function chevronTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 32;
  const g = c.getContext('2d');
  g.strokeStyle = 'rgba(190,235,255,0.9)';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(18, 4); g.lineTo(34, 16); g.lineTo(18, 28);
  g.moveTo(40, 4); g.lineTo(56, 16); g.lineTo(40, 28);
  g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createGimmicks3d(scene) {
  const root = new THREE.Group();
  scene.add(root);
  const chevrons = chevronTexture();
  let wells = [];
  let bands = [];
  const warn = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 0.2),
    new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0, depthWrite: false }),
  );
  warn.visible = false;
  root.add(warn);
  let warnLeft = 0;

  function clear() {
    for (const m of [...wells.map((w) => w.group), ...bands.map((b) => b.mesh)]) {
      root.remove(m);
      m.traverse((o) => { if (o.isMesh) o.material.dispose(); });
    }
    wells = [];
    bands = [];
    warn.visible = false;
    warnLeft = 0;
  }

  /** @param {object|null} g the world's gimmick state */
  function setLevel(g) {
    clear();
    if (!g) return;
    for (const well of g.wells ?? []) {
      const group = new THREE.Group();
      group.position.set(toWorldX(well.x), toWorldY(well.y), 1.25); // above the bricks, or the mural hides it
      const rings = [1, 0.68, 0.38].map((s, k) => {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(well.r * s * 0.82, well.r * s, 48, 1, 0, Math.PI * 1.6),
          new THREE.MeshBasicMaterial({ color: 0xc9b8ff, transparent: true, opacity: 0.3 + k * 0.12, depthWrite: false, side: THREE.DoubleSide }),
        );
        group.add(ring);
        return ring;
      });
      const eye = new THREE.Mesh(new THREE.CircleGeometry(1.2, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.85, depthWrite: false }));
      group.add(eye);
      root.add(group);
      wells.push({ group, rings });
    }
    for (const band of g.bands ?? []) {
      const tex = chevrons.clone();
      tex.needsUpdate = true;
      const w = band.right - band.left;
      const h = band.top - band.bottom;
      tex.repeat.set(band.dir * w / 4, 1);
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ map: tex, color: 0x6fd3ff, transparent: true, opacity: 0.4, depthWrite: false }),
      );
      mesh.position.set(toWorldX(band.left + w / 2), toWorldY(band.bottom + h / 2), 1.15);
      root.add(mesh);
      bands.push({ mesh, tex, dir: band.dir });
    }
  }

  /** Lightning is about to hit column c (rows bottom..top) in `seconds`. */
  function warnColumn(c, bottom, top, seconds) {
    warn.visible = true;
    warn.scale.set(1, top - bottom + 1, 1);
    warn.position.set(toWorldX(c + 0.5), toWorldY((bottom + top + 1) / 2), 1.3);
    warnLeft = seconds;
  }

  function update(time, dt) {
    wells.forEach(({ rings }) => rings.forEach((r, k) => { r.rotation.z = -time * (0.8 + k * 0.9); }));
    bands.forEach(({ tex, dir }) => { tex.offset.x = -dir * time * 0.9; });
    if (warnLeft > 0) {
      warnLeft -= dt;
      warn.material.opacity = 0.18 + 0.22 * (0.5 + 0.5 * Math.sin(time * WARN_FLICKER));
      if (warnLeft <= 0) warn.visible = false;
    }
  }

  return { setLevel, warnColumn, update, hideWarning: () => { warn.visible = false; warnLeft = 0; } };
}
