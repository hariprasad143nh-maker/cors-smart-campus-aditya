export interface Point {
  x: number;
  y: number;
  floor?: number;
  room?: string;
  type?: 'building' | 'junction' | 'hostel' | 'lab' | 'office' | 'reception' | 'fee_counter';
  lat?: number;
  lng?: number;
}

export interface RoadPoint {
  lat: number;
  lng: number;
  x: number;
  y: number;
  accuracy?: number;
  recordedAt?: number;
}

export interface Connection {
  from: string;
  to: string;
  weight: number;
  geometry?: RoadPoint[];
  wheelchairAccessible?: boolean;
  hasStairs?: boolean;
  tactilePaving?: boolean;
  multipathRisk?: 'low' | 'medium' | 'high';
}

export type LegacyConnection = [string, string, number];
export type PointsMap = Record<string, Point>;

export function normalizeConnection(value: Connection | LegacyConnection): Connection {
  if (Array.isArray(value)) return { from: value[0], to: value[1], weight: value[2] ?? 1 };
  return {
    from: value.from,
    to: value.to,
    weight: Number.isFinite(value.weight) ? value.weight : 1,
    geometry: Array.isArray(value.geometry) ? value.geometry.filter(point =>
      Number.isFinite(point.lat) && Number.isFinite(point.lng) &&
      Number.isFinite(point.x) && Number.isFinite(point.y)
    ) : undefined,
    ...(value.wheelchairAccessible !== undefined ? { wheelchairAccessible: value.wheelchairAccessible } : {}),
    ...(value.hasStairs !== undefined ? { hasStairs: value.hasStairs } : {}),
    ...(value.tactilePaving !== undefined ? { tactilePaving: value.tactilePaving } : {}),
    ...(value.multipathRisk !== undefined ? { multipathRisk: value.multipathRisk } : {}),
  };
}

export function normalizeConnections(values: unknown): Connection[] {
  if (!Array.isArray(values)) return [];
  return values
    .filter((value): value is Connection | LegacyConnection =>
      (Array.isArray(value) && typeof value[0] === 'string' && typeof value[1] === 'string') ||
      (!!value && typeof value === 'object' && typeof (value as Connection).from === 'string' && typeof (value as Connection).to === 'string')
    )
    .map(normalizeConnection);
}

export function connectionId(connection: Pick<Connection, 'from' | 'to'>): string {
  return [connection.from, connection.to].sort().join('::');
}

export function findConnection(connections: Connection[], a: string, b: string): Connection | undefined {
  return connections.find(connection =>
    (connection.from === a && connection.to === b) || (connection.from === b && connection.to === a)
  );
}

export const INITIAL_POINTS: PointsMap = {
  main_gate: { x: 400, y: 580, type: 'junction' },
  reception: { x: 400, y: 480, type: 'reception', floor: 0, room: 'G-01' },
  fee_counter: { x: 250, y: 420, type: 'fee_counter', floor: 0, room: 'G-02' },
  j_central: { x: 400, y: 380, type: 'junction' },
  admin_block: { x: 300, y: 300, type: 'office', floor: 1, room: '101' },
  dean_office: { x: 300, y: 240, type: 'office', floor: 2, room: '201' },
  cse_dept: { x: 500, y: 300, type: 'building', floor: 1, room: '102' },
  ece_dept: { x: 550, y: 240, type: 'building', floor: 2, room: '203' },
  mech_dept: { x: 200, y: 300, type: 'building', floor: 1, room: '104' },
  j_labs: { x: 500, y: 380, type: 'junction' },
  lab_1: { x: 600, y: 340, type: 'lab', floor: 1, room: 'L-101' },
  lab_2: { x: 650, y: 400, type: 'lab', floor: 2, room: 'L-202' },
  j_hostel: { x: 400, y: 200, type: 'junction' },
  boys_hostel: { x: 300, y: 120, type: 'hostel', floor: 3, room: 'BH-301' },
  girls_hostel: { x: 500, y: 120, type: 'hostel', floor: 2, room: 'GH-205' },
  library: { x: 200, y: 200, type: 'building', floor: 0, room: 'LIB-G' },
  canteen: { x: 600, y: 200, type: 'building', floor: 0, room: 'CAN-G' },
  sports_ground: { x: 150, y: 450, type: 'building', floor: 0 },
  auditorium: { x: 600, y: 480, type: 'building', floor: 0, room: 'AUD-G' },
};

