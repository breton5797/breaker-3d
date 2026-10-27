import * as THREE from 'three';
import { PADDLE_Y, COLS } from '../sim/constants.js';
import { toWorldX, toWorldY } from './stage.js';
import { ART } from '../art.js';
import { paintedTexture } from './art.js';
import { loadBossModel, bossCopy } from './bossModels.js';

// The boss as a 3D creature: a generated model (see bossModels.js), with a
// body built from simple shapes standing in until it loads. Matte, shadowed,
// never glowing. It follows the sim's boss (position, phase, plates, attack) every
// frame, flinches when hit, turns red when angry, and falls apart when beaten.
// Attack warnings and strikes are drawn from the sim's attack state.

const HOVER = 4.2; // height above the table
const FLINCH_TIME = 0.12;
const FLINCH_GAP = 0.25; // a swarm hits it non-stop: blink at most this often, or it would stay white
const DOWN_TIME = 1.4;
const ANGRY = new THREE.Color(0xff2a2a);
const LANE_ROWS = 14; // a lane warning rises this far above the paddle row (the paddle would hide a flat one)
const WHITE = new THREE.Color(0xffffff);

const matte = (color) => new THREE.MeshLambertMaterial({ color });

// Generated surface pictures (stone, skin, rock, hull). Until one loads the
// part is painted its plain colour, so it looks as before. The material
// colour stays white: the picture carries the colour, and the angry/hit
// tints still lerp from it.
const skins = new Map();
function skinTexture(path, fallback) {
  const key = `${path}|${fallback}`;
  if (!skins.has(key)) {
    skins.set(key, paintedTexture(256, (g, n, img) => {
      g.fillStyle = `#${fallback.toString(16).padStart(6, '0')}`;
      g.fillRect(0, 0, n, n);
      if (img) g.drawImage(img, 0, 0, n, n);
    }, path, (tex) => { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; }));
  }
  return skins.get(key);
}
/** Matte part with a picture; `shade` darkens it (e.g. the colossus's darker stone). */
const skin = (path, fallback, shade = 0xffffff) => new THREE.MeshLambertMaterial({ color: shade, map: skinTexture(path, fallback) });
const plated = (path, fallback, shade = 0xffffff) => new THREE.MeshStandardMaterial({ color: shade, map: skinTexture(path, fallback), roughness: 0.5, metalness: 0.55 });

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

/** Stone Colossus: a carved torso and head with red slit eyes and heavy swinging arms. */
function buildColossus(r) {
  const g = new THREE.Group();
  const stone = skin(ART.colossus, 0xb9a98b);
  const dark = skin(ART.colossus, 0xb9a98b, 0x7a7266);
  g.add(mesh(new THREE.BoxGeometry(r * 1.5, r * 0.9, r * 1.2), stone, 0, 0, 0));
  g.add(mesh(new THREE.BoxGeometry(r * 1.9, r * 0.5, r * 0.35), dark, 0, 0, r * 0.62));
  const head = mesh(new THREE.BoxGeometry(r * 0.8, r * 0.7, r * 0.75), stone, 0, 0, r * 1.15);
  const eyeMat = matte(0xff3b2a);
  head.add(mesh(new THREE.BoxGeometry(r * 0.2, 0.2, r * 0.1), eyeMat, -r * 0.18, -r * 0.36, r * 0.05));
  head.add(mesh(new THREE.BoxGeometry(r * 0.2, 0.2, r * 0.1), eyeMat, r * 0.18, -r * 0.36, r * 0.05));
  g.add(head);
  const arms = [-1, 1].map((s) => {
    const pivot = new THREE.Group();
    pivot.position.set(s * r * 0.95, 0, r * 0.5);
    pivot.add(mesh(new THREE.BoxGeometry(r * 0.38, r * 0.4, r * 1.3), dark, 0, 0, -r * 0.6));
    g.add(pivot);
    return { pivot, s };
  });
  return {
    group: g,
    animate(t, phase) { arms.forEach(({ pivot, s }) => { pivot.rotation.y = s * (0.25 + 0.2 * Math.sin(t * (1.2 + phase * 0.4))); }); },
  };
}

