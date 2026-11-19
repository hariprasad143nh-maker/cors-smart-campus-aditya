import * as XLSX from 'xlsx';
import type { StaffRecord } from './staff-data';
import { generateStaffId } from './staff-data';
import type { LabRecord, ClubRecord, EventRecord } from './campus-extra-data';
import { generateId } from './campus-extra-data';

export type ImportType = 'staff' | 'labs' | 'clubs' | 'events';

export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_ROWS = 2000;

export interface SkippedRow {
  row: number;
  name: string;
  reason: string;
}

export interface ParseResult<T> {
  valid: T[];
  skipped: SkippedRow[];
  unknownDepartments: string[];
}

type Row = Record<string, unknown>;

const HEADERS: Record<ImportType, string[]> = {
  staff: ['Name', 'Designation', 'Department', 'Phone', 'Email', 'Location', 'Room', 'Floor'],
  labs: ['Name', 'Department', 'Location', 'Room', 'Floor'],
  clubs: ['Name', 'Type', 'Location', 'Room', 'Floor', 'Coordinator Name', 'Coordinator Phone'],
  events: ['Name', 'Fest', 'Start Date/Time', 'End Date/Time', 'Venue', 'Room', 'Floor', 'For Students', 'For Others', 'Student Coordinator Name', 'Student Coordinator Phone', 'Faculty Coordinator Name', 'Faculty Coordinator Phone'],
};

const SAMPLE: Record<ImportType, (string | number)[]> = {
  staff: ['Dr. A Kumar', 'HOD', 'CSE', '9876543210', 'hod.cse@example.edu', 'Main Block', '204', 2],
  labs: ['AI Lab', 'CSE', 'Main Block', '301', 3],
  clubs: ['Robotics Club', 'Technical', 'Main Block', '105', 1, 'S Rao', '9876543210'],
  events: ['Robo Race', 'Tech Fest', '2026-09-15 10:00', '2026-09-15 16:00', 'Auditorium', 'A1', 0, 'Yes', 'No', 'Ravi K', '9876543210', 'Dr. S Rao', '9123456780'],
};

export const TYPE_LABELS: Record<ImportType, string> = {
  staff: 'Staff / Officers',
  labs: 'Labs',
  clubs: 'Clubs',
  events: 'Events',
};

/** Column headers shown in the dialog preview and template. */
export const headersFor = (type: ImportType) => HEADERS[type];

export function downloadTemplate(type: ImportType) {
  const ws = XLSX.utils.aoa_to_sheet([HEADERS[type], SAMPLE[type]]);
  ws['!cols'] = HEADERS[type].map(h => ({ wch: Math.max(12, h.length + 4) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, TYPE_LABELS[type].slice(0, 28));
  XLSX.writeFile(wb, `${type}-template.xlsx`);
}

/** Read the first sheet of an .xlsx/.csv file into keyed rows. */
export async function readSheet(file: File): Promise<Row[]> {
  if (file.size > MAX_FILE_BYTES) throw new Error('File is larger than 2 MB');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) throw new Error('The file has no sheets');
  const rows = XLSX.utils.sheet_to_json<Row>(sheet, { defval: '', raw: false });
  if (rows.length > MAX_ROWS) throw new Error(`Too many rows (${rows.length}). Limit is ${MAX_ROWS}.`);
  return rows;
}

// ── helpers ──
const norm = (v: unknown) => String(v ?? '').trim();
const cap = (v: unknown, max = 160) => norm(v).slice(0, max);
const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

function pick(row: Row, ...names: string[]): string {
  const map = new Map(Object.keys(row).map(k => [key(k), k]));
  for (const n of names) {
    const hit = map.get(key(n));
    if (hit !== undefined) return norm(row[hit]);
  }
  return '';
}

const toFloor = (v: string) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
};

const toBool = (v: string, fallback = false) => {
  const s = v.toLowerCase();
  if (['yes', 'y', 'true', '1'].includes(s)) return true;
  if (['no', 'n', 'false', '0'].includes(s)) return false;
  return fallback;
};

