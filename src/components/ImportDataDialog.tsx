import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, Upload, FileSpreadsheet, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import {
  downloadTemplate, headersFor, mergeRecords, parseRows, readSheet, TYPE_LABELS,
  type ImportType, type SkippedRow,
} from '@/lib/excel-import';
import { useDepartments, saveDepartments } from '@/lib/departments';

interface Props<T extends { id: string; name: string }> {
  type: ImportType;
  records: T[];
  mapNodes: string[];
  onUpdate: (records: T[]) => void;
}

export function ImportDataDialog<T extends { id: string; name: string }>({ type, records, mapNodes, onUpdate }: Props<T>) {
  const departments = useDepartments();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<T[]>([]);
  const [skipped, setSkipped] = useState<SkippedRow[]>([]);
  const [unknownDepts, setUnknownDepts] = useState<string[]>([]);
  const [addDepts, setAddDepts] = useState(true);

  const reset = () => { setParsed([]); setSkipped([]); setUnknownDepts([]); setFileName(''); };

  const handleFile = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const rows = await readSheet(file);
      const res = parseRows(type, rows, mapNodes, departments);
      setFileName(file.name);
      setParsed(res.valid as unknown as T[]);
      setSkipped(res.skipped);
      setUnknownDepts(res.unknownDepartments);
      setOpen(true);
      if (!res.valid.length) toast.error('No valid rows found in that file');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not read that file');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const apply = async (mode: 'add' | 'replace') => {
    if (unknownDepts.length && addDepts) {
      try {
        await saveDepartments([...departments, ...unknownDepts.filter(d => !departments.includes(d))]);
      } catch {
        toast.error('Could not save new departments');
      }
    }
    onUpdate(mergeRecords(records, parsed, mode));
    toast.success(mode === 'replace' ? `Replaced with ${parsed.length} records` : `Imported ${parsed.length} records`);
    setOpen(false);
    reset();
  };

  const cols = headersFor(type);

  return (
    <>
      <div className="flex gap-1">
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={e => handleFile(e.target.files?.[0])}
        />
        <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => fileRef.current?.click()} disabled={busy}>
          {busy ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Upload className="w-3 h-3 mr-1" />} Import Excel
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => downloadTemplate(type)}>
          <Download className="w-3 h-3 mr-1" /> Template
        </Button>
      </div>

      <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) reset(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileSpreadsheet className="w-4 h-4 text-primary" /> Import {TYPE_LABELS[type]}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-xs">
            <p className="text-muted-foreground truncate">{fileName}</p>
            <div className="flex gap-3">
              <span className="font-semibold text-primary">{parsed.length} valid</span>
              <span className="text-muted-foreground">{skipped.length} skipped</span>
            </div>

            {parsed.length > 0 && (
              <div className="max-h-52 overflow-auto rounded border border-border">
                <table className="w-full text-[11px]">
                  <thead className="sticky top-0 bg-muted">
                    <tr>{cols.map(c => <th key={c} className="px-2 py-1 text-left font-medium whitespace-nowrap">{c}</th>)}</tr>
                  </thead>
                  <tbody>
                    {parsed.slice(0, 50).map(r => {
                      const rec = r as unknown as Record<string, unknown>;
                      const map: Record<string, unknown> = {
                        Name: rec.name,
                        Designation: rec.designation,
                        Department: rec.department,
                        Phone: rec.phone,
                        Email: rec.email,
                        Location: rec.linkedNode,
                        Venue: rec.venue,
                        Room: rec.room,
                        Floor: rec.floor,
                        Type: rec.type,
                        'Coordinator Name': rec.coordinatorName,
                        'Coordinator Phone': rec.coordinatorPhone,
                         'Start Date/Time': rec.startDateTime || rec.date,
                         'End Date/Time': rec.endDateTime || rec.date,
                        'For Students': rec.forStudents ? 'Yes' : 'No',
                        'For Others': rec.forOthers ? 'Yes' : 'No',
                      };
                      return (
                        <tr key={r.id} className="border-t border-border/60">
                          {cols.map(c => <td key={c} className="px-2 py-1 whitespace-nowrap">{String(map[c] ?? '')}</td>)}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {skipped.length > 0 && (
              <div className="max-h-28 overflow-auto rounded border border-destructive/40 bg-destructive/5 p-2 space-y-0.5">
                {skipped.map(s => (
                  <p key={`${s.row}-${s.name}`} className="text-[11px] text-destructive">
                    Row {s.row} — {s.name}: {s.reason}
                  </p>
                ))}
              </div>
            )}

            {unknownDepts.length > 0 && (
              <label className="flex items-start gap-2 rounded border border-border p-2">
                <Checkbox checked={addDepts} onCheckedChange={v => setAddDepts(!!v)} className="mt-0.5" />
                <span className="text-[11px]">
                  <AlertTriangle className="inline w-3 h-3 mr-1 text-primary" />
                  New departments found: {unknownDepts.join(', ')}. Add them to the departments list.
                </span>
              </label>
            )}

            <div className="flex flex-col gap-1.5 sm:flex-row">
              <Button size="sm" className="h-8 text-xs flex-1" disabled={!parsed.length} onClick={() => apply('add')}>
                Add on top / update
              </Button>
              <Button size="sm" variant="destructive" className="h-8 text-xs flex-1" disabled={!parsed.length} onClick={() => apply('replace')}>
                Replace all
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { setOpen(false); reset(); }}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
