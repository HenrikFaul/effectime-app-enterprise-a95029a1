import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Props { workspaceId: string; userId: string; }

export function SubstituteInbox({ workspaceId, userId }: Props) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('leave_request_substitutes')
      .select('*, leave_requests(id, start_date, end_date, leave_type, comment, user_id, status)')
      .eq('workspace_id', workspaceId)
      .eq('substitute_user_id', userId)
      .eq('status', 'pending');
    const requesterIds = Array.from(new Set((data || []).map((x: any) => x.leave_requests?.user_id).filter(Boolean))) as string[];
    let names: Record<string, string> = {};
    if (requesterIds.length) {
      const { data: profs } = await supabase.from('profiles').select('user_id, display_name').in('user_id', requesterIds);
      names = Object.fromEntries((profs || []).map((p: any) => [p.user_id, p.display_name || p.user_id.slice(0, 8)]));
    }
    setItems((data || []).map((x: any) => ({ ...x, requesterName: names[x.leave_requests?.user_id] || '?' })));
    setLoading(false);
  }, [workspaceId, userId]);

  useEffect(() => { load(); }, [load]);

  const respond = async (id: string, status: 'confirmed' | 'declined') => {
    const { error } = await supabase
      .from('leave_request_substitutes')
      .update({ status, responded_at: new Date().toISOString() } as any)
      .eq('id', id);
    if (error) { toast.error('Hiba'); return; }
    toast.success(status === 'confirmed' ? 'Helyettesítés megerősítve' : 'Helyettesítés elutasítva');
    load();
  };

  if (loading) return null;
  if (items.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-primary" />
          Helyettesítési kérések ({items.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((s) => (
          <div key={s.id} className="flex items-center justify-between border rounded-md p-2 text-xs">
            <div>
              <p className="font-medium">{s.requesterName}</p>
              <p className="text-muted-foreground">
                {format(new Date(s.leave_requests.start_date), 'yyyy.MM.dd')} – {format(new Date(s.leave_requests.end_date), 'yyyy.MM.dd')}
                <Badge variant="outline" className="ml-2 text-[10px]">{s.leave_requests.leave_type}</Badge>
              </p>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" className="h-7" onClick={() => respond(s.id, 'declined')}>
                <XCircle className="h-3 w-3 mr-1" /> Elutasít
              </Button>
              <Button size="sm" className="h-7" onClick={() => respond(s.id, 'confirmed')}>
                <CheckCircle2 className="h-3 w-3 mr-1" /> Megerősít
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
