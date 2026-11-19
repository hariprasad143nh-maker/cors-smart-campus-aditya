import { db, STAFF_COL, collection, getDocs, setDoc, doc, deleteDoc, onSnapshot } from './firebase';
import type { QuerySnapshot, DocumentData } from './firebase';

export interface StaffRecord {
  id: string;
  name: string;
  designation: 'HOD' | 'Dean' | 'Principal' | 'Vice Principal' | 'Professor' | 'Dignitary' | 'Other';
  department?: string;
  phone?: string;
  email?: string;
  linkedNode: string;
  room: string;
  floor: number;
}

export function generateStaffId(): string {
  return 's_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export async function loadStaffFromFirebase(): Promise<StaffRecord[]> {
  const snap = await getDocs(collection(db, STAFF_COL));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as StaffRecord));
}

export async function saveStaffToFirebase(staff: StaffRecord): Promise<void> {
  await setDoc(doc(db, STAFF_COL, staff.id), staff);
}

export async function deleteStaffFromFirebase(id: string): Promise<void> {
  await deleteDoc(doc(db, STAFF_COL, id));
}

export async function saveAllStaffToFirebase(staffList: StaffRecord[]): Promise<void> {
  const snap = await getDocs(collection(db, STAFF_COL));
  await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
  await Promise.all(staffList.map(s => setDoc(doc(db, STAFF_COL, s.id), s)));
}

export function subscribeStaff(callback: (staff: StaffRecord[]) => void) {
  return onSnapshot(collection(db, STAFF_COL), (snap: QuerySnapshot<DocumentData>) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as StaffRecord)));
  });
}
