/**
 * Tests for src/utils/geo.ts
 * The Haversine implementation is a pure function — ideal unit test target.
 */
import { calculateDistance } from '../../utils/geo';

describe('calculateDistance (Haversine)', () => {
  it('returns 0 for the same point', () => {
    expect(calculateDistance(6.4281, 3.4219, 6.4281, 3.4219)).toBeCloseTo(0, 1);
  });

  it('calculates the Lagos ↔ Abuja distance (~530 km)', () => {
    const d = calculateDistance(6.4281, 3.4219, 9.0579, 7.4951);
    expect(d).toBeGreaterThan(500_000);
    expect(d).toBeLessThan(560_000);
  });

  it('is symmetric', () => {
    const d1 = calculateDistance(6.4281, 3.4219, 9.0579, 7.4951);
    const d2 = calculateDistance(9.0579, 7.4951, 6.4281, 3.4219);
    expect(d1).toBeCloseTo(d2, 0);
  });

  it('returns metres, not kilometres (large distance > 1000)', () => {
    const d = calculateDistance(6.4281, 3.4219, 9.0579, 7.4951);
    expect(d).toBeGreaterThan(1000);
  });

  it('detects a short (~100 m) distance correctly', () => {
    // Roughly 111 m per 0.001° latitude
    const d = calculateDistance(6.4281, 3.4219, 6.4290, 3.4219);
    expect(d).toBeGreaterThan(50);
    expect(d).toBeLessThan(200);
  });

  it('handles equatorial points', () => {
    const d = calculateDistance(0, 0, 0, 1); // 1° longitude at equator ≈ 111 km
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });

  it('handles antipodal points (max distance ~20,000 km)', () => {
    const d = calculateDistance(0, 0, 0, 180);
    expect(d).toBeGreaterThan(19_000_000);
    expect(d).toBeLessThan(21_000_000);
  });
});
