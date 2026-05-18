import { useParams, useSearchParams } from 'react-router-dom';
import { EmbedCapacityView } from '@/components/embed/EmbedCapacityView';
import { EmbedShiftRosterView } from '@/components/embed/EmbedShiftRosterView';
import { AlertTriangle } from 'lucide-react';

export default function EmbedPage() {
  const { view } = useParams<{ view: string }>();
  const [searchParams] = useSearchParams();

  const token       = searchParams.get('token') ?? '';
  const office      = searchParams.get('office') ?? undefined;
  const from        = searchParams.get('from') ?? undefined;
  const modeParam   = searchParams.get('mode');
  const mode        = (modeParam === 'monthly' || modeParam === 'weekly') ? modeParam : undefined;

  if (!token) {
    return (
      <div className="flex items-center justify-center h-screen text-sm text-destructive">
        <div className="text-center p-8">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-60" />
          <p className="font-medium">Missing embed token</p>
          <p className="text-xs text-muted-foreground mt-1">
            Include <code>?token=…</code> in the iframe URL.
          </p>
        </div>
      </div>
    );
  }

  if (view === 'capacity_planner') {
    return (
      <div className="h-screen w-full overflow-hidden flex flex-col">
        <div className="h-0.5 w-full bg-primary shrink-0" />
        <div className="flex-1 overflow-hidden">
          <EmbedCapacityView
            token={token}
            officeFilter={office}
            initialFrom={from}
            mode={mode}
          />
        </div>
      </div>
    );
  }

  if (view === 'shift_roster') {
    return (
      <div className="h-screen w-full overflow-hidden flex flex-col">
        <div className="h-0.5 w-full bg-primary shrink-0" />
        <div className="flex-1 overflow-hidden">
          <EmbedShiftRosterView
            token={token}
            officeFilter={office}
            initialFrom={from}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-screen text-sm text-muted-foreground">
      <div className="text-center p-8">
        <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-60" />
        <p className="font-medium">Unknown embed view: {view}</p>
        <p className="text-xs mt-1">
          Supported: <code>capacity_planner</code>, <code>shift_roster</code>
        </p>
      </div>
    </div>
  );
}
