import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pencil, Save, Trash2, Link, Plus } from 'lucide-react';
import type { PointsMap, Connection } from '@/lib/campus-data';
import { useState } from 'react';
import { calibrationStats } from '@/lib/geo';
import { sortNames } from '@/lib/sorting';
import type { RoadPoint } from '@/lib/campus-data';
import { RoadGeometryEditor } from '@/components/RoadGeometryEditor';

// Parse coordinates from either decimal ("17.0835") or DMS ("17°05'00.6\"N")
// Also accepts a combined string like: 17°05'00.6"N 82°03'57.8"E
function parseCoord(input: string): number | null {
  if (!input) return null;
  const s = input.trim().replace(/,/g, '.');
  // Plain decimal
  if (/^-?\d+(\.\d+)?$/.test(s)) return parseFloat(s);
  // DMS: 17°05'00.6"N  (degrees, minutes, seconds, hemisphere)
  const m = s.match(/(-?\d+(?:\.\d+)?)[°\s:]+(\d+(?:\.\d+)?)['′\s:]+(\d+(?:\.\d+)?)(?:["″]?)\s*([NSEWnsew])?/);
  if (m) {
    const deg = parseFloat(m[1]);
    const min = parseFloat(m[2]);
    const sec = parseFloat(m[3]);
    const hem = (m[4] || '').toUpperCase();
    let val = Math.abs(deg) + min / 60 + sec / 3600;
    if (deg < 0 || hem === 'S' || hem === 'W') val = -val;
    return val;
  }
  // Degrees + decimal minutes: 17°05.01'N
  const m2 = s.match(/(-?\d+(?:\.\d+)?)[°\s:]+(\d+(?:\.\d+)?)['′]?\s*([NSEWnsew])?/);
  if (m2) {
    const deg = parseFloat(m2[1]);
    const min = parseFloat(m2[2]);
    const hem = (m2[3] || '').toUpperCase();
    let val = Math.abs(deg) + min / 60;
    if (deg < 0 || hem === 'S' || hem === 'W') val = -val;
    return val;
  }
  return null;
}

// Parse a combined "lat lng" paste like: 17°05'00.6"N 82°03'57.8"E  or  17.0835, 82.0660
function parseLatLngPair(input: string): { lat: number; lng: number } | null {
  if (!input) return null;
  const s = input.trim();
  // Try splitting on comma first
  if (s.includes(',') && !/[°'"]/.test(s)) {
    const [a, b] = s.split(',').map(x => x.trim());
    const la = parseCoord(a); const ln = parseCoord(b);
    if (la != null && ln != null) return { lat: la, lng: ln };
  }
  // Match two DMS tokens
  const re = /(-?\d+(?:\.\d+)?[°\s:]+\d+(?:\.\d+)?(?:['′\s:]+\d+(?:\.\d+)?["″]?)?\s*[NSEWnsew]?)/g;
  const tokens = s.match(re);
  if (tokens && tokens.length >= 2) {
    const la = parseCoord(tokens[0]);
    const ln = parseCoord(tokens[1]);
    if (la != null && ln != null) return { lat: la, lng: ln };
  }
  // Two decimals separated by whitespace
  const parts = s.split(/\s+/);
  if (parts.length === 2) {
    const la = parseCoord(parts[0]); const ln = parseCoord(parts[1]);
    if (la != null && ln != null) return { lat: la, lng: ln };
  }
  return null;
}

interface EditorPanelProps {
  editMode: boolean;
  points: PointsMap;
  connections: Connection[];
  selectedNode: string | null;
  onToggleEdit: () => void;
  onSave: () => void;
  onDeleteNode: (name: string) => void;
  onRenameNode: (oldName: string, newName: string) => void;
  onUpdateNodeMeta: (name: string, field: string, value: any) => void;
  onAddConnection: (a: string, b: string) => void;
  onRemoveConnection: (a: string, b: string) => void;
  onUpdateRoadGeometry: (id: string, geometry: RoadPoint[]) => void;
  onPreviewRoadGeometry: (id: string | null, geometry: RoadPoint[] | null) => void;
  isSaving: boolean;
}

export function EditorPanel({
  editMode, points, connections, selectedNode,
  onToggleEdit, onSave, onDeleteNode, onRenameNode, onUpdateNodeMeta,
  onAddConnection, onRemoveConnection, onUpdateRoadGeometry, onPreviewRoadGeometry, isSaving
}: EditorPanelProps) {
  const [renameVal, setRenameVal] = useState('');
  const [connTarget, setConnTarget] = useState('');
  const [latInput, setLatInput] = useState<string>('');
  const [lngInput, setLngInput] = useState<string>('');
  const [lastNode, setLastNode] = useState<string | null>(null);
  const [pasteVal, setPasteVal] = useState('');

  const calib = calibrationStats(points);
  const calibGood = calib.anchors >= 4 && (calib.rmsXY ?? Infinity) < 40;

  // Reset local inputs when selection changes
  if (selectedNode !== lastNode) {
    setLastNode(selectedNode);
    const p = selectedNode ? points[selectedNode] : null;
    setLatInput(p?.lat != null ? String(p.lat) : '');
    setLngInput(p?.lng != null ? String(p.lng) : '');
    setPasteVal('');
  }

  const commitLat = (raw: string) => {
    const v = raw.trim();
    if (v === '') { onUpdateNodeMeta(selectedNode!, 'lat', undefined); return; }
    const parsed = parseCoord(v);
    if (parsed != null && !Number.isNaN(parsed)) {
      onUpdateNodeMeta(selectedNode!, 'lat', parsed);
      setLatInput(String(parsed));
    }
  };
  const commitLng = (raw: string) => {
    const v = raw.trim();
    if (v === '') { onUpdateNodeMeta(selectedNode!, 'lng', undefined); return; }
    const parsed = parseCoord(v);
    if (parsed != null && !Number.isNaN(parsed)) {
      onUpdateNodeMeta(selectedNode!, 'lng', parsed);
      setLngInput(String(parsed));
    }
  };
  const tryPastePair = (raw: string) => {
    const pair = parseLatLngPair(raw);
    if (pair) {
      onUpdateNodeMeta(selectedNode!, 'lat', pair.lat);
      onUpdateNodeMeta(selectedNode!, 'lng', pair.lng);
      setLatInput(String(pair.lat));
      setLngInput(String(pair.lng));
      setPasteVal('');
      return true;
    }
    return false;
  };

  const visibleNodes = sortNames(Object.keys(points).filter(k => !k.startsWith('j_')));
  const selectedPt = selectedNode ? points[selectedNode] : null;

  const nodeConnections = selectedNode
    ? connections.filter(c => c.from === selectedNode || c.to === selectedNode)
    : [];

  return (
    <div className="p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Pencil className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Editor</h3>
      </div>

      <div className="flex gap-2">
        <Button size="sm" variant={editMode ? 'default' : 'outline'} onClick={onToggleEdit} className="h-7 text-xs flex-1">
          <Pencil className="w-3 h-3 mr-1" />
          {editMode ? 'Editing' : 'Edit Mode'}
        </Button>
        <Button size="sm" variant="outline" onClick={onSave} disabled={isSaving} className="h-7 text-xs flex-1">
          <Save className="w-3 h-3 mr-1" />
          Save
        </Button>
      </div>

      <div className={`text-[10px] border rounded-md p-1.5 ${calibGood ? 'border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-300' : 'border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300'}`}>
        GPS calibration: <b>{calib.anchors}</b> anchor{calib.anchors === 1 ? '' : 's'}
        {calib.rmsXY != null && <> · fit ±{calib.rmsXY.toFixed(1)} px</>}
        {calib.anchors < 4 && <> — add at least 4 spread-out nodes with lat/lng for live GPS</>}
      </div>

      {editMode && selectedNode && selectedPt && (
        <div className="space-y-2 border rounded-md p-2 bg-muted/50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">
              {selectedNode.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </span>
          </div>

          <div className="flex gap-1">
            <Input value={renameVal} onChange={e => setRenameVal(e.target.value)}
              placeholder="New name..." className="h-7 text-xs" />
            <Button size="sm" className="h-7 text-xs" onClick={() => { if (renameVal) { onRenameNode(selectedNode, renameVal); setRenameVal(''); } }}>
              Rename
            </Button>
          </div>

          <div className="flex gap-1">
            <Input value={selectedPt.room || ''} onChange={e => onUpdateNodeMeta(selectedNode, 'room', e.target.value)}
              placeholder="Room" className="h-7 text-xs flex-1" />
            <Input value={selectedPt.floor ?? ''} onChange={e => onUpdateNodeMeta(selectedNode, 'floor', parseInt(e.target.value) || 0)}
              placeholder="Floor" className="h-7 text-xs w-16" />
          </div>

          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">GPS Coordinates (real-world)</p>
            <Input
              value={pasteVal}
              onChange={e => {
                const v = e.target.value;
                setPasteVal(v);
                // Auto-commit if a full pair is detected
                if (parseLatLngPair(v)) tryPastePair(v);
              }}
              onBlur={() => { if (pasteVal) tryPastePair(pasteVal); }}
              placeholder={`Paste both: 17°05'00.6"N 82°03'57.8"E`}
              className="h-7 text-xs"
            />
            <div className="flex gap-1">
              <Input
                value={latInput}
                onChange={e => setLatInput(e.target.value)}
                onBlur={e => commitLat(e.target.value)}
                onPaste={e => {
                  const text = e.clipboardData.getData('text');
                  if (parseLatLngPair(text)) { e.preventDefault(); tryPastePair(text); }
                }}
                placeholder={`Lat e.g. 17.0835 or 17°05'00.6"N`}
                className="h-7 text-xs flex-1"
              />
              <Input
                value={lngInput}
                onChange={e => setLngInput(e.target.value)}
                onBlur={e => commitLng(e.target.value)}
                onPaste={e => {
                  const text = e.clipboardData.getData('text');
                  if (parseLatLngPair(text)) { e.preventDefault(); tryPastePair(text); }
                }}
                placeholder={`Lng e.g. 82.0660 or 82°03'57.8"E`}
                className="h-7 text-xs flex-1"
              />
            </div>
            {selectedPt.lat != null && selectedPt.lng != null && (
              <p className="text-[10px] text-muted-foreground">
                Saved: {Number(selectedPt.lat).toFixed(6)}, {Number(selectedPt.lng).toFixed(6)}
              </p>
            )}
          </div>

          <Select value={selectedPt.type || 'building'} onValueChange={v => onUpdateNodeMeta(selectedNode, 'type', v)}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {['building', 'junction', 'hostel', 'lab', 'office', 'reception', 'fee_counter'].map(t => (
                <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Connections ({nodeConnections.length})</p>
            {nodeConnections.map((connection, i) => {
              const { from: a, to: b } = connection;
              const other = a === selectedNode ? b : a;
              return (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{other.replace(/_/g, ' ')}</span>
                  <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => onRemoveConnection(a, b)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              );
            })}
            <div className="flex gap-1">
              <Select value={connTarget} onValueChange={setConnTarget}>
                <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Connect to..." /></SelectTrigger>
                <SelectContent>
                  {visibleNodes.filter(n => n !== selectedNode).map(n => (
                    <SelectItem key={n} value={n}>{n.replace(/_/g, ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" className="h-7 w-7 p-0" onClick={() => { if (connTarget) { onAddConnection(selectedNode, connTarget); setConnTarget(''); } }}>
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          </div>

          <Button size="sm" variant="destructive" className="w-full h-7 text-xs" onClick={() => onDeleteNode(selectedNode)}>
            <Trash2 className="w-3 h-3 mr-1" /> Delete Node
          </Button>
        </div>
      )}

      {editMode && !selectedNode && (
        <div className="text-xs text-muted-foreground p-2 border rounded-md bg-muted/50">
          Click a node to edit. Double-click map to add.
        </div>
      )}

      {editMode && (
        <RoadGeometryEditor
          points={points}
          connections={connections}
          onUpdate={onUpdateRoadGeometry}
          onPreview={onPreviewRoadGeometry}
        />
      )}
    </div>
  );
}
