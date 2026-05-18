import { useParams, useSearchParams } from 'react-router-dom';
import { EmbedCapacityView } from '@/components/embed/EmbedCapacityView';
import { AlertTriangle } from 'lucide-react';

export default function EmbedPage() {
  const { view } = useParams<{ view: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

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
      <div className="h-screen w-full overflow-hidden">
        <EmbedCapacityView token={token} />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-screen text-sm text-muted-foreground">
      <div className="text-center p-8">
        <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-60" />
        <p className="font-medium">Unknown embed view: {view}</p>
        <p className="text-xs mt-1">Supported views: <code>capacity_planner</code></p>
      </div>
    </div>
  );
}
