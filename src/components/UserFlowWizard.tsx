import { useEffect, useMemo, useState } from 'react';
import { useDepartments } from '@/lib/departments';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { User, GraduationCap, Users, ArrowRight, ArrowLeft, AlertCircle, Shield, Map as MapIcon, MapPin, Phone, Mail, Calendar, Building2, DoorOpen, Layers, UserCircle, Sparkles, Pencil } from 'lucide-react';
import type { StaffRecord } from '@/lib/staff-data';
import type { LabRecord, ClubRecord, EventRecord } from '@/lib/campus-extra-data';
import { formatEventDateTime, getEventEndDateTime, getEventStartDateTime } from '@/lib/campus-extra-data';
import { useI18n } from '@/lib/i18n';
import { LanguageMenu } from '@/components/LanguageMenu';
import type { PointsMap } from '@/lib/campus-data';
import { formatNodeName } from '@/lib/campus-data';
import { byText, groupThenSort, sortByDateThenText } from '@/lib/sorting';
import { useAppSettings, saveAppTitle } from '@/lib/app-settings';

export interface UserFlowData {
  role: 'student' | 'parent' | 'others' | '';
  name: string;
  department: string;
  year: string;
  gender: string;
  studentName: string;
  studentDepartment: string;
  purpose: string;
  destinationType: string;
  selectedId: string;
  selectedLabel: string;
  destination: string;
  room: string;
  floor: number;
  currentLocation: string;
}

interface UserFlowWizardProps {
  onComplete: (data: UserFlowData) => void;
  staff: StaffRecord[];
  labs: LabRecord[];
  clubs: ClubRecord[];
  events: EventRecord[];
  mapNodes: string[];
  points?: PointsMap;
  onOpenEditor: () => void;
  onOpenMap: () => void;
  initialData?: UserFlowData | null;
  initialStep?: number;
  isAdmin?: boolean;
  loginSlot?: React.ReactNode;
}

const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
const CLUB_TYPE_ORDER = ['Technical', 'Cultural', 'Sports', 'Social', 'Other'] as const;
const fieldClassName = 'flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2';

// "Principal" records are presented as "Officers" everywhere in the UI.
const designationLabel = (d: string) =>
  d === 'Principal' ? 'Officers' : d === 'Vice Principal' ? 'Vice Officers' : d;

interface DestOption {
  id: string;
  label: string;
  node: string;
  room: string;
  floor: number;
  meta: { icon: React.ReactNode; label: string; value: string }[];
}

