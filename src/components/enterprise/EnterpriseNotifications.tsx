import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useI18n } from '@/i18n/I18nProvider';

interface Props {
  workspaceId: string;
  userId: string;
}

const EVENT_ICONS: Record<string, string> = {
  'leave_request.submitted': '📝',
  'leave_request.approved': '✅',
  'leave_request.rejected': '❌',
  'leave_request.cancelled': '🚫',
  'membership.invited': '📨',
  'membership.role_changed': '🔄',
  'escalation.triggered': '⚠️',
  'rule.conflict': '🔥',
  'export.completed': '📊',
  'shift_assigned': '📅',
  'open_shift_filled': '✅',
  'open_shift_broadcast': '📢',
};

function getLocalizedTitle(t: (key: string, vars?: Record<string, string>) => string, n: any): string {
  switch (n.event_type) {
    case 'shift_assigned': return t('enterprise_notifications.shift_confirmed');
    case 'open_shift_filled': return t('enterprise_notifications.open_shift_filled_title');
    case 'open_shift_broadcast': return t('enterprise_notifications.new_open_shift_title');
    default: return n.title;
  }
}

function getLocalizedMessage(t: (key: string, vars?: Record<string, string>) => string, n: any): string {
  const dateMatch = (n.message ?? '').match(/\d{4}-\d{2}-\d{2}/);
  const date = dateMatch?.[0] ?? '';
  switch (n.event_type) {
    case 'shift_assigned': return t('enterprise_notifications.shift_confirmed_msg', { date });
    case 'open_shift_filled': return t('enterprise_notifications.open_shift_filled_msg', { date });
    case 'open_shift_broadcast': return t('enterprise_notifications.new_open_shift_msg', { date });
    default: return n.message ?? '';
  }
}

export function EnterpriseNotifications({ workspaceId, userId }: Props) {
  const { t } = useI18n();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('enterprise_notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(50);
    setNotifications((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchNotifications(); }, [workspaceId, userId]);

  const markRead = async (id: string) => {
    await supabase.from('enterprise_notifications').update({ is_read: true }).eq('id', id);
    fetchNotifications();
  };

  const markAllRead = async () => {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;
    for (const id of unreadIds) {
      await supabase.from('enterprise_notifications').update({ is_read: true }).eq('id', id);
    }
    fetchNotifications();
  };

  const deleteNotification = async (id: string) => {
    await supabase.from('enterprise_notifications').delete().eq('id', id);
    fetchNotifications();
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (loading) return <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  return (
    <div className="space-y-2 p-3">
      {unreadCount > 0 && (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" className="text-xs h-7" onClick={markAllRead}>
            {t('enterprise_notifications.mark_all_read')}
          </Button>
        </div>
      )}

      {notifications.length === 0 ? (
        <Card><CardContent className="text-center py-8 text-muted-foreground text-sm">{t('enterprise_notifications.empty')}</CardContent></Card>
      ) : (
        <ScrollArea className="h-[350px]">
          <div className="space-y-1">
            {notifications.map(n => (
              <div key={n.id} className={`flex items-start gap-2 p-2 rounded-md border text-xs ${!n.is_read ? 'bg-foreground/[0.04] border-primary/30' : ''}`}>
                <span className="text-sm shrink-0">{EVENT_ICONS[n.event_type] || '🔔'}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs ${!n.is_read ? 'font-semibold' : ''}`}>
                    {getLocalizedTitle(t, n)}
                  </p>
                  {n.message && (
                    <p className="text-muted-foreground text-[11px] truncate">
                      {getLocalizedMessage(t, n)}
                    </p>
                  )}
                  <p className="text-muted-foreground text-[10px] mt-0.5">
                    {format(new Date(n.created_at), 'MM.dd HH:mm', { locale: hu })}
                  </p>
                </div>
                <div className="flex gap-0.5 shrink-0">
                  {!n.is_read && (
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => markRead(n.id)}>
                      <Eye className="h-3 w-3" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => deleteNotification(n.id)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
