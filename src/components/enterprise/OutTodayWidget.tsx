import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarOff } from 'lucide-react';

interface Props { workspaceId: string; }

export function OutTodayWidget({ workspaceId }: Props) {
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from('leave_requests')
        .select('id, leave_type, user_id, is_half_day, half_day_period')
        .eq('workspace_id', workspaceId)
        .eq('status', 'approved')
        .lte('start_date', today)
        .gte('end_date', today);
      const ids = Array.from(new Set((data || []).map((x: any) => x.user_id)));
      if (ids.length === 0) { setItems([]); return; }
      const { data: p } = await supabase.from('profiles').select('user_id, display_name').in('user_id', ids);
      const names = Object.fromEntries((p || []).map((x: any) => [x.user_id, x.display_name || x.user_id.slice(0, 8)]));
      setItems((data || []).map((x: any) => ({ ...x, name: names[x.user_id] })));
    })();
  }, [workspaceId]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <CalendarOff className="h-4 w-4 text-primary" />
          Ma távol ({items.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">Mindenki dolgozik ma 🎉</p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {items.map((i) => (
              <Badge key={i.id} variant="secondary" className="text-xs">
                {i.name}
                {i.is_half_day && <span className="ml-1 opacity-60">({i.half_day_period === 'morning' ? 'DE' : 'DU'})</span>}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
