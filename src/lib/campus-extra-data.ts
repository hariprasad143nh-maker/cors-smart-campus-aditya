import { db, collection, getDocs, setDoc, doc, deleteDoc, onSnapshot } from './firebase';
import type { QuerySnapshot, DocumentData } from './firebase';

// ── Labs ──
export interface LabRecord {
  id: string;
  name: string;
  department: string;
  linkedNode: string;
  room: string;
  floor: number;
}

// ── Clubs ──
export interface ClubRecord {
  id: string;
  name: string;
  type: 'Technical' | 'Cultural' | 'Sports' | 'Social' | 'Other';
  linkedNode: string;
  room: string;
  floor: number;
  coordinatorName?: string;
  coordinatorPhone?: string;
}

// ── Events ──
export interface EventRecord {
  id: string;
  name: string;
  /** Legacy date-only value retained so existing Firestore events remain readable. */
  date?: string;
  startDateTime?: string;
  endDateTime?: string;
  /** Optional fest/category this event belongs to (e.g. "Tech Fest"). */
  fest?: string;
  venue: string;
  room: string;
  floor: number;
  forStudents: boolean;
  forOthers: boolean;
  studentCoordinatorName?: string;
  studentCoordinatorPhone?: string;
  facultyCoordinatorName?: string;
  facultyCoordinatorPhone?: string;
}

const LABS_COL = 'labs';
const CLUBS_COL = 'clubs';
const EVENTS_COL = 'events';

export function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

async function saveAll<T extends { id: string }>(col: string, items: T[]) {
  const snap = await getDocs(collection(db, col));
  await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
  await Promise.all(items.map(item => setDoc(doc(db, col, item.id), item)));
}

function subscribe<T extends { id: string }>(col: string, cb: (items: T[]) => void) {
  return onSnapshot(collection(db, col), (snap: QuerySnapshot<DocumentData>) => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as T)));
  });
}

export const saveAllLabs = (items: LabRecord[]) => saveAll(LABS_COL, items);
export const subscribeLabs = (cb: (items: LabRecord[]) => void) => subscribe<LabRecord>(LABS_COL, cb);

export const saveAllClubs = (items: ClubRecord[]) => saveAll(CLUBS_COL, items);
export const subscribeClubs = (cb: (items: ClubRecord[]) => void) => subscribe<ClubRecord>(CLUBS_COL, cb);

export const saveAllEvents = (items: EventRecord[]) => saveAll(EVENTS_COL, items);
export const subscribeEvents = (cb: (items: EventRecord[]) => void) => subscribe<EventRecord>(EVENTS_COL, cb);

/** Resolve the new date-time fields while keeping old date-only records usable. */
export function getEventStartDateTime(event: EventRecord): string {
  return event.startDateTime || (event.date ? `${event.date}T00:00` : '');
}

export function getEventEndDateTime(event: EventRecord): string {
  return event.endDateTime || (event.date ? `${event.date}T23:59` : '');
}

export function formatEventDateTime(value: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatEventDateRange(event: EventRecord): string {
  return `${formatEventDateTime(getEventStartDateTime(event))} – ${formatEventDateTime(getEventEndDateTime(event))}`;
}

// Delete a single event doc by id
export const deleteEvent = (id: string) => deleteDoc(doc(db, EVENTS_COL, id));

// Remove any events whose end date-time has passed.
// Returns the ids that were pruned.
export async function pruneExpiredEvents(events: EventRecord[]): Promise<string[]> {
  const expired = events.filter(ev => {
    const end = getEventEndDateTime(ev);
    if (!end) return false;
    const endTime = new Date(end).getTime();
    return !Number.isNaN(endTime) && endTime < Date.now();
  });
  if (expired.length === 0) return [];
  await Promise.all(expired.map(ev => deleteEvent(ev.id)));
  return expired.map(ev => ev.id);
}
