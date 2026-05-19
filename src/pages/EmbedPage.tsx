import { useParams, useSearchParams } from 'react-router-dom';
import { EmbedCapacityView } from '@/components/embed/EmbedCapacityView';
import { EmbedShiftRosterView } from '@/components/embed/EmbedShiftRosterView';
import { EmbedLeaveCalendarView } from '@/components/embed/EmbedLeaveCalendarView';
import { EmbedOfficeHeadcountView } from '@/components/embed/EmbedOfficeHeadcountView';
import { EmbedMemberScheduleView } from '@/components/embed/EmbedMemberScheduleView';
import { AlertTriangle } from 'lucide-react';

const BRAND_STRIPE = <div className="h-0.5 w-full bg-primary shrink-0" />;

function EmbedShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen w-full overflow-hidden flex flex-col">
      {BRAND_STRIPE}
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

export default function EmbedPage() {
  const { view } = useParams<{ view: string }>();
  const [searchParams] = useSearchParams();

  const token    = searchParams.get('token') ?? '';
  const office   = searchParams.get('office') ?? undefined;
  const from     = searchParams.get('from') ?? undefined;
  const member   = searchParams.get('member') ?? undefined;
  const modeParam = searchParams.get('mode');
  const mode     = (modeParam === 'monthly' || modeParam === 'weekly') ? modeParam : undefined;

  if (!token) {
    return (
      <div className="flex items-center justify-center h-screen text-sm text-destructive">
        <div className="text-center p-8">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-60" />
          <p className="font-medium">Hiányzó beágyazási token</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add meg a <code>?token=…</code> paramétert az iframe URL-ben.
          </p>
        </div>
      </div>
    );
  }

  if (view === 'capacity_planner') {
    return (
      <EmbedShell>
        <EmbedCapacityView token={token} officeFilter={office} initialFrom={from} mode={mode} />
      </EmbedShell>
    );
  }

  if (view === 'shift_roster') {
    return (
      <EmbedShell>
        <EmbedShiftRosterView token={token} officeFilter={office} initialFrom={from} />
      </EmbedShell>
    );
  }

  if (view === 'leave_calendar') {
    return (
      <EmbedShell>
        <EmbedLeaveCalendarView token={token} officeFilter={office} initialFrom={from} />
      </EmbedShell>
    );
  }

  if (view === 'office_headcount') {
    return (
      <EmbedShell>
        <EmbedOfficeHeadcountView token={token} officeFilter={office} initialFrom={from} />
      </EmbedShell>
    );
  }

  if (view === 'member_schedule') {
    if (!member) {
      return (
        <div className="flex items-center justify-center h-screen text-sm text-muted-foreground">
          <div className="text-center p-8">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-60" />
            <p className="font-medium">Hiányzó <code>member</code> paraméter</p>
            <p className="text-xs mt-1">Add meg a csapattag user_id-jét: <code>?member=…</code></p>
          </div>
        </div>
      );
    }
    return (
      <EmbedShell>
        <EmbedMemberScheduleView token={token} memberId={member} initialFrom={from} />
      </EmbedShell>
    );
  }

  const supported = ['capacity_planner', 'shift_roster', 'leave_calendar', 'office_headcount', 'member_schedule'];
  return (
    <div className="flex items-center justify-center h-screen text-sm text-muted-foreground">
      <div className="text-center p-8">
        <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-60" />
        <p className="font-medium">Ismeretlen nézet: {view}</p>
        <p className="text-xs mt-1">
          Elérhető nézetek: <code>{supported.join(', ')}</code>
        </p>
      </div>
    </div>
  );
}
