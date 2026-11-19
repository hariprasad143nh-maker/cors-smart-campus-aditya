import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Edit2, Check, X, Users } from 'lucide-react';
import type { ClubRecord } from '@/lib/campus-extra-data';
import { generateId } from '@/lib/campus-extra-data';
import { sortNames, groupThenSort } from '@/lib/sorting';
import { ImportDataDialog } from '@/components/ImportDataDialog';

const CLUB_TYPES: ClubRecord['type'][] = ['Technical', 'Cultural', 'Sports', 'Social', 'Other'];

interface Props {
  clubs: ClubRecord[];
  onUpdate: (clubs: ClubRecord[]) => void;
  mapNodes: string[];
}

export function ClubsEditor({ clubs, onUpdate, mapNodes }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<Partial<ClubRecord>>({ name: '', type: 'Technical', linkedNode: '', room: '', floor: 0, coordinatorName: '', coordinatorPhone: '' });

  const formatName = (n: string) => n.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const visibleNodes = sortNames(mapNodes.filter(n => !n.startsWith('j_')));
  const sortedClubs = groupThenSort(clubs, c => c.type || '', c => c.name, CLUB_TYPES);

  const resetForm = () => { setForm({ name: '', type: 'Technical', linkedNode: '', room: '', floor: 0, coordinatorName: '', coordinatorPhone: '' }); setShowAdd(false); setEditingId(null); };

  const handleAdd = () => {
    if (!form.name || !form.linkedNode || !form.room) return;
    onUpdate([...clubs, {
      id: generateId('club'),
      name: form.name!,
      type: form.type as ClubRecord['type'] || 'Other',
      linkedNode: form.linkedNode!,
      room: form.room!,
      floor: form.floor || 0,
      ...(form.coordinatorName?.trim() ? { coordinatorName: form.coordinatorName.trim() } : {}),
      ...(form.coordinatorPhone?.trim() ? { coordinatorPhone: form.coordinatorPhone.trim() } : {}),
    }]);
    resetForm();
  };

  const handleEdit = (c: ClubRecord) => { setEditingId(c.id); setForm({ ...c }); setShowAdd(true); };
  const handleSaveEdit = () => {
    if (!editingId || !form.name || !form.linkedNode || !form.room) return;
    onUpdate(clubs.map(c => c.id === editingId ? { ...c, ...form } as ClubRecord : c));
    resetForm();
  };

  return (
    <div className="p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Clubs</h3>
        </div>
        <span className="text-xs text-muted-foreground">{clubs.length} records</span>
      </div>

      <ImportDataDialog type="clubs" records={clubs} mapNodes={mapNodes} onUpdate={onUpdate} />

      <div className="space-y-1 max-h-48 overflow-y-auto">
        {clubs.length === 0 && <p className="text-xs text-muted-foreground">No clubs yet.</p>}
        {sortedClubs.map(c => (
          <div key={c.id} className="flex items-center justify-between p-1.5 rounded bg-muted/50 text-xs">
            <div>
              <p className="font-medium text-foreground">{c.name}</p>
              <p className="text-muted-foreground">{c.type} • Room {c.room} • F{c.floor}</p>
              {(c.coordinatorName || c.coordinatorPhone) && (
                <p className="text-muted-foreground">
                  {c.coordinatorName || '—'}{c.coordinatorPhone ? ` • ${c.coordinatorPhone}` : ''}
                </p>
              )}
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleEdit(c)}><Edit2 className="w-3 h-3" /></Button>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => onUpdate(clubs.filter(x => x.id !== c.id))}><Trash2 className="w-3 h-3" /></Button>
            </div>
          </div>
        ))}
      </div>

      {showAdd ? (
        <div className="space-y-1.5 border rounded-md p-2 bg-muted/50">
          <p className="text-xs font-medium">{editingId ? 'Edit Club' : 'Add Club'}</p>
          <Input value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Club name" className="h-7 text-xs" />
          <Select value={form.type || 'Technical'} onValueChange={v => setForm(f => ({ ...f, type: v as any }))}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{CLUB_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={form.linkedNode || ''} onValueChange={v => setForm(f => ({ ...f, linkedNode: v }))}>
            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Location" /></SelectTrigger>
            <SelectContent>{visibleNodes.map(n => <SelectItem key={n} value={n}>{formatName(n)}</SelectItem>)}</SelectContent>
          </Select>
          <div className="flex gap-1">
            <Input value={form.room || ''} onChange={e => setForm(f => ({ ...f, room: e.target.value }))} placeholder="Room no." className="h-7 text-xs flex-1" />
            <Input value={form.floor ?? ''} onChange={e => setForm(f => ({ ...f, floor: parseInt(e.target.value) || 0 }))} placeholder="Floor" className="h-7 text-xs w-16" />
          </div>
          <Input value={form.coordinatorName || ''} onChange={e => setForm(f => ({ ...f, coordinatorName: e.target.value }))} placeholder="Coordinator name (optional)" className="h-7 text-xs" />
          <Input value={form.coordinatorPhone || ''} onChange={e => setForm(f => ({ ...f, coordinatorPhone: e.target.value }))} placeholder="Coordinator phone (optional)" className="h-7 text-xs" inputMode="tel" />
          <div className="flex gap-1">
            <Button size="sm" className="h-7 text-xs flex-1" onClick={editingId ? handleSaveEdit : handleAdd}>
              <Check className="w-3 h-3 mr-1" /> {editingId ? 'Save' : 'Add'}
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={resetForm}><X className="w-3 h-3" /></Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" className="w-full h-7 text-xs" onClick={() => setShowAdd(true)}>
          <Plus className="w-3 h-3 mr-1" /> Add Club
        </Button>
      )}
    </div>
  );
}
