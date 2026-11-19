import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus, Trash2, Edit2, Check, X, Shield } from 'lucide-react';
import type { StaffRecord } from '@/lib/staff-data';
import { generateStaffId } from '@/lib/staff-data';
import { useDepartments } from '@/lib/departments';
import { sortNames, groupThenSort } from '@/lib/sorting';
import { ImportDataDialog } from '@/components/ImportDataDialog';

interface StaffDataEditorProps {
  staff: StaffRecord[];
  onUpdate: (staff: StaffRecord[]) => void;
  mapNodes: string[];
}

const DESIGNATIONS: StaffRecord['designation'][] = ['HOD', 'Dean', 'Principal', 'Vice Principal', 'Professor', 'Dignitary', 'Other'];

// Display order for grouped sections.
const GROUP_ORDER: StaffRecord['designation'][] = ['Principal', 'Vice Principal', 'Dean', 'HOD', 'Professor', 'Dignitary', 'Other'];

// Display labels — "Principal" is shown as "Officers" across the app.
const DESIGNATION_LABELS: Partial<Record<StaffRecord['designation'], string>> = {
  Principal: 'Officers',
  'Vice Principal': 'Vice Officers',
};
const labelFor = (d: StaffRecord['designation']) => DESIGNATION_LABELS[d] ?? d;

export function StaffDataEditor({ staff, onUpdate, mapNodes }: StaffDataEditorProps) {
  const DEPARTMENTS = useDepartments();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<Partial<StaffRecord>>({
    name: '', designation: 'HOD', department: '', phone: '', email: '',
    linkedNode: '', room: '', floor: 0,
  });

  const formatName = (n: string) => n.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const resetForm = () => {
    setForm({ name: '', designation: 'HOD', department: '', phone: '', email: '', linkedNode: '', room: '', floor: 0 });
    setShowAdd(false);
    setEditingId(null);
  };

  const handleAdd = () => {
    if (!form.name || !form.linkedNode || !form.room) return;
    const newStaff: StaffRecord = {
      id: generateStaffId(),
      name: form.name || '',
      designation: (form.designation as StaffRecord['designation']) || 'Other',
      department: form.department,
      phone: form.phone,
      email: form.email,
      linkedNode: form.linkedNode || '',
      room: form.room || '',
      floor: form.floor || 0,
    };
    onUpdate([...staff, newStaff]);
    resetForm();
  };

  const handleEdit = (s: StaffRecord) => {
    setEditingId(s.id);
    setForm({ ...s });
    setShowAdd(true);
  };

  const handleSaveEdit = () => {
    if (!editingId || !form.name || !form.linkedNode || !form.room) return;
    onUpdate(staff.map(s => s.id === editingId ? { ...s, ...form } as StaffRecord : s));
    resetForm();
  };

  const handleDelete = (id: string) => {
    onUpdate(staff.filter(s => s.id !== id));
  };

  const visibleNodes = sortNames(mapNodes.filter(n => !n.startsWith('j_')));

  // Group by designation, then within each group sort by department (A→Z), then name.
  const grouped = GROUP_ORDER
    .map(desig => ({
      desig,
      items: groupThenSort(
        staff.filter(s => s.designation === desig),
        s => s.department || '',
        s => s.name,
      ),
    }))
    .filter(g => g.items.length > 0);

  return (
    <div className="p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Staff & Dignitaries</h3>
        </div>
        <span className="text-xs text-muted-foreground">{staff.length} records</span>
      </div>

      <ImportDataDialog type="staff" records={staff} mapNodes={mapNodes} onUpdate={onUpdate} />

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {staff.length === 0 && (
          <p className="text-xs text-muted-foreground">No staff records yet.</p>
        )}
        {grouped.map(group => (
          <div key={group.desig} className="space-y-1">
            <div className="sticky top-0 z-10 flex items-center justify-between bg-background/95 backdrop-blur px-1 py-0.5 border-b border-border/60">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">{labelFor(group.desig)}</p>
              <span className="text-[10px] text-muted-foreground">{group.items.length}</span>
            </div>
            {group.items.map(s => (
              <div key={s.id} className="flex items-center justify-between p-1.5 rounded bg-muted/50 text-xs">
                <div>
                  <p className="font-medium text-foreground">{s.name}</p>
                  <p className="text-muted-foreground">
                    {s.department ? `${s.department} • ` : ''}Room {s.room} • F{s.floor}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleEdit(s)}>
                    <Edit2 className="w-3 h-3" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleDelete(s.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {showAdd ? (
        <div className="space-y-1.5 border rounded-md p-2 bg-muted/50">
          <p className="text-xs font-medium">{editingId ? 'Edit Staff' : 'Add Staff'}</p>
          <Input value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Full name" className="h-7 text-xs" />

          <Select value={form.designation} onValueChange={v => setForm(f => ({ ...f, designation: v as any }))}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DESIGNATIONS.map(d => <SelectItem key={d} value={d}>{labelFor(d)}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={form.department || ''} onValueChange={v => setForm(f => ({ ...f, department: v }))}>
            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Department" /></SelectTrigger>
            <SelectContent>
              {DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>

          <Input value={form.phone || ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            placeholder="Phone (optional)" className="h-7 text-xs" />
          <Input value={form.email || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            placeholder="Email (optional)" className="h-7 text-xs" />

          <Select value={form.linkedNode || ''} onValueChange={v => setForm(f => ({ ...f, linkedNode: v }))}>
            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Location node" /></SelectTrigger>
            <SelectContent>
              {visibleNodes.map(n => <SelectItem key={n} value={n}>{formatName(n)}</SelectItem>)}
            </SelectContent>
          </Select>

          <div className="flex gap-1">
            <Input value={form.room || ''} onChange={e => setForm(f => ({ ...f, room: e.target.value }))}
              placeholder="Room no." className="h-7 text-xs flex-1" />
            <Input value={form.floor ?? ''} onChange={e => setForm(f => ({ ...f, floor: parseInt(e.target.value) || 0 }))}
              placeholder="Floor" className="h-7 text-xs w-16" />
          </div>

          <div className="flex gap-1">
            <Button size="sm" className="h-7 text-xs flex-1" onClick={editingId ? handleSaveEdit : handleAdd}>
              <Check className="w-3 h-3 mr-1" /> {editingId ? 'Save' : 'Add'}
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={resetForm}>
              <X className="w-3 h-3" />
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" className="w-full h-7 text-xs" onClick={() => setShowAdd(true)}>
          <UserPlus className="w-3 h-3 mr-1" /> Add Staff Record
        </Button>
      )}
    </div>
  );
}
