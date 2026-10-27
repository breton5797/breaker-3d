import * as THREE from 'three';
import { artUrl } from '../art.js';

const pictures = new Map(); // path -> Promise<HTMLImageElement|null>

/** Loads a picture from public/art once. Resolves null when it cannot load. */
export function loadArt(path) {
  if (!pictures.has(path)) {
    pictures.set(path, new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = artUrl(path);
    }));
  }
  return pictures.get(path);
}

/**
 * A canvas texture painted by `draw(g, size, img)`: first with img = null
 * (the drawn fallback), then again with the picture once it arrives. The
 * texture object stays the same, so materials need no rewiring.
 * @param {number} size canvas side in pixels
 * @param {(g: CanvasRenderingContext2D, size: number, img: HTMLImageElement|null) => void} draw
 * @param {string|null} path picture in public/art, or null for the fallback only
 * @param {(tex: THREE.CanvasTexture) => void} [setup] wrap/repeat/anisotropy tweaks
 */
export function paintedTexture(size, draw, path, setup) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size, null);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  setup?.(tex);
  if (path) {
    loadArt(path).then((img) => {
      if (!img) return;
      g.clearRect(0, 0, size, size);
      draw(g, size, img);
      tex.needsUpdate = true;
    });
  }
  return tex;
}
