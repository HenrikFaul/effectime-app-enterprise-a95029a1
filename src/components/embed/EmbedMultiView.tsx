import { useState } from 'react';
import { AlertTriangle, User } from 'lucide-react';
import { EffectimeLogo } from '@/components/EffectimeLogo';
import { EmbedCapacityView } from './EmbedCapacityView';
import { EmbedShiftRosterView } from './EmbedShiftRosterView';
import { EmbedLeaveCalendarView } from './EmbedLeaveCalendarView';
import { EmbedOfficeHeadcountView } from './EmbedOfficeHeadcountView';
import { EmbedMemberScheduleView } from './EmbedMemberScheduleView';
import { cn } from '@/lib/utils';

const TAB_LABELS: Record<string, string> = {
  capacity_planner: 'Kapacitás',
  shift_roster:     'Beosztás',
  leave_calendar:   'Távollétek',
  office_headcount: 'Létszám',
  member_schedule:  'Menetrend',
};

const ALL_VIEWS = ['capacity_planner', 'shift_roster', 'leave_calendar', 'office_headcount', 'member_schedule'];

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
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b bg-card shrink-0 shadow-subtle">
        <div className="flex items-center gap-0.5 flex-1 overflow-x-auto min-w-0">
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
        <div className="shrink-0 pl-2">
          <EffectimeLogo size={20} variant="full" />
        </div>
      </div>

      {/* Active view — each view manages its own header + navigation */}
      <div className="flex-1 overflow-hidden min-h-0">
        {activeView === 'capacity_planner' && (
          <EmbedCapacityView token={token} officeFilter={officeFilter} initialFrom={initialFrom} mode={mode} />
        )}
        {activeView === 'shift_roster' && (
          <EmbedShiftRosterView token={token} officeFilter={officeFilter} initialFrom={initialFrom} />
        )}
        {activeView === 'leave_calendar' && (
          <EmbedLeaveCalendarView token={token} officeFilter={officeFilter} initialFrom={initialFrom} />
        )}
        {activeView === 'office_headcount' && (
          <EmbedOfficeHeadcountView token={token} officeFilter={officeFilter} initialFrom={initialFrom} />
        )}
        {activeView === 'member_schedule' && !member && (
          <div className="flex flex-col items-center justify-center h-full min-h-48 gap-2 text-muted-foreground p-6 text-center">
            <User className="h-8 w-8 opacity-30" />
            <p className="font-semibold text-foreground text-sm">Hiányzó member paraméter</p>
            <p className="text-xs">Add meg a <code>?member=&lt;user_id&gt;</code> paramétert az iframe URL-ben.</p>
          </div>
        )}
        {activeView === 'member_schedule' && member && (
          <EmbedMemberScheduleView token={token} memberId={member} initialFrom={initialFrom} />
        )}
      </div>
    </div>
  );
}
