import * as THREE from 'three';
import { COLS, ROWS } from './sim/constants.js';

/**
 * @param {{ camera: THREE.Camera, reach: number }} stage
 * @returns {(e: { clientX: number, clientY: number }) => ({ paddleX: number, x: number, y: number } | null)}
 *   where the pointer is on the board: x for the paddle (with finger reach), and the true x, y
 */
export function createBoardPointer(stage) {
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const paddlePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.5);
  const hit = new THREE.Vector3();
  return function pointerOnBoard(e) {
    ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, stage.camera);
    if (!raycaster.ray.intersectPlane(paddlePlane, hit)) return null;
    return { paddleX: hit.x * stage.reach + COLS / 2, x: hit.x + COLS / 2, y: hit.y + ROWS / 2 };
  };
}
