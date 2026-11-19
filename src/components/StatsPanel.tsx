import { MapPin, GitBranch } from 'lucide-react';
import type { PointsMap, Connection } from '@/lib/campus-data';

interface StatsPanelProps {
  points: PointsMap;
  connections: Connection[];
}

export function StatsPanel({ points, connections }: StatsPanelProps) {
  const nodeCount = Object.keys(points).length;
  const visibleCount = Object.keys(points).filter(k => !k.startsWith('j_')).length;

  return (
    <div className="flex gap-3 text-xs text-muted-foreground px-3 py-2">
      <div className="flex items-center gap-1">
        <MapPin className="w-3 h-3" />
        {visibleCount} locations ({nodeCount} total)
      </div>
      <div className="flex items-center gap-1">
        <GitBranch className="w-3 h-3" />
        {connections.length} paths
      </div>
    </div>
  );
}
