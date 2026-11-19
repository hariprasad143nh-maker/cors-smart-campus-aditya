type SpeechLang = 'en' | 'te' | 'hi';

const LANG_TAGS: Record<SpeechLang, string[]> = {
  // Indian English ONLY — do not fall back to en-US / en-GB, that is what caused
  // the accent to flip between navigation prompts on Android.
  en: ['en-IN'],
  te: ['te-IN', 'te'],
  hi: ['hi-IN', 'hi'],
};

const isMobile = typeof navigator !== 'undefined' && /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);

// Curated preferred voices per language, ordered best → acceptable.
// Matched by lang tag + substring of voice name.
const PREFERRED_VOICES: Record<SpeechLang, { lang: string; name: string }[]> = {
  te: [
    { lang: 'te-IN', name: 'Microsoft Anu' },
    { lang: 'te-IN', name: 'Google తెలుగు' },
    { lang: 'te-IN', name: 'Telugu' },
  ],
  hi: [
    // Mobile (Android) commonly ships these — list first so they win on phones
    { lang: 'hi-IN', name: 'Google हिन्दी' },
    { lang: 'hi-IN', name: 'Google Hindi' },
    { lang: 'hi-IN', name: 'Microsoft Heera' },
    { lang: 'hi-IN', name: 'Hindi' },
  ],
  en: [
    // Indian-accent voices only. Never list en-US / en-GB here.
    { lang: 'en-IN', name: 'Google हिन्दी' }, // some Android builds label the en-IN voice this way
    { lang: 'en-IN', name: 'Google' },
    { lang: 'en-IN', name: 'Microsoft Heera' },
    { lang: 'en-IN', name: 'Microsoft Ravi' },
    { lang: 'en-IN', name: 'Microsoft Prabhat' },
    { lang: 'en-IN', name: 'English India' },
    { lang: 'en-IN', name: 'Indian' },
  ],
};

// Quality keywords ordered from best to acceptable.
// Neural / Online / Google voices are dramatically clearer than default OS voices.
const QUALITY_KEYWORDS = [
  'neural',
  'online',
  'natural',
  'premium',
  'enhanced',
  'google',
  'microsoft',
  'wavenet',
];

const DEFAULT_LANG_BY_SPEECH: Record<SpeechLang, string> = {
  en: 'en-IN',
  te: 'te-IN',
  hi: 'hi-IN',
};

function getVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    let voices = speechSynthesis.getVoices();
    if (voices.length) { resolve(voices); return; }
    const handler = () => {
      voices = speechSynthesis.getVoices();
      speechSynthesis.removeEventListener('voiceschanged', handler);
      resolve(voices);
    };
    speechSynthesis.addEventListener('voiceschanged', handler);
    setTimeout(() => resolve(speechSynthesis.getVoices()), 800);
  });
}

function scoreVoice(v: SpeechSynthesisVoice): number {
  const name = v.name.toLowerCase();
  let score = 0;
  QUALITY_KEYWORDS.forEach((kw, idx) => {
    if (name.includes(kw)) score += (QUALITY_KEYWORDS.length - idx) * 10;
  });
  // Prefer non-local (cloud) voices — they are usually higher quality
  if (!v.localService) score += 5;
  // Female voices tend to be clearer for navigation prompts
  if (/female|zira|aria|jenny|priya|swara|kalpana|heera/i.test(v.name)) score += 2;
  return score;
}

function sortVoicesByQuality(voices: SpeechSynthesisVoice[]) {
  return [...voices].sort((a, b) => {
    const d = scoreVoice(b) - scoreVoice(a);
    return d !== 0 ? d : a.name.localeCompare(b.name);
  });
}

function pickMobilePreferredVoice(voices: SpeechSynthesisVoice[], lang: SpeechLang): SpeechSynthesisVoice | null {
  if (lang === 'hi') {
    const hindiNative = voices.filter(v => v.lang.toLowerCase().startsWith('hi-in'));
    const preferredHindi = sortVoicesByQuality(hindiNative).find(v =>
      /google हिन्दी|google hindi|microsoft heera|hindi|swara|kalpana/i.test(v.name)
    );
    return preferredHindi || sortVoicesByQuality(hindiNative)[0] || null;
  }

  if (lang === 'en') {
    // Strict: only en-IN voices are eligible. If none exist we return null and
    // the outer picker falls through — the utterance still gets lang="en-IN" so
    // the OS TTS engine picks its own Indian voice instead of us handing it a
    // US/UK voice reference.
    const indianEn = voices.filter(v => v.lang.toLowerCase().startsWith('en-in'));
    if (!indianEn.length) return null;
    return sortVoicesByQuality(indianEn)[0];
  }

  return null;
}

