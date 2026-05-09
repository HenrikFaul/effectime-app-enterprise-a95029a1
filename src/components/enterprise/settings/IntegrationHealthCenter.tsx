import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, AlertTriangle, CheckCircle2, Plug } from 'lucide-react';
import { useT } from '@/i18n/I18nProvider';

interface Props {
  workspaceId: string;
}

interface Integration {
  id: string;
  provider: string;
  base_url: string | null;
  is_active: boolean;
  project_key: string | null;
}

interface SyncLog {
  id: string;
  integration_id: string;
  action: string;
  status: string;
  error_message: string | null;
  created_at: string;
}

type Health = 'healthy' | 'degraded' | 'failed' | 'unknown';

function classify(logs: SyncLog[]): Health {
  if (logs.length === 0) return 'unknown';
  const recent = logs.slice(0, 5);
  const failures = recent.filter((l) => l.status === 'error' || l.status === 'failed').length;
  if (failures === 0) return 'healthy';
  if (failures < recent.length) return 'degraded';
  return 'failed';
}

export function IntegrationHealthCenter({ workspaceId }: Props) {
  const t = useT();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [logsByIntegration, setLogsByIntegration] = useState<Record<string, SyncLog[]>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('enterprise_workspace_integrations')
      .select('id, provider, base_url, is_active, project_key')
      .eq('workspace_id', workspaceId)
      .order('provider');
    const ints = (data as Integration[]) || [];
    setIntegrations(ints);

    if (ints.length > 0) {
      const map: Record<string, SyncLog[]> = {};
      await Promise.all(
        ints.map(async (i) => {
          const { data: logs } = await (supabase as any)
            .from('enterprise_agile_sync_log')
            .select('id, integration_id, action, status, error_message, created_at')
            .eq('integration_id', i.id)
            .order('created_at', { ascending: false })
            .limit(10);
          map[i.id] = (logs as SyncLog[]) || [];
        }),
      );
      setLogsByIntegration(map);
    } else {
      setLogsByIntegration({});
    }
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <div>
            <CardTitle className="text-base">{t('integration_health.title')}</CardTitle>
            <CardDescription className="text-xs">{t('integration_health.subtitle')}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <div className="text-sm text-muted-foreground">{t('common.loading')}</div>
        ) : integrations.length === 0 ? (
          <div className="text-sm text-muted-foreground italic">{t('integration_health.no_integrations')}</div>
        ) : (
          integrations.map((i) => {
            const logs = logsByIntegration[i.id] ?? [];
            const health = classify(logs);
            const last = logs[0];
            const recentErrors = logs.filter((l) => l.status === 'error' || l.status === 'failed').slice(0, 3);
            const HealthBadge =
              health === 'healthy' ? (
                <Badge className="text-[10px] gap-1" variant="default">
                  <CheckCircle2 className="h-3 w-3" /> {t('integration_health.healthy')}
                </Badge>
              ) : health === 'degraded' ? (
                <Badge className="text-[10px] gap-1" variant="secondary">
                  <AlertTriangle className="h-3 w-3" /> {t('integration_health.degraded')}
                </Badge>
              ) : health === 'failed' ? (
                <Badge className="text-[10px] gap-1" variant="destructive">
                  <AlertTriangle className="h-3 w-3" /> {t('integration_health.failed')}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px]">—</Badge>
              );
            return (
              <div key={i.id} className="rounded-md border bg-card px-3 py-2">
                <div className="flex items-center gap-2">
                  <Plug className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm font-medium flex-1">
                    {i.provider}
                    {i.project_key ? <span className="text-muted-foreground"> · {i.project_key}</span> : null}
                  </span>
                  {HealthBadge}
                </div>
                {last ? (
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {t('integration_health.last_sync')}: {new Date(last.created_at).toLocaleString()} · {last.action} ·
                    <span className={last.status === 'error' || last.status === 'failed' ? 'text-destructive ml-1' : 'ml-1'}>
                      {last.status === 'error' || last.status === 'failed' ? t('integration_health.error') : t('integration_health.success')}
                    </span>
                  </div>
                ) : (
                  <div className="text-[11px] text-muted-foreground mt-1">{t('integration_health.no_sync_log')}</div>
                )}
                {recentErrors.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {recentErrors.map((e) => (
                      <li key={e.id} className="text-[11px] text-destructive truncate">
                        {new Date(e.created_at).toLocaleString()} — {e.action}: {e.error_message || '—'}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
