import { db, SETTINGS_COL, doc, setDoc, getDoc } from './firebase';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  type User,
} from 'firebase/auth';
import { initializeApp, getApps, deleteApp } from 'firebase/app';

const app = getApps()[0];
export const auth = getAuth(app);

// Create a new Firebase Auth account for a new admin without disturbing the
// currently logged-in admin's session. Uses a temporary secondary app instance.
// The new account's password is set to the current admin's password (verified
// by re-authenticating with `currentAdminPassword` first).
export async function createAdminAccount(
  currentAdminEmail: string,
  currentAdminPassword: string,
  newEmail: string,
): Promise<void> {
  // 1. Verify current admin's password by signing in on the main app.
  await signInWithEmailAndPassword(auth, currentAdminEmail, currentAdminPassword);

  // 2. Spin up a secondary app so creating the new user doesn't replace the
  //    main app's auth session.
  const secondary = initializeApp(app.options, `secondary-${Date.now()}`);
  const secondaryAuth = getAuth(secondary);
  try {
    await createUserWithEmailAndPassword(secondaryAuth, newEmail, currentAdminPassword);
    await signOut(secondaryAuth);
  } finally {
    await deleteApp(secondary);
  }
}

const ADMINS_DOC = 'admin_emails';

export async function getAdminEmails(): Promise<string[]> {
  try {
    const snap = await getDoc(doc(db, SETTINGS_COL, ADMINS_DOC));
    if (snap.exists()) return snap.data().emails || [];
  } catch (e) {
    console.error('Failed to load admin emails:', e);
  }
  return [];
}

export async function saveAdminEmails(emails: string[]): Promise<void> {
  await setDoc(doc(db, SETTINGS_COL, ADMINS_DOC), { emails });
}

export async function isAdmin(email: string): Promise<boolean> {
  const admins = await getAdminEmails();
  return admins.map(e => e.toLowerCase()).includes(email.toLowerCase());
}

export function subscribeAuth(cb: (user: User | null) => void) {
  return onAuthStateChanged(auth, cb);
}

export async function loginAdmin(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function logoutAdmin() {
  return signOut(auth);
}