function pickVoice(voices: SpeechSynthesisVoice[], lang: SpeechLang): { voice: SpeechSynthesisVoice; isNative: boolean } | null {
  const tags = LANG_TAGS[lang];

  if (lang === 'hi' || lang === 'en') {
    const mobilePick = pickMobilePreferredVoice(voices, lang);
    if (mobilePick) {
      return { voice: mobilePick, isNative: mobilePick.lang.toLowerCase().startsWith(lang) };
    }
  }

  // 1. Try curated preferred voices first (highest quality, known good)
  const preferred = PREFERRED_VOICES[lang] || [];
  for (const cfg of preferred) {
    const match = voices.find(
      v => v.lang.toLowerCase() === cfg.lang.toLowerCase() && v.name.includes(cfg.name)
    );
    if (match) return { voice: match, isNative: match.lang.toLowerCase().startsWith(lang) };
  }

  // 2. Try native language voices (any voice matching the language tag)
  for (const tag of tags) {
    const native = voices.filter(v => {
      const l = v.lang.toLowerCase();
      return l === tag.toLowerCase() || l.startsWith(tag.toLowerCase() + '-');
    });
    if (native.length) {
      return { voice: sortVoicesByQuality(native)[0], isNative: true };
    }
  }

  // 3. Indic fallback: prefer Indian English voices (handle Indic script better)
  if (lang === 'te' || lang === 'hi') {
    const indianEn = voices.filter(v => v.lang.toLowerCase().startsWith('en-in'));
    if (indianEn.length) {
      return { voice: sortVoicesByQuality(indianEn)[0], isNative: false };
    }
    const anyEn = voices.filter(v => v.lang.toLowerCase().startsWith('en'));
    if (anyEn.length) {
      return { voice: sortVoicesByQuality(anyEn)[0], isNative: false };
    }
  }

  // For English we refuse to pick a non en-IN voice — better to let the OS
  // resolve by utterance.lang="en-IN" than to force a US/UK accent.
  if (lang !== 'en' && voices.length) return { voice: voices[0], isNative: false };
  return null;
}

// Cache the chosen voice IDENTITY (name + lang) — NOT the SpeechSynthesisVoice
// object. Chrome/Android replaces voice objects when `voiceschanged` fires as
// more engines finish loading; assigning a stale reference to utterance.voice
// silently fails and the browser falls back to the system default for
// utterance.lang (often en-US on Android). That was the second cause of the
// accent flipping mid-navigation. We re-resolve the live voice on every speak().
const voiceCache: Partial<Record<SpeechLang, { name: string; lang: string; isNative: boolean }>> = {};
const voiceSelectionCache: Partial<Record<SpeechLang, Promise<{ voice: SpeechSynthesisVoice; isNative: boolean } | null>>> = {};

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  // When the voice list changes we drop the cache so the next speak() re-picks
  // against the fresh list (this is what fixes the mid-session accent flip).
  speechSynthesis.addEventListener?.('voiceschanged', () => {
    (Object.keys(voiceCache) as SpeechLang[]).forEach(k => delete voiceCache[k]);
  });
}

export function resetVoiceCache() {
  (Object.keys(voiceCache) as SpeechLang[]).forEach(k => delete voiceCache[k]);
  (Object.keys(voiceSelectionCache) as SpeechLang[]).forEach(k => delete voiceSelectionCache[k]);
}

export async function speak(text: string, lang: SpeechLang = 'en'): Promise<void> {
  if (!('speechSynthesis' in window)) return;
  cancelSpeech();
  // Always work against the LIVE voice list to avoid stale voice references.
  voiceSelectionCache[lang] ||= getVoices().then((voices) => pickVoice(voices, lang));
  const initial = (await voiceSelectionCache[lang]) || null;
  delete voiceSelectionCache[lang];

  const liveVoices = speechSynthesis.getVoices();
  let voice: SpeechSynthesisVoice | undefined;
  let isNative = true;

  const cached = voiceCache[lang];
  if (cached) {
    // Re-resolve the cached identity against the current list.
    voice = liveVoices.find(v => v.name === cached.name && v.lang === cached.lang);
    isNative = cached.isNative;
  }
  if (!voice && initial) {
    // The picker's chosen object may itself be stale — re-resolve by identity.
    voice = liveVoices.find(v => v.name === initial.voice.name && v.lang === initial.voice.lang) || initial.voice;
    isNative = initial.isNative;
    voiceCache[lang] = { name: initial.voice.name, lang: initial.voice.lang, isNative };
  }

  // Hard guard: for English, never speak with a non en-IN voice — drop it and
  // let the OS resolve via utterance.lang instead.
  if (lang === 'en' && voice && !voice.lang.toLowerCase().startsWith('en-in')) {
    voice = undefined;
  }

  if (voice && !isNative && lang !== 'en') {
    console.warn(`[speech] No native "${lang}" voice. Using "${voice.name}" (${voice.lang}).`);
  }

  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    if (voice) utterance.voice = voice;
    // Always pin utterance.lang to the Indian tag — this is what the OS uses
    // when utterance.voice is missing or gets rejected. Prevents en-US default.
    utterance.lang = DEFAULT_LANG_BY_SPEECH[lang];
    // Slower, clearer rates on mobile — speakers are smaller and ambient noise is higher.
    if (lang === 'en') {
      utterance.rate = isMobile ? 0.85 : 0.95;
    } else {
      utterance.rate = isMobile ? 0.75 : 0.8;
    }
    utterance.pitch = 1.0;
    utterance.volume = 1;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    speechSynthesis.speak(utterance);
  });
}

export function cancelSpeech() {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}
