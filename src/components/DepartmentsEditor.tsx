import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, GraduationCap, Loader2 } from 'lucide-react';
import { useDepartments, saveDepartments } from '@/lib/departments';
import { sortNames } from '@/lib/sorting';
import { toast } from 'sonner';

export function DepartmentsEditor() {
  const departments = useDepartments();
  const [newDept, setNewDept] = useState('');
  const [saving, setSaving] = useState(false);

  const persist = async (list: string[]) => {
    setSaving(true);
    try {
      await saveDepartments(list);
      toast.success('Departments updated');
    } catch {
      toast.error('Could not save departments');
    } finally {
      setSaving(false);
    }
  };

  const add = () => {
    const name = newDept.trim();
    if (!name) return;
    if (departments.some(d => d.toLowerCase() === name.toLowerCase())) {
      toast.error('That department already exists');
      return;
    }
    setNewDept('');
    persist([...departments, name]);
  };

  const remove = (name: string) => {
    if (departments.length <= 1) {
      toast.error('Keep at least one department');
      return;
    }
    persist(departments.filter(d => d !== name));
  };

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-2">
        <GraduationCap className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">🎓 Departments / Branches</h3>
        {saving && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
      </div>
      <p className="text-xs text-muted-foreground">
        Added branches appear everywhere — student/parent forms, staff and labs editors.
      </p>

      <div className="flex gap-2">
        <Input
          value={newDept}
          onChange={e => setNewDept(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') add(); }}
          placeholder="e.g. Agriculture, MBA, Nursing"
          className="h-10 text-sm"
        />
        <Button onClick={add} disabled={!newDept.trim() || saving} className="h-10 shrink-0">
          <Plus className="w-4 h-4 mr-1" /> Add
        </Button>
      </div>

      <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1">
        {sortNames(departments).map(d => (
          <div key={d} className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
            <span className="text-sm font-medium truncate">{d}</span>
            <Button variant="ghost" size="sm" className="h-8 px-2 text-destructive" onClick={() => remove(d)} disabled={saving}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
