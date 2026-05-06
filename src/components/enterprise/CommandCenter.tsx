import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, AlertTriangle, GitMerge, Shield, Plug, Building2 } from 'lucide-react';
import { useT } from '@/i18n/I18nProvider';

interface Props {
  workspaceId: string;
  onOpenTab?: (tab: string) => void;
  recoveryMode?: boolean;
}

interface Counts {
  approvals: number;
  onboarding: number;
  access: number;
  incompleteOrg: number;
}

export function CommandCenter({ workspaceId, onOpenTab, recoveryMode }: Props) {
  const t = useT();
  const [counts, setCounts] = useState<Counts>({ approvals: 0, onboarding: 0, access: 0, incompleteOrg: 0 });

  const refresh = useCallback(async () => {
    const queries = await Promise.all([
      (supabase as any)
        .from('leave_requests')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('status', 'pending'),
      (supabase as any)
        .from('enterprise_onboarding_instances')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('status', 'in_progress'),
      (supabase as any)
        .from('enterprise_access_requests')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('status', 'pending'),
      (supabase as any)
        .from('enterprise_memberships')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('status', 'active')
        .or('org_unit_id.is.null,manager_id.is.null,contract_type_id.is.null,leadership_level_id.is.null'),
    ]);

    setCounts({
      approvals: queries[0]?.count ?? 0,
      onboarding: queries[1]?.count ?? 0,
      access: queries[2]?.count ?? 0,
      incompleteOrg: queries[3]?.count ?? 0,
    });
  }, [workspaceId]);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 90_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const items: Array<{ key: string; label: string; count: number; icon: any; tab?: string }> = [
    { key: 'approvals', label: t('command.pending_approvals'), count: counts.approvals, icon: Shield, tab: 'requests' },
    { key: 'onboarding', label: t('command.pending_onboarding'), count: counts.onboarding, icon: GitMerge, tab: 'workflows' },
    { key: 'access', label: t('command.pending_access'), count: counts.access, icon: Plug, tab: 'workflows' },
    { key: 'org', label: t('command.organization_completion'), count: counts.incompleteOrg, icon: Building2, tab: 'organization' },
  ];

  return (
    <Card className={recoveryMode ? 'border-destructive/50 bg-destructive/5' : ''}>
      <CardContent className="p-3">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <Activity className={`h-4 w-4 ${recoveryMode ? 'text-destructive' : 'text-primary'}`} />
          <span className="text-sm font-semibold">{t('command.title')}</span>
          <span className="text-xs text-muted-foreground">— {t('command.subtitle')}</span>
          {recoveryMode ? (
            <Badge variant="destructive" className="ml-auto text-[10px] flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {t('command.recovery_active')}
            </Badge>
          ) : (
            <Badge variant="outline" className="ml-auto text-[10px]">{t('command.recovery_inactive')}</Badge>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {items.map((it) => {
            const Icon = it.icon;
            const dim = it.count === 0;
            return (
              <button
                key={it.key}
                type="button"
                onClick={() => it.tab && onOpenTab?.(it.tab)}
                className={`flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-left hover:bg-accent transition-colors ${dim ? 'opacity-70' : ''}`}
              >
                <Icon className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground truncate">{it.label}</div>
                  <div className="text-base font-semibold leading-none mt-0.5">{it.count}</div>
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
