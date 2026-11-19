import type { PointsMap, TurnDirection } from './campus-data';
import { calculateDirection } from './campus-data';
import { latLngToLocalMeters, projectOntoSegment } from './geo';
import type { LatLng } from './geo';

export interface FollowerConfig {
  preAlertM: number;     // distance from upcoming turn to fire "in X meters"
  turnNowM: number;      // distance to fire "turn now"
  arriveM: number;       // distance to destination to fire "arrived"
  offRouteM: number;     // perpendicular distance from segment that counts as off-route
  accuracyGateM: number; // ignore fixes with worse accuracy for triggers
  smoothing: number;     // number of recent fixes to average
}

export const DEFAULT_FOLLOWER_CONFIG: FollowerConfig = {
  preAlertM: 35,
  turnNowM: 10,
  arriveM: 12,
  offRouteM: 22,
  accuracyGateM: 30,
  smoothing: 3,
};

// Centimeter-precision thresholds unlocked by Survey of India CORS-RTK Fixed + AI Multipath Filter
export const CORS_FOLLOWER_CONFIG: FollowerConfig = {
  preAlertM: 15,
  turnNowM: 1.5,
  arriveM: 1.0,
  offRouteM: 1.2,
  accuracyGateM: 0.15,
  smoothing: 1,
};

export interface FollowerCallbacks {
  onApproach: (turnNode: string, dir: TurnDirection, meters: number) => void;
  onTurnNow: (turnNode: string, dir: TurnDirection) => void;
  onArrived: () => void;
  onOffRoute: (consecutiveBadFixes: number) => void;
  onProgress: (segment: number, progress: number) => void;
}

export interface Follower {
  feed: (coord: LatLng) => void;
  destroy: () => void;
}

// Build a follower for one navigation session. All distance reasoning happens in a
// local east/north tangent plane anchored at the path's start node — accurate enough
// for a campus-scale route (a few hundred meters across).
export function createFollower(
  path: string[],
  points: PointsMap,
  cbs: FollowerCallbacks,
  cfg: FollowerConfig = DEFAULT_FOLLOWER_CONFIG,
): Follower | null {
  if (path.length < 2) return null;
  // Need lat/lng on every path node.
  for (const n of path) {
    const p = points[n];
    if (!p || p.lat == null || p.lng == null) return null;
  }

  const origin: LatLng = { lat: points[path[0]].lat!, lng: points[path[0]].lng! };
  const nodeXY = path.map(n => latLngToLocalMeters(origin, { lat: points[n].lat!, lng: points[n].lng! }));

  let segment = 0;
  const buf: LatLng[] = [];
  const spokenApproach = new Set<string>();
  const spokenTurn = new Set<string>();
  let offRouteCount = 0;
  let arrived = false;
  let destroyed = false;

  const dirAt = (i: number): TurnDirection => {
    if (i <= 0 || i >= path.length - 1) return 'straight';
    return calculateDirection(points[path[i - 1]], points[path[i]], points[path[i + 1]]);
  };

  const feed = (raw: LatLng) => {
    if (destroyed || arrived) return;

    // Smooth fix
    buf.push(raw);
    if (buf.length > cfg.smoothing) buf.shift();
    const sm: LatLng = {
      lat: buf.reduce((s, c) => s + c.lat, 0) / buf.length,
      lng: buf.reduce((s, c) => s + c.lng, 0) / buf.length,
      accuracy: raw.accuracy,
    };

    // Accuracy gate — still update progress but skip voice triggers when noisy.
    const noisy = (raw.accuracy ?? 0) > cfg.accuracyGateM;

    const user = latLngToLocalMeters(origin, sm);

    // Advance segment while we're past the current segment end.
    // Keep advancing in case GPS jumped (skip very short segments cleanly).
    for (let safety = 0; safety < path.length; safety++) {
      if (segment >= path.length - 1) break;
      const a = nodeXY[segment];
      const b = nodeXY[segment + 1];
      const { t } = projectOntoSegment(user, a, b);
      if (t >= 0.95 && segment < path.length - 1) {
        segment += 1;
      } else break;
    }

    if (segment >= path.length - 1) {
      const dest = nodeXY[path.length - 1];
      const distDest = Math.hypot(user.x - dest.x, user.y - dest.y);
      cbs.onProgress(path.length - 2, 1);
      if (!noisy && distDest <= cfg.arriveM) {
        arrived = true;
        cbs.onArrived();
      }
      return;
    }

    const a = nodeXY[segment];
    const b = nodeXY[segment + 1];
    const { t, dist: perpDist } = projectOntoSegment(user, a, b);
    cbs.onProgress(segment, t);

    // Off-route detection (debounced)
    if (!noisy && perpDist > cfg.offRouteM) {
      offRouteCount += 1;
      if (offRouteCount >= 3) {
        cbs.onOffRoute(offRouteCount);
        offRouteCount = 0;
      }
    } else {
      offRouteCount = 0;
    }

    if (noisy) return;

    // Upcoming turn = node at index segment+1 (skip if it's the destination — handled by arrive)
    const turnIdx = segment + 1;
    if (turnIdx < path.length - 1) {
      const turnNode = path[turnIdx];
      const tn = nodeXY[turnIdx];
      const distToTurn = Math.hypot(user.x - tn.x, user.y - tn.y);
      const dir = dirAt(turnIdx);

      if (!spokenApproach.has(turnNode) && distToTurn <= cfg.preAlertM && distToTurn > cfg.turnNowM) {
        spokenApproach.add(turnNode);
        cbs.onApproach(turnNode, dir, Math.round(distToTurn));
      }
      if (!spokenTurn.has(turnNode) && distToTurn <= cfg.turnNowM) {
        spokenTurn.add(turnNode);
        spokenApproach.add(turnNode); // suppress late approach
        cbs.onTurnNow(turnNode, dir);
      }
    } else {
      // Approaching the destination itself
      const dest = nodeXY[path.length - 1];
      const distDest = Math.hypot(user.x - dest.x, user.y - dest.y);
      if (distDest <= cfg.arriveM) {
        arrived = true;
        cbs.onArrived();
      }
    }
  };

  return { feed, destroy: () => { destroyed = true; } };
}