function toDate(v: string): string {
  if (!v) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = new Date(v);
  if (isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function toDateTime(v: string, fallbackTime: string): string {
  if (!v) return '';
  const value = v.trim().replace(' ', 'T');
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T${fallbackTime}`;
  const isoMatch = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{1,2}):(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}T${isoMatch[2].padStart(2, '0')}:${isoMatch[3]}`;
  const d = new Date(v);
  if (isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const friendly = (node: string) => node.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

/** Match a location cell against node ids or their friendly display names. */
function matchNode(value: string, nodes: string[]): string | null {
  if (!value) return null;
  const want = key(value);
  for (const n of nodes) if (key(n) === want || key(friendly(n)) === want) return n;
  return null;
}

function matchDepartment(value: string, departments: string[]): string | null {
  if (!value) return null;
  const want = key(value);
  return departments.find(d => key(d) === want) ?? null;
}

const DESIGNATIONS: StaffRecord['designation'][] = ['HOD', 'Dean', 'Principal', 'Vice Principal', 'Professor', 'Dignitary', 'Other'];
const DESIGNATION_ALIASES: Record<string, StaffRecord['designation']> = {
  officers: 'Principal',
  officer: 'Principal',
  principal: 'Principal',
  viceofficers: 'Vice Principal',
  viceprincipal: 'Vice Principal',
};

const CLUB_TYPES: ClubRecord['type'][] = ['Technical', 'Cultural', 'Sports', 'Social', 'Other'];

export function parseRows(
  type: ImportType,
  rows: Row[],
  nodes: string[],
  departments: string[],
): ParseResult<StaffRecord | LabRecord | ClubRecord | EventRecord> {
  const valid: (StaffRecord | LabRecord | ClubRecord | EventRecord)[] = [];
  const skipped: SkippedRow[] = [];
  const unknownDepartments = new Set<string>();

  rows.forEach((row, i) => {
    const rowNo = i + 2; // header is row 1
    const name = cap(pick(row, 'Name'));
    if (!name) {
      skipped.push({ row: rowNo, name: '(blank)', reason: 'Missing name' });
      return;
    }

    const locRaw = pick(row, 'Location', 'Venue', 'Node');
    const node = matchNode(locRaw, nodes);
    if (!node) {
      skipped.push({ row: rowNo, name, reason: locRaw ? `Unknown location "${locRaw}"` : 'Missing location' });
      return;
    }

    const room = cap(pick(row, 'Room'), 24);
    const floor = toFloor(pick(row, 'Floor'));

    const deptRaw = pick(row, 'Department', 'Branch');
    let dept = '';
    if (deptRaw) {
      const matched = matchDepartment(deptRaw, departments);
      if (matched) dept = matched;
      else {
        dept = cap(deptRaw, 60);
        unknownDepartments.add(dept);
      }
    }

    if (type === 'staff') {
      const dRaw = pick(row, 'Designation', 'Role');
      const desig =
        DESIGNATIONS.find(d => key(d) === key(dRaw)) ?? DESIGNATION_ALIASES[key(dRaw)] ?? null;
      if (!desig) {
        skipped.push({ row: rowNo, name, reason: dRaw ? `Unknown designation "${dRaw}"` : 'Missing designation' });
        return;
      }
      valid.push({
        id: generateStaffId(),
        name,
        designation: desig,
        department: dept,
        phone: cap(pick(row, 'Phone', 'Mobile'), 20),
        email: cap(pick(row, 'Email'), 120),
        linkedNode: node,
        room,
        floor,
      } satisfies StaffRecord);
      return;
    }

    if (type === 'labs') {
      valid.push({ id: generateId('lab'), name, department: dept, linkedNode: node, room, floor } satisfies LabRecord);
      return;
    }

    if (type === 'clubs') {
      const tRaw = pick(row, 'Type', 'Category');
      const clubType = CLUB_TYPES.find(t => key(t) === key(tRaw)) ?? 'Other';
      const coordinatorName = cap(pick(row, 'Coordinator Name', 'Coordinator'), 80);
      const coordinatorPhone = cap(pick(row, 'Coordinator Phone', 'Coordinator Mobile'), 20);
      valid.push({
        id: generateId('club'),
        name,
        type: clubType,
        linkedNode: node,
        room,
        floor,
        ...(coordinatorName ? { coordinatorName } : {}),
        ...(coordinatorPhone ? { coordinatorPhone } : {}),
      } satisfies ClubRecord);
      return;
    }

    const legacyDate = toDate(pick(row, 'Date (YYYY-MM-DD)', 'Date'));
    const startDateTime = toDateTime(pick(row, 'Start Date/Time', 'Start Date', 'Start'), '00:00') || (legacyDate ? `${legacyDate}T00:00` : '');
    const endDateTime = toDateTime(pick(row, 'End Date/Time', 'End Date', 'End'), '23:59') || (legacyDate ? `${legacyDate}T23:59` : '');
    if (!startDateTime || !endDateTime) {
      skipped.push({ row: rowNo, name, reason: 'Missing or invalid start/end date and time' });
      return;
    }
    if (new Date(endDateTime).getTime() < new Date(startDateTime).getTime()) {
      skipped.push({ row: rowNo, name, reason: 'End date and time must be after the start' });
      return;
    }
    valid.push({
      id: generateId('evt'),
      name,
      startDateTime,
      endDateTime,
      venue: node,
      room,
      floor,
      forStudents: toBool(pick(row, 'For Students'), true),
      fest: String(pick(row, 'Fest', 'Fest Name', 'Category') ?? '').trim(),
      forOthers: toBool(pick(row, 'For Others'), false),
      studentCoordinatorName: cap(pick(row, 'Student Coordinator Name', 'Student Coordinator'), 80) || undefined,
      studentCoordinatorPhone: cap(pick(row, 'Student Coordinator Phone', 'Student Coordinator Mobile'), 20) || undefined,
      facultyCoordinatorName: cap(pick(row, 'Faculty Coordinator Name', 'Faculty Coordinator'), 80) || undefined,
      facultyCoordinatorPhone: cap(pick(row, 'Faculty Coordinator Phone', 'Faculty Coordinator Mobile'), 20) || undefined,
    } satisfies EventRecord);
  });

  return { valid, skipped, unknownDepartments: [...unknownDepartments] };
}

/**
 * Merge imported rows into existing records.
 * `add` updates existing records whose name matches (case-insensitive) and appends the rest.
 * `replace` returns only the imported rows.
 */
export function mergeRecords<T extends { id: string; name: string }>(
  existing: T[],
  incoming: T[],
  mode: 'add' | 'replace',
): T[] {
  if (mode === 'replace') return incoming;
  const out = [...existing];
  const index = new Map(out.map((r, i) => [r.name.trim().toLowerCase(), i]));
  for (const row of incoming) {
    const k = row.name.trim().toLowerCase();
    const at = index.get(k);
    if (at !== undefined) out[at] = { ...row, id: out[at].id };
    else {
      index.set(k, out.length);
      out.push(row);
    }
  }
  return out;
}