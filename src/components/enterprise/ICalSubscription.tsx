import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CalendarPlus, Copy, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props { workspaceId: string; userId: string; }

export function ICalSubscription({ workspaceId, userId }: Props) {
  const [tokens, setTokens] = useState<any[]>([]);
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const baseUrl = `https://${projectId}.functions.supabase.co/leave-ical`;

  const load = async () => {
    const { data } = await (supabase as any)
      .from('enterprise_ical_tokens')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId);
    setTokens(data || []);
  };
  useEffect(() => { load(); }, [workspaceId, userId]);

  const create = async (scope: 'own' | 'team') => {
    const { error } = await (supabase as any).from('enterprise_ical_tokens').insert({
      workspace_id: workspaceId, user_id: userId, scope,
    });
    if (error) { toast.error(error.message.includes('duplicate') ? 'Már létezik ilyen feed' : 'Hiba'); return; }
    toast.success('Feed létrehozva');
    load();
  };

  const remove = async (id: string) => {
    await (supabase as any).from('enterprise_ical_tokens').delete().eq('id', id);
    load();
  };

  const copy = (token: string, scope: string) => {
    const url = `${baseUrl}?token=${token}&scope=${scope}`;
    navigator.clipboard.writeText(url);
    toast.success('URL másolva — illeszd be Outlook/Google Calendar feliratkozásnál');
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <CalendarPlus className="h-4 w-4 text-primary" /> Naptár-feliratkozás (iCal)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Hozz létre egy egyedi feed URL-t, amelyet Outlook / Google Calendar / Apple Calendar feliratkozhat. Frissítés automatikus.
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => create('own')}>+ Saját szabadságok</Button>
          <Button size="sm" variant="outline" onClick={() => create('team')}>+ Csapat szabadságok</Button>
        </div>
        {tokens.map((t) => (
          <div key={t.id} className="flex items-center gap-2 border rounded-md p-2">
            <Badge variant={t.scope === 'team' ? 'default' : 'secondary'} className="text-xs">{t.scope === 'team' ? 'Csapat' : 'Saját'}</Badge>
            <Input readOnly className="h-7 text-xs font-mono" value={`${baseUrl}?token=${t.token}&scope=${t.scope}`} />
            <Button size="sm" variant="ghost" onClick={() => copy(t.token, t.scope)}><Copy className="h-3 w-3" /></Button>
            <Button size="sm" variant="ghost" onClick={() => remove(t.id)}><Trash2 className="h-3 w-3" /></Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
