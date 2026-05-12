import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Plug, PlugZap, Unlink, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useT } from '@/i18n/I18nProvider';

interface Props {
  workspaceId: string;
}

interface Integration {
  id: string;
  provider: string;
  provider_user_email: string | null;
  is_active: boolean;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  created_at: string;
}

export function M365IntegrationPanel({ workspaceId }: Props) {
  const t = useT();
  const [items, setItems] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ms365-sync', {
        body: { action: 'status', workspace_id: workspaceId },
      });
      if (error) throw error;
      setItems(((data as any)?.integrations as Integration[]) ?? []);
    } catch (e: any) {
      toast.error(t('m365.load_error') + ': ' + (e?.message ?? String(e)));
    } finally {
      setLoading(false);
    }
  }, [workspaceId, t]);

  useEffect(() => { load(); }, [load]);

  const connect = async () => {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('ms365-sync', {
        body: { action: 'get_auth_url', workspace_id: workspaceId, return_to: window.location.href },
      });
      if (error) throw error;
      const url = (data as any)?.auth_url;
      if (!url) throw new Error('No auth URL');
      window.location.href = url;
    } catch (e: any) {
      toast.error(t('m365.connect_error') + ': ' + (e?.message ?? String(e)));
      setConnecting(false);
    }
  };

  const disconnect = async (id: string) => {
    if (!confirm(t('m365.disconnect_confirm'))) return;
    try {
      const { error } = await supabase.functions.invoke('ms365-sync', {
        body: { action: 'disconnect', integration_id: id },
      });
      if (error) throw error;
      toast.success(t('m365.disconnected'));
      load();
    } catch (e: any) {
      toast.error(t('m365.disconnect_error') + ': ' + (e?.message ?? String(e)));
    }
  };

  const syncNow = async (id: string) => {
    setSyncingId(id);
    try {
      const { data, error } = await supabase.functions.invoke('ms365-sync', {
        body: { action: 'sync_now', integration_id: id },
      });
      if (error) throw error;
      const r = data as any;
      if (r?.ok) {
        toast.success(t('m365.sync_success', { count: (r.pushed ?? 0) + (r.ooo ?? 0) }));
      } else {
        toast.error(t('m365.sync_failed') + ': ' + (r?.error ?? 'unknown'));
      }
      load();
    } catch (e: any) {
      toast.error(t('m365.sync_failed') + ': ' + (e?.message ?? String(e)));
    } finally {
      setSyncingId(null);
    }
  };

  const m365 = items.find((i) => i.provider === 'ms365');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Plug className="h-5 w-5 text-primary" />
          <div>
            <CardTitle className="text-base">{t('m365.title')}</CardTitle>
            <CardDescription className="text-xs">{t('m365.subtitle')}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" /> {t('common.loading')}
          </div>
        ) : !m365 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t('m365.not_connected_hint')}</p>
            <Button onClick={connect} disabled={connecting} size="sm" className="gap-2">
              {connecting ? <Loader2 className="h-3 w-3 animate-spin" /> : <PlugZap className="h-3 w-3" />}
              {t('m365.connect_btn')}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-md border bg-card px-3 py-2">
              <div className="flex items-center gap-2">
                <Badge variant="default" className="text-[10px]">Microsoft 365</Badge>
                <span className="text-sm font-medium flex-1 truncate">{m365.provider_user_email ?? '—'}</span>
                {m365.last_sync_status === 'error' ? (
                  <Badge variant="destructive" className="gap-1 text-[10px]">
                    <AlertTriangle className="h-3 w-3" /> {t('m365.status_error')}
                  </Badge>
                ) : m365.last_sync_at ? (
                  <Badge variant="default" className="gap-1 text-[10px]">
                    <CheckCircle2 className="h-3 w-3" /> {t('m365.status_ok')}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px]">{t('m365.status_pending')}</Badge>
                )}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">
                {t('m365.last_sync')}: {m365.last_sync_at ? new Date(m365.last_sync_at).toLocaleString() : t('m365.never')}
              </div>
              {m365.last_sync_error ? (
                <div className="text-[11px] text-destructive mt-1 truncate">{m365.last_sync_error}</div>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => syncNow(m365.id)} disabled={syncingId === m365.id} className="gap-2">
                {syncingId === m365.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                {t('m365.sync_now')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => disconnect(m365.id)} className="gap-2 text-destructive">
                <Unlink className="h-3 w-3" /> {t('m365.disconnect')}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">{t('m365.sync_schedule_hint')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
