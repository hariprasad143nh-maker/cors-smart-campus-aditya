import { useMemo, useState } from 'react';
import {
  Satellite, Radio, ShieldCheck, AlertTriangle, Accessibility,
  Activity, ChevronDown, ChevronUp, Play, Square, Sparkles
} from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  SOI_CORS_STATION,
  type CorsPositionSample,
  type PositioningMode,
  type TelemetryPoint,
} from '@/lib/cors-rtk';

interface CorsTelemetryPanelProps {
  mode: PositioningMode;
  onModeChange: (mode: PositioningMode) => void;
  accessibleMode: boolean;
  onAccessibleChange: (val: boolean) => void;
  latestSample: CorsPositionSample | null;
  telemetry: TelemetryPoint[];
  isSimulating: boolean;
  canSimulate: boolean;
  onToggleSimulation: () => void;
}

export function CorsTelemetryPanel({
  mode,
  onModeChange,
  accessibleMode,
  onAccessibleChange,
  latestSample,
  telemetry,
  isSimulating,
  canSimulate,
  onToggleSimulation,
}: CorsTelemetryPanelProps) {
  const [showNmea, setShowNmea] = useState(false);

  const avgStats = useMemo(() => {
    if (telemetry.length === 0) return { avgRaw: 7.4, avgCors: 0.016, reduction: 99.8, spikes: 0 };
    const avgRaw = telemetry.reduce((s, p) => s + p.rawGpsErrorM, 0) / telemetry.length;
    const avgCors = telemetry.reduce((s, p) => s + p.corsAiErrorM, 0) / telemetry.length;
    const reduction = avgRaw > 0 ? Math.max(0, ((avgRaw - avgCors) / avgRaw) * 100) : 99.8;
    const spikes = telemetry.filter((p) => p.multipathDetected).length;
    return { avgRaw, avgCors, reduction, spikes };
  }, [telemetry]);

  const isCorsActive = mode !== 'standard_gps';
  const activeErrorLabel = latestSample
    ? mode === 'standard_gps'
      ? `±${latestSample.rawGpsErrorM.toFixed(1)} m`
      : `±${(latestSample.corsAiErrorM * 100).toFixed(1)} cm`
    : mode === 'standard_gps'
    ? '±7.5 m'
    : '±1.5 cm';

  return (
    <div className="p-3 border-t border-border space-y-2.5 bg-card/60">
      {/* Header + Fix Status */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Satellite className={`w-4 h-4 shrink-0 ${isCorsActive ? 'text-emerald-500' : 'text-red-500'}`} />
          <span className="text-xs font-bold tracking-tight text-foreground truncate">
            SoI CORS-RTK + AI
          </span>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
            isCorsActive
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
              : 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isCorsActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
          {mode === 'standard_gps' ? 'GPS' : 'RTK FIXED'} · {activeErrorLabel}
        </span>
      </div>

      {/* Positioning Mode Switcher */}
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
        {(
          [
            { id: 'standard_gps', label: 'Std GPS' },
            { id: 'cors_rtk', label: 'CORS + AI' },
            { id: 'compare', label: 'Compare' },
          ] as { id: PositioningMode; label: string }[]
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onModeChange(item.id)}
            className={`rounded-md py-1.5 text-[10px] font-semibold transition-all ${
              mode === item.id
                ? item.id === 'standard_gps'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'bg-emerald-600 text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Live Demo Simulator Button */}
      <Button
        size="sm"
        variant={isSimulating ? 'destructive' : 'secondary'}
        className="w-full h-8 text-xs font-semibold"
        onClick={onToggleSimulation}
        disabled={!canSimulate && !isSimulating}
      >
        {isSimulating ? (
          <>
            <Square className="w-3.5 h-3.5 mr-1.5 fill-current" />
            Stop CORS Rover Simulation
          </>
        ) : (
          <>
            <Play className="w-3.5 h-3.5 mr-1.5 fill-current" />
            Simulate Live CORS Walk
          </>
        )}
      </Button>

      {/* Wheelchair / Tactile Accessible Routing Toggle */}
      <div className="flex items-center justify-between rounded-md border border-border bg-background/60 px-2.5 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <Accessibility className={`w-4 h-4 shrink-0 ${accessibleMode ? 'text-blue-500' : 'text-muted-foreground'}`} />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-foreground leading-tight">
              Accessible / Ramp Mode
            </p>
            <p className="text-[9px] text-muted-foreground leading-tight truncate">
              Avoids stairs · 1.2 m sidewalk lock
            </p>
          </div>
        </div>
        <Switch checked={accessibleMode} onCheckedChange={onAccessibleChange} aria-label="Accessible wheelchair mode" />
      </div>

      {/* Station & Constellation Telemetry */}
      <div className="rounded-md border border-border bg-background/60 p-2 space-y-1.5 text-[10px]">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="flex items-center gap-1 font-medium text-foreground">
            <Radio className="w-3 h-3 text-emerald-500" />
            {SOI_CORS_STATION.id}
          </span>
          <span>Base: {SOI_CORS_STATION.baselineKm} km</span>
        </div>
        <div className="grid grid-cols-3 gap-1 pt-0.5 text-center">
          <div className="rounded bg-muted/60 px-1.5 py-1">
            <div className="text-[9px] text-muted-foreground">NavIC + GNSS</div>
            <div className="font-bold text-foreground">
              {mode === 'standard_gps' ? '9 sats' : `${SOI_CORS_STATION.navicSats}L5 / 32`}
            </div>
          </div>
          <div className="rounded bg-muted/60 px-1.5 py-1">
            <div className="text-[9px] text-muted-foreground">HDOP</div>
            <div className="font-bold text-foreground">
              {latestSample ? latestSample.hdop.toFixed(2) : isCorsActive ? '0.62' : '2.85'}
            </div>
          </div>
          <div className="rounded bg-muted/60 px-1.5 py-1">
            <div className="text-[9px] text-muted-foreground">Off-Route</div>
            <div className="font-bold text-foreground">{isCorsActive ? '1.2 m' : '22.0 m'}</div>
          </div>
        </div>

        {/* AI Multipath Suppression Status */}
        <div
          className={`flex items-center justify-between rounded px-2 py-1 border ${
            latestSample?.multipathDetected
              ? isCorsActive
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                : 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300'
              : 'bg-muted/40 border-transparent text-muted-foreground'
          }`}
        >
          <span className="flex items-center gap-1 font-medium">
            {latestSample?.multipathDetected ? (
              isCorsActive ? (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              )
            ) : (
              <Sparkles className="w-3 h-3 text-primary shrink-0" />
            )}
            {latestSample?.multipathDetected
              ? isCorsActive
                ? 'AI Kalman Suppressed Multipath!'
                : 'Building Multipath Drift!'
              : 'AI Multipath Filter Ready'}
          </span>
          <span className="font-mono font-semibold">{avgStats.spikes} fixed</span>
        </div>
      </div>

      {/* Live Recharts Error Comparison Graph */}
      <div className="rounded-md border border-border bg-background/60 p-2 space-y-1">
        <div className="flex items-center justify-between text-[10px]">
          <span className="flex items-center gap-1 font-semibold text-foreground">
            <Activity className="w-3 h-3 text-primary" />
            Error: GPS vs CORS+AI (m)
          </span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400">
            -{avgStats.reduction.toFixed(1)}%
          </span>
        </div>
        <div className="h-24 w-full">
          {telemetry.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={telemetry.slice(-24)} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <XAxis dataKey="label" hide />
                <YAxis tick={{ fontSize: 9 }} domain={[0, 'auto']} />
                <Tooltip
                  contentStyle={{
                    fontSize: '10px',
                    borderRadius: '6px',
                    padding: '4px 8px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="rawGpsErrorM"
                  name="Std GPS (m)"
                  stroke="#ef4444"
                  fill="#ef4444"
                  fillOpacity={0.2}
                  strokeWidth={1.5}
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="corsAiErrorM"
                  name="CORS+AI (m)"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.35}
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-[10px] text-muted-foreground text-center px-2">
              Start navigation or click “Simulate Live CORS Walk” to stream live error telemetry.
            </div>
          )}
        </div>
      </div>

      {/* Collapsible NMEA $GNGGA Stream */}
      <div className="rounded-md border border-border bg-background/60">
        <button
          type="button"
          onClick={() => setShowNmea((s) => !s)}
          className="w-full flex items-center justify-between px-2 py-1.5 text-[10px] font-medium text-muted-foreground hover:text-foreground"
        >
          <span>NMEA-0183 / RTCM 3.2 Feed</span>
          {showNmea ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
        {showNmea && (
          <div className="px-2 pb-2 space-y-1">
            <code className="block break-all rounded bg-slate-950 p-1.5 font-mono text-[9px] text-emerald-400">
              {latestSample?.nmeaGga ||
                '$GNGGA,152010.00,1705.36472,N,08204.00710,E,4,32,0.62,34.2,M,-62.4,M,0.8,0412*6A'}
            </code>
            <p className="text-[9px] text-muted-foreground">
              Mountpoint: <span className="font-mono">{SOI_CORS_STATION.mountpoint}</span> · RTCM:{' '}
              {SOI_CORS_STATION.rtcmMessages.join(', ')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
