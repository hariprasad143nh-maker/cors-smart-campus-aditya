// Multilingual Voice AI Input (Web Speech API + Campus Intent & Accessibility Resolver)
// Supports English (en-IN), Telugu (te-IN), and Hindi (hi-IN)

import type { Language } from './i18n';
import { formatNodeName } from './campus-data';

export interface VoiceIntentResult {
  transcript: string;
  destinationNode: string | null;
  accessibleMode: boolean;
  confidence: number;
  matchedLabel: string | null;
}

const SPEECH_LOCALE: Record<Language, string> = {
  en: 'en-IN',
  te: 'te-IN',
  hi: 'hi-IN',
};

// Multilingual synonyms for campus landmarks + accessibility requests
const ACCESSIBILITY_KEYWORDS = [
  'wheelchair', 'ramp', 'accessible', 'disabled', 'no stairs', 'avoid stairs', 'tactile', 'blind', 'elevator', 'lift',
  'వీల్ చైర్', 'రాంప్', 'మెట్లు వద్దు',
  'व्हीलचेयर', 'रैंप', 'सीढ़ियां नहीं', 'लिफ्ट',
];

const LANDMARK_SYNONYMS: Record<string, string[]> = {
  main_gate: ['main gate', 'entrance', 'gate', 'మెయిన్ గేట్', 'मुख्य द्वार', 'गेट'],
  reception: ['reception', 'front desk', 'help desk', 'రిసెప్షన్', 'रिसेप्शन'],
  fee_counter: ['fee', 'fees', 'fee counter', 'admission', 'accounts', 'ఫీజు', 'शुल्क', 'फीस'],
  admin_block: ['admin', 'administration', 'office', 'అడ్మిన్', 'प्रशासन'],
  dean_office: ['dean', 'hod', 'principal', 'డీన్', 'डीन'],
  cse_dept: ['cse', 'computer', 'computer science', 'cs', 'సిఎస్ఇ', 'कंप्यूटर'],
  ece_dept: ['ece', 'electronics', 'communication', 'ఇసిఇ', 'इलेक्ट्रॉनिक्स'],
  mech_dept: ['mech', 'mechanical', 'మెకానికల్', 'मैकेनिकल'],
  lab_1: ['lab 1', 'lab one', 'first lab', 'computer lab', 'ల్యాబ్ 1', 'लैब 1'],
  lab_2: ['lab 2', 'lab two', 'second lab', 'ల్యాబ్ 2', 'लैब 2'],
  boys_hostel: ['boys hostel', 'mens hostel', 'bh', 'బాయ్స్ హాస్టల్', 'बॉयज हॉस्टल'],
  girls_hostel: ['girls hostel', 'ladies hostel', 'gh', 'గర్ల్స్ హాస్టల్', 'गर्ल्स हॉस्टल'],
  library: ['library', 'books', 'central library', 'లైబ్రరీ', 'గ్రంథాలయం', 'पुस्तकालय', 'लाइब्रेरी'],
  canteen: ['canteen', 'food', 'cafeteria', 'mess', 'lunch', 'క్యాంటీన్', 'कैंटीन'],
  sports_ground: ['sports', 'ground', 'playground', 'stadium', 'cricket', 'క్రీడా మైదానం', 'मैदान'],
  auditorium: ['auditorium', 'seminar hall', 'hall', 'ఆడిటోరియం', 'ऑडिटोरियम'],
};

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

export function parseVoiceCommand(
  transcript: string,
  visibleNodes: string[]
): VoiceIntentResult {
  const lower = transcript.toLowerCase().trim();
  const accessibleMode = ACCESSIBILITY_KEYWORDS.some((kw) => lower.includes(kw));

  let bestNode: string | null = null;
  let bestScore = 0;

  for (const node of visibleNodes) {
    const formatted = formatNodeName(node).toLowerCase();
    const raw = node.toLowerCase().replace(/_/g, ' ');

    // Direct match against formatted node name
    if (lower.includes(formatted) || lower.includes(raw)) {
      const score = formatted.length + 10;
      if (score > bestScore) {
        bestScore = score;
        bestNode = node;
      }
    }

    // Synonym match (EN / TE / HI)
    const syns = LANDMARK_SYNONYMS[node] ?? [];
    for (const syn of syns) {
      if (lower.includes(syn.toLowerCase())) {
        const score = syn.length + 8;
        if (score > bestScore) {
          bestScore = score;
          bestNode = node;
        }
      }
    }

    // Token overlap fallback
    const tokens = formatted.split(/\s+/).filter((t) => t.length >= 3);
    const hits = tokens.filter((tok) => lower.includes(tok)).length;
    if (hits > 0) {
      const score = hits * 4;
      if (score > bestScore) {
        bestScore = score;
        bestNode = node;
      }
    }
  }

  return {
    transcript,
    destinationNode: bestNode,
    accessibleMode,
    confidence: bestNode ? Math.min(0.99, 0.72 + bestScore * 0.02) : 0,
    matchedLabel: bestNode ? formatNodeName(bestNode) : null,
  };
}

export function listenForVoiceCommand(
  lang: Language,
  visibleNodes: string[]
): Promise<VoiceIntentResult> {
  return new Promise((resolve, reject) => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      reject(new Error('Voice recognition is not supported in this browser. Use Chrome or Edge.'));
      return;
    }

    const recognition = new SpeechRec();
    recognition.lang = SPEECH_LOCALE[lang] || 'en-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 3;

    recognition.onresult = (event: any) => {
      const results = event.results?.[0];
      if (!results || results.length === 0) {
        reject(new Error('No speech detected.'));
        return;
      }
      // Try alternatives until one resolves a valid campus node
      let fallback: VoiceIntentResult | null = null;
      for (let i = 0; i < results.length; i++) {
        const text = results[i]?.transcript || '';
        const parsed = parseVoiceCommand(text, visibleNodes);
        if (!fallback) fallback = parsed;
        if (parsed.destinationNode) {
          resolve(parsed);
          return;
        }
      }
      resolve(fallback!);
    };

    recognition.onerror = (event: any) => {
      reject(new Error(event.error === 'not-allowed' ? 'Microphone permission denied.' : `Voice error: ${event.error}`));
    };

    recognition.start();
  });
}
