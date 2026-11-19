# Campus Navigator Pro

import { useState, useRef, useCallback, useEffect } from 'react';
import { Map, MapPin, Shield, RotateCcw, FlaskConical, Users, CalendarDays, Menu, X } from 'lucide-react';
import {
  INITIAL_POINTS, INITIAL_CONNECTIONS, calculateFastestPath,
  getVisibleNodes, calculateDirection, formatNodeName, saveMapData, loadMapData
} from '@/lib/campus-data';
import type { PointsMap, Connection } from '@/lib/campus-data';
import { subscribeStaff, saveAllStaffToFirebase } from '@/lib/staff-data';
import type { StaffRecord } from '@/lib/staff-data';
import {
  subscribeLabs, saveAllLabs, subscribeClubs, saveAllClubs, subscribeEvents, saveAllEvents,
} from '@/lib/campus-extra-data';
import type { LabRecord, ClubRecord, EventRecord } from '@/lib/campus-extra-data';
import { saveMapDataToFirebase, loadMapDataFromFirebase, saveMapImageUrl, loadMapImageUrl } from '@/lib/map-firebase';
import { speak, cancelSpeech } from '@/lib/speech';
import { CampusMap } from '@/components/CampusMap';
import { NavigationPanel } from '@/components/NavigationPanel';
import { EditorPanel } from '@/components/EditorPanel';
import { StaffDataEditor } from '@/components/StaffDataEditor';
import { LabsEditor } from '@/components/LabsEditor';
import { ClubsEditor } from '@/components/ClubsEditor';
import { EventsEditor } from '@/components/EventsEditor';
import { ConsoleLog } from '@/components/ConsoleLog';
import { StatsPanel } from '@/components/StatsPanel';
import { UserFlowWizard, type UserFlowData } from '@/components/UserFlowWizard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';

const DEFAULT_MAP_URL = 'https://i.postimg.cc/BndNjYp2/map.png';

type EditorTab = 'staff' | 'labs' | 'clubs' | 'events' | 'map';