/** Kraken: a tall mantle, two eyes that watch the paddle, eight waving tentacles. */
function buildKraken(r) {
  const g = new THREE.Group();
  const flesh = skin(ART.kraken, 0xc2456a);
  const mantle = mesh(new THREE.SphereGeometry(r * 0.75, 20, 14), flesh, 0, r * 0.15, r * 0.25);
  mantle.scale.set(1, 1.35, 0.9);
  g.add(mantle);
  const eyes = [-1, 1].map((s) => {
    const eye = mesh(new THREE.SphereGeometry(r * 0.2, 14, 10), matte(0xf4f0e6), s * r * 0.32, -r * 0.45, r * 0.15);
    const pupil = mesh(new THREE.SphereGeometry(r * 0.1, 10, 8), matte(0x14100c), 0, -r * 0.13, 0);
    eye.add(pupil);
    g.add(eye);
    return pupil;
  });
  const tentacles = Array.from({ length: 8 }, (_, k) => {
    const segs = Array.from({ length: 7 }, (__, j) => {
      const seg = mesh(new THREE.SphereGeometry(r * (0.2 - j * 0.022), 10, 8), flesh);
      g.add(seg);
      return seg;
    });
    return { segs, base: (k - 3.5) * r * 0.2, k };
  });
  return {
    group: g,
    animate(t, phase, look) {
      const speed = 2 + phase * 0.7;
      for (const { segs, base, k } of tentacles) {
        segs.forEach((seg, j) => {
          const u = j / segs.length;
          seg.position.set(base * (1 + u * 1.6) + Math.sin(t * speed + k + j * 0.6) * r * 0.18 * u, -r * (0.55 + u * 1.25), -r * 0.1 * u);
        });
      }
      eyes.forEach((pupil) => { pupil.position.x = Math.max(-0.08, Math.min(0.08, look)) * r; });
    },
  };
}

/** Lava Golem: a heap of dark rocks with molten seams and two huge fists. */
function buildGolem(r) {
  const g = new THREE.Group();
  const rock = skin(ART.golem, 0x4a403a);
  const lava = matte(0xff7a1a); // plain bright orange: the seams must pop against the dark rock
  const geo = new THREE.DodecahedronGeometry(1, 0);
  [[0, 0, 0, 0.85], [-0.45, 0.1, 0.45, 0.5], [0.45, 0.1, 0.45, 0.5], [0, 0.05, 0.95, 0.45], [-0.3, -0.1, -0.5, 0.45], [0.3, -0.1, -0.5, 0.45]]
    .forEach(([x, y, z, s]) => { const m = mesh(geo, rock, x * r, y * r, z * r); m.scale.setScalar(s * r); m.rotation.set(x * 3, y * 5, z * 2); g.add(m); });
  [[-0.25, -0.75, 0.2], [0.3, -0.72, -0.1], [0, -0.8, 0.5]].forEach(([x, y, z]) => g.add(mesh(new THREE.BoxGeometry(r * 0.5, 0.25, 0.25), lava, x * r, y * r, z * r)));
  g.add(mesh(new THREE.BoxGeometry(r * 0.16, 0.2, r * 0.12), lava, -r * 0.18, -r * 0.4, r * 1.0));
  g.add(mesh(new THREE.BoxGeometry(r * 0.16, 0.2, r * 0.12), lava, r * 0.18, -r * 0.4, r * 1.0));
  const fists = [-1, 1].map((s) => {
    const f = mesh(geo, rock, s * r * 1.15, -r * 0.1, 0);
    f.scale.setScalar(r * 0.42);
    g.add(f);
    return { f, s };
  });
  return {
    group: g,
    animate(t, phase) { fists.forEach(({ f, s }) => { f.position.z = Math.sin(t * (1.5 + phase * 0.5) + (s > 0 ? Math.PI : 0)) * r * 0.35; }); },
  };
}

