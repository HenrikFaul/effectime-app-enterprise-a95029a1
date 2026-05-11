import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pin, Play, Loader2, GripVertical, Maximize2 } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ReportRunner } from './ReportRunner';
import { getDataSourceLabels } from './reportTemplates';
import { useI18n } from '@/i18n/I18nProvider';
import type { SavedReport } from './ReportLibrary';
import { ResourceWidgetCard, type ResourceWidgetKind, type ResourceWidgetConfig } from '../resources/ResourceWidgetCard';
import { toast } from 'sonner';

const RESOURCE_WIDGET_SOURCES: ResourceWidgetKind[] = ['resource_capacity', 'capacity_gap'];
function isResourceWidget(ds: string): ds is ResourceWidgetKind {
  return (RESOURCE_WIDGET_SOURCES as string[]).includes(ds);
}

interface Props {
  workspaceId: string;
}

type WidgetSize = 'small' | 'medium' | 'large';

const SIZE_CLASS: Record<WidgetSize, string> = {
  small: 'sm:col-span-1',
  medium: 'sm:col-span-1 lg:col-span-2',
  large: 'sm:col-span-2 lg:col-span-3',
};

const SIZE_NEXT: Record<WidgetSize, WidgetSize> = {
  small: 'medium',
  medium: 'large',
  large: 'small',
};

function SortableTile({ report, onRun, onResize, workspaceId }: {
  report: SavedReport;
  onRun: (r: SavedReport) => void;
  onResize: (r: SavedReport) => void;
  workspaceId: string;
}) {
  const { t } = useI18n();
  const DATA_SOURCE_LABELS = getDataSourceLabels(t);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: report.id });
  const size = (report.widget_size as WidgetSize) || 'medium';
  const isResource = isResourceWidget(report.data_source as string);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  // Resource widgets render as live capacity cards instead of plain rows.
  if (isResource) {
    return (
      <div ref={setNodeRef} style={style} className={`group relative ${SIZE_CLASS[size]}`}>
        <div className="absolute top-1 right-1 z-10 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none p-1 rounded hover:bg-accent" title={t('report_library.move_tile')}>
            <GripVertical className="h-3 w-3 text-muted-foreground" />
          </button>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onResize(report)} title={t('report_library.resize_tile')}>
            <Maximize2 className="h-3 w-3" />
          </Button>
        </div>
        <ResourceWidgetCard
          workspaceId={workspaceId}
          kind={report.data_source as ResourceWidgetKind}
          config={(report.config as unknown as ResourceWidgetConfig) || {}}
          title={report.name}
        />
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative flex items-center justify-between gap-2 px-3 py-2.5 rounded-md border bg-card hover:border-primary/40 transition-colors ${SIZE_CLASS[size]}`}
    >
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>
      <button onClick={() => onRun(report)} className="text-left flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{report.name}</p>
        <p className="text-[10px] text-muted-foreground truncate">{DATA_SOURCE_LABELS[report.data_source]} · {size}</p>
      </button>
      <div className="flex items-center gap-1 flex-shrink-0">
        <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => onResize(report)} title={t('report_library.resize_tile')}>
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onRun(report)}>
          <Play className="h-3.5 w-3.5 text-primary" />
        </Button>
      </div>
    </div>
  );
}

export function PinnedReportsWidget({ workspaceId }: Props) {
  const { t } = useI18n();
  const [pinned, setPinned] = useState<SavedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<SavedReport | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from('enterprise_reports')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('is_pinned', true)
        .order('dashboard_slot', { ascending: true, nullsFirst: false })
        .order('updated_at', { ascending: false })
        .limit(12);
      if (!cancelled) {
        setPinned((data as SavedReport[]) || []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [workspaceId]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = pinned.findIndex(r => r.id === active.id);
    const newIndex = pinned.findIndex(r => r.id === over.id);
    const reordered = arrayMove(pinned, oldIndex, newIndex);
    setPinned(reordered);

    // Persist new dashboard_slot ordering
    const updates = reordered.map((r, i) =>
      (supabase as any).from('enterprise_reports').update({ dashboard_slot: i }).eq('id', r.id)
    );
    await Promise.all(updates).catch(() => toast.error(t('report_library.sort_order_error')));
  };

  const handleResize = async (report: SavedReport) => {
    const current = (report.widget_size as WidgetSize) || 'medium';
    const next = SIZE_NEXT[current];
    setPinned(prev => prev.map(r => r.id === report.id ? { ...r, widget_size: next } : r));
    await (supabase as any).from('enterprise_reports').update({ widget_size: next }).eq('id', report.id);
  };

  if (running) {
    return <ReportRunner report={running} workspaceId={workspaceId} onBack={() => setRunning(null)} />;
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (pinned.length === 0) return null;

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Pin className="h-4 w-4 text-primary" />
          {t('report_library.pinned_title')}
          <Badge variant="outline" className="text-[10px] ml-1">{pinned.length}</Badge>
          <span className="text-[10px] text-muted-foreground font-normal ml-auto">{t('report_library.drag_hint')}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={pinned.map(p => p.id)} strategy={rectSortingStrategy}>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {pinned.map(r => (
                <SortableTile key={r.id} report={r} onRun={setRunning} onResize={handleResize} workspaceId={workspaceId} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </CardContent>
    </Card>
  );
}
