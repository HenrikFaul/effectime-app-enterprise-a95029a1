import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Loader2, Eye } from 'lucide-react';
import { ReportRunner } from './ReportRunner';
import type { SavedReport } from './ReportLibrary';

interface Props {
  report: SavedReport;
  workspaceId: string;
  /** Debounce delay before auto-running on config change. */
  debounceMs?: number;
}

/**
 * Right-rail live preview for the desktop builder.
 * Auto-reruns the report after configuration changes settle.
 */
export function LivePreviewPane({ report, workspaceId, debounceMs = 600 }: Props) {
  const [snapshot, setSnapshot] = useState<SavedReport>(report);
  const [pending, setPending] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    setPending(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setSnapshot({ ...report });
      setPending(false);
    }, debounceMs);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(report.config), report.chart_type, report.data_source, debounceMs]);

  // Provide a stable id so ReportRunner re-runs when snapshot updates
  const previewKey = JSON.stringify({
    ds: snapshot.data_source,
    cfg: snapshot.config,
    ct: snapshot.chart_type,
  });

  return (
    <div className="space-y-2 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
          <Eye className="h-3 w-3" /> Élő előnézet
        </h4>
        {pending && (
          <Badge variant="outline" className="text-[10px] gap-1">
            <Loader2 className="h-2.5 w-2.5 animate-spin" /> Várakozás…
          </Badge>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <ReportRunner
          key={previewKey}
          report={snapshot}
          workspaceId={workspaceId}
          onBack={() => { /* no-op in preview pane */ }}
        />
      </div>
    </div>
  );
}
