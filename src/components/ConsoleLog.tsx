import { Terminal } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface ConsoleLogProps {
  logs: string[];
}

export function ConsoleLog({ logs }: ConsoleLogProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.scrollTo(0, ref.current.scrollHeight); }, [logs]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Terminal className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Console</h3>
      </div>
      <div ref={ref} className="h-32 overflow-y-auto rounded-lg border border-border bg-secondary/50 p-2 font-mono text-xs text-muted-foreground space-y-0.5">
        {logs.length === 0 && <p className="text-center opacity-50">No logs yet</p>}
        {logs.map((l, i) => <p key={i}>{l}</p>)}
      </div>
    </div>
  );
}