export function UserFlowWizard({ onComplete, staff, labs, clubs, events, mapNodes, points, onOpenEditor, onOpenMap, initialData, initialStep, isAdmin, loginSlot }: UserFlowWizardProps) {
  const { t } = useI18n();
  const [step, setStep] = useState(initialStep ?? 0);
  const [error, setError] = useState('');
  const [detailOption, setDetailOption] = useState<DestOption | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [eventSearch, setEventSearch] = useState('');
  const [festFilter, setFestFilter] = useState<string>('all');
  const [eventCategory, setEventCategory] = useState<'current' | 'upcoming'>('current');
  const { title: customTitle, featuredFests } = useAppSettings();
  const appTitle = customTitle || t('wizard.title');
  const [pickedNote, setPickedNote] = useState('');
  const [titleOpen, setTitleOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [savingTitle, setSavingTitle] = useState(false);
  const handleSaveTitle = async () => {
    setSavingTitle(true);
    try {
      await saveAppTitle(titleDraft.trim());
      setTitleOpen(false);
    } catch (e) {
      console.error('Failed to save app name:', e);
    }
    setSavingTitle(false);
  };
  const DEPARTMENTS = useDepartments();
  const [data, setData] = useState<UserFlowData>(initialData ?? {
    role: '', name: '', department: '', year: '', gender: '',
    studentName: '', studentDepartment: '', purpose: '',
    destinationType: '', selectedId: '', selectedLabel: '',
    destination: '', room: '', floor: 0, currentLocation: '',
  });

  // Phone back button support: pop through wizard steps instead of leaving the app.
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const s = e.state && typeof (e.state as any).wizardStep === 'number'
        ? (e.state as any).wizardStep
        : 0;
      setStep(s);
      setError('');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const advanceTo = (newStep: number) => {
    if (newStep > step) {
      window.history.pushState({ wizardStep: newStep }, '');
    } else if (newStep < step) {
      window.history.back();
      return;
    }
    setStep(newStep);
    setError('');
  };

  const update = (field: keyof UserFlowData, value: string) => {
    setData(prev => ({ ...prev, [field]: value }));
    if (field === 'destinationType') {
      setData(prev => ({ ...prev, destinationType: value, selectedId: '' }));
      setEventSearch('');
    }
  };

  const eventSearchLower = eventSearch.trim().toLowerCase();

  const festNames = useMemo(() => {
    const isStudent = data.role === 'student';
    const now = Date.now();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    const visible = events
      .filter(e => (!data.role ? (e.forStudents || e.forOthers) : isStudent ? e.forStudents : e.forOthers))
      .filter(e => {
        const start = getEventStartDateTime(e) ? new Date(getEventStartDateTime(e)).getTime() : 0;
        const end = getEventEndDateTime(e) ? new Date(getEventEndDateTime(e)).getTime() : 0;
        if (eventCategory === 'current') {
          if (start && end && now >= start && now <= end) return true;
          if (start >= startOfToday.getTime() && start <= endOfToday.getTime()) return true;
          return false;
        }
        return start > endOfToday.getTime();
      });
    return Array.from(new Set(visible.map(e => (e.fest || '').trim()).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }));
  }, [events, data.role, eventCategory]);

  // Fest categories an admin chose to show on the first page (only those that
  // actually have events visible right now).
  const firstPageFests = useMemo(() => {
    const now = Date.now();
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return featuredFests
      .map(fest => {
        const mine = events.filter(e =>
          (e.fest || '').trim().toLowerCase() === fest.toLowerCase() && (e.forStudents || e.forOthers));
        let current = 0, upcoming = 0;
        mine.forEach(e => {
          const start = getEventStartDateTime(e) ? new Date(getEventStartDateTime(e)).getTime() : 0;
          const end = getEventEndDateTime(e) ? new Date(getEventEndDateTime(e)).getTime() : 0;
          if ((start && end && now >= start && now <= end) ||
              (start >= startOfToday.getTime() && start <= endOfToday.getTime())) current++;
          else if (start > endOfToday.getTime()) upcoming++;
        });
        return { fest, current, upcoming, total: current + upcoming };
      })
      .filter(f => f.total > 0)
      .sort((a, b) => byText(a.fest, b.fest));
  }, [featuredFests, events]);

  const openFest = (f: { fest: string; current: number }) => {
    setEventCategory(f.current > 0 ? 'current' : 'upcoming');
    setFestFilter(f.fest);
    setEventSearch('');
    update('destinationType', 'event');
    setListOpen(true);
  };

  const destOptions = useMemo<DestOption[]>(() => {
    const type = data.destinationType;
    const staffFilters: Record<string, StaffRecord['designation'][]> = {
      principal: ['Principal', 'Vice Principal'],
      dean: ['Dean'],
      hod: ['HOD'],
      staff: ['Professor', 'Dignitary', 'Other'],
    };
    if (staffFilters[type]) {
      const allowed = staffFilters[type];
      return groupThenSort(
        staff.filter(s => allowed.includes(s.designation)),
        s => s.department || '',
        s => s.name,
      )
        .map(s => ({
          id: s.id,
          label: type === 'staff'
            ? `${designationLabel(s.designation)} - ${s.name}${s.department ? ` (${s.department})` : ''}`
            : `${designationLabel(s.designation)} - ${s.department ? `${s.department} - ` : ''}${s.name}`,
          node: s.linkedNode, room: s.room, floor: s.floor,
          meta: [
            { icon: <UserCircle className="w-4 h-4" />, label: 'Name', value: s.name },
            { icon: <Building2 className="w-4 h-4" />, label: 'Designation', value: designationLabel(s.designation) },
            ...(s.department ? [{ icon: <MapPin className="w-4 h-4" />, label: 'Department', value: s.department }] : []),
            ...(s.phone ? [{ icon: <Phone className="w-4 h-4" />, label: 'Phone', value: s.phone }] : []),
            ...(s.email ? [{ icon: <Mail className="w-4 h-4" />, label: 'Email', value: s.email }] : []),
            { icon: <DoorOpen className="w-4 h-4" />, label: 'Room', value: s.room || '—' },
            { icon: <Layers className="w-4 h-4" />, label: 'Floor', value: String(s.floor ?? 0) },
            { icon: <MapPin className="w-4 h-4" />, label: 'Node', value: formatNodeName(s.linkedNode) },
          ],
        }));
    }
    if (type === 'reception' || type === 'admission') {
      if (!points) return [];
      const wantAdmission = type === 'admission';
      return Object.entries(points)
        .filter(([name, p]) => {
          if (name.startsWith('j_')) return false;
          const lower = name.toLowerCase();
          if (wantAdmission) return p.type === 'fee_counter' || lower.includes('admission');
          return p.type === 'reception' || lower.includes('reception');
        })
        .sort(([a], [b]) => byText(a, b))
        .map(([name, p]) => ({
          id: name,
          label: formatNodeName(name),
          node: name,
          room: p.room || '',
          floor: p.floor ?? 0,
          meta: [
            { icon: <Building2 className="w-4 h-4" />, label: 'Location', value: formatNodeName(name) },
            { icon: <DoorOpen className="w-4 h-4" />, label: 'Room', value: p.room || '—' },
            { icon: <Layers className="w-4 h-4" />, label: 'Floor', value: String(p.floor ?? 0) },
          ],
        }));
    }
    if (type === 'lab') return groupThenSort(labs, l => l.department || '', l => l.name).map(l => ({
      id: l.id,
      label: `${l.name} (${l.department})`,
      node: l.linkedNode, room: l.room, floor: l.floor,
      meta: [
        { icon: <Building2 className="w-4 h-4" />, label: 'Lab', value: l.name },
        { icon: <MapPin className="w-4 h-4" />, label: 'Department', value: l.department },
        { icon: <DoorOpen className="w-4 h-4" />, label: 'Room', value: l.room || '—' },
        { icon: <Layers className="w-4 h-4" />, label: 'Floor', value: String(l.floor ?? 0) },
        { icon: <MapPin className="w-4 h-4" />, label: 'Node', value: formatNodeName(l.linkedNode) },
      ],
    }));
    if (type === 'club') return groupThenSort(clubs, c => c.type || '', c => c.name, CLUB_TYPE_ORDER).map(c => ({
      id: c.id,
      label: `${c.name} (${c.type})`,
      node: c.linkedNode, room: c.room, floor: c.floor,
      meta: [
        { icon: <UserCircle className="w-4 h-4" />, label: 'Club', value: c.name },
        { icon: <Building2 className="w-4 h-4" />, label: 'Type', value: c.type },
        ...(c.coordinatorName ? [{ icon: <UserCircle className="w-4 h-4" />, label: 'Coordinator', value: c.coordinatorName }] : []),
        ...(c.coordinatorPhone ? [{ icon: <Phone className="w-4 h-4" />, label: 'Phone', value: c.coordinatorPhone }] : []),
        { icon: <DoorOpen className="w-4 h-4" />, label: 'Room', value: c.room || '—' },
        { icon: <Layers className="w-4 h-4" />, label: 'Floor', value: String(c.floor ?? 0) },
        { icon: <MapPin className="w-4 h-4" />, label: 'Node', value: formatNodeName(c.linkedNode) },
      ],
    }));
    if (type === 'event') {
      const isStudent = data.role === 'student';
      const now = Date.now();
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);
      const filtered = events
        .filter(e => (!data.role ? (e.forStudents || e.forOthers) : isStudent ? e.forStudents : e.forOthers))
        .filter(e => {
          if (festFilter === 'all') return true;
          if (festFilter === 'none') return !(e.fest || '').trim();
          return (e.fest || '').trim().toLowerCase() === festFilter.toLowerCase();
        })
        .filter(e => {
          const start = getEventStartDateTime(e) ? new Date(getEventStartDateTime(e)).getTime() : 0;
          const end = getEventEndDateTime(e) ? new Date(getEventEndDateTime(e)).getTime() : 0;
          if (eventCategory === 'current') {
            // Happening now OR scheduled today
            if (start && end && now >= start && now <= end) return true;
            if (start >= startOfToday.getTime() && start <= endOfToday.getTime()) return true;
            return false;
          }
          // Upcoming: starts after today
          return start > endOfToday.getTime();
        })
        .filter(e => {
          if (!eventSearchLower) return true;
          const hay = `${e.name} ${e.fest || ''} ${e.venue} ${e.room || ''}`.toLowerCase();
          return hay.includes(eventSearchLower);
        });
      return sortByDateThenText(filtered, getEventStartDateTime, e => e.name)
        .map(e => ({
          id: e.id,
          label: `${e.name} — ${formatEventDateTime(getEventStartDateTime(e))}`,
          node: e.venue, room: e.room, floor: e.floor,
          meta: [
            { icon: <Calendar className="w-4 h-4" />, label: 'Event', value: e.name },
            ...(e.fest ? [{ icon: <Sparkles className="w-4 h-4" />, label: 'Fest', value: e.fest }] : []),
            { icon: <Calendar className="w-4 h-4" />, label: 'Starts', value: formatEventDateTime(getEventStartDateTime(e)) },
            { icon: <Calendar className="w-4 h-4" />, label: 'Ends', value: formatEventDateTime(getEventEndDateTime(e)) },
            { icon: <MapPin className="w-4 h-4" />, label: 'Venue', value: formatNodeName(e.venue) },
            { icon: <DoorOpen className="w-4 h-4" />, label: 'Room', value: e.room || '—' },
            { icon: <Layers className="w-4 h-4" />, label: 'Floor', value: String(e.floor ?? 0) },
            ...(e.studentCoordinatorName ? [{ icon: <UserCircle className="w-4 h-4" />, label: 'Student Coordinator', value: `${e.studentCoordinatorName}${e.studentCoordinatorPhone ? ` (${e.studentCoordinatorPhone})` : ''}` }] : []),
            ...(e.facultyCoordinatorName ? [{ icon: <UserCircle className="w-4 h-4" />, label: 'Faculty Coordinator', value: `${e.facultyCoordinatorName}${e.facultyCoordinatorPhone ? ` (${e.facultyCoordinatorPhone})` : ''}` }] : []),
          ],
        }));
    }
    return [];
  }, [data.destinationType, data.role, staff, labs, clubs, events, points, eventSearchLower, festFilter, eventCategory]);

  // Generic search across every destination type (label + all detail values)
  const visibleOptions = useMemo(() => {
    if (!eventSearchLower) return destOptions;
    return destOptions.filter(opt => {
      const hay = `${opt.label} ${opt.node} ${opt.room || ''} ${opt.meta.map(m => `${m.label} ${m.value}`).join(' ')}`.toLowerCase();
      return hay.includes(eventSearchLower);
    });
  }, [destOptions, eventSearchLower]);


  const destTypes = useMemo(() => {
    const isStudent = data.role === 'student';
    const types: { value: string; label: string }[] = [
      { value: 'principal', label: 'Officers' },
      { value: 'dean', label: 'Dean' },
      { value: 'hod', label: 'HOD' },
      ...(isStudent ? [] : [{ value: 'staff', label: 'Staff' }]),
      { value: 'reception', label: 'Reception' },
      ...(isStudent ? [] : [{ value: 'admission', label: 'Admission' }]),
    ];
    if (isStudent) {
      types.push({ value: 'lab', label: `🧪 ${t('destType.lab')}` });
      types.push({ value: 'club', label: `🎨 ${t('destType.club')}` });
      types.push({ value: 'event', label: `🎉 ${t('destType.event')}` });
    } else {
      types.push({ value: 'event', label: `🎉 ${t('destType.event')}` });
    }
    // Prepend emojis to base types
    const emojiMap: Record<string,string> = {
      principal: '🎓', dean: '🏛️', hod: '👨‍🏫', staff: '👥',
      reception: '📞', admission: '📝',
    };
    return types.map(t => emojiMap[t.value] ? { ...t, label: `${emojiMap[t.value]} ${t.label}` } : t);
  }, [data.role, t]);

  const totalSteps = 3;

  const canProceed = () => {
    if (step === 0) return !!data.role;
    if (step === 1) {
      if (data.role === 'student') return true;
      if (data.role === 'parent') return !!data.name && !!data.studentName;
      return !!data.name;
    }
    if (step === 2) return !!data.destinationType && !!data.selectedId;
    return true;
  };

  const handleNext = () => {
    if (step === totalSteps - 1) {
      const selected = destOptions.find(d => d.id === data.selectedId);
      if (!selected) { setError(t('wizard.errorSelect')); return; }
      setError('');
      onComplete({
        ...data,
        selectedLabel: selected.label,
        destination: selected.node,
        room: selected.room,
        floor: selected.floor,
      });
      return;
    }
    advanceTo(step + 1);
  };

  const handleBack = () => {
    if (step === 0) return;
    advanceTo(step - 1);
  };

  const selectOptionAndNavigate = (opt: DestOption) => {
    setDetailOption(null);
    setListOpen(false);
    const next: UserFlowData = {
      ...data,
      selectedId: opt.id,
      selectedLabel: opt.label,
      destination: opt.node,
      room: opt.room,
      floor: opt.floor,
    };
    // Picked straight from a fest category on the first page: start
    // navigation immediately — no role/details/destination steps needed.
    if (step === 0) {
      onComplete({ ...next, role: next.role || 'others' });
      return;
    }
    if (!next.role) {
      setData(next);
      setPickedNote(`Selected: ${opt.label}`);
      advanceTo(0);
      return;
    }
    onComplete(next);
  };

  return (
    <div className="mobile-screen flex flex-col relative">
      {/* Animated background layer */}
      <div className="animated-bg" aria-hidden="true">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
        <div className="spark" style={{ top: '15%', left: '20%', animationDelay: '0s' }} />
        <div className="spark" style={{ top: '25%', right: '18%', animationDelay: '1.2s' }} />
        <div className="spark" style={{ top: '65%', left: '12%', animationDelay: '2.1s' }} />
        <div className="spark" style={{ bottom: '20%', right: '25%', animationDelay: '0.6s' }} />
        <div className="spark" style={{ top: '45%', left: '80%', animationDelay: '3s' }} />
        <div className="spark" style={{ top: '80%', left: '45%', animationDelay: '1.8s' }} />
      </div>
      {/* Top bar — sticky, with quick actions */}
      <div className="safe-top sticky top-0 z-10 flex w-full items-center justify-between gap-1.5 border-b border-border/60 bg-card/70 backdrop-blur-xl px-2 py-2 shadow-soft">
        <Button variant="outline" size="sm" className="h-10 shrink-0 px-2.5" onClick={onOpenMap}>
          <MapIcon className="w-4 h-4 sm:mr-1" />
          <span className="hidden sm:inline text-xs">🗺️ {t('wizard.openMap')}</span>
        </Button>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
          <LanguageMenu className="min-w-0" />
          {isAdmin ? (
            <Button variant="outline" size="sm" className="h-10 shrink-0 px-2.5" onClick={onOpenEditor}>
              <Shield className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline text-xs">🛡️ {t('wizard.editorMode')}</span>
            </Button>
          ) : (
            loginSlot
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-start sm:justify-center px-3 pt-3 pb-24 sm:px-4 sm:pt-4 sm:pb-4">
      <Card className="w-full max-w-md sm:shadow-elegant border-0 sm:border bg-card/90 backdrop-blur-xl rounded-xl sm:rounded-2xl overflow-hidden">
        <CardHeader className="px-4 pt-4 text-center pb-2 sm:px-6 sm:pt-6">
          <div className="mx-auto mb-1.5 w-20 h-20 sm:mb-2 sm:w-24 sm:h-24 rounded-xl sm:rounded-2xl bg-card flex items-center justify-center shadow-elegant overflow-hidden p-2">
            <img src="/favicon.png" alt="Aditya University" className="h-full w-full object-contain" />
          </div>
          <CardTitle className="text-xl sm:text-2xl text-gradient font-bold flex items-center justify-center gap-1.5">
            <span>✨ {appTitle}</span>
            {isAdmin && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 shrink-0"
                title="Change app name"
                onClick={() => { setTitleDraft(appTitle); setTitleOpen(true); }}
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
            )}
          </CardTitle>
          <Dialog open={titleOpen} onOpenChange={setTitleOpen}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>App name</DialogTitle>
                <DialogDescription>This name is shown at the top for everyone.</DialogDescription>
              </DialogHeader>
              <Input
                value={titleDraft}
                onChange={e => setTitleDraft(e.target.value)}
                placeholder="Campus Navigator"
                onKeyDown={e => { if (e.key === 'Enter') void handleSaveTitle(); }}
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setTitleOpen(false)}>Cancel</Button>
                <Button onClick={() => void handleSaveTitle()} disabled={savingTitle || !titleDraft.trim()}>
                  {savingTitle ? 'Saving...' : 'Save'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <p className="text-sm text-muted-foreground">{t('wizard.step', { current: step + 1, total: totalSteps })}</p>
          <div className="flex gap-1 justify-center mt-2">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div key={i} className={`h-1.5 w-10 rounded-full transition-all ${i <= step ? 'bg-gradient-primary' : 'bg-muted'}`} />
            ))}
          </div>
        </CardHeader>

        <CardContent className="space-y-3 px-4 pb-4 sm:space-y-4 sm:px-6 sm:pb-6">
          {step === 0 && (
            <div className="space-y-3">
              {firstPageFests.length > 0 && (
                <div className="space-y-2">
                  {firstPageFests.map(f => (
                    <button
                      key={f.fest}
                      onClick={() => openFest(f)}
                      className="w-full rounded-xl border-2 border-transparent bg-gradient-primary px-4 py-4 text-left text-primary-foreground shadow-elegant transition-all active:scale-[0.98] hover:-translate-y-0.5"
                    >
                      <span className="block text-base font-bold">{f.fest}</span>
                      <span className="block text-xs opacity-90">
                        {f.total} event{f.total > 1 ? 's' : ''} · tap to view
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {pickedNote && (
                <p className="text-xs text-center text-primary font-medium">{pickedNote}</p>
              )}
              <p className="text-base font-medium text-center">👋 {t('wizard.who')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { value: 'student', label: t('wizard.role.student'), icon: GraduationCap, emoji: '🎓' },
                  { value: 'parent', label: t('wizard.role.parent'), icon: Users, emoji: '👨‍👩‍👧' },
                  { value: 'others', label: t('wizard.role.others'), icon: User, emoji: '🧑' },
                ].map(({ value, label, icon: Icon, emoji }) => (
                  <div key={value} onClick={() => { update('role', value); advanceTo(1); }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { update('role', value); advanceTo(1); } }}
                    className={`flex cursor-pointer items-center sm:flex-col gap-3 p-4 sm:p-5 rounded-xl border-2 transition-all min-h-[64px] active:scale-[0.98] hover:-translate-y-0.5 hover:shadow-elegant ${data.role === value ? 'border-primary bg-gradient-to-br from-primary/10 to-accent shadow-soft' : 'border-border hover:border-primary/50 bg-card'}`}
                  >
                    <span className="text-3xl shrink-0">{emoji}</span>
                    <span className="text-base sm:text-sm font-semibold">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 1 && data.role === 'student' && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-center">📚 {t('wizard.basicDetails')}</p>
              <select value={data.department} onChange={e => update('department', e.target.value)} className={fieldClassName} autoFocus>
                <option value="">{t('wizard.selectBranch')}</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select value={data.year} onChange={e => update('year', e.target.value)} className={fieldClassName}>
                <option value="">{t('wizard.selectYear')}</option>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          )}

          {step === 1 && data.role === 'parent' && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-center">👨‍👩‍👧 {t('wizard.basicDetails')}</p>
              <Input value={data.name} onChange={e => update('name', e.target.value)} placeholder={t('wizard.yourName')} autoFocus />
              <Input value={data.studentName} onChange={e => update('studentName', e.target.value)} placeholder={t('wizard.studentName')} />
              <select value={data.studentDepartment} onChange={e => update('studentDepartment', e.target.value)} className={fieldClassName}>
                <option value="">{t('wizard.selectStudentBranch')}</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <Input value={data.purpose} onChange={e => update('purpose', e.target.value)} placeholder={t('wizard.purpose')} />
            </div>
          )}

          {step === 1 && data.role === 'others' && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-center">🧑 {t('wizard.basicDetails')}</p>
              <Input value={data.name} onChange={e => update('name', e.target.value)} placeholder={t('wizard.fullName')} autoFocus />
              <Input value={data.purpose} onChange={e => update('purpose', e.target.value)} placeholder={t('wizard.purpose')} />
            </div>
          )}


          {step === 2 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-base font-medium">📍 {t('wizard.where')}</p>
                {isAdmin && (
                  <Button variant="ghost" size="sm" className="text-xs h-6" onClick={onOpenEditor}>{t('wizard.editData')}</Button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {destTypes.map(typeOpt => (
                  <button key={typeOpt.value} onClick={() => { update('destinationType', typeOpt.value); setEventSearch(''); setListOpen(true); }}
                    className={`rounded-xl border-2 px-3 py-3 text-sm font-semibold transition-all min-h-[48px] active:scale-[0.98] hover:-translate-y-0.5 ${
                      data.destinationType === typeOpt.value
                        ? 'border-transparent bg-gradient-primary text-primary-foreground shadow-elegant'
                        : 'border-border bg-card text-foreground hover:border-primary/50'
                    }`}
                  >
                    {typeOpt.label}
                  </button>
                ))}
              </div>

              {data.destinationType ? (
                destOptions.length === 0 ? (
                  <div className="text-xs text-muted-foreground text-center py-4">
                    {t('wizard.noRecords')}
                  </div>
                ) : (
                  <Button variant="outline" className="w-full h-11 text-sm" onClick={() => setListOpen(true)}>
                    📋 View {destOptions.length} option{destOptions.length > 1 ? 's' : ''}
                  </Button>
                )
              ) : null}
            </div>
          )}


          {error && (
            <div className="flex items-center gap-2 text-destructive text-xs">
              <AlertCircle className="w-4 h-4" />
              <p>{error}</p>
            </div>
          )}

          {/* Inline nav for tablets / desktop */}
          <div className="hidden sm:flex justify-between pt-2">
            <Button variant="outline" onClick={handleBack} disabled={step === 0}>
              <ArrowLeft className="w-4 h-4 mr-1" /> {t('wizard.back')}
            </Button>
            <Button onClick={handleNext} disabled={!canProceed()} className="bg-gradient-primary hover:opacity-90 text-primary-foreground shadow-elegant">
              {step < totalSteps - 1 ? <>{t('wizard.next')} <ArrowRight className="w-4 h-4 ml-1" /></> : <>🚀 {t('wizard.openNavigate')} <ArrowRight className="w-4 h-4 ml-1" /></>}
            </Button>
          </div>
        </CardContent>
      </Card>
      </div>

      {/* Sticky bottom action bar — mobile only, big tap targets */}
      <div className="sm:hidden fixed bottom-0 inset-x-0 z-20 border-t border-border/60 bg-card/90 backdrop-blur-xl px-3 py-3 flex gap-2 safe-bottom shadow-soft">
        <Button variant="outline" className="flex-1 h-12 text-base" onClick={handleBack} disabled={step === 0}>
          <ArrowLeft className="w-5 h-5 mr-1" /> {t('wizard.back')}
        </Button>
        <Button className="flex-1 h-12 text-base bg-gradient-primary hover:opacity-90 text-primary-foreground shadow-elegant" onClick={handleNext} disabled={!canProceed()}>
          {step < totalSteps - 1 ? <>{t('wizard.next')} <ArrowRight className="w-5 h-5 ml-1" /></> : <>🚀 {t('wizard.openNavigate')} <ArrowRight className="w-5 h-5 ml-1" /></>}
        </Button>
      </div>

      {/* Member list popup — pick one to navigate directly */}
      <Dialog open={listOpen} onOpenChange={setListOpen}>
        <DialogContent className="grid max-h-[calc(100dvh-1rem)] grid-rows-[auto_auto_auto_minmax(0,1fr)] sm:max-w-lg bg-card/95 backdrop-blur-xl border border-border/60 rounded-xl sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {destTypes.find(dt => dt.value === data.destinationType)?.label || '📍 Select'}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Tap any card to start navigation right away.
            </DialogDescription>
          </DialogHeader>
          {data.destinationType === 'event' && (
            <div className="space-y-2 -mt-2">
              <div className="flex gap-2">
                {[
                  { v: 'current' as const, l: 'Current / Today' },
                  { v: 'upcoming' as const, l: 'Upcoming' },
                ].map(c => (
                  <button
                    key={c.v}
                    type="button"
                    onClick={() => { setEventCategory(c.v); setFestFilter('all'); }}
                    className={`flex-1 rounded-xl border-2 px-3 py-2 text-xs font-semibold transition-all active:scale-95 ${eventCategory === c.v ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}
                  >
                    {c.l}
                  </button>
                ))}
              </div>
              {festNames.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {festNames.map(n => ({ v: n, l: n })).map(c => (
                    <button
                      key={c.v}
                      type="button"
                      onClick={() => setFestFilter(f => f === c.v ? 'all' : c.v)}
                      className={`rounded-full border-2 px-3 py-1.5 text-xs font-medium transition-all active:scale-95 ${festFilter === c.v ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}
                    >
                      {c.l}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="space-y-2 -mt-1">
            <Input
              value={eventSearch}
              onChange={e => setEventSearch(e.target.value)}
              placeholder="SEARCH"
              className="h-11"
              autoFocus
            />
            {eventSearch.trim() && (
              <p className="text-xs text-muted-foreground text-center">
                {visibleOptions.length} result{visibleOptions.length === 1 ? '' : 's'} found
              </p>
            )}
          </div>
           <div className="min-h-0 space-y-2 overflow-y-auto overscroll-contain pr-1 py-1">
            {visibleOptions.map(opt => (

              <button
                key={opt.id}
                type="button"
                onClick={() => selectOptionAndNavigate(opt)}
                className="w-full text-left rounded-xl border-2 border-border bg-background/60 p-3 transition-all active:scale-[0.99] hover:border-primary/60 hover:-translate-y-0.5"
              >
                <span className="font-semibold block text-sm">{opt.label}</span>
                <div className="mt-1 space-y-0.5">
                  {opt.meta.map((m, i) => (
                    <p key={i} className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <span className="text-primary shrink-0">{m.icon}</span>
                      <span className="truncate">{m.label}: {m.value}</span>
                    </p>
                  ))}
                </div>
                <span className="mt-1.5 inline-block text-xs font-medium text-primary">Tap to navigate</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail popup for selected destination */}
      <Dialog open={!!detailOption} onOpenChange={open => { if (!open) setDetailOption(null); }}>
        <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-xl border border-border/60 rounded-xl sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg">{detailOption?.label}</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Review details and start navigation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {detailOption?.meta.map((m, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/60 p-3">
                <div className="mt-0.5 text-primary">{m.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">{m.label}</p>
                  <p className="text-sm font-medium break-words">{m.value}</p>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setDetailOption(null)}>Cancel</Button>
            {detailOption && (
              <Button className="w-full sm:w-auto bg-gradient-primary hover:opacity-90 text-primary-foreground shadow-elegant" onClick={() => selectOptionAndNavigate(detailOption)}>
                🚀 Select & Navigate
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
