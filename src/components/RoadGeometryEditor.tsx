import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, MapPinned, Pause, Play, Plus, Save, Square, Trash2, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { connectionId, formatNodeName, type Connection, type PointsMap, type RoadPoint } from '@/lib/campus-data';
import { buildLatLngToXY, haversineMeters, latLngToXY } from '@/lib/geo';
import { sortNames } from '@/lib/sorting';

interface RoadGeometryEditorProps {
  points: PointsMap;
  connections: Connection[];
  onUpdate: (id: string, geometry: RoadPoint[]) => void;
  onPreview: (id: string | null, geometry: RoadPoint[] | null) => void;
}

function parseCoordinate(input: string): number | null {
  const value = input.trim().replace(/,/g, '.');
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  const match = value.match(/(-?\d+(?:\.\d+)?)[°\s:]+(\d+(?:\.\d+)?)['′\s:]+(\d+(?:\.\d+)?)(?:["″]?)\s*([NSEW])?/i);
  if (!match) return null;
  let result = Math.abs(Number(match[1])) + Number(match[2]) / 60 + Number(match[3]) / 3600;
  if (Number(match[1]) < 0 || /[SW]/i.test(match[4] ?? '')) result *= -1;
  return result;
}

export function RoadGeometryEditor({ points, connections, onUpdate, onPreview }: RoadGeometryEditorProps) {
  const ordered = useMemo(() => [...connections].sort((a, b) =>
    sortNames([`${formatNodeName(a.from)} ${formatNodeName(a.to)}`, `${formatNodeName(b.from)} ${formatNodeName(b.to)}`])[0] === `${formatNodeName(a.from)} ${formatNodeName(a.to)}` ? -1 : 1
  ), [connections]);
  const [roadId, setRoadId] = useState('');
  const [draft, setDraft] = useState<RoadPoint[]>([]);
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [status, setStatus] = useState<'idle' | 'recording' | 'paused' | 'review'>('idle');
  const [message, setMessage] = useState('');
  const watchRef = useRef<number | null>(null);
  const draftRef = useRef<RoadPoint[]>([]);
  const mapping = useMemo(() => buildLatLngToXY(points), [points]);
  const selected = connections.find(connection => connectionId(connection) === roadId);

  const stopWatch = () => {
    if (watchRef.current != null && typeof navigator !== 'undefined') navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = null;
  };

  useEffect(() => () => stopWatch(), []);
  useEffect(() => { draftRef.current = draft; }, [draft]);

  const showDraft = (next: RoadPoint[]) => {
    setDraft(next);
    draftRef.current = next;
    onPreview(roadId || null, next);
  };

  const selectRoad = (id: string) => {
    stopWatch();
    const road = connections.find(connection => connectionId(connection) === id);
    const next = road?.geometry ? [...road.geometry] : [];
    setRoadId(id);
    setDraft(next);
    draftRef.current = next;
    setStatus('idle');
    setMessage('');
    onPreview(id, next);
  };

  const beginWatch = (replace: boolean) => {
    if (!selected || !mapping) {
      setMessage('Add GPS coordinates to at least 3 map nodes before recording a road.');
      return;
    }
    if (!navigator.geolocation) {
      setMessage('GPS is not available on this device.');
      return;
    }
    if (replace) showDraft([]);
    stopWatch();
    setStatus('recording');
    setMessage('Walk along the road. Keep this screen open.');
    watchRef.current = navigator.geolocation.watchPosition(position => {
      const accuracy = position.coords.accuracy;
      if (accuracy > 50) {
        setMessage(`Waiting for better GPS accuracy (±${Math.round(accuracy)} m).`);
        return;
      }
      const ll = { lat: position.coords.latitude, lng: position.coords.longitude };
      const previous = draftRef.current[draftRef.current.length - 1];
      if (previous && haversineMeters(previous, ll) < 2) return;
      if (previous && haversineMeters(previous, ll) > 120) {
        setMessage('A GPS jump was ignored. Continue walking.');
        return;
      }
      const xy = latLngToXY(mapping, ll);
      const next = [...draftRef.current, { ...ll, ...xy, accuracy, recordedAt: Date.now() }];
      showDraft(next);
      setMessage(`${next.length} points recorded · accuracy ±${Math.round(accuracy)} m`);
    }, error => {
      setMessage(error.code === error.PERMISSION_DENIED
        ? 'Location access was denied. Allow GPS access in browser settings and try again.'
        : 'GPS could not get a reliable location. Turn on precise location and try again.');
      stopWatch();
      setStatus('paused');
    }, { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 });
  };

  const pause = () => { stopWatch(); setStatus('paused'); setMessage('Recording paused.'); };
  const stop = () => {
    stopWatch();
    setStatus('review');
    setMessage(draft.length < 2 ? 'Add at least 2 road points before saving.' : 'Review the road shape, then save it.');
  };

  const addManual = () => {
    if (!mapping) { setMessage('Add GPS coordinates to at least 3 map nodes first.'); return; }
    const lat = parseCoordinate(latitude);
    const lng = parseCoordinate(longitude);
    if (lat == null || lng == null || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      setMessage('Enter valid latitude and longitude values.');
      return;
    }
    const next = [...draft, { lat, lng, ...latLngToXY(mapping, { lat, lng }) }];
    showDraft(next);
    setLatitude('');
    setLongitude('');
    setStatus('review');
    setMessage('Manual point added.');
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= draft.length) return;
    const next = [...draft];
    [next[index], next[target]] = [next[target], next[index]];
    showDraft(next);
  };

  const endpointWarning = useMemo(() => {
    if (!selected || draft.length < 2) return '';
    const from = points[selected.from];
    const to = points[selected.to];
    if (from?.lat == null || from.lng == null || to?.lat == null || to.lng == null) return '';
    const forward = haversineMeters(from, draft[0]) + haversineMeters(to, draft[draft.length - 1]);
    const reverse = haversineMeters(to, draft[0]) + haversineMeters(from, draft[draft.length - 1]);
    return Math.min(forward, reverse) > 60 ? 'The recorded path appears far from this road’s endpoints.' : '';
  }, [draft, points, selected]);

  return (
    <div className="space-y-2 border-t border-border pt-3">
      <div className="flex items-center gap-2">
        <MapPinned className="h-4 w-4 text-primary" />
        <h4 className="text-xs font-semibold text-foreground">Road GPS</h4>
      </div>
      <Select value={roadId} onValueChange={selectRoad}>
        <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select a road" /></SelectTrigger>
        <SelectContent>
          {ordered.map(connection => (
            <SelectItem key={connectionId(connection)} value={connectionId(connection)}>
              {formatNodeName(connection.from)} → {formatNodeName(connection.to)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selected && (
        <div className="space-y-3 rounded-md border border-border bg-muted/40 p-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">{draft.length} road points</span>
            <span className={mapping ? 'text-muted-foreground' : 'text-destructive'}>{mapping ? 'Map calibrated' : 'Needs 3 GPS nodes'}</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {status === 'recording' ? (
              <>
                <Button size="sm" variant="outline" className="h-10" onClick={pause}><Pause className="mr-1 h-4 w-4" />Pause</Button>
                <Button size="sm" className="h-10" onClick={stop}><Square className="mr-1 h-4 w-4" />Stop</Button>
              </>
            ) : (
              <Button size="sm" className="col-span-2 h-10" onClick={() => beginWatch(status !== 'paused')}>
                <Play className="mr-1 h-4 w-4" />{status === 'paused' ? 'Resume recording' : 'Record while walking'}
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-[10px]">Latitude</Label><Input className="h-9 text-xs" value={latitude} onChange={event => setLatitude(event.target.value)} placeholder="17.0835" /></div>
            <div><Label className="text-[10px]">Longitude</Label><Input className="h-9 text-xs" value={longitude} onChange={event => setLongitude(event.target.value)} placeholder="82.0660" /></div>
          </div>
          <Button size="sm" variant="outline" className="h-9 w-full" onClick={addManual}><Plus className="mr-1 h-4 w-4" />Add GPS point</Button>

          {draft.length > 0 && (
            <div className="max-h-44 space-y-1 overflow-y-auto pr-1">
              {draft.map((point, index) => (
                <div key={`${point.lat}-${point.lng}-${index}`} className="flex min-w-0 items-center gap-1 rounded border border-border bg-card p-1.5 text-[10px]">
                  <span className="w-5 shrink-0 text-center font-semibold">{index + 1}</span>
                  <span className="min-w-0 flex-1 truncate">{point.lat.toFixed(6)}, {point.lng.toFixed(6)}</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Move point up"><ChevronUp className="h-3 w-3" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(index, 1)} disabled={index === draft.length - 1} aria-label="Move point down"><ChevronDown className="h-3 w-3" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => showDraft(draft.filter((_, itemIndex) => itemIndex !== index))} aria-label="Delete point"><Trash2 className="h-3 w-3" /></Button>
                </div>
              ))}
            </div>
          )}

          {(message || endpointWarning) && <p className={`text-[10px] leading-relaxed ${endpointWarning ? 'text-destructive' : 'text-muted-foreground'}`}>{endpointWarning || message}</p>}
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" variant="outline" className="h-10" onClick={() => {
              stopWatch();
              const original = selected.geometry ? [...selected.geometry] : [];
              showDraft(original);
              setStatus('idle');
              setMessage('Changes discarded.');
            }}><Undo2 className="mr-1 h-4 w-4" />Discard</Button>
            <Button size="sm" className="h-10" disabled={draft.length < 2 || status === 'recording'} onClick={() => {
              onUpdate(roadId, draft);
              onPreview(null, null);
              setStatus('idle');
              setMessage('Road shape ready. Use Save above to publish it.');
            }}><Save className="mr-1 h-4 w-4" />Keep shape</Button>
          </div>
        </div>
      )}
    </div>
  );
}