export default function Index() {
  const [flowComplete, setFlowComplete] = useState(false);
  const [userData, setUserData] = useState(null);

  const [points, setPoints] = useState(() => {
    const saved = loadMapData();
    return saved ? saved.points : INITIAL_POINTS;
  });
  const [connections, setConnections] = useState(() => {
    const saved = loadMapData();
    return saved ? saved.connections : INITIAL_CONNECTIONS;
  });

  const [staff, setStaff] = useState([]);
  const [labs, setLabs] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [events, setEvents] = useState([]);
  const [mapImageUrl, setMapImageUrl] = useState(DEFAULT_MAP_URL);

  const [setupMode, setSetupMode] = useState(false);
  const [editorTab, setEditorTab] = useState('staff');
  const [editMode, setEditMode] = useState(false);
  const [startNode, setStartNode] = useState('main_gate');
  const [destNode, setDestNode] = useState('');
  const [logs, setLogs] = useState([]);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(true);
   const [selectedNode, setSelectedNode] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);

  const [promptOpen, setPromptOpen] = useState(false);
  const [promptValue, setPromptValue] = useState('');
  const [pendingCoords, setPendingCoords] = useState<{ x: number; y: number } | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState('');

  const navStateRef = useRef({ path: [] as string[], segment: 0, progress: 0 });

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
      subscribeEvents(setEvents),
    ];
    return () => unsubs.forEach(u => u());
  }, []);

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [...prev.slice(-20), `>> ${msg}`]);
  }, []);

  const speakAndLog = useCallback(async (text: string) => {
    addLog(`🗣️ ${text}`);
    if (speechEnabled) await speak(text);
  }, [addLog, speechEnabled]);

  const visibleNodes = getVisibleNodes(points);

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
    setStartNode('main_gate');

    const roomInfo = data.room ? `Room ${data.room}` : '';
    const floorInfo = data.floor !== undefined ? `Floor ${data.floor}` : '';
    const locationInfo = [roomInfo, floorInfo].filter(Boolean).join(', ');

    addLog(`👤 ${data.name} (${data.role})`);
    addLog(`📍 Destination: ${formatNodeName(data.destination)} — ${locationInfo}`);

    setTimeout(async () => {
      await startNavigation('main_gate', data.destination, locationInfo);
    }, 1000);
  };

  const startNavigation = async (start: string, dest: string, locationInfo?: string) => {
    if (!start || !dest || start === dest) return;
    const path = calculateFastestPath(start, dest, points, connections);
    if (path.length === 0) { addLog('⚠️ No route found.'); return; }
    if (editMode) setEditMode(false);
    setIsNavigating(true);
    navStateRef.current.path = path;

    addLog(`🧭 Routing: ${formatNodeName(start)} → ${formatNodeName(dest)}`);
    const info = locationInfo || '';

    await speakAndLog(
      `Welcome ${userData?.name || ''}. Navigating to ${formatNodeName(dest)}.` +
      (info ? ` You are assigned to ${info}.` : '')
    );

    for (let i = 0; i < path.length - 1; i++) {
      navStateRef.current.segment = i;
      const nextName = path[i + 1];
      let instruction: string;

      if (i === 0) {
        instruction = `Head towards ${formatNodeName(nextName)}`;
      } else {
        const prevPt = points[path[i - 1]];
        const currPt = points[path[i]];
        const nextPt = points[nextName];
        const turn = calculateDirection(prevPt, currPt, nextPt);
        const landmark = path[i].startsWith('j_') ? '' : ` at ${formatNodeName(path[i])}`;
        instruction = `${turn}${landmark} towards ${formatNodeName(nextName)}`;
      }

      await speakAndLog(instruction);

      await new Promise(resolve => {
        const startTime = performance.now();
        const step = (time: number) => {
          const progress = Math.min((time - startTime) / 800, 1);
          navStateRef.current.progress = progress;
          if (progress < 1) requestAnimationFrame(step); else resolve();
        };
        requestAnimationFrame(step);
      });
    }

    await speakAndLog(
      `You have arrived at ${formatNodeName(dest)}.` +
      (info ? ` Your assigned location is ${info}.` : '')
    );
    addLog('✅ DESTINATION REACHED.');
    setTimeout(() => setIsNavigating(false), 2000);
  };

  const handleStartNav = () => startNavigation(startNode, destNode);

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
    setConnections(prev => prev.filter(c => c[0] !== pendingDelete && c[1] !== pendingDelete));
    setSelectedNode(null);
    addLog(`Deleted node: ${pendingDelete}`);
    setDeleteOpen(false);
  };

  const handleRenameNode = (oldName: string, newName: string) => {
    const clean = newName.toLowerCase().replace(/\s+/g, '_');
    setPoints(prev => { const n = { ...prev }; n[clean] = n[oldName]; delete n[oldName]; return n; });
    setConnections(prev => prev.map(([a, b, w]) => [a === oldName ? clean : a, b === oldName ? clean : b, w] as Connection));
    setSelectedNode(clean);
    addLog(`Renamed: ${oldName} → ${clean}`);
  };

  const handleUpdateNodeMeta = (name: string, field: string, value: any) => {
    setPoints(prev => ({ ...prev, [name]: { ...prev[name], [field]: value } }));
  };

  const handleAddConnection = (a: string, b: string) => {
    if (!connections.some(c => (c[0] === a && c[1] === b) || (c[0] === b && c[1] === a))) {
      setConnections(prev => [...prev, [a, b, 1]]);
      addLog(`Connected: ${a} ↔ ${b}`);
    }
  };

  const handleRemoveConnection = (a: string, b: string) => {
    setConnections(prev => prev.filter(c => !(c[0] === a && c[1] === b) && !(c[0] === b && c[1] === a)));
    addLog(`Disconnected: ${a} ↔ ${b}`);
  };

  const handleDragNode = (name: string, x: number, y: number) => {
    setPoints(prev => ({ ...prev, [name]: { ...prev[name], x, y } }));
  };

  useEffect(() => () => cancelSpeech(), []);

  // Wizard screen
  if (!flowComplete && !setupMode) {
    return (
       setSetupMode(true)}
        onOpenMap={() => { setFlowComplete(true); }}
        initialData={userData}
        initialStep={wizardStep}
      />
    );
  }

  const editorTabs: { key: EditorTab; label: string; icon: React.ReactNode }[] = [
    { key: 'staff', label: 'Staff', icon:  },
    { key: 'labs', label: 'Labs', icon:  },
    { key: 'clubs', label: 'Clubs', icon:  },
    { key: 'events', label: 'Events', icon:  },
    { key: 'map', label: 'Map', icon:  },
  ];

  return (
    


      {/* Header */}
      


        


          
        


        


          

NURA Mesh


          


            {userData ? `${userData.name} • ${userData.role}` : 'Campus Navigation'}
            {userData?.room ? ` • Room ${userData.room}, Floor ${userData.floor}` : ''}
          


        


        
         setSidebarOpen(s => !s)}
        >
          {sidebarOpen ?  : }
        
         {
            if (flowComplete) {
              setFlowComplete(false);
              setWizardStep(2);
              setIsNavigating(false);
              cancelSpeech();
            }
            else { setSetupMode(false); }
          }}
        >
          
          {flowComplete ? 'New Session' : 'Back'}
        
      



      {/* Main Content */}
      


        {/* Map Area */}
        


          


            
          


        



        {/* Sidebar - slides in on mobile */}
        


          


            {/* Navigation Controls */}
             { setSpeechEnabled(s => !s); if (speechEnabled) cancelSpeech(); }}
            />

            {/* Editor Tabs */}
            


              {editorTabs.map(tab => (
                 setEditorTab(tab.key)}
                  className={`flex-1 flex items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors ${
                    editorTab === tab.key
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                
              ))}
            



            {/* Tab Content */}
            {editorTab === 'staff' && (
              
            )}
            {editorTab === 'labs' && (
              
            )}
            {editorTab === 'clubs' && (
              
            )}
            {editorTab === 'events' && (
              
            )}
            {editorTab === 'map' && (
              <>
                 { setEditMode(!editMode); setSelectedNode(null); }}
                  onSave={handleSave} onDeleteNode={handleConfirmDelete}
                  onRenameNode={handleRenameNode} onUpdateNodeMeta={handleUpdateNodeMeta}
                  onAddConnection={handleAddConnection} onRemoveConnection={handleRemoveConnection}
                  isSaving={isSaving}
                />
                


                  

Map Background URL


                   setMapImageUrl(e.target.value)}
                    placeholder="https://example.com/map.png" className="h-7 text-xs" />
                


              
            )}

            {/* Console */}
            
          


        


      



      {/* Add Node Dialog */}
      
        
          
            Add New Node
            Enter a name for the new map node.
          
           setPromptValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddNode(); }}
            placeholder="Node name..." autoFocus />
          
             setPromptOpen(false)}>Cancel
            Add Node
          
        
      

      {/* Delete Dialog */}
      
        
          
            Delete Node
            Delete "{pendingDelete.replace(/_/g, ' ')}"?
          
          
             setDeleteOpen(false)}>Cancel
            Delete
          
        
      
    


  );
}
now the editor mode should be available to only admins. i'm the admin and ill provide admin to others using their emails (there should be an option for me to give admin role for others). only for admins the editor should be accesseble remaing features should be same for admins and users dont ask any gmail for users ask only for admins
my mail hariprasad143nh@gmail.com

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://adityauniversity-guide.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/09f5e8a3-28fa-43cd-8543-4fc82a62ba8a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
