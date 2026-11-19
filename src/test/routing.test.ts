import { describe, it, expect } from 'vitest';
import { calculateFastestPath, edgeCost, normalizeConnections, type PointsMap, type Connection } from '@/lib/campus-data';

describe('routing uses real ground distance when GPS coords exist', () => {
  // Drawing puts the "long" route close together, but on the ground it is far away.
  const points: PointsMap = {
    a: { x: 0, y: 0, lat: 17.08, lng: 82.06 },
    shortcut: { x: 500, y: 0, lat: 17.0801, lng: 82.0601 },
    detour: { x: 10, y: 0, lat: 17.09, lng: 82.07 },
    b: { x: 600, y: 0, lat: 17.0802, lng: 82.0602 },
  };
  const connections: Connection[] = [
    { from: 'a', to: 'shortcut', weight: 1 }, { from: 'shortcut', to: 'b', weight: 1 },
    { from: 'a', to: 'detour', weight: 1 }, { from: 'detour', to: 'b', weight: 1 },
  ];

  it('prefers the physically shorter path', () => {
    expect(calculateFastestPath('a', 'b', points, connections)).toEqual(['a', 'shortcut', 'b']);
  });

  it('falls back to drawing distance without coordinates', () => {
    const noGps = { a: { x: 0, y: 0 }, b: { x: 3, y: 4 } };
    expect(edgeCost(noGps.a, noGps.b, 2)).toBe(10);
  });

  it('applies the difficulty multiplier to real distances', () => {
    const plain = edgeCost(points.a, points.b, 1);
    expect(edgeCost(points.a, points.b, 1.5)).toBeCloseTo(plain * 1.5, 6);
  });

  it('normalizes legacy tuple connections', () => {
    expect(normalizeConnections([['a', 'b', 2]])).toEqual([{ from: 'a', to: 'b', weight: 2 }]);
  });

  it('measures a curved road through every recorded point', () => {
    const straight = edgeCost(points.a, points.b, 1);
    const curved = edgeCost(points.a, points.b, 1, [
      { lat: 17.081, lng: 82.07, x: 300, y: 100 },
    ]);
    expect(curved).toBeGreaterThan(straight);
  });
});
