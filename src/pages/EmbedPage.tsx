import { useParams, useSearchParams } from 'react-router-dom';
import { EmbedCapacityView } from '@/components/embed/EmbedCapacityView';
import { EmbedShiftRosterView } from '@/components/embed/EmbedShiftRosterView';
import { EmbedLeaveTimelineView } from '@/components/embed/EmbedLeaveTimelineView';
import { EmbedOfficeHeadcountView } from '@/components/embed/EmbedOfficeHeadcountView';
import { EmbedMemberScheduleView } from '@/components/embed/EmbedMemberScheduleView';
import { EmbedMultiView } from '@/components/embed/EmbedMultiView';
import { AlertTriangle } from 'lucide-react';

const BRAND_STRIPE = <div className="h-0.5 w-full bg-primary shrink-0" />;

function EmbedShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-dvh w-full overflow-hidden flex flex-col">
      {BRAND_STRIPE}
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

const SINGLE_VIEWS = ['capacity_planner', 'shift_roster', 'leave_calendar', 'office_headcount', 'member_schedule'];

export default function EmbedPage() {
  const { view } = useParams<{ view: string }>();
  const [searchParams] = useSearchParams();

  const token     = searchParams.get('token') ?? '';
  const office    = searchParams.get('office') ?? undefined;
  const from      = searchParams.get('from') ?? undefined;
  const member    = searchParams.get('member') ?? undefined;
  const modeParam = searchParams.get('mode');
  const mode      = (modeParam === 'monthly' || modeParam === 'weekly') ? modeParam : undefined;

  if (!token) {
    return (
      <div className="flex items-center justify-center h-dvh text-sm text-destructive">
        <div className="text-center p-8">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-60" />
          <p className="font-semibold">Hiányzó beágyazási token</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add meg a <code>?token=…</code> paramétert az iframe URL-ben.
          </p>
        </div>
      </div>
    );
  }

  if (view === 'multi') {
    const viewsParam = searchParams.get('views') ?? '';
    const views = viewsParam.split(',').map(v => v.trim()).filter(v => SINGLE_VIEWS.includes(v));
    return (
      <EmbedShell>
        <EmbedMultiView
          token={token}
          views={views}
          officeFilter={office}
          initialFrom={from}
          member={member}
          mode={mode}
        />
      </EmbedShell>
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
        <EmbedLeaveTimelineView token={token} officeFilter={office} initialFrom={from} />
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
        <div className="flex items-center justify-center h-dvh text-sm text-muted-foreground">
          <div className="text-center p-8">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-60" />
            <p className="font-semibold">Hiányzó <code>member</code> paraméter</p>
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

  return (
    <div className="flex items-center justify-center h-dvh text-sm text-muted-foreground">
      <div className="text-center p-8">
        <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-60" />
        <p className="font-semibold">Ismeretlen nézet: {view}</p>
        <p className="text-xs mt-1">
          Elérhető nézetek: <code>{[...SINGLE_VIEWS, 'multi'].join(', ')}</code>
        </p>
      </div>
    </div>
  );
}
