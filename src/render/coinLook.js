import * as THREE from 'three';

// Shared look for gold coins (in the wall and falling): a thick matte disc
// with a darker milled rim and an embossed face. No glow; depth comes from
// shading and the rim.

const FACE = '#f4c21f';
const DARK = '#b8860b';

/** Embossed coin face: bright disc, inner ring, a bold "G" for gold. */
function faceTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = FACE;
  g.fillRect(0, 0, 128, 128);
  // Soft top-left light, darker lower-right: reads as a slightly domed face.
  const shade = g.createLinearGradient(16, 16, 112, 112);
  shade.addColorStop(0, 'rgba(255,255,255,0.35)');
  shade.addColorStop(1, 'rgba(120,70,0,0.35)');
  g.fillStyle = shade;
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = DARK;
  g.lineWidth = 8;
  g.beginPath();
  g.arc(64, 64, 46, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = DARK;
  g.font = 'bold 64px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('G', 64, 68);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

let shared = null;

/** @returns {THREE.Material[]} [rim, top face, bottom face] for a CylinderGeometry */
export function coinMaterials() {
  if (!shared) {
    const face = new THREE.MeshLambertMaterial({ map: faceTexture() });
    shared = [new THREE.MeshLambertMaterial({ color: DARK }), face, face];
  }
  return shared;
}

/** Coin disc, axis along +z (so its face looks up at the tilted camera). */
export function coinGeometry(radius, thickness) {
  return new THREE.CylinderGeometry(radius, radius, thickness, 28).rotateX(Math.PI / 2);
}
