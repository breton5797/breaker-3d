/**
 * True when (x, y) is inside the steel box that holds the landmark. Grids
 * without a box (hand-built test grids) fall back to "above the sealed floor".
 * @param {{ box: {left:number,right:number,bottom:number,top:number}|null, floorRow:number }} grid
 */
export function isInside(grid, x, y) {
  const b = grid.box;
  if (!b) return y > grid.floorRow + 1;
  return x > b.left + 1 && x < b.right && y > b.bottom + 1 && y < b.top;
}
