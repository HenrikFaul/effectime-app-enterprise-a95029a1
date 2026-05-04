import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Props {
  workspaceId: string;
}

const ACTION_LABELS: Record<string, string> = {
  'leave_request.created': 'Kérelem létrehozva',
  'leave_request.approved': 'Kérelem jóváhagyva',
  'leave_request.rejected': 'Kérelem elutasítva',
  'leave_request.cancelled': 'Kérelem visszavonva',
  'membership.invited': 'Tag meghívva',
  'membership.role_changed': 'Szerepkör módosítva',
  'membership.removed': 'Tag eltávolítva',
  'membership.suspended': 'Tag felfüggesztve',
  'rule.created': 'Szabály létrehozva',
  'rule.deleted': 'Szabály törölve',
  'template.applied': 'Sablon alkalmazva',
  'export.created': 'Export létrehozva',
  'settings.updated': 'Beállítások módosítva',
};

const ACTION_FILTER_OPTIONS = [
  { value: 'all', label: 'Összes művelet' },
  { value: 'leave_request', label: 'Kérelmek' },
  { value: 'membership', label: 'Tagság' },
  { value: 'rule', label: 'Szabályok' },
  { value: 'export', label: 'Export' },
  { value: 'settings', label: 'Beállítások' },
];

export function AuditLog({ workspaceId }: Props) {
  const [events, setEvents] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchEvents = async () => {
    setLoading(true);
    let query = supabase
      .from('enterprise_audit_events')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (actionFilter !== 'all') {
      query = query.like('action', `${actionFilter}%`);
    }

    const { data } = await query;
    const items = (data as any[]) || [];
    setEvents(items);

    const userIds = [...new Set([...items.map(e => e.actor_id), ...items.filter(e => e.affected_user_id).map(e => e.affected_user_id)])];
    if (userIds.length > 0) {
      const { data: profileData } = await supabase.from('profiles').select('user_id, display_name').in('user_id', userIds);
      const map: Record<string, string> = {};
      (profileData || []).forEach((p: any) => { map[p.user_id] = p.display_name || 'Ismeretlen'; });
      setProfiles(map);
    }
    setLoading(false);
  };

  useEffect(() => { fetchEvents(); }, [workspaceId, actionFilter]);

  const filteredEvents = searchQuery
    ? events.filter(e => {
        const actionLabel = ACTION_LABELS[e.action] || e.action;
        const actorName = profiles[e.actor_id] || '';
        return actionLabel.toLowerCase().includes(searchQuery.toLowerCase()) ||
               actorName.toLowerCase().includes(searchQuery.toLowerCase());
      })
    : events;

  if (loading) return <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {ACTION_FILTER_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input
          placeholder="Keresés..."
          className="h-8 text-xs w-[200px]"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      {filteredEvents.length === 0 ? (
        <Card><CardContent className="text-center py-8 text-muted-foreground text-sm">Nincs audit esemény.</CardContent></Card>
      ) : (
        <ScrollArea className="h-[400px]">
          <div className="space-y-1">
            {filteredEvents.map(e => (
              <div key={e.id} className="flex items-start gap-3 p-2 rounded-md border text-xs">
                <div className="text-muted-foreground shrink-0 w-[120px]">
                  {format(new Date(e.created_at), 'MM.dd HH:mm', { locale: hu })}
                </div>
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-medium">{profiles[e.actor_id] || 'Rendszer'}</span>
                    <Badge variant="outline" className="text-[10px] h-4">{ACTION_LABELS[e.action] || e.action}</Badge>
                  </div>
                  {e.affected_user_id && e.affected_user_id !== e.actor_id && (
                    <p className="text-muted-foreground">→ {profiles[e.affected_user_id] || e.affected_user_id}</p>
                  )}
                  {e.metadata && Object.keys(e.metadata).length > 0 && (
                    <p className="text-muted-foreground truncate">{JSON.stringify(e.metadata)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