const road = (
  from: string,
  to: string,
  weight = 1,
  meta?: Pick<Connection, 'wheelchairAccessible' | 'hasStairs' | 'tactilePaving' | 'multipathRisk'>
): Connection => ({ from, to, weight, ...meta });

export const INITIAL_CONNECTIONS: Connection[] = [
  road('main_gate', 'reception', 1, { wheelchairAccessible: true, tactilePaving: true, multipathRisk: 'low' }),
  road('reception', 'j_central', 1, { wheelchairAccessible: true, tactilePaving: true, multipathRisk: 'medium' }),
  road('reception', 'fee_counter', 1, { wheelchairAccessible: true, tactilePaving: true, multipathRisk: 'medium' }),
  // Direct stair shortcut (avoided automatically in Wheelchair / Accessible mode!)
  road('reception', 'cse_dept', 0.85, { wheelchairAccessible: false, hasStairs: true, multipathRisk: 'high' }),
  road('j_central', 'admin_block', 1, { wheelchairAccessible: true, tactilePaving: true, multipathRisk: 'high' }),
  road('j_central', 'cse_dept', 1, { wheelchairAccessible: true, tactilePaving: true, multipathRisk: 'high' }),
  road('j_central', 'j_labs', 1, { wheelchairAccessible: true, tactilePaving: true, multipathRisk: 'high' }),
  road('j_central', 'j_hostel', 1, { wheelchairAccessible: true, tactilePaving: true, multipathRisk: 'medium' }),
  road('j_central', 'mech_dept', 1, { wheelchairAccessible: true, multipathRisk: 'medium' }),
  road('admin_block', 'dean_office', 1, { wheelchairAccessible: true, tactilePaving: true, multipathRisk: 'high' }),
  road('cse_dept', 'ece_dept', 1, { wheelchairAccessible: true, tactilePaving: true, multipathRisk: 'high' }),
  road('j_labs', 'lab_1', 1, { wheelchairAccessible: true, tactilePaving: true, multipathRisk: 'high' }),
  road('j_labs', 'lab_2', 1, { wheelchairAccessible: false, hasStairs: true, multipathRisk: 'high' }),
  road('lab_1', 'lab_2', 1.1, { wheelchairAccessible: true, tactilePaving: true, multipathRisk: 'high' }),
  road('j_hostel', 'boys_hostel', 1, { wheelchairAccessible: true, multipathRisk: 'medium' }),
  road('j_hostel', 'girls_hostel', 1, { wheelchairAccessible: true, multipathRisk: 'medium' }),
  road('j_hostel', 'library', 1, { wheelchairAccessible: true, tactilePaving: true, multipathRisk: 'medium' }),
  road('j_hostel', 'canteen', 1, { wheelchairAccessible: true, tactilePaving: true, multipathRisk: 'low' }),
  road('fee_counter', 'sports_ground', 1, { wheelchairAccessible: true, multipathRisk: 'low' }),
  road('reception', 'auditorium', 1, { wheelchairAccessible: true, tactilePaving: true, multipathRisk: 'medium' }),
  road('main_gate', 'sports_ground', 1, { wheelchairAccessible: true, multipathRisk: 'low' }),
];

