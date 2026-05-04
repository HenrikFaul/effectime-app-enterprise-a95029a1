import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Bell, Mail, Smartphone } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  workspaceId: string;
  userId: string;
}

const EVENT_TYPES = [
  { key: 'leave_approved', label: 'Szabadság jóváhagyva' },
  { key: 'leave_rejected', label: 'Szabadság elutasítva' },
  { key: 'leave_cancelled', label: 'Szabadság visszavonva/lemondva' },
  { key: 'new_leave_request', label: 'Új szabadságkérelem (admin)' },
  { key: 'invitation', label: 'Meghívó a munkaterületre' },
  { key: 'approval_reminder', label: 'Jóváhagyási emlékeztető' },
];

interface Pref {
  event_type: string;
  channel_email: boolean;
  channel_push: boolean;
}

export function NotificationPreferences({ workspaceId, userId }: Props) {
  const [prefs, setPrefs] = useState<Map<string, Pref>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPrefs();
  }, [workspaceId, userId]);

  const fetchPrefs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('enterprise_notification_preferences')
      .select('event_type, channel_email, channel_push')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId);

    const map = new Map<string, Pref>();
    // Default all to email=true, push=false
    EVENT_TYPES.forEach(et => {
      map.set(et.key, { event_type: et.key, channel_email: true, channel_push: false });
    });
    // Override with saved prefs
    ((data as any[]) || []).forEach((p: any) => {
      map.set(p.event_type, { event_type: p.event_type, channel_email: p.channel_email, channel_push: p.channel_push });
    });
    setPrefs(map);
    setLoading(false);
  };

  const handleToggle = async (eventType: string, channel: 'channel_email' | 'channel_push', value: boolean) => {
    const current = prefs.get(eventType) || { event_type: eventType, channel_email: true, channel_push: false };
    const updated = { ...current, [channel]: value };
    setPrefs(prev => new Map(prev).set(eventType, updated));

    const { error } = await supabase
      .from('enterprise_notification_preferences')
      .upsert({
        workspace_id: workspaceId,
        user_id: userId,
        event_type: eventType,
        channel_email: updated.channel_email,
        channel_push: updated.channel_push,
      } as any, { onConflict: 'workspace_id,user_id,event_type' });

    if (error) {
      toast.error('Hiba a mentéskor');
      fetchPrefs();
    }
  };

  if (loading) {
    return <div className="flex justify-center py-4"><div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <Bell className="h-4 w-4" /> Értesítési beállítások
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-3">
        {/* Column headers */}
        <div className="flex items-center justify-end gap-6 pr-1 text-[10px] text-muted-foreground font-medium">
          <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> Email</span>
          <span className="flex items-center gap-1"><Smartphone className="h-3 w-3" /> Push</span>
        </div>

        {EVENT_TYPES.map(et => {
          const pref = prefs.get(et.key) || { event_type: et.key, channel_email: true, channel_push: false };
          return (
            <div key={et.key} className="flex items-center justify-between">
              <Label className="text-xs font-normal flex-1">{et.label}</Label>
              <div className="flex items-center gap-6">
                <Switch
                  checked={pref.channel_email}
                  onCheckedChange={(v) => handleToggle(et.key, 'channel_email', v)}
                  className="scale-75"
                />
                <div className="relative">
                  <Switch
                    checked={pref.channel_push}
                    disabled
                    className="scale-75 opacity-40"
                  />
                  {/* Tooltip-like badge */}
                </div>
              </div>
            </div>
          );
        })}

        <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
          <Smartphone className="h-3 w-3" />
          Push értesítések hamarosan elérhetők a natív alkalmazásban.
        </p>
      </CardContent>
    </Card>
  );
}
