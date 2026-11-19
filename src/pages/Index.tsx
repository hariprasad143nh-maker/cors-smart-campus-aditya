import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Map, MapPin, Shield, RotateCcw, FlaskConical, Users, CalendarDays, Navigation as NavIcon, Terminal, GraduationCap, ArrowUp, CornerUpLeft, CornerUpRight, Flag, Route } from 'lucide-react';
import {
  INITIAL_POINTS, INITIAL_CONNECTIONS, calculateFastestPath, findConnection, connectionId, connectionCost,
  getVisibleNodes, calculateDirection, formatNodeName, saveMapData, loadMapData, edgeCost
} from '@/lib/campus-data';
import type { PointsMap, Connection, RoadPoint } from '@/lib/campus-data';
import {
  AiMultipathFilter, SOI_CORS_STATION,
  type CorsPositionSample, type PositioningMode, type TelemetryPoint
} from '@/lib/cors-rtk';
import { CorsTelemetryPanel } from '@/components/CorsTelemetryPanel';
import { subscribeStaff, saveAllStaffToFirebase } from '@/lib/staff-data';
import type { StaffRecord } from '@/lib/staff-data';
import {
  subscribeLabs, saveAllLabs, subscribeClubs, saveAllClubs, subscribeEvents, saveAllEvents,
  pruneExpiredEvents,
} from '@/lib/campus-extra-data';
import type { LabRecord, ClubRecord, EventRecord } from '@/lib/campus-extra-data';
import { saveMapDataToFirebase, loadMapDataFromFirebase, saveMapImageUrl, loadMapImageUrl } from '@/lib/map-firebase';
import { speak, cancelSpeech } from '@/lib/speech';
import { subscribeAuth, isAdmin as checkIsAdmin, getAdminEmails, saveAdminEmails } from '@/lib/admin-auth';
import type { User } from 'firebase/auth';
import { CampusMap } from '@/components/CampusMap';
import { NavigationPanel } from '@/components/NavigationPanel';
import { EditorPanel } from '@/components/EditorPanel';
import { StaffDataEditor } from '@/components/StaffDataEditor';
import { LabsEditor } from '@/components/LabsEditor';
import { DepartmentsEditor } from '@/components/DepartmentsEditor';
import { ClubsEditor } from '@/components/ClubsEditor';
import { EventsEditor } from '@/components/EventsEditor';
import { ConsoleLog } from '@/components/ConsoleLog';
import { StatsPanel } from '@/components/StatsPanel';
import { UserFlowWizard, type UserFlowData } from '@/components/UserFlowWizard';
import { AdminLoginButton, AdminManager } from '@/components/AdminAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import { LanguageMenu } from '@/components/LanguageMenu';
import { useI18n } from '@/lib/i18n';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useGeolocation, buildLatLngToXY, latLngToXY, nearestNode, getCurrentPositionOnce } from '@/lib/geo';
import { LocateFixed, Loader2 } from 'lucide-react';
import { createFollower, DEFAULT_FOLLOWER_CONFIG, CORS_FOLLOWER_CONFIG, type Follower } from '@/lib/navFollower';
import { Pencil } from 'lucide-react';
import { useAppSettings, saveAppTitle, saveAppSubtitle } from '@/lib/app-settings';


const DEFAULT_MAP_URL = 'https://i.postimg.cc/BndNjYp2/map.png';
type EditorTab = 'staff' | 'labs' | 'clubs' | 'events' | 'depts' | 'map';
type GuidanceKind = 'straight' | 'left' | 'right' | 'rerouting' | 'arrived';

interface VisualGuidance {
  kind: GuidanceKind;
  title: string;
  subtitle: string;
  maneuverMeters?: number;
}

