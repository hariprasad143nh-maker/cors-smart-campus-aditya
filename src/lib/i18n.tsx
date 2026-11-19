import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type Language = 'en' | 'te' | 'hi';

export const LANGUAGE_LABELS: Record<Language, string> = {
  en: 'English',
  te: 'తెలుగు',
  hi: 'हिन्दी',
};

type Dict = Record<string, string>;

const translations: Record<Language, Dict> = {
  en: {
    'app.title': 'NURA Mesh',
    'app.subtitle': 'Campus Navigation',
    'wizard.openMap': 'Open Map',
    'wizard.editorMode': 'Editor Mode',
    'wizard.title': 'Campus Navigator',
    'wizard.step': 'Step {current} of {total}',
    'wizard.who': 'Who are you?',
    'wizard.role.student': 'Student',
    'wizard.role.parent': 'Parent',
    'wizard.role.others': 'Visitor',
    'wizard.basicDetails': 'Your Basic Details',
    'wizard.fullName': 'Your full name',
    'wizard.yourName': 'Your name',
    'wizard.studentName': 'Student name',
    'wizard.selectBranch': 'Select branch (optional)',
    'wizard.selectStudentBranch': 'Select student branch (optional)',
    'wizard.selectYear': 'Select year (optional)',
    'wizard.purpose': 'Purpose of visit (optional)',
    'wizard.where': 'Where do you want to go?',
    'wizard.editData': 'Edit Data',
    'wizard.noRecords': 'No records found. Open Editor Mode to add data.',
    'wizard.selectDestination': 'Select destination',
    'wizard.selectCurrentLocation': 'Select your current location',
    'wizard.errorSelect': 'Please select a destination.',
    'wizard.back': 'Back',
    'wizard.next': 'Next',
    'wizard.openNavigate': 'Open Map & Navigate',
    'destType.staff': 'Staff / HOD / Dean',
    'destType.lab': 'Labs',
    'destType.club': 'Clubs',
    'destType.event': 'Events',
    'nav.title': 'Navigation',
    'nav.start': 'Start...',
    'nav.destination': 'Destination...',
    'nav.startNav': 'Start Navigation',
    'nav.navigating': 'Navigating...',
    'nav.replaceRoute': 'Start New Route',
    'header.newSession': 'New Session',
    'header.back': 'Back',
    'lang.select': 'Select Language',
    'speak.welcome': 'Welcome {name}. Navigating to {dest}.',
    'speak.assigned': ' You are assigned to {info}.',
    'speak.headTowards': 'Head towards {next}',
    'speak.turnLeft': 'Turn left',
    'speak.turnRight': 'Turn right',
    'speak.continueStraight': 'Continue straight',
    'speak.atLandmark': ' at {landmark}',
    'speak.towards': ' towards {next}',
    'speak.arrived': 'You have arrived at {dest}.',
    'speak.assignedLocation': ' Your assigned location is {info}.',
    'speak.inMeters': 'In about {meters} meters, {action}',
    'speak.now': '{action} now',
    'speak.rerouting': 'Rerouting.',
    'nav.remaining': '{distance} remaining',
    'nav.then': 'Then {action} toward {next}',
    'nav.continueTo': 'Continue toward {next}',
    'nav.routeReady': 'Route ready',
    'nav.arrived': 'You have arrived',
    'log.routing': 'Routing: {start} → {dest}',
    'log.destinationReached': 'DESTINATION REACHED.',
    'log.noRoute': 'No route found.',
    'log.destination': 'Destination: {dest} — {info}',
  },
  te: {
    'app.title': 'NURA మెష్',
    'app.subtitle': 'క్యాంపస్ నావిగేషన్',
    'wizard.openMap': 'మ్యాప్ తెరవండి',
    'wizard.editorMode': 'ఎడిటర్ మోడ్',
    'wizard.title': 'క్యాంపస్ నావిగేటర్',
    'wizard.step': 'దశ {current} / {total}',
    'wizard.who': 'మీరు ఎవరు?',
    'wizard.role.student': 'విద్యార్థి',
    'wizard.role.parent': 'తల్లిదండ్రులు',
    'wizard.role.others': 'సందర్శకుడు',
    'wizard.basicDetails': 'మీ ప్రాథమిక వివరాలు',
    'wizard.fullName': 'మీ పూర్తి పేరు',
    'wizard.yourName': 'మీ పేరు',
    'wizard.studentName': 'విద్యార్థి పేరు',
    'wizard.selectBranch': 'శాఖను ఎంచుకోండి (ఐచ్ఛికం)',
    'wizard.selectStudentBranch': 'విద్యార్థి శాఖను ఎంచుకోండి (ఐచ్ఛికం)',
    'wizard.selectYear': 'సంవత్సరం ఎంచుకోండి (ఐచ్ఛికం)',
    'wizard.purpose': 'సందర్శన ఉద్దేశ్యం (ఐచ్ఛికం)',
    'wizard.where': 'మీరు ఎక్కడికి వెళ్లాలనుకుంటున్నారు?',
    'wizard.editData': 'డేటాను సవరించండి',
    'wizard.noRecords': 'రికార్డులు కనుగొనబడలేదు. డేటాను జోడించడానికి ఎడిటర్ మోడ్ తెరవండి.',
    'wizard.selectDestination': 'గమ్యస్థానాన్ని ఎంచుకోండి',
    'wizard.selectCurrentLocation': 'మీ ప్రస్తుత స్థానాన్ని ఎంచుకోండి',
    'wizard.errorSelect': 'దయచేసి గమ్యస్థానాన్ని ఎంచుకోండి.',
    'wizard.back': 'వెనుకకు',
    'wizard.next': 'తదుపరి',
    'wizard.openNavigate': 'మ్యాప్ తెరిచి నావిగేట్ చేయండి',
    'destType.staff': 'సిబ్బంది / HOD / డీన్',
    'destType.lab': 'ల్యాబ్‌లు',
    'destType.club': 'క్లబ్‌లు',
    'destType.event': 'ఈవెంట్‌లు',
    'nav.title': 'నావిగేషన్',
    'nav.start': 'ప్రారంభం...',
    'nav.destination': 'గమ్యం...',
    'nav.startNav': 'నావిగేషన్ ప్రారంభించండి',
    'nav.navigating': 'నావిగేట్ చేస్తోంది...',
    'nav.replaceRoute': 'కొత్త మార్గం ప్రారంభించండి',
    'header.newSession': 'కొత్త సెషన్',
    'header.back': 'వెనుకకు',
    'lang.select': 'భాషను ఎంచుకోండి',
    'speak.welcome': 'స్వాగతం {name}. {dest} కు నావిగేట్ చేస్తున్నాము.',
    'speak.assigned': ' మీరు {info} కు కేటాయించబడ్డారు.',
    'speak.headTowards': '{next} వైపు వెళ్లండి',
    'speak.turnLeft': 'ఎడమవైపు తిరగండి',
    'speak.turnRight': 'కుడివైపు తిరగండి',
    'speak.continueStraight': 'నేరుగా కొనసాగండి',
    'speak.atLandmark': ' {landmark} వద్ద',
    'speak.towards': ' {next} వైపు',
    'speak.arrived': 'మీరు {dest} కు చేరుకున్నారు.',
    'speak.assignedLocation': ' మీ కేటాయించిన స్థానం {info}.',
    'speak.inMeters': 'సుమారు {meters} మీటర్లలో, {action}',
    'speak.now': 'ఇప్పుడు {action}',
    'speak.rerouting': 'మార్గం పునః లెక్కిస్తోంది.',
    'nav.remaining': 'ఇంకా {distance}',
    'nav.then': 'తర్వాత {next} వైపు {action}',
    'nav.continueTo': '{next} వైపు కొనసాగండి',
    'nav.routeReady': 'మార్గం సిద్ధంగా ఉంది',
    'nav.arrived': 'మీరు చేరుకున్నారు',
    'log.routing': 'మార్గం: {start} → {dest}',
    'log.destinationReached': 'గమ్యస్థానం చేరుకుంది.',
    'log.noRoute': 'మార్గం కనుగొనబడలేదు.',
    'log.destination': 'గమ్యం: {dest} — {info}',
  },
  hi: {
    'app.title': 'NURA मेश',
    'app.subtitle': 'कैंपस नेविगेशन',
    'wizard.openMap': 'मानचित्र खोलें',
    'wizard.editorMode': 'एडिटर मोड',
    'wizard.title': 'कैंपस नेविगेटर',
    'wizard.step': 'चरण {current} / {total}',
    'wizard.who': 'आप कौन हैं?',
    'wizard.role.student': 'छात्र',
    'wizard.role.parent': 'अभिभावक',
    'wizard.role.others': 'आगंतुक',
    'wizard.basicDetails': 'आपकी मूल जानकारी',
    'wizard.fullName': 'आपका पूरा नाम',
    'wizard.yourName': 'आपका नाम',
    'wizard.studentName': 'छात्र का नाम',
    'wizard.selectBranch': 'शाखा चुनें (वैकल्पिक)',
    'wizard.selectStudentBranch': 'छात्र की शाखा चुनें (वैकल्पिक)',
    'wizard.selectYear': 'वर्ष चुनें (वैकल्पिक)',
    'wizard.purpose': 'यात्रा का उद्देश्य (वैकल्पिक)',
    'wizard.where': 'आप कहाँ जाना चाहते हैं?',
    'wizard.editData': 'डेटा संपादित करें',
    'wizard.noRecords': 'कोई रिकॉर्ड नहीं मिला। डेटा जोड़ने के लिए एडिटर मोड खोलें।',
    'wizard.selectDestination': 'गंतव्य चुनें',
    'wizard.selectCurrentLocation': 'अपना वर्तमान स्थान चुनें',
    'wizard.errorSelect': 'कृपया एक गंतव्य चुनें।',
    'wizard.back': 'वापस',
    'wizard.next': 'आगे',
    'wizard.openNavigate': 'मानचित्र खोलें और नेविगेट करें',
    'destType.staff': 'स्टाफ / HOD / डीन',
    'destType.lab': 'लैब्स',
    'destType.club': 'क्लब्स',
    'destType.event': 'इवेंट्स',
    'nav.title': 'नेविगेशन',
    'nav.start': 'प्रारंभ...',
    'nav.destination': 'गंतव्य...',
    'nav.startNav': 'नेविगेशन शुरू करें',
    'nav.navigating': 'नेविगेट हो रहा है...',
    'nav.replaceRoute': 'नया मार्ग शुरू करें',
    'header.newSession': 'नया सत्र',
    'header.back': 'वापस',
    'lang.select': 'भाषा चुनें',
    'speak.welcome': 'स्वागत है {name}. {dest} की ओर नेविगेट कर रहे हैं।',
    'speak.assigned': ' आपको {info} में नियुक्त किया गया है।',
    'speak.headTowards': '{next} की ओर बढ़ें',
    'speak.turnLeft': 'बाएँ मुड़ें',
    'speak.turnRight': 'दाएँ मुड़ें',
    'speak.continueStraight': 'सीधे चलते रहें',
    'speak.atLandmark': ' {landmark} पर',
    'speak.towards': ' {next} की ओर',
    'speak.arrived': 'आप {dest} पर पहुँच गए हैं।',
    'speak.assignedLocation': ' आपका नियुक्त स्थान {info} है।',
    'speak.inMeters': 'लगभग {meters} मीटर में, {action}',
    'speak.now': 'अभी {action}',
    'speak.rerouting': 'मार्ग पुनः गणना हो रही है।',
    'nav.remaining': '{distance} शेष',
    'nav.then': 'फिर {next} की ओर {action}',
    'nav.continueTo': '{next} की ओर बढ़ते रहें',
    'nav.routeReady': 'मार्ग तैयार है',
    'nav.arrived': 'आप पहुँच गए हैं',
    'log.routing': 'मार्ग: {start} → {dest}',
    'log.destinationReached': 'गंतव्य पहुँच गया।',
    'log.noRoute': 'मार्ग नहीं मिला।',
    'log.destination': 'गंतव्य: {dest} — {info}',
  },
};

interface I18nContextValue {
  lang: Language;
  setLang: (l: Language) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = 'app.lang';

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    const stored = typeof window !== 'undefined' ? (localStorage.getItem(STORAGE_KEY) as Language | null) : null;
    return stored && stored in translations ? stored : 'en';
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* ignore */ }
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (l: Language) => setLangState(l);

  const t = (key: string, vars?: Record<string, string | number>) => {
    let str = translations[lang][key] ?? translations.en[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
    }
    return str;
  };

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}