/** Mothership: a spinning saucer with a dome and a ring of running lights. */
function buildMothership(r) {
  const g = new THREE.Group();
  const spin = new THREE.Group();
  g.add(spin);
  const hull = mesh(new THREE.CylinderGeometry(r * 1.05, r * 0.8, r * 0.35, 32), plated(ART.mothership, 0x9aa3b8), 0, 0, 0);
  hull.rotation.x = Math.PI / 2;
  spin.add(hull);
  const rim = mesh(new THREE.TorusGeometry(r * 1.02, r * 0.09, 8, 40), plated(ART.steel, 0x5c6478, 0x8a90a0), 0, 0, 0);
  spin.add(rim);
  const dome = mesh(new THREE.SphereGeometry(r * 0.45, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), matte(0x7fd8e8), 0, 0, r * 0.16);
  dome.rotation.x = Math.PI / 2;
  g.add(dome);
  const lights = Array.from({ length: 12 }, (_, k) => {
    const a = (k / 12) * Math.PI * 2;
    const l = mesh(new THREE.BoxGeometry(0.5, 0.5, 0.3), matte(0xffd23a), Math.cos(a) * r * 0.92, Math.sin(a) * r * 0.92, -r * 0.05);
    spin.add(l);
    return l;
  });
  return {
    group: g,
    animate(t, phase) {
      spin.rotation.z = t * (0.6 + phase * 0.4);
      lights.forEach((l, k) => l.material.color.setHex(Math.floor(t * 4 + k) % 3 === 0 ? 0xffd23a : 0x3a3f52));
    },
  };
}

const BUILD = { colossus: buildColossus, kraken: buildKraken, golem: buildGolem, mothership: buildMothership };

// Whole-body motion for the generated models (one solid piece each, so they
// sway, stomp and spin rather than move their limbs), by the boss's path
// style. `body` holds the fit scale, so only its position and rotation move.
const MOTION = {
  sway: (body, t, phase) => { body.rotation.z = 0.08 * Math.sin(t * (1.2 + phase * 0.4)); },
  eight: (body, t, phase) => {
    const s = 2 + phase * 0.7;
    body.rotation.z = 0.12 * Math.sin(t * s);
    body.position.y = 0.5 * Math.sin(t * s * 2);
  },
  hop: (body, t, phase) => {
    const s = 1.5 + phase * 0.5;
    body.rotation.z = 0.1 * Math.sin(t * s);
    body.position.z = 0.8 * Math.abs(Math.sin(t * s));
  },
  glide: (body, t, phase) => {
    body.rotation.z = 0.15 * Math.sin(t * (0.9 + phase * 0.3));
    body.position.y = 0.4 * Math.sin(t * 1.8);
  },
  spin: (body, t, phase) => { body.rotation.z = t * (0.6 + phase * 0.4); },
};
const SPINNERS = new Set(['mothership', 'ringBeast']); // round things turn instead of banking

/** A generated model as a boss body, in the same shape the builders return. */
function fromModel(template, boss) {
  const group = bossCopy(template, boss.r);
  const body = group.children[0];
  const move = SPINNERS.has(boss.kind) ? MOTION.spin : MOTION[boss.move] ?? MOTION.sway;
  return { group, animate: (t, phase) => move(body, t, phase) };
}

