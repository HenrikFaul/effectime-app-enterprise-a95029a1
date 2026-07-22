import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CalendarX2, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useI18n } from '@/i18n/I18nProvider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  workspaceId: string;
  userId: string;
}

interface ICalTokenSummary {
  id: string;
  scope: string;
}

interface SummaryState {
  contextKey: string;
  status: 'loading' | 'ready' | 'error';
  summaries: ICalTokenSummary[];
  failedRevokeIds: string[];
}

function parseTokenSummaries(value: unknown): ICalTokenSummary[] | null {
  if (!Array.isArray(value)) return null;

  const seenIds = new Set<string>();
  const summaries: ICalTokenSummary[] = [];
  for (const row of value) {
    if (row === null || typeof row !== 'object') return null;
    const { id, scope } = row as Record<string, unknown>;
    if (
      typeof id !== 'string'
      || id.trim().length === 0
      || typeof scope !== 'string'
      || scope.trim().length === 0
      || seenIds.has(id)
    ) return null;
    seenIds.add(id);
    summaries.push({ id, scope });
  }
  return summaries;
}

// Generated database types do not yet contain this legacy table. Keep the
// escape local and, critically, keep the recovery projection token-free.
const iCalSummaryClient = supabase as unknown as SupabaseClient;

export function ICalTokenRevocationList({ workspaceId, userId }: Props) {
  const { t } = useI18n();
  const contextKey = `${workspaceId}:${userId}`;
  const [state, setState] = useState<SummaryState>(() => ({
    contextKey,
    status: 'loading',
    summaries: [],
    failedRevokeIds: [],
  }));
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const pendingIdsRef = useRef<Set<string>>(new Set());
  const requestSequenceRef = useRef(0);
  const activeContextRef = useRef<string | null>(contextKey);

  const currentState = state.contextKey === contextKey
    ? state
    : { contextKey, status: 'loading' as const, summaries: [], failedRevokeIds: [] };

  const load = useCallback(async () => {
    const requestSequence = ++requestSequenceRef.current;
    const requestContext = contextKey;
    setState({
      contextKey: requestContext,
      status: 'loading',
      summaries: [],
      failedRevokeIds: [],
    });

    try {
      const { data, error } = await iCalSummaryClient
        .from('enterprise_ical_tokens')
        .select('id, scope')
        .eq('workspace_id', workspaceId)
        .eq('user_id', userId);
      if (
        requestSequence !== requestSequenceRef.current
        || activeContextRef.current !== requestContext
      ) return;
      if (error) {
        setState({
          contextKey: requestContext,
          status: 'error',
          summaries: [],
          failedRevokeIds: [],
        });
        return;
      }
      const summaries = parseTokenSummaries(data ?? []);
      if (summaries === null) {
        setState({
          contextKey: requestContext,
          status: 'error',
          summaries: [],
          failedRevokeIds: [],
        });
        return;
      }
      setState({
        contextKey: requestContext,
        status: 'ready',
        summaries,
        failedRevokeIds: [],
      });
    } catch {
      if (
        requestSequence === requestSequenceRef.current
        && activeContextRef.current === requestContext
      ) {
        setState({
          contextKey: requestContext,
          status: 'error',
          summaries: [],
          failedRevokeIds: [],
        });
      }
    }
  }, [contextKey, userId, workspaceId]);

  useEffect(() => {
    activeContextRef.current = contextKey;
    pendingIdsRef.current = new Set();
    setPendingIds(new Set());
    void load();
    return () => {
      requestSequenceRef.current += 1;
      if (activeContextRef.current === contextKey) activeContextRef.current = null;
    };
  }, [contextKey, load]);

  const revoke = async (id: string) => {
    if (pendingIdsRef.current.has(id)) return;
    const mutationContext = contextKey;
    const nextPending = new Set(pendingIdsRef.current).add(id);
    pendingIdsRef.current = nextPending;
    setPendingIds(nextPending);
    setState((current) => current.contextKey === mutationContext
      ? { ...current, failedRevokeIds: current.failedRevokeIds.filter((failedId) => failedId !== id) }
      : current);

    try {
      const { error, count } = await iCalSummaryClient
        .from('enterprise_ical_tokens')
        .delete({ count: 'exact' })
        .eq('id', id)
        .eq('workspace_id', workspaceId)
        .eq('user_id', userId);
      if (activeContextRef.current !== mutationContext) return;
      if (error || count !== 1) {
        setState((current) => current.contextKey === mutationContext
          ? {
              ...current,
              failedRevokeIds: current.failedRevokeIds.includes(id)
                ? current.failedRevokeIds
                : [...current.failedRevokeIds, id],
            }
          : current);
        toast.error(t('ical_subscription.revoke_failed'));
        return;
      }
      setState((current) => current.contextKey === mutationContext
        ? {
            ...current,
            summaries: current.summaries.filter((summary) => summary.id !== id),
            failedRevokeIds: current.failedRevokeIds.filter((failedId) => failedId !== id),
          }
        : current);
      toast.success(t('ical_subscription.feed_revoked'));
    } catch {
      if (activeContextRef.current === mutationContext) {
        setState((current) => current.contextKey === mutationContext
          ? {
              ...current,
              failedRevokeIds: current.failedRevokeIds.includes(id)
                ? current.failedRevokeIds
                : [...current.failedRevokeIds, id],
            }
          : current);
        toast.error(t('ical_subscription.revoke_failed'));
      }
    } finally {
      if (activeContextRef.current === mutationContext) {
        const remaining = new Set(pendingIdsRef.current);
        remaining.delete(id);
        pendingIdsRef.current = remaining;
        setPendingIds(remaining);
      }
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <CalendarX2 className="h-4 w-4 text-primary" />
          {t('ical_subscription.revoke_card_title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          {t('ical_subscription.entitlement_unavailable_description')}
        </p>

        {currentState.status === 'loading' && (
          <p role="status" className="text-sm text-muted-foreground">
            {t('ical_subscription.loading_summaries')}
          </p>
        )}

        {currentState.status === 'error' && (
          <Alert variant="destructive">
            <AlertDescription className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>{t('ical_subscription.summary_load_failed')}</span>
              <Button size="sm" variant="outline" onClick={() => void load()}>
                <RefreshCw className="mr-2 h-3.5 w-3.5" />
                {t('ical_subscription.retry_summary_load')}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {currentState.status === 'ready' && currentState.summaries.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {t('ical_subscription.no_revocable_feeds')}
          </p>
        )}

        {currentState.summaries.map((summary) => {
          const scopeLabel = summary.scope === 'team'
            ? t('ical_subscription.scope_team')
            : summary.scope === 'own'
              ? t('ical_subscription.scope_own')
              : t('ical_subscription.scope_unknown');
          const pending = pendingIds.has(summary.id);
          const revokeFailed = currentState.failedRevokeIds.includes(summary.id);
          return (
            <div key={summary.id} className="space-y-1 rounded-md border p-2">
              <div className="flex items-center gap-2">
                <Badge variant={summary.scope === 'team' ? 'default' : 'secondary'} className="text-xs">
                  {scopeLabel}
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto"
                  disabled={pending}
                  aria-busy={pending}
                  aria-label={t('ical_subscription.delete_feed', { scope: scopeLabel })}
                  onClick={() => void revoke(summary.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              {revokeFailed && (
                <p role="alert" className="text-sm text-destructive">
                  {t('ical_subscription.revoke_failed')}
                </p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
