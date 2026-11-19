import { useEffect, useState } from 'react';
import { db, MAP_COL, doc, setDoc, onSnapshot } from './firebase';

// Stored in the publicly-readable map_data collection so every visitor
// (not only signed-in admins) can see the custom app name.
const APP_DOC = 'app_settings';

export interface AppSettings {
  /** Custom app name shown in the header (empty = use default). */
  title: string;
  /** Custom tagline shown under the app name (empty = use default). */
  subtitle: string;
  /** Fest names an admin chose to show as a category on the first page. */
  featuredFests: string[];
}

const EMPTY: AppSettings = { title: '', subtitle: '', featuredFests: [] };

export async function saveAppTitle(title: string): Promise<void> {
  await setDoc(doc(db, MAP_COL, APP_DOC), { title }, { merge: true });
}

export async function saveAppSubtitle(subtitle: string): Promise<void> {
  await setDoc(doc(db, MAP_COL, APP_DOC), { subtitle }, { merge: true });
}

export async function saveFeaturedFests(featuredFests: string[]): Promise<void> {
  await setDoc(doc(db, MAP_COL, APP_DOC), { featuredFests }, { merge: true });
}


/** Live app settings from the cloud. */
export function useAppSettings(): AppSettings {
  const [settings, setSettings] = useState<AppSettings>(EMPTY);

  useEffect(() => {
    try {
      const unsub = onSnapshot(
        doc(db, MAP_COL, APP_DOC),
        snap => {
          const d = (snap.exists() ? snap.data() : {}) as any;
          setSettings({
            title: typeof d.title === 'string' ? d.title.trim() : '',
            subtitle: typeof d.subtitle === 'string' ? d.subtitle.trim() : '',

            featuredFests: Array.isArray(d.featuredFests)
              ? d.featuredFests.filter((f: unknown) => typeof f === 'string' && f.trim()).map((f: string) => f.trim())
              : [],
          });
        },
        err => console.error('Failed to load app settings:', err),
      );
      return unsub;
    } catch (e) {
      console.error('Failed to subscribe to app settings:', e);
    }
  }, []);

  return settings;
}

/**
 * Live app title. Falls back to the translated default when no custom
 * title has been set by an admin.
 */
export function useAppTitle(fallback: string): string {
  return useAppSettings().title || fallback;
}
