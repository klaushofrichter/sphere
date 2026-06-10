export const SPHERE_RADIUS = 10;
export const THETA_STEP = 0.40;   // horizontal angular spacing between cards (rad)
export const PHI_STEP = 0.344;    // vertical angular spacing (rad), keeps card aspect
export const VISIBLE_THETA = 1.25; // half-window beyond which cards are hidden
export const VISIBLE_PHI = 1.0;

export function wrapOffset(value, extent) {
  const half = extent / 2;
  return ((((value + half) % extent) + extent) % extent) - half;
}

/**
 * Map a card's grid cell to a position on the inner sphere.
 * @param {number} col - grid column index
 * @param {number} row - grid row index
 * @param {number} offsetX - horizontal scroll offset in radians
 * @param {number} offsetY - vertical scroll offset in radians
 * @param {number} cols - total grid columns (wrap extent)
 * @param {number} rows - total grid rows (wrap extent)
 */
export function gridToSphere(col, row, offsetX, offsetY, cols, rows) {
  const theta = wrapOffset(col * THETA_STEP - offsetX, cols * THETA_STEP);
  const phi = wrapOffset(row * PHI_STEP - offsetY, rows * PHI_STEP);
  const visible = Math.abs(theta) < VISIBLE_THETA && Math.abs(phi) < VISIBLE_PHI;
  if (!visible) return { theta, phi, visible, position: null };
  const r = SPHERE_RADIUS;
  const cosPhi = Math.cos(phi);
  return {
    theta,
    phi,
    visible,
    position: [
      r * Math.sin(theta) * cosPhi,
      r * Math.sin(phi),
      -r * Math.cos(theta) * cosPhi,
    ],
  };
}
