import { useEffect, useState } from 'react';
import { db, SETTINGS_COL, setDoc, doc, onSnapshot } from './firebase';
import { sortNames } from './sorting';

/** Fallback list used before Firestore responds or when nothing is saved yet. */
export const DEFAULT_DEPARTMENTS = [
  'CSE', 'ECE', 'Mechanical', 'Civil', 'EEE', 'IT',
  'AIML', 'AIDS', 'Pharmacy', 'Degree', 'Polytechnic', 'Forensic',
];

const DEPTS_DOC = 'departments';

export async function saveDepartments(list: string[]): Promise<void> {
  await setDoc(doc(db, SETTINGS_COL, DEPTS_DOC), { list: sortNames(list) });
}

export function subscribeDepartments(cb: (list: string[]) => void) {
  return onSnapshot(doc(db, SETTINGS_COL, DEPTS_DOC), snap => {
    const data = snap.data() as { list?: string[] } | undefined;
    const list = Array.isArray(data?.list) && data!.list!.length ? data!.list! : DEFAULT_DEPARTMENTS;
    cb(sortNames(list));
  }, () => cb(sortNames(DEFAULT_DEPARTMENTS)));
}

/** Live departments/branches list shared by all editors and the wizard. */
export function useDepartments(): string[] {
  const [list, setList] = useState<string[]>(() => sortNames(DEFAULT_DEPARTMENTS));
  useEffect(() => subscribeDepartments(setList), []);
  return list;
}
