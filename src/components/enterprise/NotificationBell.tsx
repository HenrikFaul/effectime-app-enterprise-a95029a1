import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { EnterpriseNotifications } from './EnterpriseNotifications';
import { useT } from '@/i18n/I18nProvider';

interface Props {
  workspaceId: string;
  userId: string;
}

export function NotificationBell({ workspaceId, userId }: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const refreshCount = async () => {
    if (!workspaceId || !userId) return;
    const { count } = await supabase
      .from('enterprise_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .eq('is_read', false);
    setUnreadCount(count ?? 0);
  };

  useEffect(() => {
    refreshCount();
    const intervalId = window.setInterval(refreshCount, 60_000);
    return () => window.clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, userId]);

  // Refresh on popover close (to reflect mark-as-read changes from inside)
  useEffect(() => {
    if (!open) refreshCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const display = unreadCount > 99 ? '99+' : String(unreadCount);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative h-9 w-9 rounded-full p-0 text-foreground/80 hover:bg-accent"
          aria-label={t('header.notifications')}
          title={t('header.notifications')}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 ? (
            <span
              aria-hidden
              className="absolute -top-0.5 -right-0.5 inline-flex min-w-[1.1rem] h-[1.1rem] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground ring-2 ring-background"
            >
              {display}
            </span>
          ) : null}
          {unreadCount > 0 ? (
            <span className="sr-only">{unreadCount} unread</span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(92vw,22rem)] sm:w-[26rem] p-0 max-h-[80vh] overflow-hidden"
      >
        <div className="px-3 py-2 border-b text-sm font-semibold flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          {t('header.notifications')}
          {unreadCount > 0 ? (
            <span className="ml-auto inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              {display}
            </span>
          ) : null}
        </div>
        <div className="overflow-y-auto max-h-[70vh]">
          <EnterpriseNotifications workspaceId={workspaceId} userId={userId} />
        </div>
      </PopoverContent>
    </Popover>
  );
}