export default function Index() {
  const { t, lang } = useI18n();
  const [flowComplete, setFlowComplete] = useState(false);
  const [userData, setUserData] = useState<UserFlowData | null>(null);
  const [mobileTab, setMobileTab] = useState<'nav' | 'admin' | 'console' | null>(null);

  // Admin auth state
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [isAdminUser, setIsAdminUser] = useState(false);

  const [points, setPoints] = useState<PointsMap>(() => {
    const saved = loadMapData();
    return saved ? saved.points : INITIAL_POINTS;
  });
  const [connections, setConnections] = useState<Connection[]>(() => {
    const saved = loadMapData();
    return saved ? saved.connections : INITIAL_CONNECTIONS;
  });

  const [staff, setStaff] = useState<StaffRecord[]>([]);
  const [labs, setLabs] = useState<LabRecord[]>([]);
  const [clubs, setClubs] = useState<ClubRecord[]>([]);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [mapImageUrl, setMapImageUrl] = useState(DEFAULT_MAP_URL);

  const [setupMode, setSetupMode] = useState(false);
  const [editorTab, setEditorTab] = useState<EditorTab>('staff');
  const [editMode, setEditMode] = useState(false);
  const [startNode, setStartNode] = useState('main_gate');
  const [destNode, setDestNode] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [wizardStep, setWizardStep] = useState(0);
  const [lastOffPathReroute, setLastOffPathReroute] = useState(0);
  const [navSegment, setNavSegment] = useState(0);
  const [navProgress, setNavProgress] = useState(0);
  const [gpsMode, setGpsMode] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locateMsg, setLocateMsg] = useState('');
  const [visualGuidance, setVisualGuidance] = useState<VisualGuidance | null>(null);

  // CORS-RTK + AI Smart Campus state
  const [positioningMode, setPositioningMode] = useState<PositioningMode>('compare');
  const [accessibleMode, setAccessibleMode] = useState(false);
  const [corsSample, setCorsSample] = useState<CorsPositionSample | null>(null);
  const [rawDriftTrail, setRawDriftTrail] = useState<Array<{ x: number; y: number }>>([]);
  const [corsTrail, setCorsTrail] = useState<Array<{ x: number; y: number }>>([]);
  const [telemetry, setTelemetry] = useState<TelemetryPoint[]>([]);
  const [isSimulatingCors, setIsSimulatingCors] = useState(false);
  const [previewRoad, setPreviewRoad] = useState<{ id: string; geometry: RoadPoint[] } | null>(null);

  const aiFilterRef = useRef(new AiMultipathFilter());
  const simTimerRef = useRef<number | null>(null);
  const positioningModeRef = useRef<PositioningMode>('compare');
  useEffect(() => { positioningModeRef.current = positioningMode; }, [positioningMode]);

  const [promptOpen, setPromptOpen] = useState(false);
  const appSettings = useAppSettings();
  const [nameEditOpen, setNameEditOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [subtitleDraft, setSubtitleDraft] = useState('');

  const [promptValue, setPromptValue] = useState('');
  const [pendingCoords, setPendingCoords] = useState<{ x: number; y: number } | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState('');

  const navStateRef = useRef({ path: [] as string[], segment: 0, progress: 0 });
  const followerRef = useRef<Follower | null>(null);
  const gpsModeRef = useRef(false);
  const reroutingRef = useRef(false);
  // Monotonic token to invalidate in-flight fallback walkthroughs after reset/reroute.
  const navTokenRef = useRef(0);
  // Latest GPS fix, readable from stable callbacks without stale-closure risk.
  const liveCoordsRef = useRef<import('@/lib/geo').LatLng | null>(null);

  // Super admin should be seeded server-side via Firebase Admin SDK, not from client code

  // Subscribe to auth state
  useEffect(() => {
    const unsub = subscribeAuth(async (user) => {
      setAuthUser(user);
      if (user?.email) {
        const admin = await checkIsAdmin(user.email);
        setIsAdminUser(admin);
      } else {
        setIsAdminUser(false);
      }
    });
    return unsub;
  }, []);

  // Load from Firebase on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [fbMap, fbUrl] = await Promise.all([loadMapDataFromFirebase(), loadMapImageUrl()]);
        if (fbMap) { setPoints(fbMap.points); setConnections(fbMap.connections); }
        if (fbUrl) setMapImageUrl(fbUrl);
      } catch (e) { console.error('Firebase load error:', e); }
    };
    loadData();
    const unsubs = [
      subscribeStaff(setStaff),
      subscribeLabs(setLabs),
      subscribeClubs(setClubs),
      subscribeEvents((items) => {
        setEvents(items);
        pruneExpiredEvents(items)
          .then((ids) => {
            if (ids.length > 0) {
              addLog(`🗑️ Auto-removed ${ids.length} expired event(s).`);
            }
          })
          .catch((e) => console.error('pruneExpiredEvents error:', e));
      }),
    ];
    return () => unsubs.forEach(u => u());
  }, []);

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [...prev.slice(-20), `>> ${msg}`]);
  }, []);

  const speakAndLog = useCallback(async (text: string) => {
    addLog(`🗣️ ${text}`);
    if (speechEnabled) await speak(text, lang);
  }, [addLog, speechEnabled, lang]);

  const visibleNodes = getVisibleNodes(points);

  // Build lat/lng -> SVG x/y mapping whenever points change (needs >=3 anchors).
  const latLngMap = useMemo(() => buildLatLngToXY(points), [points]);

  const remainingRouteMeters = useMemo(() => {
    if (!isNavigating) return null;
    const path = navStateRef.current.path;
    if (path.length < 2 || navSegment >= path.length - 1) return 0;
    let remaining = 0;
    for (let i = navSegment; i < path.length - 1; i++) {
      const from = points[path[i]];
      const to = points[path[i + 1]];
      if (!from || !to) continue;
      const connection = findConnection(connections, path[i], path[i + 1]);
      const segmentDistance = connection ? connectionCost(connection, points, path[i]) : edgeCost(from, to, 1);
      remaining += i === navSegment ? segmentDistance * (1 - navProgress) : segmentDistance;
    }
    return Math.max(0, Math.round(remaining));
  }, [connections, isNavigating, navProgress, navSegment, points]);

  const formatDistance = (meters: number) => meters >= 1000
    ? `${(meters / 1000).toFixed(meters >= 10000 ? 0 : 1)} km`
    : `${Math.max(0, Math.round(meters))} m`;

  // Live GPS: only watch while a navigation is active or the map is visible.
  const gpsEnabled = flowComplete; // map view is open
  const { coords: liveCoords, error: gpsError } = useGeolocation(gpsEnabled);
  useEffect(() => { liveCoordsRef.current = liveCoords; }, [liveCoords]);
  const liveXY = useMemo(() => {
    if (!liveCoords || !latLngMap) return null;
    return latLngToXY(latLngMap, liveCoords);
  }, [liveCoords, latLngMap]);

  // Legacy off-path detection (nearest-node based). Disabled when follower is active,
  // since the follower has its own perpendicular-distance off-route trigger.
  useEffect(() => {
    // Only run the legacy nearest-node rerouter when the follower is NOT active,
    // i.e. when we truly have no lat/lng calibration to drive turn-by-turn.
    if (!liveCoords || !isNavigating || gpsModeRef.current) return;
    if (latLngMap) return;
    const path = navStateRef.current.path;
    if (path.length < 2) return;
    const nearest = nearestNode(liveCoords, points, { includeJunctions: true });
    if (!nearest) return;
    // If the nearest node is already in the remaining path, we're on track.
    const remaining = path.slice(navSegment);
    if (remaining.includes(nearest.name)) return;
    // Throttle: don't reroute more than once per 8 seconds.
    const now = Date.now();
    if (now - lastOffPathReroute < 8000) return;
    setLastOffPathReroute(now);
    addLog(`📡 Off path — recalculating from ${formatNodeName(nearest.name)}`);
    cancelSpeech();
    setIsNavigating(false);
    setStartNode(nearest.name);
    setTimeout(() => startNavigation(nearest.name, destNode, undefined, true), 300);
  }, [liveCoords, isNavigating, points, destNode, addLog, lastOffPathReroute, navSegment, latLngMap]);

  // Feed live GPS into the active follower (GPS-driven turn-by-turn).
  useEffect(() => {
    if (!liveCoords || !followerRef.current) return;
    followerRef.current.feed(liveCoords);
  }, [liveCoords]);

  // Cleanup follower when navigation ends or component unmounts.
  useEffect(() => {
    if (!isNavigating) {
      // Invalidate any in-flight fallback walkthrough loop.
      navTokenRef.current += 1;
      // Cancel any awaited speech so the loop's `await speakAndLog(...)` resolves
      // immediately and the next token check aborts the walkthrough.
      cancelSpeech();
      followerRef.current?.destroy();
      followerRef.current = null;
      gpsModeRef.current = false;
      setGpsMode(false);
      setVisualGuidance(current => current?.kind === 'arrived' ? current : null);
    }
  }, [isNavigating]);

  const handleStaffUpdate = async (updated: StaffRecord[]) => {
    setStaff(updated);
    try { await saveAllStaffToFirebase(updated); addLog(`✅ Staff saved. ${updated.length} records.`); }
    catch { addLog('⚠️ Failed to save staff data.'); }
  };

  const handleLabsUpdate = async (updated: LabRecord[]) => {
    setLabs(updated);
    try { await saveAllLabs(updated); addLog(`✅ Labs saved. ${updated.length} records.`); }
    catch { addLog('⚠️ Failed to save labs data.'); }
  };

  const handleClubsUpdate = async (updated: ClubRecord[]) => {
    setClubs(updated);
    try { await saveAllClubs(updated); addLog(`✅ Clubs saved. ${updated.length} records.`); }
    catch { addLog('⚠️ Failed to save clubs data.'); }
  };

  const handleEventsUpdate = async (updated: EventRecord[]) => {
    setEvents(updated);
    try { await saveAllEvents(updated); addLog(`✅ Events saved. ${updated.length} records.`); }
    catch { addLog('⚠️ Failed to save events data.'); }
  };

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    saveMapData(points, connections);
    try {
      await saveMapDataToFirebase(points, connections);
      await saveMapImageUrl(mapImageUrl);
      addLog('✅ Map data saved.');
    } catch { addLog('⚠️ Local save only. Firebase failed.'); }
    setTimeout(() => setIsSaving(false), 300);
  }, [points, connections, mapImageUrl, addLog]);

  const handleFlowComplete = async (data: UserFlowData) => {
    setSetupMode(false);
    setUserData(data);
    setFlowComplete(true);
    setDestNode(data.destination);
    const start = data.currentLocation || 'main_gate';
    setStartNode(start);

    const roomInfo = data.room ? `Room ${data.room}` : '';
    const floorInfo = data.floor !== undefined ? `Floor ${data.floor}` : '';
    const locationInfo = [roomInfo, floorInfo].filter(Boolean).join(', ');

    addLog(`👤 ${data.name || data.role} (${data.role})`);
    addLog(`📍 ${t('log.destination', { dest: formatNodeName(data.destination), info: locationInfo })}`);

    setTimeout(async () => {
      await startNavigation(start, data.destination, locationInfo);
    }, 1000);
  };

  // Phone back button: return from map view to the wizard instead of leaving the app.
  useEffect(() => {
    if (!flowComplete) return;
    window.history.pushState({ mapView: true }, '');
    const onPop = (e: PopStateEvent) => {
      const isMap = !!(e.state && (e.state as any).mapView);
      if (!isMap) {
        setFlowComplete(false);
        setWizardStep(2);
        setIsNavigating(false);
        cancelSpeech();
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [flowComplete]);

  const stopCorsSimulation = useCallback(() => {
    if (simTimerRef.current != null) {
      window.clearInterval(simTimerRef.current);
      simTimerRef.current = null;
    }
    setIsSimulatingCors(false);
  }, []);

  const startNavigation = async (
    start: string,
    dest: string,
    locationInfo?: string,
    isReroute = false,
    accessibleOverride?: boolean
  ) => {
    if (!start || !dest || start === dest) return;
    if (reroutingRef.current && isReroute) return;
    stopCorsSimulation();
    const useAccessible = accessibleOverride ?? accessibleMode;
    const path = calculateFastestPath(start, dest, points, connections, { accessibleOnly: useAccessible });
    if (path.length === 0) { addLog(`⚠️ ${t('log.noRoute')}`); return; }
    if (editMode) setEditMode(false);
    // Fully invalidate the previous route before activating this one. This stops
    // its speech, GPS follower, delayed reroute, arrival timer, and walkthrough.
    cancelSpeech();
    const myToken = ++navTokenRef.current;
    reroutingRef.current = false;
    followerRef.current?.destroy();
    followerRef.current = null;
    gpsModeRef.current = false;
    setGpsMode(false);
    setVisualGuidance(null);
    setIsNavigating(true);
    navStateRef.current.path = path;
    navStateRef.current.segment = 0;
    navStateRef.current.progress = 0;
    setNavSegment(0);
    setNavProgress(0);

    addLog(`🧭 ${t('log.routing', { start: formatNodeName(start), dest: formatNodeName(dest) })}`);
    const info = locationInfo || '';

    const turnKeyMap = { left: 'speak.turnLeft', right: 'speak.turnRight', straight: 'speak.continueStraight' } as const;

    // Greeting (always)
    const greeting =
      t('speak.welcome', { name: userData?.name || '', dest: formatNodeName(dest) }) +
      (info ? t('speak.assigned', { info }) : '');

    // Decide GPS mode: needs calibration map + lat/lng on EVERY path node.
    const allHaveCoords = path.every(n => points[n]?.lat != null && points[n]?.lng != null);
    const canUseGps = !!latLngMap && allHaveCoords;
    setVisualGuidance({
      kind: 'straight',
      title: t('speak.headTowards', { next: formatNodeName(path[1]) }),
      subtitle: t('nav.routeReady'),
    });

    if (canUseGps) {
      gpsModeRef.current = true;
      setGpsMode(true);
      if (!isReroute) await speakAndLog(greeting);
      if (navTokenRef.current !== myToken) return;
      // Initial direction cue so user knows where to start walking.
      await speakAndLog(t('speak.headTowards', { next: formatNodeName(path[1]) }));
      if (navTokenRef.current !== myToken) return;

      const f = createFollower(path, points, {
        onProgress: (seg, prog) => {
          if (navTokenRef.current !== myToken) return;
          setNavSegment(seg);
          setNavProgress(prog);
          navStateRef.current.segment = seg;
          navStateRef.current.progress = prog;
          const segmentStart = points[path[seg]];
          const segmentEnd = points[path[seg + 1]];
          if (!segmentStart || !segmentEnd) return;
          const connection = findConnection(connections, path[seg], path[seg + 1]);
          const segDist = connection ? connectionCost(connection, points, path[seg]) : edgeCost(segmentStart, segmentEnd, 1);
          const maneuverMeters = Math.max(0, Math.round(segDist * (1 - prog)));
          const turnIdx = seg + 1;
          if (turnIdx >= path.length - 1) {
            setVisualGuidance({
              kind: 'straight',
              title: t('nav.continueTo', { next: formatNodeName(dest) }),
              subtitle: formatNodeName(dest),
              maneuverMeters,
            });
            return;
          }
          const dir = calculateDirection(points[path[turnIdx - 1]], points[path[turnIdx]], points[path[turnIdx + 1]]);
          const afterTurn = formatNodeName(path[turnIdx + 1]);
          setVisualGuidance({
            kind: dir,
            title: t(turnKeyMap[dir]),
            subtitle: t('nav.then', { action: t(turnKeyMap[dir]), next: afterTurn }),
            maneuverMeters,
          });
        },
        onApproach: (turnNode, dir, meters) => {
          if (navTokenRef.current !== myToken) return;
          const idx = path.indexOf(turnNode);
          const nextNode = idx >= 0 && idx < path.length - 1 ? path[idx + 1] : dest;
          setVisualGuidance({
            kind: dir,
            title: t(turnKeyMap[dir]),
            subtitle: t('nav.then', { action: t(turnKeyMap[dir]), next: formatNodeName(nextNode) }),
            maneuverMeters: meters,
          });
          // Voice remains suppressed here; it speaks only after reaching the waypoint.
        },
        onTurnNow: (turnNode, dir) => {
          if (navTokenRef.current !== myToken) return;
          const action = t(turnKeyMap[dir]);
          const idx = path.indexOf(turnNode);
          const nextNode = idx >= 0 && idx < path.length - 1 ? path[idx + 1] : '';
          const reached = turnNode.startsWith('j_')
            ? ''
            : `Reached ${formatNodeName(turnNode)}. `;
          const towards = nextNode ? ` toward ${formatNodeName(nextNode)}` : '';
          setVisualGuidance({
            kind: dir,
            title: t(turnKeyMap[dir]),
            subtitle: nextNode ? t('nav.continueTo', { next: formatNodeName(nextNode) }) : formatNodeName(dest),
            maneuverMeters: 0,
          });
          speakAndLog(`${reached}${action}${towards}`);
        },
        onArrived: () => {
          if (navTokenRef.current !== myToken) return;
          setVisualGuidance({
            kind: 'arrived',
            title: t('nav.arrived'),
            subtitle: formatNodeName(dest),
            maneuverMeters: 0,
          });
          speakAndLog(
            t('speak.arrived', { dest: formatNodeName(dest) }) +
            (info ? t('speak.assignedLocation', { info }) : '')
          );
          addLog(`✅ ${t('log.destinationReached')}`);
          setTimeout(() => {
            if (navTokenRef.current === myToken) setIsNavigating(false);
          }, 1500);
        },
        onOffRoute: () => {
          if (navTokenRef.current !== myToken) return;
          if (reroutingRef.current) return;
          const live = liveCoordsRef.current;
          if (!live) return;
          const nearest = nearestNode(live, points, { includeJunctions: true });
          if (!nearest) return;
          reroutingRef.current = true;
          setVisualGuidance({ kind: 'rerouting', title: t('speak.rerouting'), subtitle: formatNodeName(dest) });
          addLog(`📡 Off route — rerouting from ${formatNodeName(nearest.name)}`);
          cancelSpeech();
          speakAndLog(t('speak.rerouting'));
          setIsNavigating(false);
          setStartNode(nearest.name);
          setTimeout(() => {
            if (navTokenRef.current !== myToken) return;
            reroutingRef.current = false;
            startNavigation(nearest.name, dest, info, true);
          }, 600);
        },
      }, positioningModeRef.current === 'standard_gps' ? DEFAULT_FOLLOWER_CONFIG : CORS_FOLLOWER_CONFIG);
      followerRef.current = f;
      // If follower creation failed (shouldn't, but guard), fall back below.
      if (f) return;
    }

    // Fallback: simulated walkthrough (no GPS / no calibration / missing coords)
    addLog('ℹ️ GPS not calibrated — using guided walkthrough.');
    if (!isReroute) await speakAndLog(greeting);
    if (navTokenRef.current !== myToken) return;

    for (let i = 0; i < path.length - 1; i++) {
      // Abort if navigation was reset or a newer navigation started.
      if (navTokenRef.current !== myToken) return;
      navStateRef.current.segment = i;
      setNavSegment(i);
      const nextName = path[i + 1];
      let instruction: string;

      if (i === 0) {
        instruction = t('speak.headTowards', { next: formatNodeName(nextName) });
      } else {
        const prevPt = points[path[i - 1]];
        const currPt = points[path[i]];
        const nextPt = points[nextName];
        const turn = calculateDirection(prevPt, currPt, nextPt);
        const turnText = t(turnKeyMap[turn]);
        const landmark = path[i].startsWith('j_') ? '' : t('speak.atLandmark', { landmark: formatNodeName(path[i]) });
        const towards = t('speak.towards', { next: formatNodeName(nextName) });
        instruction = `${turnText}${landmark}${towards}`;
      }

      const fallbackKind: GuidanceKind = i === 0
        ? 'straight'
        : calculateDirection(points[path[i - 1]], points[path[i]], points[nextName]);
      setVisualGuidance({
        kind: fallbackKind,
        title: instruction,
        subtitle: t('nav.continueTo', { next: formatNodeName(nextName) }),
      });

      await speakAndLog(instruction);

      await new Promise<void>(resolve => {
        const startTime = performance.now();
        const step = (time: number) => {
          if (navTokenRef.current !== myToken) { resolve(); return; }
          const progress = Math.min((time - startTime) / 800, 1);
          navStateRef.current.progress = progress;
          setNavProgress(progress);
          if (progress < 1) requestAnimationFrame(step); else resolve();
        };
        requestAnimationFrame(step);
      });
    }

    if (navTokenRef.current !== myToken) return;
    await speakAndLog(
      t('speak.arrived', { dest: formatNodeName(dest) }) +
      (info ? t('speak.assignedLocation', { info }) : '')
    );
    setVisualGuidance({ kind: 'arrived', title: t('nav.arrived'), subtitle: formatNodeName(dest), maneuverMeters: 0 });
    addLog(`✅ ${t('log.destinationReached')}`);
    setTimeout(() => {
      if (navTokenRef.current === myToken) setIsNavigating(false);
    }, 2000);
  };

  const handleStartNav = () => startNavigation(startNode, destNode);

  const handleToggleCorsSimulation = useCallback(() => {
    if (isSimulatingCors) {
      stopCorsSimulation();
      addLog('⏹️ Stopped CORS-RTK rover simulation.');
      return;
    }

    const simStart = startNode && points[startNode] ? startNode : 'main_gate';
    const simDest =
      destNode && points[destNode] && destNode !== simStart
        ? destNode
        : points['cse_dept'] && simStart !== 'cse_dept'
        ? 'cse_dept'
        : visibleNodes.find((n) => n !== simStart) || '';

    if (!simDest) return;
    if (simDest !== destNode) setDestNode(simDest);
    if (simStart !== startNode) setStartNode(simStart);

    const path = calculateFastestPath(simStart, simDest, points, connections, { accessibleOnly: accessibleMode });
    if (path.length < 2) {
      addLog(`⚠️ ${t('log.noRoute')}`);
      return;
    }

    cancelSpeech();
    navTokenRef.current += 1;
    followerRef.current?.destroy();
    followerRef.current = null;
    if (editMode) setEditMode(false);

    aiFilterRef.current.reset();
    setRawDriftTrail([]);
    setCorsTrail([]);
    setTelemetry([]);
    setCorsSample(null);
    setIsNavigating(true);
    setIsSimulatingCors(true);

    navStateRef.current.path = path;
    navStateRef.current.segment = 0;
    navStateRef.current.progress = 0;
    setNavSegment(0);
    setNavProgress(0);

    addLog(
      `🛰️ CORS-RTK Sim (${SOI_CORS_STATION.id}): ${formatNodeName(simStart)} → ${formatNodeName(simDest)}${
        accessibleMode ? ' [Ramp/Accessible]' : ''
      }`
    );
    if (speechEnabled) {
      void speak(
        accessibleMode
          ? `CORS RTK Fixed. Starting wheelchair accessible route to ${formatNodeName(simDest)}.`
          : `CORS RTK Fixed. Navigating to ${formatNodeName(simDest)} with centimeter precision.`,
        lang
      );
    }

    let seg = 0;
    let prog = 0;
    let tick = 0;
    const spokenSegments = new Set<number>();

    simTimerRef.current = window.setInterval(() => {
      if (seg >= path.length - 1) {
        stopCorsSimulation();
        setVisualGuidance({
          kind: 'arrived',
          title: t('nav.arrived'),
          subtitle: `${formatNodeName(simDest)} · CORS RTK ±1.5 cm`,
          maneuverMeters: 0,
        });
        addLog(`✅ Arrived at ${formatNodeName(simDest)} (CORS-RTK ±1.5 cm lock).`);
        if (speechEnabled) {
          void speak(t('speak.arrived', { dest: formatNodeName(simDest) }), lang);
        }
        return;
      }

      const fromPt = points[path[seg]];
      const toPt = points[path[seg + 1]];
      if (!fromPt || !toPt) {
        stopCorsSimulation();
        return;
      }

      const conn = findConnection(connections, path[seg], path[seg + 1]);
      const canyonRisk = conn?.multipathRisk ?? 'medium';
      const trueX = fromPt.x + (toPt.x - fromPt.x) * prog;
      const trueY = fromPt.y + (toPt.y - fromPt.y) * prog;

      const sample = aiFilterRef.current.processPoint(trueX, trueY, canyonRisk, positioningModeRef.current);
      tick += 1;

      setCorsSample(sample);
      setRawDriftTrail((prev) => [...prev.slice(-45), { x: sample.rawGpsX, y: sample.rawGpsY }]);
      setCorsTrail((prev) => [...prev.slice(-60), { x: sample.x, y: sample.y }]);
      setTelemetry((prev) => [
        ...prev.slice(-40),
        {
          step: tick,
          label: `${tick}s`,
          rawGpsErrorM: sample.rawGpsErrorM,
          corsAiErrorM: sample.corsAiErrorM,
          multipathDetected: sample.multipathDetected,
        },
      ]);

      navStateRef.current.segment = seg;
      navStateRef.current.progress = prog;
      setNavSegment(seg);
      setNavProgress(prog);

      const segDist = conn ? connectionCost(conn, points, path[seg]) : edgeCost(fromPt, toPt, 1);
      const remM = Math.max(0, Math.round(segDist * (1 - prog)));
      const nextIdx = seg + 1;

      if (!spokenSegments.has(seg)) {
        spokenSegments.add(seg);
        const dir: GuidanceKind =
          seg === 0
            ? 'straight'
            : calculateDirection(points[path[seg - 1]], points[path[seg]], points[path[seg + 1]]);
        const rampNote = accessibleMode && conn?.tactilePaving ? ' · Tactile ramp path' : '';
        setVisualGuidance({
          kind: dir,
          title:
            nextIdx >= path.length - 1
              ? t('nav.continueTo', { next: formatNodeName(simDest) })
              : dir === 'left'
              ? t('speak.turnLeft')
              : dir === 'right'
              ? t('speak.turnRight')
              : t('speak.headTowards', { next: formatNodeName(path[nextIdx]) }),
          subtitle: `${formatNodeName(path[nextIdx])}${rampNote}`,
          maneuverMeters: remM,
        });
      } else {
        setVisualGuidance((prev) => (prev ? { ...prev, maneuverMeters: remM } : prev));
      }

      prog += 0.08;
      if (prog >= 1) {
        prog = 0;
        seg += 1;
      }
    }, 320);
  }, [
    isSimulatingCors, stopCorsSimulation, startNode, destNode, points, connections,
    accessibleMode, visibleNodes, editMode, addLog, speechEnabled, lang, t,
  ]);

  const handleAccessibleChange = useCallback((nextVal: boolean) => {
    setAccessibleMode(nextVal);
    addLog(nextVal ? '♿ Accessible / Wheelchair Ramp Mode enabled (avoiding stairs).' : '🚶 Standard pedestrian routing enabled.');
    if (isNavigating && startNode && destNode && !isSimulatingCors) {
      void startNavigation(startNode, destNode, undefined, false, nextVal);
    }
  }, [addLog, isNavigating, startNode, destNode, isSimulatingCors]);

  const handleVoiceCommand = useCallback(
    (targetDest: string, wantAccessible: boolean, transcript: string) => {
      addLog(`🎙️ Voice AI: "${transcript}" → ${formatNodeName(targetDest)}${wantAccessible ? ' (Ramp Mode)' : ''}`);
      setDestNode(targetDest);
      if (wantAccessible) setAccessibleMode(true);
      const start = startNode && points[startNode] ? startNode : 'main_gate';
      if (start !== targetDest) {
        void startNavigation(start, targetDest, undefined, false, wantAccessible || accessibleMode);
      }
    },
    [addLog, startNode, points, accessibleMode]
  );

  const handleUpdateRoadGeometry = useCallback((id: string, geometry: RoadPoint[]) => {
    setConnections((prev) =>
      prev.map((c) => (connectionId(c) === id ? { ...c, geometry } : c))
    );
    addLog(`🛣️ Updated road geometry (${geometry.length} points).`);
  }, [addLog]);

  const handlePreviewRoadGeometry = useCallback((id: string | null, geometry: RoadPoint[] | null) => {
    setPreviewRoad(id && geometry ? { id, geometry } : null);
  }, []);

  const handleUseGpsOnMap = async () => {
    setLocateMsg('');
    setLocating(true);
    try {
      const pos = await getCurrentPositionOnce();
      const nearest = nearestNode(pos, points, { includeJunctions: true });
      if (!nearest) {
        setLocateMsg('No nodes have GPS coordinates yet.');
      } else {
        setStartNode(nearest.name);
        const label = nearest.name.startsWith('j_')
          ? 'nearest walkway point'
          : formatNodeName(nearest.name);
        setLocateMsg(`Start set to ${label} (~${Math.round(nearest.meters)} m)`);
        addLog(`📍 GPS start: ${formatNodeName(nearest.name)}`);
      }
    } catch (e: any) {
      setLocateMsg(e?.message || 'Could not get GPS location.');
    } finally {
      setLocating(false);
      setTimeout(() => setLocateMsg(''), 4000);
    }
  };

  const handlePromptNewNode = (x: number, y: number) => {
    setPendingCoords({ x, y }); setPromptValue(''); setPromptOpen(true);
  };

  const handleAddNode = () => {
    if (promptValue && pendingCoords) {
      const cleanName = promptValue.toLowerCase().replace(/\s+/g, '_');
      setPoints(p => ({ ...p, [cleanName]: { ...pendingCoords, type: 'building' as const, floor: 0, room: '' } }));
      addLog(`Added node: ${cleanName}`);
    }
    setPromptOpen(false);
  };

  const handleConfirmDelete = (nodeName: string) => { setPendingDelete(nodeName); setDeleteOpen(true); };

  const handleDelete = () => {
    setPoints(prev => { const n = { ...prev }; delete n[pendingDelete]; return n; });
    setConnections(prev => prev.filter(c => c.from !== pendingDelete && c.to !== pendingDelete));
    setSelectedNode(null);
    addLog(`Deleted node: ${pendingDelete}`);
    setDeleteOpen(false);
  };

  const handleRenameNode = (oldName: string, newName: string) => {
    const clean = newName.toLowerCase().replace(/\s+/g, '_');
    setPoints(prev => { const n = { ...prev }; n[clean] = n[oldName]; delete n[oldName]; return n; });
    setConnections(prev => prev.map(c => ({
      ...c,
      from: c.from === oldName ? clean : c.from,
      to: c.to === oldName ? clean : c.to,
    })));
    setSelectedNode(clean);
    addLog(`Renamed: ${oldName} → ${clean}`);
  };

  const handleUpdateNodeMeta = (name: string, field: string, value: any) => {
    setPoints(prev => ({ ...prev, [name]: { ...prev[name], [field]: value } }));
  };

  const handleAddConnection = (a: string, b: string) => {
    if (!findConnection(connections, a, b)) {
      setConnections(prev => [...prev, { from: a, to: b, weight: 1, wheelchairAccessible: true, multipathRisk: 'medium' }]);
      addLog(`Connected: ${a} ↔ ${b}`);
    }
  };

  const handleRemoveConnection = (a: string, b: string) => {
    setConnections(prev => prev.filter(c => !(c.from === a && c.to === b) && !(c.from === b && c.to === a)));
    addLog(`Disconnected: ${a} ↔ ${b}`);
  };

  const handleDragNode = (name: string, x: number, y: number) => {
    setPoints(prev => ({ ...prev, [name]: { ...prev[name], x, y } }));
  };

  useEffect(() => () => {
    cancelSpeech();
    if (simTimerRef.current != null) window.clearInterval(simTimerRef.current);
  }, []);

  // Whenever the map view opens, quietly fetch the visitor's GPS location and
  // snap the start point to the nearest node (junctions included). No prompts
  // are shown on the wizard's first page anymore.
  useEffect(() => {
    if (!flowComplete || setupMode) return;
    void handleUseGpsOnMap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowComplete]);

  // Wizard screen
  if (!flowComplete && !setupMode) {
    return (
      <UserFlowWizard
        onComplete={handleFlowComplete}
        staff={staff} labs={labs} clubs={clubs} events={events}
        mapNodes={visibleNodes}
        points={points}
        onOpenEditor={() => setSetupMode(true)}
        onOpenMap={() => setFlowComplete(true)}
        initialData={userData}
        initialStep={wizardStep}
        isAdmin={isAdminUser}
        loginSlot={
          <AdminLoginButton
            user={authUser}
            isAdmin={isAdminUser}
            onLogin={() => {}}
            onLogout={() => setIsAdminUser(false)}
          />
        }
      />
    );
  }

  const editorTabs: { key: EditorTab; label: string; icon: React.ReactNode }[] = [
    { key: 'staff', label: 'Staff', icon: <Shield className="w-3 h-3" /> },
    { key: 'labs', label: 'Labs', icon: <FlaskConical className="w-3 h-3" /> },
    { key: 'clubs', label: 'Clubs', icon: <Users className="w-3 h-3" /> },
    { key: 'events', label: 'Events', icon: <CalendarDays className="w-3 h-3" /> },
    { key: 'depts', label: 'Depts', icon: <GraduationCap className="w-3 h-3" /> },
    { key: 'map', label: 'Map', icon: <Map className="w-3 h-3" /> },
  ];

  return (
    <div className="flex h-screen h-[100dvh] flex-col bg-background text-foreground overflow-hidden">
      {/* Header */}
      <header className="safe-top flex min-h-14 items-center justify-between border-b border-border px-3 py-2 bg-card shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <MapPin className="w-5 h-5 text-primary shrink-0" />
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-foreground truncate">{appSettings.title || t('app.title')}</h1>
            <p className="text-[10px] text-muted-foreground truncate">
              {userData ? `${userData.name} • ${userData.role}` : (appSettings.subtitle || t('app.subtitle'))}
              {userData?.room ? ` • Room ${userData.room}, Floor ${userData.floor}` : ''}
            </p>
          </div>
          {isAdminUser && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              title="Edit app name"
              onClick={() => {
                setTitleDraft(appSettings.title);
                setSubtitleDraft(appSettings.subtitle);
                setNameEditOpen(true);
              }}
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>


        {/* Desktop header actions */}
        <div className="hidden lg:flex items-center gap-2">
          <AdminLoginButton
            user={authUser}
            isAdmin={isAdminUser}
            onLogin={() => {}}
            onLogout={() => setIsAdminUser(false)}
          />
          {isAdminUser && <AdminManager isAdmin={isAdminUser} user={authUser} />}
          <LanguageMenu />
          <Button variant="outline" size="sm" className="h-9 text-xs" onClick={() => {
            if (flowComplete) {
              setFlowComplete(false);
              setWizardStep(2);
              setIsNavigating(false);
              cancelSpeech();
            } else {
              setSetupMode(false);
            }
          }}>
            <RotateCcw className="w-3 h-3 mr-1" />
            {flowComplete ? t('header.newSession') : t('header.back')}
          </Button>
        </div>

        {/* Mobile header actions — compact */}
        <div className="flex lg:hidden items-center gap-1">
          <Button variant="outline" size="sm" className="h-9 px-2 text-xs" onClick={() => {
            if (flowComplete) {
              setFlowComplete(false);
              setWizardStep(2);
              setIsNavigating(false);
              cancelSpeech();
            } else {
              setSetupMode(false);
            }
          }}>
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Desktop Sidebar - left side (hidden on mobile, shown via bottom-nav tabs) */}
        <div className="hidden lg:block w-80 border-r border-border bg-card flex-shrink-0 overflow-y-auto z-20">
          <div className="flex flex-col h-full">
            {/* Navigation Controls (visible to everyone) */}
            <NavigationPanel
              visibleNodes={visibleNodes} startNode={startNode.startsWith('j_') ? '' : startNode} destNode={destNode}
              onStartChange={setStartNode} onDestChange={setDestNode}
              onNavigate={handleStartNav}
              onVoiceCommand={handleVoiceCommand}
              isNavigating={isNavigating}
              speechEnabled={speechEnabled}
              onToggleSpeech={() => { setSpeechEnabled(s => !s); if (speechEnabled) cancelSpeech(); }}
            />

            {/* Survey of India CORS-RTK + AI Telemetry Dashboard */}
            <CorsTelemetryPanel
              mode={positioningMode}
              onModeChange={setPositioningMode}
              accessibleMode={accessibleMode}
              onAccessibleChange={handleAccessibleChange}
              latestSample={corsSample}
              telemetry={telemetry}
              isSimulating={isSimulatingCors}
              canSimulate={visibleNodes.length >= 2}
              onToggleSimulation={handleToggleCorsSimulation}
            />

            {/* Editor Tabs - ADMIN ONLY */}
            {isAdminUser && (
              <>
                <div className="flex border-y border-border">
                  {editorTabs.map(tab => (
                    <button key={tab.key} onClick={() => setEditorTab(tab.key)}
                      className={`flex-1 flex items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors ${
                        editorTab === tab.key
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {tab.icon}
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                {editorTab === 'staff' && (
                  <StaffDataEditor staff={staff} onUpdate={handleStaffUpdate} mapNodes={Object.keys(points)} />
                )}
                {editorTab === 'labs' && (
                  <LabsEditor labs={labs} onUpdate={handleLabsUpdate} mapNodes={Object.keys(points)} />
                )}
                {editorTab === 'clubs' && (
                  <ClubsEditor clubs={clubs} onUpdate={handleClubsUpdate} mapNodes={Object.keys(points)} />
                )}
                {editorTab === 'events' && (
                  <EventsEditor events={events} onUpdate={handleEventsUpdate} mapNodes={Object.keys(points)} />
                )}
                {editorTab === 'depts' && <DepartmentsEditor />}
                {editorTab === 'map' && (
                  <>
                    <EditorPanel
                      editMode={editMode} points={points} connections={connections}
                      selectedNode={selectedNode}
                      onToggleEdit={() => { setEditMode(!editMode); setSelectedNode(null); }}
                      onSave={handleSave} onDeleteNode={handleConfirmDelete}
                      onRenameNode={handleRenameNode} onUpdateNodeMeta={handleUpdateNodeMeta}
                      onAddConnection={handleAddConnection} onRemoveConnection={handleRemoveConnection}
                      onUpdateRoadGeometry={handleUpdateRoadGeometry}
                      onPreviewRoadGeometry={handlePreviewRoadGeometry}
                      isSaving={isSaving}
                    />
                    <div className="px-3 pb-2 space-y-1">
                      <p className="text-xs text-muted-foreground">Map Background URL</p>
                      <Input value={mapImageUrl} onChange={e => setMapImageUrl(e.target.value)}
                        placeholder="https://example.com/map.png" className="h-7 text-xs" />
                    </div>
                  </>
                )}
              </>
            )}

            {!isAdminUser && (
              <div className="p-3 text-xs text-muted-foreground border-t border-border">
                <StatsPanel points={points} connections={connections} />
              </div>
            )}

            {/* Console - visible to everyone */}
            <div className="mt-auto p-3 border-t border-border">
              <ConsoleLog logs={logs} />
            </div>
          </div>
        </div>

        {/* Map Area - takes remaining space */}
        <div className="flex-1 relative min-w-0 pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
          <div className="absolute inset-0">
            <CampusMap
              points={points} connections={connections}
              editMode={isAdminUser && editMode}
              navPath={navStateRef.current.path}
              navSegment={navSegment}
              navProgress={navProgress}
              isNavigating={isNavigating}
              selectedNode={selectedNode}
              mapImageUrl={mapImageUrl}
              liveXY={liveXY}
              followUser={isNavigating && gpsMode}
              positioningMode={positioningMode}
              corsSample={corsSample}
              rawDriftTrail={rawDriftTrail}
              corsTrail={corsTrail}
              accessibleMode={accessibleMode}
              previewRoad={previewRoad}
              onSelectNode={setSelectedNode}
              onDragNode={handleDragNode}
              onAddNode={handlePromptNewNode}
            />
            {visualGuidance && (isNavigating || visualGuidance.kind === 'arrived') && (
              <div className="absolute left-2 right-2 top-2 z-20 mx-auto max-w-xl rounded-lg border border-primary/30 bg-card/95 p-3 shadow-lg backdrop-blur sm:left-4 sm:right-4 sm:top-4 sm:p-4" role="status" aria-live="polite">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground sm:h-14 sm:w-14">
                    {visualGuidance.kind === 'left' && <CornerUpLeft className="h-7 w-7 sm:h-8 sm:w-8" />}
                    {visualGuidance.kind === 'right' && <CornerUpRight className="h-7 w-7 sm:h-8 sm:w-8" />}
                    {visualGuidance.kind === 'straight' && <ArrowUp className="h-7 w-7 sm:h-8 sm:w-8" />}
                    {visualGuidance.kind === 'rerouting' && <Route className="h-7 w-7 sm:h-8 sm:w-8" />}
                    {visualGuidance.kind === 'arrived' && <Flag className="h-7 w-7 sm:h-8 sm:w-8" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-base font-bold leading-tight text-foreground sm:text-lg">{visualGuidance.title}</p>
                      {visualGuidance.maneuverMeters != null && visualGuidance.kind !== 'arrived' && (
                        <span className="shrink-0 text-sm font-semibold text-primary">{formatDistance(visualGuidance.maneuverMeters)}</span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground sm:text-sm">{visualGuidance.subtitle}</p>
                    {remainingRouteMeters != null && visualGuidance.kind !== 'arrived' && (
                      <p className="mt-1 text-xs font-medium text-foreground">{t('nav.remaining', { distance: formatDistance(remainingRouteMeters) })}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
            {/* GPS quick action: detect current location and set as start */}
            <div className={`absolute left-2 z-10 flex max-w-[52%] flex-col items-start gap-1 ${visualGuidance && (isNavigating || visualGuidance.kind === 'arrived') ? 'top-24 sm:top-28' : 'top-2'}`}>
              <Button
                size="sm"
                variant="secondary"
                className="h-11 px-3 text-xs shadow-md"
                onClick={handleUseGpsOnMap}
                disabled={locating}
              >
                {locating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <LocateFixed className="w-4 h-4 mr-1" />}
                {locating ? 'Detecting…' : 'Use my GPS'}
              </Button>
              {locateMsg && !gpsError && (
                <div className="rounded-md bg-card/90 backdrop-blur px-2 py-1 text-[10px] border border-border shadow max-w-[220px]">
                  {locateMsg}
                </div>
              )}
            </div>
            {/* Live GPS / CORS-RTK status badge */}
            <div className={`absolute right-2 z-10 max-w-[48%] pointer-events-none ${visualGuidance && (isNavigating || visualGuidance.kind === 'arrived') ? 'top-24 sm:top-28' : 'top-2'}`}>
              {corsSample ? (
                <div className={`rounded-lg bg-card/95 backdrop-blur px-2.5 py-1.5 text-[10px] leading-tight font-semibold border shadow flex items-center gap-1.5 ${
                  positioningMode === 'standard_gps'
                    ? 'border-red-500/50 text-red-600 dark:text-red-400'
                    : 'border-emerald-500/50 text-emerald-600 dark:text-emerald-400'
                }`}>
                  <span className={`w-2 h-2 rounded-full animate-pulse ${positioningMode === 'standard_gps' ? 'bg-red-500' : 'bg-emerald-500'}`} />
                  {positioningMode === 'standard_gps'
                    ? `Std GPS · ±${corsSample.rawGpsErrorM.toFixed(1)}m`
                    : positioningMode === 'compare'
                    ? `CORS-RTK ±${(corsSample.corsAiErrorM * 100).toFixed(1)}cm vs GPS ±${corsSample.rawGpsErrorM.toFixed(1)}m`
                    : `SoI CORS-RTK Fixed · ±${(corsSample.corsAiErrorM * 100).toFixed(1)}cm`}
                </div>
              ) : liveCoords ? (
                <div className="rounded-lg bg-card/90 backdrop-blur px-2 py-1 text-[10px] leading-tight font-medium border border-border shadow flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  {positioningMode === 'standard_gps' ? 'GPS live' : 'CORS-RTK ready'}
                  {!latLngMap && ' (no calibration)'}{gpsMode && ' · auto-guide'}
                  {liveCoords.accuracy != null && ` · ±${Math.round(liveCoords.accuracy)}m`}
                </div>
              ) : gpsError ? (
                <div className="rounded-full bg-card/90 backdrop-blur px-3 py-1 text-[10px] font-medium border border-destructive/50 text-destructive shadow">
                  GPS: {gpsError}
                </div>
              ) : gpsEnabled ? (
                <div className="rounded-full bg-card/90 backdrop-blur px-3 py-1 text-[10px] font-medium border border-border shadow flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                  Acquiring GNSS / CORS…
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile bottom nav — fixed, big tap targets */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 grid grid-cols-[56px_48px_minmax(0,1fr)_64px] items-stretch h-[calc(4rem+env(safe-area-inset-bottom))] border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <button
          onClick={() => setMobileTab('nav')}
          className="flex min-w-0 flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-foreground active:bg-muted transition-colors"
          aria-label="Navigation"
        >
          <NavIcon className="w-5 h-5 text-primary" />
          <span>{t('nav.title')}</span>
        </button>
        <button
          onClick={() => setMobileTab('console')}
          className="flex min-w-0 flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-foreground active:bg-muted transition-colors"
          aria-label="Console"
        >
          <Terminal className="w-5 h-5" />
          <span>Logs</span>
        </button>
        <div className="flex min-w-0 items-center justify-center px-1">
          <LanguageMenu className="w-full px-1.5" />
        </div>
        {isAdminUser ? (
          <button
            onClick={() => setMobileTab('admin')}
            className="flex min-w-0 flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-foreground active:bg-muted transition-colors"
            aria-label="Admin"
          >
            <Shield className="w-5 h-5 text-primary" />
            <span>Admin</span>
          </button>
        ) : (
          <div className="flex min-w-0 items-center justify-center [&_button]:h-10 [&_button]:max-w-full [&_button]:px-1.5 [&_button]:text-[10px]">
            <AdminLoginButton
              user={authUser}
              isAdmin={isAdminUser}
              onLogin={() => {}}
              onLogout={() => setIsAdminUser(false)}
            />
          </div>
        )}
      </nav>

      {/* Mobile Navigation drawer */}
      <Sheet open={mobileTab === 'nav'} onOpenChange={(o) => !o && setMobileTab(null)}>
        <SheetContent side="bottom" className="h-[80dvh] p-0 rounded-t-2xl overflow-y-auto overscroll-contain">
          <SheetHeader className="p-4 pb-2">
            <SheetTitle>{t('nav.title')}</SheetTitle>
          </SheetHeader>
          <NavigationPanel
            visibleNodes={visibleNodes} startNode={startNode.startsWith('j_') ? '' : startNode} destNode={destNode}
            onStartChange={setStartNode} onDestChange={setDestNode}
            onNavigate={() => { handleStartNav(); setMobileTab(null); }}
            onVoiceCommand={(d, acc, tr) => { handleVoiceCommand(d, acc, tr); setMobileTab(null); }}
            isNavigating={isNavigating}
            speechEnabled={speechEnabled}
            onToggleSpeech={() => { setSpeechEnabled(s => !s); if (speechEnabled) cancelSpeech(); }}
          />
          <CorsTelemetryPanel
            mode={positioningMode}
            onModeChange={setPositioningMode}
            accessibleMode={accessibleMode}
            onAccessibleChange={handleAccessibleChange}
            latestSample={corsSample}
            telemetry={telemetry}
            isSimulating={isSimulatingCors}
            canSimulate={visibleNodes.length >= 2}
            onToggleSimulation={() => { handleToggleCorsSimulation(); setMobileTab(null); }}
          />
          {!isAdminUser && (
            <div className="p-3 border-t border-border">
              <StatsPanel points={points} connections={connections} />
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Mobile Console drawer */}
      <Sheet open={mobileTab === 'console'} onOpenChange={(o) => !o && setMobileTab(null)}>
        <SheetContent side="bottom" className="h-[60dvh] p-0 rounded-t-2xl overflow-y-auto overscroll-contain">
          <SheetHeader className="p-4 pb-2">
            <SheetTitle>Activity Log</SheetTitle>
          </SheetHeader>
          <div className="p-3">
            <ConsoleLog logs={logs} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Mobile Admin drawer */}
      <Sheet open={mobileTab === 'admin'} onOpenChange={(o) => !o && setMobileTab(null)}>
        <SheetContent side="bottom" className="h-[90dvh] p-0 rounded-t-2xl overflow-y-auto overscroll-contain">
          <SheetHeader className="p-4 pb-2 flex-row items-center justify-between">
            <SheetTitle>Admin Panel</SheetTitle>
            <div className="flex gap-2">
              <AdminManager isAdmin={isAdminUser} user={authUser} />
              <AdminLoginButton
                user={authUser}
                isAdmin={isAdminUser}
                onLogin={() => {}}
                onLogout={() => { setIsAdminUser(false); setMobileTab(null); }}
              />
            </div>
          </SheetHeader>
          {isAdminUser && (
            <div className="flex flex-col">
              <div className="flex border-y border-border overflow-x-auto">
                {editorTabs.map(tab => (
                  <button key={tab.key} onClick={() => setEditorTab(tab.key)}
                    className={`flex-1 min-w-[80px] flex items-center justify-center gap-1 py-3 text-xs font-medium transition-colors ${
                      editorTab === tab.key
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>
              {editorTab === 'staff' && <StaffDataEditor staff={staff} onUpdate={handleStaffUpdate} mapNodes={Object.keys(points)} />}
              {editorTab === 'labs' && <LabsEditor labs={labs} onUpdate={handleLabsUpdate} mapNodes={Object.keys(points)} />}
              {editorTab === 'clubs' && <ClubsEditor clubs={clubs} onUpdate={handleClubsUpdate} mapNodes={Object.keys(points)} />}
              {editorTab === 'events' && <EventsEditor events={events} onUpdate={handleEventsUpdate} mapNodes={Object.keys(points)} />}
              {editorTab === 'depts' && <DepartmentsEditor />}
              {editorTab === 'map' && (
                <>
                  <EditorPanel
                    editMode={editMode} points={points} connections={connections}
                    selectedNode={selectedNode}
                    onToggleEdit={() => { setEditMode(!editMode); setSelectedNode(null); }}
                    onSave={handleSave} onDeleteNode={handleConfirmDelete}
                    onRenameNode={handleRenameNode} onUpdateNodeMeta={handleUpdateNodeMeta}
                    onAddConnection={handleAddConnection} onRemoveConnection={handleRemoveConnection}
                    onUpdateRoadGeometry={handleUpdateRoadGeometry}
                    onPreviewRoadGeometry={handlePreviewRoadGeometry}
                    isSaving={isSaving}
                  />
                  <div className="px-3 pb-2 space-y-1">
                    <p className="text-xs text-muted-foreground">Map Background URL</p>
                    <Input value={mapImageUrl} onChange={e => setMapImageUrl(e.target.value)}
                      placeholder="https://example.com/map.png" className="h-10 text-sm" />
                  </div>
                </>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Edit app name Dialog */}
      <Dialog open={nameEditOpen} onOpenChange={setNameEditOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit app name</DialogTitle>
            <DialogDescription>Shown in the header for everyone. Leave blank to use the default.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Input value={titleDraft} onChange={e => setTitleDraft(e.target.value)} placeholder={t('app.title')} />
            <Input value={subtitleDraft} onChange={e => setSubtitleDraft(e.target.value)} placeholder={t('app.subtitle')} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNameEditOpen(false)}>Cancel</Button>
            <Button onClick={async () => {
              try {
                await saveAppTitle(titleDraft.trim());
                await saveAppSubtitle(subtitleDraft.trim());
                setNameEditOpen(false);
              } catch (e) { console.error('Failed to save app name:', e); }
            }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Add Node Dialog */}
      <Dialog open={promptOpen} onOpenChange={setPromptOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add New Node</DialogTitle>
            <DialogDescription>Enter a name for the new map node.</DialogDescription>
          </DialogHeader>
          <Input value={promptValue} onChange={e => setPromptValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddNode(); }}
            placeholder="Node name..." autoFocus />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPromptOpen(false)}>Cancel</Button>
            <Button onClick={handleAddNode}>Add Node</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Node</DialogTitle>
            <DialogDescription>Delete "{pendingDelete.replace(/_/g, ' ')}"?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
