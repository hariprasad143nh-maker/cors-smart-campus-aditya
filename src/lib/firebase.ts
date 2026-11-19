import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, getDoc, setDoc, doc, deleteDoc, onSnapshot, type QuerySnapshot, type DocumentData } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBZy8oEWdcJv3YA_TF4QuLobfPray9Dktg",
  authDomain: "campus-map-ccdd3.firebaseapp.com",
  projectId: "campus-map-ccdd3",
  storageBucket: "campus-map-ccdd3.firebasestorage.app",
  messagingSenderId: "200607607626",
  appId: "1:200607607626:web:cace31dcd1637a90642fb3",
  measurementId: "G-N898GHSJ5R"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Collections
export const PERSONS_COL = 'persons';
export const STAFF_COL = 'staff';
export const MAP_COL = 'map_data';
export const SETTINGS_COL = 'settings';

export { collection, getDocs, getDoc, setDoc, doc, deleteDoc, onSnapshot };
export type { QuerySnapshot, DocumentData };
