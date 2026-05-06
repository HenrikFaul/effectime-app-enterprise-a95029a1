import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useT } from '@/i18n/I18nProvider';

interface Props {
  workspaceId: string;
  userId: string;
}

export function RecoveryModeSettings({ workspaceId, userId }: Props) {
  const t = useT();
  const [active, setActive] = useState(false);
  const [reason, setReason] = useState('');
  const [activeReason, setActiveReason] = useState<string | null>(null);
  const [activatedAt, setActivatedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await (supabase as any)
      .from('enterprise_workspaces')
      .select('recovery_mode, recovery_mode_reason, recovery_mode_activated_at')
      .eq('id', workspaceId)
      .maybeSingle();
    setActive(!!data?.recovery_mode);
    setActiveReason(data?.recovery_mode_reason ?? null);
    setActivatedAt(data?.recovery_mode_activated_at ?? null);
  }, [workspaceId]);

  useEffect(() => {
    load();
  }, [load]);

  const activate = async () => {
    setBusy(true);
    const { error } = await (supabase as any)
      .from('enterprise_workspaces')
      .update({
        recovery_mode: true,
        recovery_mode_reason: reason.trim() || null,
        recovery_mode_activated_at: new Date().toISOString(),
        recovery_mode_activated_by: userId,
      })
      .eq('id', workspaceId);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setReason('');
    toast.success(t('common.save'));
    load();
  };

  const deactivate = async () => {
    setBusy(true);
    const { error } = await (supabase as any)
      .from('enterprise_workspaces')
      .update({
        recovery_mode: false,
        recovery_mode_reason: null,
        recovery_mode_activated_at: null,
        recovery_mode_activated_by: null,
      })
      .eq('id', workspaceId);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t('common.save'));
    load();
  };

  return (
    <Card className={active ? 'border-destructive/50' : ''}>
      <CardHeader>
        <div className="flex items-center gap-2">
          {active ? (
            <AlertTriangle className="h-5 w-5 text-destructive" />
          ) : (
            <ShieldCheck className="h-5 w-5 text-primary" />
          )}
          <div className="flex-1">
            <CardTitle className="text-base">{t('settings.recovery.title')}</CardTitle>
            <CardDescription className="text-xs">{t('settings.recovery.description')}</CardDescription>
          </div>
          {active ? (
            <Badge variant="destructive" className="text-[10px]">{t('command.recovery_active')}</Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">{t('command.recovery_inactive')}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {active && activatedAt ? (
          <div className="rounded-md bg-muted/50 px-3 py-2 text-xs">
            <strong>{t('settings.recovery.active_since')}:</strong> {new Date(activatedAt).toLocaleString()}
            {activeReason ? <div className="mt-1 text-muted-foreground">{activeReason}</div> : null}
          </div>
        ) : null}

        {!active ? (
          <div className="space-y-2">
            <label className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {t('settings.recovery.reason')}
            </label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('settings.recovery.reason_placeholder')}
            />
            <Button onClick={activate} disabled={busy} variant="destructive" size="sm">
              <AlertTriangle className="h-3.5 w-3.5 mr-1" /> {t('settings.recovery.activate')}
            </Button>
          </div>
        ) : (
          <Button onClick={deactivate} disabled={busy} variant="outline" size="sm">
            <ShieldCheck className="h-3.5 w-3.5 mr-1" /> {t('settings.recovery.deactivate')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
