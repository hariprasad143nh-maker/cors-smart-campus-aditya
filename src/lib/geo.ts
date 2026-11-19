import { useEffect, useRef, useState } from 'react';
import type { PointsMap } from './campus-data';

export interface LatLng { lat: number; lng: number; accuracy?: number }

// Haversine distance in meters
export function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Find the nearest node (with lat/lng) to a coordinate.
// Junctions (j_*) are skipped by default; pass includeJunctions to allow them
// (useful for starting navigation from the closest point on the walkway network).
export function nearestNode(
  coord: LatLng,
  points: PointsMap,
  opts?: { includeJunctions?: boolean },
): { name: string; meters: number } | null {
  let best: { name: string; meters: number } | null = null;
  for (const [name, p] of Object.entries(points)) {
    if (p.lat == null || p.lng == null) continue;
    if (!opts?.includeJunctions && name.startsWith('j_')) continue;
    const d = haversineMeters(coord, { lat: p.lat, lng: p.lng });
    if (!best || d < best.meters) best = { name, meters: d };
  }
  return best;
}


// Build an affine mapping from (lng, lat) -> (x, y) using least-squares over all
// nodes that have both real-world coordinates and SVG x/y. Needs >= 3 anchors.
export interface XYMapping { ax: number; bx: number; cx: number; ay: number; by: number; cy: number }

export function buildLatLngToXY(points: PointsMap): XYMapping | null {
  const rows: { lng: number; lat: number; x: number; y: number }[] = [];
  for (const p of Object.values(points)) {
    if (p.lat != null && p.lng != null) rows.push({ lng: p.lng, lat: p.lat, x: p.x, y: p.y });
  }
  if (rows.length < 3) return null;
  // Solve X = a*lng + b*lat + c  (and same for Y) via normal equations.
  const solve = (target: 'x' | 'y') => {
    let s1 = 0, sLng = 0, sLat = 0, sLngLng = 0, sLatLat = 0, sLngLat = 0;
    let sT = 0, sLngT = 0, sLatT = 0;
    for (const r of rows) {
      const t = r[target];
      s1 += 1; sLng += r.lng; sLat += r.lat;
      sLngLng += r.lng * r.lng; sLatLat += r.lat * r.lat; sLngLat += r.lng * r.lat;
      sT += t; sLngT += r.lng * t; sLatT += r.lat * t;
    }
    // 3x3 system: [[sLngLng,sLngLat,sLng],[sLngLat,sLatLat,sLat],[sLng,sLat,s1]] * [a,b,c]^T = [sLngT,sLatT,sT]
    const m = [
      [sLngLng, sLngLat, sLng, sLngT],
      [sLngLat, sLatLat, sLat, sLatT],
      [sLng,    sLat,    s1,   sT],
    ];
    for (let i = 0; i < 3; i++) {
      // pivot
      let piv = i;
      for (let k = i + 1; k < 3; k++) if (Math.abs(m[k][i]) > Math.abs(m[piv][i])) piv = k;
      [m[i], m[piv]] = [m[piv], m[i]];
      if (Math.abs(m[i][i]) < 1e-12) return null;
      for (let k = i + 1; k < 3; k++) {
        const f = m[k][i] / m[i][i];
        for (let j = i; j < 4; j++) m[k][j] -= f * m[i][j];
      }
    }
    const sol = [0, 0, 0];
    for (let i = 2; i >= 0; i--) {
      let s = m[i][3];
      for (let j = i + 1; j < 3; j++) s -= m[i][j] * sol[j];
      sol[i] = s / m[i][i];
    }
    return sol as [number, number, number];
  };
  const sx = solve('x');
  const sy = solve('y');
  if (!sx || !sy) return null;
  return { ax: sx[0], bx: sx[1], cx: sx[2], ay: sy[0], by: sy[1], cy: sy[2] };
}

export function latLngToXY(map: XYMapping, ll: LatLng): { x: number; y: number } {
  return {
    x: map.ax * ll.lng + map.bx * ll.lat + map.cx,
    y: map.ay * ll.lng + map.by * ll.lat + map.cy,
  };
}

// Calibration quality info: anchor count + RMS reprojection error in SVG units.
export function calibrationStats(points: PointsMap): { anchors: number; rmsXY: number | null } {
  const rows: { lng: number; lat: number; x: number; y: number }[] = [];
  for (const p of Object.values(points)) {
    if (p.lat != null && p.lng != null) rows.push({ lng: p.lng, lat: p.lat, x: p.x, y: p.y });
  }
  const anchors = rows.length;
  const map = buildLatLngToXY(points);
  if (!map || anchors < 3) return { anchors, rmsXY: null };
  let sumSq = 0;
  for (const r of rows) {
    const px = map.ax * r.lng + map.bx * r.lat + map.cx;
    const py = map.ay * r.lng + map.by * r.lat + map.cy;
    sumSq += (px - r.x) ** 2 + (py - r.y) ** 2;
  }
  return { anchors, rmsXY: Math.sqrt(sumSq / anchors) };
}

// Convert a lat/lng to local east/north meters around an origin.
export function latLngToLocalMeters(origin: LatLng, p: LatLng): { x: number; y: number } {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const x = R * toRad(p.lng - origin.lng) * Math.cos(toRad(origin.lat));
  const y = R * toRad(p.lat - origin.lat);
  return { x, y };
}

// Project point P onto segment A-B, clamped to [0,1]. Returns t and perpendicular dist (same units).
export function projectOntoSegment(
  p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }
): { t: number; dist: number; x: number; y: number } {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-9) {
    const d = Math.hypot(p.x - a.x, p.y - a.y);
    return { t: 0, dist: d, x: a.x, y: a.y };
  }
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const x = a.x + t * dx, y = a.y + t * dy;
  return { t, dist: Math.hypot(p.x - x, p.y - y), x, y };
}

// React hook around watchPosition. Pass `enabled=false` to stop watching.
export function useGeolocation(enabled: boolean) {
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [supported] = useState(() => typeof navigator !== 'undefined' && 'geolocation' in navigator);
  const watchRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || !supported) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
        setError(null);
      },
      (err) => setError(err.message),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
    );
    watchRef.current = id;
    return () => { if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current); };
  }, [enabled, supported]);

  return { coords, error, supported };
}

// One-shot position fetch (used for "Use my location" button).
export function getCurrentPositionOnce(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      reject(new Error('Geolocation not supported on this device'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}