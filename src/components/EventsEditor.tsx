import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Edit2, Check, X, CalendarDays } from 'lucide-react';
import type { EventRecord } from '@/lib/campus-extra-data';
import { formatEventDateRange, generateId, getEventEndDateTime, getEventStartDateTime } from '@/lib/campus-extra-data';
import { sortNames, sortByDateThenText } from '@/lib/sorting';
import { ImportDataDialog } from '@/components/ImportDataDialog';
import { useAppSettings, saveFeaturedFests } from '@/lib/app-settings';

interface Props {
  events: EventRecord[];
  onUpdate: (events: EventRecord[]) => void;
  mapNodes: string[];
}

export function EventsEditor({ events, onUpdate, mapNodes }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<Partial<EventRecord>>({
    name: '', fest: '', startDateTime: '', endDateTime: '', venue: '', room: '', floor: 0,
    forStudents: true, forOthers: false,
    studentCoordinatorName: '', studentCoordinatorPhone: '', facultyCoordinatorName: '', facultyCoordinatorPhone: '',
  });
  const [formError, setFormError] = useState('');
  const { featuredFests } = useAppSettings();

  const formatName = (n: string) => n.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const visibleNodes = sortNames(mapNodes.filter(n => !n.startsWith('j_')));
  const sortedEvents = sortByDateThenText(events, getEventStartDateTime, e => e.name);
  const festNames = sortNames(Array.from(new Set(events.map(e => (e.fest || '').trim()).filter(Boolean))));

  const resetForm = () => {
    setForm({
      name: '', fest: '', startDateTime: '', endDateTime: '', venue: '', room: '', floor: 0,
      forStudents: true, forOthers: false,
      studentCoordinatorName: '', studentCoordinatorPhone: '', facultyCoordinatorName: '', facultyCoordinatorPhone: '',
    });
    setFormError('');
    setShowAdd(false);
    setEditingId(null);
  };

  const hasValidDateRange = () => {
    if (!form.startDateTime || !form.endDateTime) {
      setFormError('Add both a starting and ending date and time.');
      return false;
    }
    if (new Date(form.endDateTime).getTime() < new Date(form.startDateTime).getTime()) {
      setFormError('The ending date and time must be after the start.');
      return false;
    }
    return true;
  };

  const handleAdd = () => {
    if (!form.name || !form.venue || !hasValidDateRange()) return;
    onUpdate([...events, {
      id: generateId('evt'), name: form.name, fest: (form.fest || '').trim(), startDateTime: form.startDateTime, endDateTime: form.endDateTime, venue: form.venue,
      room: form.room || '', floor: form.floor || 0,
      forStudents: form.forStudents ?? true, forOthers: form.forOthers ?? false,
      studentCoordinatorName: form.studentCoordinatorName || '',
      studentCoordinatorPhone: form.studentCoordinatorPhone || '',
      facultyCoordinatorName: form.facultyCoordinatorName || '',
      facultyCoordinatorPhone: form.facultyCoordinatorPhone || '',
    }]);
    resetForm();
  };

  const handleEdit = (e: EventRecord) => {
    setEditingId(e.id);
    setForm({ ...e, startDateTime: getEventStartDateTime(e), endDateTime: getEventEndDateTime(e) });
    setFormError('');
    setShowAdd(true);
  };
  const handleSaveEdit = () => {
    if (!editingId || !form.name || !form.venue || !hasValidDateRange()) return;
    onUpdate(events.map(e => e.id === editingId ? { ...e, ...form } as EventRecord : e));
    resetForm();
  };

  return (
    <div className="p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Events</h3>
        </div>
        <span className="text-xs text-muted-foreground">{events.length} records</span>
      </div>

      <ImportDataDialog type="events" records={events} mapNodes={mapNodes} onUpdate={onUpdate} />

      {festNames.length > 0 && (
        <div className="space-y-1 border rounded-md p-2 bg-muted/40">
          <p className="text-xs font-medium text-foreground">Show fest on first page</p>
          <p className="text-[10px] text-muted-foreground">
            Turn one on to add a category with that fest's name on the first page. All off = normal first page.
          </p>
          {festNames.map(name => (
            <label key={name} className="flex items-center gap-2 text-xs cursor-pointer">
              <Checkbox
                checked={featuredFests.includes(name)}
                onCheckedChange={checked => {
                  const next = checked
                    ? sortNames([...featuredFests, name])
                    : featuredFests.filter(f => f !== name);
                  void saveFeaturedFests(next);
                }}
              />
              <span>{name}</span>
            </label>
          ))}
        </div>
      )}

      <div className="space-y-1 max-h-48 overflow-y-auto">
        {events.length === 0 && <p className="text-xs text-muted-foreground">No events yet.</p>}
        {sortedEvents.map(ev => (
          <div key={ev.id} className="flex items-center justify-between p-1.5 rounded bg-muted/50 text-xs">
            <div>
              <p className="font-medium text-foreground">{ev.name}</p>
              <p className="text-muted-foreground">
                {ev.fest ? `${ev.fest} • ` : ''}{formatEventDateRange(ev)} • {formatName(ev.venue)} {ev.room ? `• Room ${ev.room}` : ''} • F{ev.floor}
                {ev.forStudents ? ' 🎓' : ''}{ev.forOthers ? ' 👥' : ''}
                {ev.studentCoordinatorName ? ` • Student: ${ev.studentCoordinatorName}` : ''}
                {ev.facultyCoordinatorName ? ` • Faculty: ${ev.facultyCoordinatorName}` : ''}
              </p>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleEdit(ev)}><Edit2 className="w-3 h-3" /></Button>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => onUpdate(events.filter(x => x.id !== ev.id))}><Trash2 className="w-3 h-3" /></Button>
            </div>
          </div>
        ))}
      </div>

      {showAdd ? (
        <div className="space-y-1.5 border rounded-md p-2 bg-muted/50">
          <p className="text-xs font-medium">{editingId ? 'Edit Event' : 'Add Event'}</p>
          <Input value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Event name" className="h-7 text-xs" />
          <Input
            list="fest-name-options"
            value={form.fest || ''}
            onChange={e => setForm(f => ({ ...f, fest: e.target.value }))}
            placeholder="Fest name (optional, e.g. Tech Fest)"
            className="h-7 text-xs"
          />
          <datalist id="fest-name-options">
            {festNames.map(n => <option key={n} value={n} />)}
          </datalist>
           <div className="grid gap-1.5 sm:grid-cols-2">
             <label className="space-y-1 text-[11px] text-muted-foreground">
               <span>Start date & time</span>
               <Input type="datetime-local" value={form.startDateTime || ''} onChange={e => { setForm(f => ({ ...f, startDateTime: e.target.value })); setFormError(''); }} className="h-8 text-xs" />
             </label>
             <label className="space-y-1 text-[11px] text-muted-foreground">
               <span>End date & time</span>
               <Input type="datetime-local" min={form.startDateTime || undefined} value={form.endDateTime || ''} onChange={e => { setForm(f => ({ ...f, endDateTime: e.target.value })); setFormError(''); }} className="h-8 text-xs" />
             </label>
           </div>
          <Select value={form.venue || ''} onValueChange={v => setForm(f => ({ ...f, venue: v }))}>
            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Venue" /></SelectTrigger>
            <SelectContent>{visibleNodes.map(n => <SelectItem key={n} value={n}>{formatName(n)}</SelectItem>)}</SelectContent>
          </Select>
          <div className="flex gap-1">
            <Input value={form.room || ''} onChange={e => setForm(f => ({ ...f, room: e.target.value }))} placeholder="Room (optional)" className="h-7 text-xs flex-1" />
            <Input value={form.floor ?? ''} onChange={e => setForm(f => ({ ...f, floor: parseInt(e.target.value) || 0 }))} placeholder="Floor" className="h-7 text-xs w-16" />
          </div>
          <p className="text-[11px] font-medium text-muted-foreground pt-1">Student coordinator</p>
          <div className="flex gap-1">
            <Input value={form.studentCoordinatorName || ''} onChange={e => setForm(f => ({ ...f, studentCoordinatorName: e.target.value }))} placeholder="Name (optional)" className="h-7 text-xs flex-1" />
            <Input value={form.studentCoordinatorPhone || ''} onChange={e => setForm(f => ({ ...f, studentCoordinatorPhone: e.target.value }))} placeholder="Phone (optional)" className="h-7 text-xs flex-1" />
          </div>
          <p className="text-[11px] font-medium text-muted-foreground pt-1">Faculty coordinator</p>
          <div className="flex gap-1">
            <Input value={form.facultyCoordinatorName || ''} onChange={e => setForm(f => ({ ...f, facultyCoordinatorName: e.target.value }))} placeholder="Name (optional)" className="h-7 text-xs flex-1" />
            <Input value={form.facultyCoordinatorPhone || ''} onChange={e => setForm(f => ({ ...f, facultyCoordinatorPhone: e.target.value }))} placeholder="Phone (optional)" className="h-7 text-xs flex-1" />
          </div>
          <div className="flex gap-2 text-xs">
            <label className="flex items-center gap-1">
              <Checkbox checked={form.forStudents} onCheckedChange={v => setForm(f => ({ ...f, forStudents: !!v }))} /> For Students
            </label>
            <label className="flex items-center gap-1">
              <Checkbox checked={form.forOthers} onCheckedChange={v => setForm(f => ({ ...f, forOthers: !!v }))} /> For Others
            </label>
          </div>
           {formError && <p className="text-[11px] text-destructive">{formError}</p>}
          <div className="flex gap-1">
            <Button size="sm" className="h-7 text-xs flex-1" onClick={editingId ? handleSaveEdit : handleAdd}>
              <Check className="w-3 h-3 mr-1" /> {editingId ? 'Save' : 'Add'}
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={resetForm}><X className="w-3 h-3" /></Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" className="w-full h-7 text-xs" onClick={() => setShowAdd(true)}>
          <Plus className="w-3 h-3 mr-1" /> Add Event
        </Button>
      )}
    </div>
  );
}
