import * as THREE from 'three';

// Hit feedback for the boss that lives outside its body: stars circling a
// stunned boss's head, and armour plates that fly off, bounce on the table and
// fade. Matte, shadowed pieces like everything else on the board.

const GRAVITY = 42; // world units/s² pulling debris down to the table
const TABLE_Z = 0.7; // where a falling plate lands (its half-thickness above the board)
const DEBRIS_LIFE = 2.6;
const FADE = 0.8; // last seconds of a piece's life it spends fading out

function starGeometry() {
  const shape = new THREE.Shape();
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2 + Math.PI / 2;
    const r = k % 2 ? 0.45 : 1;
    if (k === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return new THREE.ExtrudeGeometry(shape, { depth: 0.35, bevelEnabled: false });
}

/** Five stars that orbit above a reeling boss. */
export function createStunStars(root) {
  const group = new THREE.Group();
  const geo = starGeometry();
  const mat = new THREE.MeshLambertMaterial({ color: 0xffd23a });
  const stars = Array.from({ length: 5 }, () => {
    const s = new THREE.Mesh(geo, mat);
    s.castShadow = true;
    group.add(s);
    return s;
  });
  group.visible = false;
  root.add(group);
  return {
    /** @param {number|null} x world x of the head, or null to hide */
    update(x, y, z, r, time) {
      group.visible = x !== null;
      if (x === null) return;
      group.position.set(x, y, z);
      stars.forEach((s, k) => {
        const a = time * 4 + (k / stars.length) * Math.PI * 2;
        // A tilted ring, so it reads as circling the head from the overhead camera.
        s.position.set(Math.cos(a) * r, Math.sin(a) * r * 0.45, Math.sin(a) * r * 0.35);
        s.rotation.z = time * 6 + k;
        s.scale.setScalar(r * 0.32);
      });
    },
  };
}

/** Loose pieces (armour plates) that fly, tumble, bounce and fade. */
export function createDebris(root) {
  let pieces = [];
  return {
    /**
     * @param {THREE.Mesh} from a mesh to copy (its geometry is shared, never disposed here)
     * @param {THREE.Vector3} velocity
     */
    launch(from, velocity) {
      const mat = from.material.clone();
      mat.transparent = true;
      const m = new THREE.Mesh(from.geometry, mat);
      m.position.copy(from.position);
      m.rotation.copy(from.rotation);
      m.scale.copy(from.scale);
      m.castShadow = true;
      root.add(m);
      const spin = new THREE.Vector3((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 10);
      pieces = [...pieces, { m, v: velocity.clone(), spin, life: DEBRIS_LIFE }];
    },
    update(dt) {
      for (const p of pieces) {
        p.life -= dt;
        p.v.z -= GRAVITY * dt;
        p.m.position.addScaledVector(p.v, dt);
        if (p.m.position.z < TABLE_Z && p.v.z < 0) {
          // Clang: bounce off the table, losing most of the fall and some slide.
          p.m.position.z = TABLE_Z;
          p.v.set(p.v.x * 0.6, p.v.y * 0.6, -p.v.z * 0.35);
          p.spin.multiplyScalar(0.5);
        }
        p.m.rotation.x += p.spin.x * dt;
        p.m.rotation.y += p.spin.y * dt;
        p.m.rotation.z += p.spin.z * dt;
        p.m.material.opacity = Math.min(1, p.life / FADE);
      }
      const gone = pieces.filter((p) => p.life <= 0);
      gone.forEach((p) => { root.remove(p.m); p.m.material.dispose(); });
      if (gone.length) pieces = pieces.filter((p) => p.life > 0);
    },
    clear() {
      pieces.forEach((p) => { root.remove(p.m); p.m.material.dispose(); });
      pieces = [];
    },
  };
}
