import { useEffect, useState } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { GripVertical, Save, RotateCcw } from 'lucide-react';
import { useCalendarFilterConfig, useFilterLabels, CalendarFilterConfig } from '@/hooks/useCalendarFilterConfig';
import { useI18n } from '@/i18n/I18nProvider';

interface Props { workspaceId: string; userId: string }

export function CalendarFilterSettings({ workspaceId, userId }: Props) {
  const { t } = useI18n();
  const filterLabels = useFilterLabels();
  const { config, save, loading, saving, reload } = useCalendarFilterConfig(workspaceId);
  const [draft, setDraft] = useState<CalendarFilterConfig[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => { setDraft(config); setDirty(false); }, [config]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = draft.findIndex(d => d.id === active.id);
    const newIdx = draft.findIndex(d => d.id === over.id);
    setDraft(arrayMove(draft, oldIdx, newIdx));
    setDirty(true);
  };

  const toggle = (id: string) => {
    setDraft(d => d.map(c => c.id === id ? { ...c, enabled: !c.enabled } : c));
    setDirty(true);
  };

  if (loading) {
    return <div className="flex justify-center py-4"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">
        {t('calendar_filter.drag_to_reorder')}
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={draft.map(d => d.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1">
            {draft.map(c => <SortableRow key={c.id} item={c} label={filterLabels[c.id]} onToggle={() => toggle(c.id)} />)}
          </div>
        </SortableContext>
      </DndContext>

      <div className="flex items-center gap-2 pt-2">
        <Button size="sm" disabled={!dirty || saving} onClick={async () => { const ok = await save(draft, userId); if (ok) setDirty(false); }}>
          <Save className="h-3.5 w-3.5 mr-1" /> {t('common.save')}
        </Button>
        <Button size="sm" variant="outline" disabled={!dirty} onClick={() => { reload(); setDirty(false); }}>
          <RotateCcw className="h-3.5 w-3.5 mr-1" /> {t('common.restore')}
        </Button>
      </div>
    </div>
  );
}

function SortableRow({ item, label, onToggle }: { item: CalendarFilterConfig; label: string; onToggle: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 p-2 rounded-md border bg-card">
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground">
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="text-sm flex-1">{label}</span>
      <Switch checked={item.enabled} onCheckedChange={onToggle} />
    </div>
  );
}
