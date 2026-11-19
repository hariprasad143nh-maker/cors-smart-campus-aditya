import { useRef, useEffect, useCallback, useMemo } from 'react';
import { connectionId, orientedRoadPoints, type PointsMap, type Connection, type RoadPoint } from '@/lib/campus-data';
import type { CorsPositionSample, PositioningMode } from '@/lib/cors-rtk';

interface CampusMapProps {
  points: PointsMap;
  connections: Connection[];
  editMode: boolean;
  navPath: string[];
  navSegment: number;
  navProgress: number;
  isNavigating: boolean;
  selectedNode: string | null;
  mapImageUrl?: string;
  liveXY?: { x: number; y: number } | null;
  followUser?: boolean;
  positioningMode?: PositioningMode;
  corsSample?: CorsPositionSample | null;
  rawDriftTrail?: Array<{ x: number; y: number }>;
  corsTrail?: Array<{ x: number; y: number }>;
  accessibleMode?: boolean;
  previewRoad?: { id: string; geometry: RoadPoint[] } | null;
  onSelectNode: (name: string | null) => void;
  onDragNode: (name: string, x: number, y: number) => void;
  onAddNode: (x: number, y: number) => void;
}

// Dynamic: compute bounding box from points to auto-fit all nodes
function computeRefBounds(points: PointsMap) {
  const xs = Object.values(points).map(p => p.x);
  const ys = Object.values(points).map(p => p.y);
  if (xs.length === 0) return { refW: 800, refH: 700 };
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const padX = (maxX - minX) * 0.08 || 50;
  const padY = (maxY - minY) * 0.08 || 50;
  return {
    refW: maxX - minX + padX * 2,
    refH: maxY - minY + padY * 2,
    offsetX: minX - padX,
    offsetY: minY - padY,
  };
}