export function createBoss3d(scene) {
  const root = new THREE.Group();
  scene.add(root);
  let model = null; // { group, animate, parts, baseColors }
  let plates = [];
  let flinch = 0;
  let sinceFlinch = 1;
  let downT = -1;
  let shownPhase = 1;
  const plateGeo = new THREE.CylinderGeometry(1, 1, 0.6, 6);
  const plateMat = plated(ART.steel, 0x8b93a8, 0x9aa2b4);

  // Attack visuals: a red zone on the paddle row, a falling rock, a slamming tentacle, a sweeping beam.
  const zone = mesh(new THREE.BoxGeometry(1, 1.6, 0.12), new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0, depthWrite: false }));
  zone.castShadow = false;
  const rockMesh = mesh(new THREE.DodecahedronGeometry(2.3, 0), matte(0xc0612a)); // big and warm, so it reads on the dark table
  const beam = mesh(new THREE.BoxGeometry(1.1, 1, 1.1), new THREE.MeshLambertMaterial({ color: 0xff4d6a, transparent: true, opacity: 0.85 }));
  const slam = mesh(new THREE.CylinderGeometry(0.9, 1.4, 1, 10), skin(ART.kraken, 0xc2456a));
  [zone, rockMesh, beam, slam].forEach((m) => { m.visible = false; root.add(m); });
  let slamT = 0;
  let slamX = 0;

  function dispose(obj) {
    obj.traverse((o) => {
      if (!o.isMesh || o.geometry === plateGeo) return;
      if (!o.userData.sharedGeometry) o.geometry.dispose(); // a generated model's mesh is reused by the next fight
      o.material.dispose();
    });
  }

  /** Puts a body (built or generated) on stage, ready to tint and to fall apart. */
  function mount(made) {
    const parts = [];
    made.group.traverse((o) => { if (o.isMesh) parts.push(o); });
    model = { ...made, parts, baseColors: parts.map((p) => p.material.color.clone()), velocities: parts.map(() => new THREE.Vector3()) };
    root.add(model.group);
  }

  function clear() {
    if (model) { root.remove(model.group); dispose(model.group); }
    plates.forEach((p) => root.remove(p));
    model = null;
    plates = [];
    [zone, rockMesh, beam, slam].forEach((m) => { m.visible = false; });
    downT = -1;
    flinch = 0;
    shownPhase = 1;
  }

  /** @param {object|null} boss the sim's boss (world.boss) */
  function setBoss(boss) {
    clear();
    if (!boss) return;
    mount((BUILD[boss.kind] ?? buildColossus)(boss.r));
    // Swap in the generated body once it has loaded, unless this fight is already over.
    const shown = model;
    loadBossModel(boss.kind).then((template) => {
      if (!template || model !== shown || downT >= 0) return;
      root.remove(shown.group);
      dispose(shown.group);
      mount(fromModel(template, boss));
    });
    plates = boss.plates.map(() => {
      const p = mesh(plateGeo, plateMat);
      p.scale.set(boss.plateR, boss.plateR, 1);
      p.rotation.x = Math.PI / 2;
      root.add(p);
      return p;
    });
  }

  /** Paints every part: angry red in phase 2+, a white blink on hits. */
  function tint(phase) {
    const k = flinch > 0 ? flinch / FLINCH_TIME : 0;
    model.parts.forEach((p, i) => {
      const c = p.material.color.copy(model.baseColors[i]);
      if (phase >= 2) c.lerp(ANGRY, phase === 3 ? 0.4 : 0.25);
      if (k > 0) c.lerp(WHITE, 0.45 * k);
      // Pictured parts are white-based, so a colour multiplier can't redden or whiten them:
      // add a little dark red when angry and a brief lift on hits (a flash, not a glow).
      if (p.material.map) {
        const angry = phase >= 2 ? (phase === 3 ? 0.22 : 0.13) : 0;
        p.material.emissive.setRGB(angry + 0.3 * k, 0.3 * k, 0.3 * k);
      }
    });
  }

  function drawAttack(boss) {
    const a = boss.attack;
    zone.visible = false;
    rockMesh.visible = false;
    beam.visible = false;
    if (!a) return;
    const py = toWorldY(PADDLE_Y);
    if (a.stage === 'warn') {
      const flick = 0.25 + 0.25 * (0.5 + 0.5 * Math.sin(performance.now() / 50));
      zone.visible = true;
      zone.material.opacity = flick;
      if (a.kind === 'sweep') {
        zone.scale.set(COLS, 1, 1);
        zone.position.set(0, py, 0.15);
      } else {
        // A lane rising from the paddle row: where the blow will land.
        zone.scale.set(Math.max(2, a.w), LANE_ROWS / 1.6, 1);
        zone.position.set(toWorldX(a.x), py + LANE_ROWS / 2 - 0.8, 0.15);
      }
      if (a.kind === 'rock') {
        // The rock arcs from the boss toward its target while the warning shows.
        const u = 1 - Math.max(0, a.t) / 1.0;
        rockMesh.visible = true;
        rockMesh.position.set(toWorldX(boss.x + (a.x - boss.x) * u), toWorldY(boss.y + (PADDLE_Y - boss.y) * u), HOVER + Math.sin(u * Math.PI) * 6 - u * (HOVER - 1));
        rockMesh.rotation.set(u * 9, u * 5, 0);
      }
    } else if (a.stage === 'sweep') {
      // A beam from the saucer down to the paddle row, crossing it.
      const top = boss.y;
      beam.visible = true;
      beam.scale.set(1, top - PADDLE_Y, 1);
      beam.position.set(toWorldX(a.beam), toWorldY((top + PADDLE_Y) / 2), 1.2);
    }
  }

  /** The sim's strike landed: a tentacle slam is drawn here (rocks and stomps use fx). */
  function strike(e, boss) {
    if (e.kind === 'slam' && boss) {
      slamT = 0.35;
      slamX = e.x;
    }
  }

  function update(boss, paddleX, time, dt) {
    if (!model) return;
    if (downT >= 0) {
      // Beaten: parts fly apart, tumble and sink.
      downT += dt;
      model.parts.forEach((p, i) => {
        const v = model.velocities[i];
        v.z -= 30 * dt;
        p.position.addScaledVector(v, dt);
        p.rotation.x += dt * 4;
      });
      model.group.scale.setScalar(Math.max(0.01, 1 - Math.max(0, downT - DOWN_TIME * 0.6) / (DOWN_TIME * 0.4)));
      if (downT > DOWN_TIME) clear();
      return;
    }
    if (!boss) return;
    flinch = Math.max(0, flinch - dt);
    sinceFlinch += dt;
    const jitter = boss.phase === 3 ? (Math.random() - 0.5) * 0.3 : 0;
    model.group.position.set(toWorldX(boss.x) + jitter, toWorldY(boss.y), HOVER + Math.sin(time * 2) * 0.4);
    const squash = flinch > 0 ? 1 - 0.12 * (flinch / FLINCH_TIME) : 1;
    model.group.scale.set(1 / squash, 1, squash);
    if (shownPhase !== boss.phase) shownPhase = boss.phase;
    tint(boss.phase);
    // After the tint, so a model's own colour animation (the saucer's lights) shows.
    model.animate(time, boss.phase, (paddleX - boss.x) / COLS);
    plates.forEach((p, k) => {
      const pl = boss.plates[k];
      p.visible = Boolean(pl);
      if (!pl) return;
      p.position.set(toWorldX(boss.x + Math.cos(pl.angle) * boss.plateOrbit), toWorldY(boss.y + Math.sin(pl.angle) * boss.plateOrbit), HOVER);
      p.rotation.y = time * 2 + k;
    });
    drawAttack(boss);
    if (slamT > 0) {
      slamT -= dt;
      const len = boss.y - PADDLE_Y;
      slam.visible = slamT > 0;
      slam.scale.set(1, len, 1);
      slam.rotation.x = Math.PI / 2;
      slam.position.set(toWorldX(slamX), toWorldY(PADDLE_Y + len / 2), 1.2 + slamT * 4);
    }
  }

  return {
    setBoss,
    update,
    strike,
    /** A ball hit it: squash and blink white. */
    hit() {
      if (sinceFlinch < FLINCH_GAP) return;
      sinceFlinch = 0;
      flinch = FLINCH_TIME;
    },
    /** Beaten: send every part flying outward from the centre. */
    down() {
      if (!model) return;
      downT = 0;
      [zone, rockMesh, beam, slam].forEach((m) => { m.visible = false; });
      plates.forEach((p) => { p.visible = false; });
      model.parts.forEach((p) => p.material.emissive?.setScalar(0)); // no lit pieces in the wreck
      model.parts.forEach((p, i) => model.velocities[i].set(p.position.x * 3 + (Math.random() - 0.5) * 8, p.position.y * 3 + (Math.random() - 0.5) * 8, 10 + Math.random() * 12));
    },
  };
}