function metersBetween(a: { lat?: number; lng?: number }, b: { lat?: number; lng?: number }): number | null {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function orientedRoadPoints(connection: Connection, from: string, points: PointsMap): Array<Point | RoadPoint> {
  const start = points[from];
  const otherName = connection.from === from ? connection.to : connection.from;
  const end = points[otherName];
  if (!start || !end) return [];
  const geometry = connection.from === from ? (connection.geometry ?? []) : [...(connection.geometry ?? [])].reverse();
  return [start, ...geometry, end];
}

export function connectionCanvasPoints(connection: Connection, points: PointsMap): Array<{ x: number; y: number }> {
  return orientedRoadPoints(connection, connection.from, points).map(point => ({ x: point.x, y: point.y }));
}

export function edgeCost(a: Point, b: Point, weight: number, geometry: RoadPoint[] = []): number {
  const chain: Array<Point | RoadPoint> = [a, ...geometry, b];
  let gpsDistance = 0;
  let hasGpsPath = true;
  for (let i = 0; i < chain.length - 1; i++) {
    const meters = metersBetween(chain[i], chain[i + 1]);
    if (meters == null) { hasGpsPath = false; break; }
    gpsDistance += meters;
  }
  if (hasGpsPath) return gpsDistance * weight;
  let drawingDistance = 0;
  for (let i = 0; i < chain.length - 1; i++) {
    drawingDistance += Math.hypot(chain[i].x - chain[i + 1].x, chain[i].y - chain[i + 1].y);
  }
  return drawingDistance * weight;
}

export function connectionCost(connection: Connection, points: PointsMap, from = connection.from): number {
  const a = points[from];
  const to = connection.from === from ? connection.to : connection.from;
  const b = points[to];
  if (!a || !b) return Infinity;
  const geometry = connection.from === from ? (connection.geometry ?? []) : [...(connection.geometry ?? [])].reverse();
  return edgeCost(a, b, connection.weight, geometry);
}

export function calculateFastestPath(
  start: string,
  end: string,
  points: PointsMap,
  connections: Connection[],
  opts?: { accessibleOnly?: boolean }
): string[] {
  const dist: Record<string, number> = {};
  const prev: Record<string, string | null> = {};
  const visited = new Set<string>();
  const nodes = Object.keys(points);
  for (const n of nodes) { dist[n] = Infinity; prev[n] = null; }
  dist[start] = 0;
  for (let i = 0; i < nodes.length; i++) {
    let u: string | null = null;
    for (const n of nodes) if (!visited.has(n) && (u === null || dist[n] < dist[u])) u = n;
    if (!u || dist[u] === Infinity) break;
    visited.add(u);
    for (const connection of connections) {
      const neighbor = connection.from === u ? connection.to : connection.to === u ? connection.from : null;
      if (!neighbor) continue;
      let cost = connectionCost(connection, points, u);
      if (opts?.accessibleOnly) {
        if (connection.hasStairs || connection.wheelchairAccessible === false) {
          cost *= 100; // strongly avoid stairs / non-ramp corridors
        } else if (connection.tactilePaving) {
          cost *= 0.92; // slight preference for tactile-paved sidewalks
        }
      }
      if (dist[u] + cost < dist[neighbor]) { dist[neighbor] = dist[u] + cost; prev[neighbor] = u; }
    }
  }
  const path: string[] = [];
  let cur: string | null = end;
  while (cur) { path.unshift(cur); cur = prev[cur]; }
  return path[0] === start ? path : [];
}

export function getVisibleNodes(points: PointsMap): string[] {
  return Object.keys(points).filter(k => !k.startsWith('j_'));
}

export type TurnDirection = 'straight' | 'left' | 'right';
export function calculateDirection(prev: Point, curr: Point, next: Point): TurnDirection {
  const angle1 = Math.atan2(curr.y - prev.y, curr.x - prev.x);
  const angle2 = Math.atan2(next.y - curr.y, next.x - curr.x);
  let diff = ((angle2 - angle1) * 180) / Math.PI;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  if (Math.abs(diff) < 30) return 'straight';
  return diff > 0 ? 'right' : 'left';
}

export function formatNodeName(name: string): string {
  return name.replace(/_/g, ' ').replace(/\bj\b/g, '').replace(/\b\w/g, c => c.toUpperCase()).trim();
}

export function saveMapData(points: PointsMap, connections: Connection[]) {
  localStorage.setItem('campus_map', JSON.stringify({ points, connections }));
}

export function loadMapData(): { points: PointsMap; connections: Connection[] } | null {
  const raw = localStorage.getItem('campus_map');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { points?: PointsMap; connections?: unknown };
    if (!parsed.points) return null;
    return { points: parsed.points, connections: normalizeConnections(parsed.connections) };
  } catch {
    return null;
  }
}