export function CampusMap({
  points, connections, editMode, navPath, navSegment, navProgress,
  isNavigating, selectedNode, mapImageUrl, liveXY, followUser,
  positioningMode = 'compare', corsSample, rawDriftTrail = [], corsTrail = [],
  accessibleMode = false, previewRoad,
  onSelectNode, onDragNode, onAddNode
}: CampusMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragging = useRef<string | null>(null);
  const animRef = useRef(0);
  const mapImgRef = useRef<HTMLImageElement | null>(null);
  const touchRef = useRef<string | null>(null);
  // Stable bounds: only recalculate when node count changes (add/delete), not on drag
  const nodeCount = Object.keys(points).length;
  const stableBounds = useMemo(() => computeRefBounds(points), [nodeCount]);

  useEffect(() => {
    if (mapImageUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = mapImageUrl;
      img.onload = () => { mapImgRef.current = img; };
    } else {
      mapImgRef.current = null;
    }
  }, [mapImageUrl]);

  const getColor = (type?: string) => {
    switch (type) {
      case 'hostel': return '#22c55e';
      case 'lab': return '#f59e0b';
      case 'office': return '#8b5cf6';
      case 'reception': return '#3b82f6';
      case 'fee_counter': return '#ef4444';
      case 'building': return '#06b6d4';
      default: return '#64748b';
    }
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const bounds = stableBounds;
    const scale = Math.min(w / bounds.refW, h / bounds.refH);
    const ox = bounds.offsetX || 0;
    const oy = bounds.offsetY || 0;
    const contentW = bounds.refW * scale;
    const contentH = bounds.refH * scale;
    const contentX = (w - contentW) / 2;
    const contentY = (h - contentH) / 2;

    // Optional camera-follow: shift so the user dot stays near the center
    // of the visible area while navigating (like Google Maps).
    let panX = 0, panY = 0;
    if (followUser && liveXY && isNavigating) {
      const targetX = contentX + (liveXY.x - ox) * scale;
      const targetY = contentY + (liveXY.y - oy) * scale;
      panX = w / 2 - targetX;
      panY = h / 2 - targetY;
    }
    const tx = (x: number) => contentX + (x - ox) * scale + panX;
    const ty = (y: number) => contentY + (y - oy) * scale + panY;

    if (mapImgRef.current) {
      ctx.fillStyle = 'hsl(220, 25%, 12%)';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(
        mapImgRef.current,
        contentX - ox * scale + panX,
        contentY - oy * scale + panY,
        mapImgRef.current.naturalWidth * scale,
        mapImgRef.current.naturalHeight * scale
      );
      ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.fillStyle = 'hsl(220, 25%, 12%)';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.1)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = 0; y < h; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }
    }

    const uiScale = Math.max(0.6, Math.min(1, scale));

    // Visibility rules:
    //  - When NOT navigating (and not in edit mode): hide ALL nodes & edges.
    //  - When navigating: show ONLY the REMAINING part of navPath (already
    //    travelled path segments disappear behind the moving dot).
    //  - In edit mode: always show everything so admins can edit.
    const remainingPath = isNavigating ? navPath.slice(navSegment) : [];
    const pathSet = new Set(remainingPath);
    // Index of an edge in the path: returns the smallest i with path[i]->path[i+1]
    const pathEdgeIndex = (a: string, b: string) => {
      for (let i = 0; i < navPath.length - 1; i++) {
        if ((navPath[i] === a && navPath[i + 1] === b) || (navPath[i] === b && navPath[i + 1] === a)) return i;
      }
      return -1;
    };

    // Current position along the route (head of the remaining path line)
    let headX: number | null = null, headY: number | null = null;
    if (isNavigating && navPath.length > 1 && navSegment < navPath.length - 1) {
      const from = points[navPath[navSegment]];
      const to = points[navPath[navSegment + 1]];
      if (from && to) {
        headX = from.x + (to.x - from.x) * navProgress;
        headY = from.y + (to.y - from.y) * navProgress;
      }
    }

    for (const connection of connections) {
      const a = connection.from;
      const b = connection.to;
      const pA = points[a], pB = points[b];
      if (!pA || !pB) continue;
      const edgeIdx = pathEdgeIndex(a, b);
      const onPathEdge = edgeIdx >= 0;
      const isRemainingEdge = onPathEdge && edgeIdx >= navSegment;
      const isPreviewEdge = previewRoad && connectionId(connection) === previewRoad.id;
      if (editMode) {
        // show all in edit mode
      } else if (isNavigating) {
        if (!isRemainingEdge) continue; // only the road ahead
      } else {
        continue; // hide all when idle
      }
      const isOnPath = isNavigating && isRemainingEdge;
      const activeGeom = isPreviewEdge ? previewRoad!.geometry : connection.geometry;
      const chain = orientedRoadPoints({ ...connection, geometry: activeGeom }, a, points);

      ctx.beginPath();
      if (chain.length > 2) {
        ctx.moveTo(tx(chain[0].x), ty(chain[0].y));
        for (let k = 1; k < chain.length; k++) {
          ctx.lineTo(tx(chain[k].x), ty(chain[k].y));
        }
      } else {
        // For the segment the user is currently on, start the line at the dot so
        // the travelled part vanishes progressively.
        let sx = pA.x, sy = pA.y, ex = pB.x, ey = pB.y;
        if (isOnPath && edgeIdx === navSegment && headX != null && headY != null) {
          const forward = navPath[navSegment] === a;
          if (forward) { sx = headX; sy = headY; }
          else { ex = headX; ey = headY; }
        }
        ctx.moveTo(tx(sx), ty(sy));
        ctx.lineTo(tx(ex), ty(ey));
      }
      if (isPreviewEdge) {
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 3.5 * uiScale;
      } else if (isOnPath) {
        ctx.strokeStyle = accessibleMode ? '#06b6d4' : '#3b82f6';
        ctx.lineWidth = 3.5 * uiScale;
      } else if (connection.hasStairs) {
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.55)';
        ctx.lineWidth = 1.5 * uiScale;
      } else {
        ctx.strokeStyle = 'rgba(100, 116, 139, 0.4)';
        ctx.lineWidth = 1.5 * uiScale;
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Destination pointer (map pin) at the end of the route
    if (isNavigating && navPath.length > 0) {
      const destPt = points[navPath[navPath.length - 1]];
      if (destPt) {
        const dx = tx(destPt.x), dy = ty(destPt.y);
        const pinH = 30 * uiScale;
        const r = 9 * uiScale;
        const cy = dy - pinH;
        // shadow
        ctx.beginPath();
        ctx.ellipse(dx, dy, 6 * uiScale, 2.5 * uiScale, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fill();
        // pin body
        ctx.beginPath();
        ctx.moveTo(dx, dy);
        ctx.lineTo(dx - r * 0.75, cy + r * 0.6);
        ctx.lineTo(dx + r * 0.75, cy + r * 0.6);
        ctx.closePath();
        ctx.fillStyle = '#ef4444';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(dx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2 * uiScale;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(dx, cy, r * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }
    }

    // Moving dot along the route (route progress head)
    if (headX != null && headY != null) {
      const cx = tx(headX);
      const cy = ty(headY);
      ctx.beginPath();
      ctx.arc(cx, cy, 10 * uiScale, 0, Math.PI * 2);
      ctx.fillStyle = '#3b82f6';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, 14 * uiScale, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)';
      ctx.lineWidth = 3 * uiScale;
      ctx.stroke();
    }


    // CORS-RTK vs Standard GPS live comparison visualization
    if (corsSample) {
      const showStd = positioningMode === 'standard_gps' || positioningMode === 'compare';
      const showCors = positioningMode === 'cors_rtk' || positioningMode === 'compare';
      const pulse = (Math.sin(Date.now() / 320) + 1) / 2;

      // 1. Standard GPS drift trail + uncertainty circle (Red)
      if (showStd) {
        if (rawDriftTrail.length > 1) {
          ctx.beginPath();
          ctx.setLineDash([5, 4]);
          ctx.moveTo(tx(rawDriftTrail[0].x), ty(rawDriftTrail[0].y));
          for (let i = 1; i < rawDriftTrail.length; i++) {
            ctx.lineTo(tx(rawDriftTrail[i].x), ty(rawDriftTrail[i].y));
          }
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.75)';
          ctx.lineWidth = 2 * uiScale;
          ctx.stroke();
          ctx.setLineDash([]);
        }

        const rx = tx(corsSample.rawGpsX);
        const ry = ty(corsSample.rawGpsY);
        const errRadiusPx = Math.max(16, Math.min(54, corsSample.rawGpsErrorM * 2.4 * scale));
        ctx.beginPath();
        ctx.arc(rx, ry, errRadiusPx, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.14)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.55)';
        ctx.lineWidth = 1.5 * uiScale;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(rx, ry, 6.5 * uiScale, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5 * uiScale;
        ctx.stroke();

        const gpsTag = `Std GPS (±${corsSample.rawGpsErrorM.toFixed(1)}m)`;
        const fs = Math.max(9, 10 * uiScale);
        ctx.font = `600 ${fs}px system-ui, sans-serif`;
        const tw = ctx.measureText(gpsTag).width;
        ctx.fillStyle = 'rgba(127, 29, 29, 0.88)';
        ctx.fillRect(rx - tw / 2 - 4, ry - 24 * uiScale, tw + 8, 14 * uiScale);
        ctx.fillStyle = '#fee2e2';
        ctx.textAlign = 'center';
        ctx.fillText(gpsTag, rx, ry - 14 * uiScale);
      }

      // 2. Compare vector line showing real-time multipath error suppression
      if (positioningMode === 'compare') {
        const rx = tx(corsSample.rawGpsX);
        const ry = ty(corsSample.rawGpsY);
        const cx = tx(corsSample.x);
        const cy = ty(corsSample.y);
        ctx.beginPath();
        ctx.setLineDash([3, 3]);
        ctx.moveTo(rx, ry);
        ctx.lineTo(cx, cy);
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 1.5 * uiScale;
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 3. CORS-RTK + AI locked trail & centimeter halo (Emerald)
      if (showCors) {
        if (corsTrail.length > 1) {
          ctx.beginPath();
          ctx.moveTo(tx(corsTrail[0].x), ty(corsTrail[0].y));
          for (let i = 1; i < corsTrail.length; i++) {
            ctx.lineTo(tx(corsTrail[i].x), ty(corsTrail[i].y));
          }
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 3 * uiScale;
          ctx.stroke();
        }

        const cx = tx(corsSample.x);
        const cy = ty(corsSample.y);
        ctx.beginPath();
        ctx.arc(cx, cy, (11 + pulse * 4) * uiScale, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(16, 185, 129, ${0.18 + pulse * 0.18})`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(cx, cy, 7.5 * uiScale, 0, Math.PI * 2);
        ctx.fillStyle = '#10b981';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2 * uiScale;
        ctx.stroke();

        const rtkTag = `CORS-RTK (±${(corsSample.corsAiErrorM * 100).toFixed(1)}cm)`;
        const fs = Math.max(9, 10 * uiScale);
        ctx.font = `700 ${fs}px system-ui, sans-serif`;
        const tw = ctx.measureText(rtkTag).width;
        ctx.fillStyle = 'rgba(6, 78, 59, 0.92)';
        ctx.fillRect(cx - tw / 2 - 5, cy + 12 * uiScale, tw + 10, 15 * uiScale);
        ctx.fillStyle = '#d1fae5';
        ctx.textAlign = 'center';
        ctx.fillText(rtkTag, cx, cy + 23 * uiScale);
      }
    }

    // Live GPS "You are here" dot — green, pulsing, drawn above everything.
    if (liveXY && !corsSample) {
      const lx = tx(liveXY.x);
      const ly = ty(liveXY.y);
      const pulse = (Math.sin(Date.now() / 350) + 1) / 2; // 0..1
      ctx.beginPath();
      ctx.arc(lx, ly, (14 + pulse * 6) * uiScale, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(34, 197, 94, ${0.15 + pulse * 0.2})`;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(lx, ly, 8 * uiScale, 0, Math.PI * 2);
      ctx.fillStyle = '#22c55e';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2 * uiScale;
      ctx.stroke();
      const tag = 'You';
      const fs = Math.max(9, 10 * uiScale);
      ctx.font = `600 ${fs}px system-ui, sans-serif`;
      const tw = ctx.measureText(tag).width;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.fillRect(lx - tw / 2 - 4, ly + 12 * uiScale, tw + 8, 14 * uiScale);
      ctx.fillStyle = '#dcfce7';
      ctx.textAlign = 'center';
      ctx.fillText(tag, lx, ly + 22 * uiScale);
    }

    for (const [name, pt] of Object.entries(points)) {
      // Visibility: in nav, only show path nodes; idle hides all; edit shows all
      if (!editMode && !isNavigating) continue;
      if (isNavigating && !pathSet.has(name)) continue;
      const px = tx(pt.x);
      const py = ty(pt.y);

      if (name.startsWith('j_')) {
        ctx.beginPath();
        ctx.arc(px, py, 4 * uiScale, 0, Math.PI * 2);
        ctx.fillStyle = '#475569';
        ctx.fill();
        continue;
      }

      const isSelected = selectedNode === name;
      const isOnPath = isNavigating && navPath.includes(name);
      const color = getColor(pt.type);
      const radius = (isSelected ? 12 : isOnPath ? 10 : 8) * uiScale;

      if (isSelected || isOnPath) {
        ctx.beginPath();
        ctx.arc(px, py, radius + 6 * uiScale, 0, Math.PI * 2);
        ctx.fillStyle = `${color}33`;
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = isSelected ? '#fff' : 'rgba(0,0,0,0.3)';
      ctx.lineWidth = isSelected ? 2.5 : 1;
      ctx.stroke();

      const label = name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const fontSize = Math.max(9, 11 * uiScale);
      ctx.font = `${fontSize}px system-ui, sans-serif`;
      const textW = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
      ctx.fillRect(px - textW / 2 - 3, py - radius - 18 * uiScale, textW + 6, 14 * uiScale);
      ctx.fillStyle = '#e2e8f0';
      ctx.textAlign = 'center';
      ctx.fillText(label, px, py - radius - 7 * uiScale);

      if (pt.room) {
        const roomLabel = `Room ${pt.room} • F${pt.floor ?? 0}`;
        const rFontSize = Math.max(7, 9 * uiScale);
        ctx.font = `${rFontSize}px system-ui, sans-serif`;
        const rw = ctx.measureText(roomLabel).width;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
        ctx.fillRect(px - rw / 2 - 3, py + radius + 3 * uiScale, rw + 6, 12 * uiScale);
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(roomLabel, px, py + radius + 12 * uiScale);
      }
    }

    animRef.current = requestAnimationFrame(draw);
  }, [points, connections, editMode, navPath, navSegment, navProgress, isNavigating, selectedNode, liveXY, followUser, positioningMode, corsSample, rawDriftTrail, corsTrail, accessibleMode, previewRoad]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw]);

  const getCanvasCoords = (clientX: number, clientY: number) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const bounds = stableBounds;
    const scale = Math.min(rect.width / bounds.refW, rect.height / bounds.refH);
    const ox = bounds.offsetX || 0;
    const oy = bounds.offsetY || 0;
    const contentW = bounds.refW * scale;
    const contentH = bounds.refH * scale;
    const contentX = (rect.width - contentW) / 2;
    const contentY = (rect.height - contentH) / 2;
    return {
      x: (clientX - rect.left - contentX) / scale + ox,
      y: (clientY - rect.top - contentY) / scale + oy,
    };
  };

  const findNode = (x: number, y: number) => {
    for (const [name, pt] of Object.entries(points)) {
      if (Math.sqrt((pt.x - x) ** 2 + (pt.y - y) ** 2) < 20) return name;
    }
    return null;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const { x, y } = getCanvasCoords(e.clientX, e.clientY);
    const node = findNode(x, y);
    if (editMode && node) {
      dragging.current = node;
      onSelectNode(node);
    } else if (node) {
      onSelectNode(node);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!editMode || !dragging.current) return;
    const { x, y } = getCanvasCoords(e.clientX, e.clientY);
    onDragNode(dragging.current, x, y);
  };

  const handleMouseUp = () => { dragging.current = null; };

  const handleDblClick = (e: React.MouseEvent) => {
    if (!editMode) return;
    const { x, y } = getCanvasCoords(e.clientX, e.clientY);
    if (!findNode(x, y)) onAddNode(x, y);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const { x, y } = getCanvasCoords(touch.clientX, touch.clientY);
    const node = findNode(x, y);
    if (editMode && node) {
      dragging.current = node;
      touchRef.current = node;
      onSelectNode(node);
      e.preventDefault();
    } else if (node) {
      onSelectNode(node);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!editMode || !dragging.current) return;
    e.preventDefault();
    const touch = e.touches[0];
    const { x, y } = getCanvasCoords(touch.clientX, touch.clientY);
    onDragNode(dragging.current, x, y);
  };

  const handleTouchEnd = () => {
    dragging.current = null;
    touchRef.current = null;
  };

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full cursor-crosshair"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleDblClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    />
  );
}
