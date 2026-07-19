import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useI18n } from '@/i18n/I18nProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CalendarPlus, Copy, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { SUPABASE_URL, buildSupabaseFunctionUrl } from '@/config/publicRuntime';

interface Props {
  workspaceId: string;
  userId: string;
  canUseIcalFeed: boolean;
  canCreateTeamFeed: boolean;
}

interface ICalToken {
  id: string;
  token: string;
  scope: 'own' | 'team';
}

interface ICalTokenState {
  contextKey: string;
  tokens: ICalToken[];
}

// The live table predates the currently incomplete generated-schema provenance.
// Keep the escape local and remove it after the missing DDL/types are reconciled.
const iCalClient = supabase as unknown as SupabaseClient;

export function ICalSubscription({ workspaceId, userId, canUseIcalFeed, canCreateTeamFeed }: Props) {
  const { t } = useI18n();
  const contextKey = `${workspaceId}:${userId}`;
  const [tokenState, setTokenState] = useState<ICalTokenState>(() => ({ contextKey, tokens: [] }));
  const tokens = tokenState.contextKey === contextKey ? tokenState.tokens : [];
  const requestSequenceRef = useRef(0);
  const activeContextRef = useRef<string | null>(contextKey);
  const baseUrl = buildSupabaseFunctionUrl('leave-ical', SUPABASE_URL);

  const load = useCallback(async (clearExisting = false) => {
    const requestSequence = ++requestSequenceRef.current;
    const requestContext = contextKey;
    if (clearExisting) setTokenState({ contextKey: requestContext, tokens: [] });
    const { data, error } = await iCalClient
      .from('enterprise_ical_tokens')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId);
    if (requestSequence !== requestSequenceRef.current || activeContextRef.current !== requestContext) return;
    if (error) {
      setTokenState({ contextKey: requestContext, tokens: [] });
      toast.error(t('ical_subscription.error_generic'));
      return;
    }
    setTokenState({ contextKey: requestContext, tokens: (data ?? []) as ICalToken[] });
  }, [contextKey, t, userId, workspaceId]);

  useEffect(() => {
    activeContextRef.current = contextKey;
    void load(true);
    return () => {
      requestSequenceRef.current += 1;
      if (activeContextRef.current === contextKey) activeContextRef.current = null;
    };
  }, [contextKey, load]);

  const create = async (scope: 'own' | 'team') => {
    if (!canUseIcalFeed || (scope === 'team' && !canCreateTeamFeed)) return;
    const mutationContext = contextKey;
    const { error } = await iCalClient.from('enterprise_ical_tokens').insert({
      workspace_id: workspaceId, user_id: userId, scope,
    });
    if (activeContextRef.current !== mutationContext) return;
    if (error) { toast.error(error.message.includes('duplicate') ? t('ical_subscription.feed_exists') : t('ical_subscription.error_generic')); return; }
    toast.success(t('ical_subscription.feed_created'));
    void load();
  };

  const remove = async (id: string) => {
    const mutationContext = contextKey;
    const { error } = await iCalClient.from('enterprise_ical_tokens').delete().eq('id', id);
    if (activeContextRef.current !== mutationContext) return;
    if (error) {
      toast.error(t('ical_subscription.error_generic'));
      return;
    }
    await load();
  };

  const copy = async (token: string, scope: string) => {
    if (!canUseIcalFeed) return;
    const mutationContext = contextKey;
    const url = `${baseUrl}?token=${token}&scope=${scope}`;
    try {
      await navigator.clipboard.writeText(url);
      if (activeContextRef.current !== mutationContext) return;
      toast.success(t('ical_subscription.url_copied'));
    } catch {
      if (activeContextRef.current !== mutationContext) return;
      toast.error(t('common.copy_failed'));
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <CalendarPlus className="h-4 w-4 text-primary" /> {t('ical_subscription.card_title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          {t(canUseIcalFeed ? 'ical_subscription.description' : 'ical_subscription.disabled_description')}
        </p>
        {canUseIcalFeed && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => void create('own')}>{t('ical_subscription.btn_own')}</Button>
            {canCreateTeamFeed && (
              <Button size="sm" variant="outline" onClick={() => void create('team')}>{t('ical_subscription.btn_team')}</Button>
            )}
          </div>
        )}
        {tokens.map((tok) => {
          const scopeLabel = tok.scope === 'team' ? t('ical_subscription.scope_team') : t('ical_subscription.scope_own');
          return (
            <div key={tok.id} className="flex items-center gap-2 border rounded-md p-2">
              <Badge variant={tok.scope === 'team' ? 'default' : 'secondary'} className="text-xs">{scopeLabel}</Badge>
              {canUseIcalFeed && (
                <>
                  <Input
                    readOnly
                    aria-label={t('ical_subscription.feed_url', { scope: scopeLabel })}
                    className="h-7 text-xs font-mono"
                    value={`${baseUrl}?token=${tok.token}&scope=${tok.scope}`}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={t('ical_subscription.copy_url', { scope: scopeLabel })}
                    onClick={() => void copy(tok.token, tok.scope)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </>
              )}
              <Button
                size="sm"
                variant="ghost"
                className={canUseIcalFeed ? undefined : 'ml-auto'}
                aria-label={t('ical_subscription.delete_feed', { scope: scopeLabel })}
                onClick={() => void remove(tok.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
