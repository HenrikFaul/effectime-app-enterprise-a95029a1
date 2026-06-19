import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { EmbedCapacityView } from './EmbedCapacityView';
import { EmbedShiftRosterView } from './EmbedShiftRosterView';
import { EmbedLeaveTimelineView } from './EmbedLeaveTimelineView';
import { EmbedMemberScheduleView } from './EmbedMemberScheduleView';
import { cn } from '@/lib/utils';

const TAB_LABELS: Record<string, string> = {
  capacity_planner: 'Kapacitás',
  shift_roster:     'Beosztás',
  leave_calendar:   'Naptár',
  member_schedule:  'Munkatárs',
};

const ALL_VIEWS = ['capacity_planner', 'shift_roster', 'leave_calendar', 'member_schedule'];

export interface EmbedMultiViewProps {
  token: string;
  views: string[];
  officeFilter?: string;
  initialFrom?: string;
  member?: string;
  mode?: 'weekly' | 'monthly';
}

export function EmbedMultiView({ token, views, officeFilter, initialFrom, member, mode }: EmbedMultiViewProps) {
  const validViews = views.filter(v => ALL_VIEWS.includes(v));
  const [activeView, setActiveView] = useState(validViews[0] ?? '');

  if (validViews.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-48 gap-2 text-muted-foreground p-6 text-center">
        <AlertTriangle className="h-8 w-8 opacity-40" />
        <p className="font-semibold text-foreground text-sm">Nincs érvényes nézet megadva</p>
        <p className="text-xs">Add meg a <code>?views=</code> paramétert a beágyazási URL-ben.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      {/* Tab bar — no duplicate logo here; each child view's header has it */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b bg-card shrink-0 overflow-x-auto">
        {validViews.map(v => (
          <button
            key={v}
            onClick={() => setActiveView(v)}
            className={cn(
              'px-3 py-1 text-xs font-semibold rounded-md whitespace-nowrap transition-colors shrink-0',
              activeView === v
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted',
            )}
          >
            {TAB_LABELS[v] ?? v}
          </button>
        ))}
      </div>

      {/* Active view */}
      <div className="flex-1 overflow-hidden min-h-0">
        {activeView === 'capacity_planner' && (
          <EmbedCapacityView token={token} officeFilter={officeFilter} initialFrom={initialFrom} mode={mode} />
        )}
        {activeView === 'shift_roster' && (
          <EmbedShiftRosterView token={token} officeFilter={officeFilter} initialFrom={initialFrom} />
        )}
        {activeView === 'leave_calendar' && (
          <EmbedLeaveTimelineView token={token} officeFilter={officeFilter} initialFrom={initialFrom} />
        )}
        {activeView === 'member_schedule' && (
          <EmbedMemberScheduleView token={token} memberId={member} initialFrom={initialFrom} />
        )}
      </div>
    </div>
  );
}
