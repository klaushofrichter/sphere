import { describe, it, expect } from 'vitest';
import {
  wrapOffset, gridToSphere,
  SPHERE_RADIUS, THETA_STEP, PHI_STEP, VISIBLE_THETA, VISIBLE_PHI,
} from '../src/sphericalMap.js';

describe('wrapOffset', () => {
  it('keeps values inside the half-extent window', () => {
    expect(wrapOffset(0, 4)).toBe(0);
    expect(wrapOffset(1.9, 4)).toBeCloseTo(1.9);
    expect(wrapOffset(2.1, 4)).toBeCloseTo(-1.9);
    expect(wrapOffset(-2.1, 4)).toBeCloseTo(1.9);
    expect(wrapOffset(4, 4)).toBeCloseTo(0);
    expect(wrapOffset(-13.9, 4)).toBeCloseTo(-1.9);
  });
});

describe('gridToSphere', () => {
  it('places card (0,0) with zero offset at the view center on the sphere', () => {
    const { theta, phi, visible, position } = gridToSphere(0, 0, 0, 0, 10, 10);
    expect(theta).toBe(0);
    expect(phi).toBe(0);
    expect(visible).toBe(true);
    expect(position[0]).toBeCloseTo(0);
    expect(position[1]).toBeCloseTo(0);
    expect(position[2]).toBeCloseTo(-SPHERE_RADIUS);
  });

  it('places a neighbor one theta step to the right', () => {
    const { theta, position } = gridToSphere(1, 0, 0, 0, 10, 10);
    expect(theta).toBeCloseTo(THETA_STEP);
    expect(position[0]).toBeCloseTo(SPHERE_RADIUS * Math.sin(THETA_STEP));
    expect(position[1]).toBeCloseTo(0);
    expect(position[2]).toBeCloseTo(-SPHERE_RADIUS * Math.cos(THETA_STEP));
  });

  it('wraps the last column to just left of center', () => {
    const { theta } = gridToSphere(9, 0, 0, 0, 10, 10);
    expect(theta).toBeCloseTo(-THETA_STEP);
  });

  it('scrolling by exactly one full extent is a no-op', () => {
    const a = gridToSphere(3, 4, 0, 0, 10, 10);
    const b = gridToSphere(3, 4, 10 * THETA_STEP, 10 * PHI_STEP, 10, 10);
    expect(b.theta).toBeCloseTo(a.theta);
    expect(b.phi).toBeCloseTo(a.phi);
  });

  it('culls cards outside the visible window', () => {
    const { visible, position } = gridToSphere(4, 0, 0, 0, 10, 10);
    expect(Math.abs(wrapOffset(4 * THETA_STEP, 10 * THETA_STEP))).toBeGreaterThan(VISIBLE_THETA);
    expect(visible).toBe(false);
    expect(position).toBeNull();
  });

  it('keeps every visible card in front of the camera (z < 0 hemisphere-ish)', () => {
    for (let c = 0; c < 10; c++) {
      for (let r = 0; r < 10; r++) {
        const { visible, position } = gridToSphere(c, r, 1.23, -0.77, 10, 10);
        if (visible) {
          expect(Math.abs(Math.atan2(position[0], -position[2]))).toBeLessThanOrEqual(VISIBLE_THETA + 1e-9);
          expect(Math.abs(Math.asin(position[1] / SPHERE_RADIUS))).toBeLessThanOrEqual(VISIBLE_PHI + 1e-9);
        }
      }
    }
  });
});
