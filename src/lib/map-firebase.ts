import { db, MAP_COL, SETTINGS_COL, doc, setDoc, getDoc } from './firebase';
import { normalizeConnections, type PointsMap, type Connection } from './campus-data';

export async function saveMapDataToFirebase(points: PointsMap, connections: Connection[]): Promise<void> {
  await setDoc(doc(db, MAP_COL, 'points'), { data: JSON.stringify(points) });
  await setDoc(doc(db, MAP_COL, 'connections'), { data: JSON.stringify(connections) });
}

export async function loadMapDataFromFirebase(): Promise<{ points: PointsMap; connections: Connection[] } | null> {
  try {
    const [pSnap, cSnap] = await Promise.all([
      getDoc(doc(db, MAP_COL, 'points')),
      getDoc(doc(db, MAP_COL, 'connections')),
    ]);
    if (pSnap.exists() && cSnap.exists()) {
      return {
        points: JSON.parse(pSnap.data().data),
        connections: normalizeConnections(JSON.parse(cSnap.data().data)),
      };
    }
  } catch (e) {
    console.error('Failed to load map from Firebase:', e);
  }
  return null;
}

export async function saveMapImageUrl(url: string): Promise<void> {
  await setDoc(doc(db, SETTINGS_COL, 'map_image'), { url });
}

export async function loadMapImageUrl(): Promise<string> {
  try {
    const snap = await getDoc(doc(db, SETTINGS_COL, 'map_image'));
    if (snap.exists()) return snap.data().url || '';
  } catch (e) {
    console.error('Failed to load map image URL:', e);
  }
  return '';
}
