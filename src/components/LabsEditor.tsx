import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Edit2, Check, X, FlaskConical } from 'lucide-react';
import type { LabRecord } from '@/lib/campus-extra-data';
import { generateId } from '@/lib/campus-extra-data';
import { useDepartments } from '@/lib/departments';
import { sortNames, groupThenSort } from '@/lib/sorting';
import { ImportDataDialog } from '@/components/ImportDataDialog';

interface Props {
  labs: LabRecord[];
  onUpdate: (labs: LabRecord[]) => void;
  mapNodes: string[];
}

export function LabsEditor({ labs, onUpdate, mapNodes }: Props) {
  const DEPARTMENTS = useDepartments();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<Partial<LabRecord>>({ name: '', department: '', linkedNode: '', room: '', floor: 0 });

  const formatName = (n: string) => n.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const visibleNodes = sortNames(mapNodes.filter(n => !n.startsWith('j_')));
  const sortedLabs = groupThenSort(labs, l => l.department || '', l => l.name);

  const resetForm = () => { setForm({ name: '', department: '', linkedNode: '', room: '', floor: 0 }); setShowAdd(false); setEditingId(null); };

  const handleAdd = () => {
    if (!form.name || !form.linkedNode || !form.room) return;
    onUpdate([...labs, { id: generateId('lab'), name: form.name!, department: form.department || '', linkedNode: form.linkedNode!, room: form.room!, floor: form.floor || 0 }]);
    resetForm();
  };

  const handleEdit = (l: LabRecord) => { setEditingId(l.id); setForm({ ...l }); setShowAdd(true); };
  const handleSaveEdit = () => {
    if (!editingId || !form.name || !form.linkedNode || !form.room) return;
    onUpdate(labs.map(l => l.id === editingId ? { ...l, ...form } as LabRecord : l));
    resetForm();
  };

  return (
    <div className="p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Labs</h3>
        </div>
        <span className="text-xs text-muted-foreground">{labs.length} records</span>
      </div>

      <ImportDataDialog type="labs" records={labs} mapNodes={mapNodes} onUpdate={onUpdate} />

      <div className="space-y-1 max-h-48 overflow-y-auto">
        {labs.length === 0 && <p className="text-xs text-muted-foreground">No labs yet.</p>}
        {sortedLabs.map(l => (
          <div key={l.id} className="flex items-center justify-between p-1.5 rounded bg-muted/50 text-xs">
            <div>
              <p className="font-medium text-foreground">{l.name}</p>
              <p className="text-muted-foreground">{l.department} • Room {l.room} • F{l.floor}</p>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleEdit(l)}><Edit2 className="w-3 h-3" /></Button>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => onUpdate(labs.filter(x => x.id !== l.id))}><Trash2 className="w-3 h-3" /></Button>
            </div>
          </div>
        ))}
      </div>

      {showAdd ? (
        <div className="space-y-1.5 border rounded-md p-2 bg-muted/50">
          <p className="text-xs font-medium">{editingId ? 'Edit Lab' : 'Add Lab'}</p>
          <Input value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Lab name" className="h-7 text-xs" />
          <Select value={form.department || ''} onValueChange={v => setForm(f => ({ ...f, department: v }))}>
            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Department" /></SelectTrigger>
            <SelectContent>{DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={form.linkedNode || ''} onValueChange={v => setForm(f => ({ ...f, linkedNode: v }))}>
            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Location" /></SelectTrigger>
            <SelectContent>{visibleNodes.map(n => <SelectItem key={n} value={n}>{formatName(n)}</SelectItem>)}</SelectContent>
          </Select>
          <div className="flex gap-1">
            <Input value={form.room || ''} onChange={e => setForm(f => ({ ...f, room: e.target.value }))} placeholder="Room no." className="h-7 text-xs flex-1" />
            <Input value={form.floor ?? ''} onChange={e => setForm(f => ({ ...f, floor: parseInt(e.target.value) || 0 }))} placeholder="Floor" className="h-7 text-xs w-16" />
          </div>
          <div className="flex gap-1">
            <Button size="sm" className="h-7 text-xs flex-1" onClick={editingId ? handleSaveEdit : handleAdd}>
              <Check className="w-3 h-3 mr-1" /> {editingId ? 'Save' : 'Add'}
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={resetForm}><X className="w-3 h-3" /></Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" className="w-full h-7 text-xs" onClick={() => setShowAdd(true)}>
          <Plus className="w-3 h-3 mr-1" /> Add Lab
        </Button>
      )}
    </div>
  );
}
