import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/i18n/I18nProvider';
import { tierName } from '@/lib/tiering/labels';

interface TierOpt { id: string; tier_key: string; name: string; }

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onCreated: () => void;
}

export function CreateWorkspaceDialog({ open, onOpenChange, userId: _userId, onCreated }: Props) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [seedingDemo, setSeedingDemo] = useState(false);
  const [tiers, setTiers] = useState<TierOpt[]>([]);
  const [tierKey, setTierKey] = useState<string>('freemium');

  useEffect(() => {
    if (!open) return;
    supabase.from('tiers').select('id, tier_key, name').order('sort_order').then(({ data }) => {
      const list = (data as TierOpt[]) || [];
      setTiers(list);
      if (list.length && !list.find(x => x.tier_key === tierKey)) setTierKey(list[0].tier_key);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error(t('create_workspace.name_required'));
      return;
    }
    if (!tierKey) {
      // Defensive: the strict v3.17.1 RPC will reject this server-side too,
      // but a client-side guard saves a network round-trip and gives a
      // localized error message.
      toast.error(t('create_workspace.tier_required'));
      return;
    }
    setLoading(true);
    try {
      const { data: newWorkspaceId, error } = await supabase.rpc('create_workspace_with_owner', {
        _name: name.trim(),
        _description: description.trim() || null,
        _tier_key: tierKey,
      });

      if (error) throw error;
      if (!newWorkspaceId) throw new Error('Workspace ID not returned');

      // POST-CREATE TIER VERIFICATION
      // The function is strict (v3.17.1+) so a wrong tier_key would have
      // raised. But verifying once more end-to-end against the source of
      // truth (workspace_active_tier view) protects against any future
      // regression in the function body or PostgREST parameter binding.
      const { data: tierRow } = await supabase
        .from('workspace_active_tier')
        .select('tier_key')
        .eq('workspace_id', newWorkspaceId)
        .maybeSingle();
      const actualTier = (tierRow as { tier_key?: string } | null)?.tier_key;
      if (actualTier && actualTier !== tierKey) {
        // Tier mismatch — surface immediately so the user knows something
        // went wrong instead of silently entering a wrong-tier workspace.
        toast.error(t('create_workspace.tier_mismatch_error', { requested: tierKey, actual: actualTier }));
      } else {
        toast.success(t('create_workspace.created_toast'));
      }

      setName('');
      setDescription('');
      onOpenChange(false);
      onCreated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[CreateWorkspaceDialog] create failed', err);
      toast.error(t('create_workspace.creation_error') + (msg ? `: ${msg}` : ''));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDemo = async () => {
    if (!tierKey) {
      toast.error(t('create_workspace.tier_required'));
      return;
    }
    setSeedingDemo(true);
    const toastId = toast.loading(t('create_workspace.demo_creating_toast'));
    try {
      const { data, error } = await supabase.functions.invoke('seed-demo-workspace', {
        body: {
          name: name.trim() || `${t('create_workspace.demo_default_name')} ${new Date().toLocaleDateString()}`,
          description: description.trim() || null,
          tier_key: tierKey,
        },
      });
      if (error) throw error;
      const payload = data as { ok?: boolean; error?: string; summary?: Record<string, number>; members_created?: number; workspace_id?: string } | null;
      if (!payload?.ok) {
        throw new Error(payload?.error ?? t('create_workspace.demo_unknown_error'));
      }

      // POST-CREATE TIER VERIFICATION (same as handleCreate). If seed-demo-
      // workspace returns a workspace_id, fetch its actual tier and compare
      // against what the user selected. A mismatch surfaces a loud error
      // instead of letting the user enter a wrong-tier demo workspace.
      const wsId = payload.workspace_id;
      if (wsId) {
        const { data: tierRow } = await supabase
          .from('workspace_active_tier')
          .select('tier_key')
          .eq('workspace_id', wsId)
          .maybeSingle();
        const actualTier = (tierRow as { tier_key?: string } | null)?.tier_key;
        if (actualTier && actualTier !== tierKey) {
          toast.error(t('create_workspace.tier_mismatch_error', { requested: tierKey, actual: actualTier }), { id: toastId });
          setSeedingDemo(false);
          return;
        }
      }

      const s = payload.summary ?? {};
      const memberCount = s.members ?? payload.members_created ?? 0;
      toast.success(
        t('create_workspace.demo_created_toast', { memberCount, leaveCount: s.leave_requests ?? 0, skillCount: s.skills ?? 0, holidayCount: s.holidays ?? 0 }),
        { id: toastId },
      );
      setName('');
      setDescription('');
      onOpenChange(false);
      onCreated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[CreateWorkspaceDialog] demo seed failed', err);
      toast.error(t('create_workspace.demo_creation_error') + (msg ? `: ${msg}` : ''), { id: toastId });
    } finally {
      setSeedingDemo(false);
    }
  };

  const busy = loading || seedingDemo;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby="create-ws-description">
        <DialogHeader>
          <DialogTitle>{t('create_workspace.dialog_title')}</DialogTitle>
        </DialogHeader>
        <p id="create-ws-description" className="sr-only">
          {t('create_workspace.dialog_desc')}
        </p>
        <div className="space-y-4">
          <div>
            <Label htmlFor="ws-name">{t('create_workspace.name_label')}</Label>
            <Input
              id="ws-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('create_workspace.name_placeholder')}
              maxLength={100}
              disabled={busy}
            />
          </div>
          <div>
            <Label htmlFor="ws-desc">{t('common.description')}</Label>
            <Textarea
              id="ws-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('create_workspace.description_placeholder')}
              rows={3}
              maxLength={500}
              disabled={busy}
            />
          </div>
          <div>
            <Label htmlFor="ws-tier">{t('create_workspace.tier_label')}</Label>
            <Select value={tierKey} onValueChange={setTierKey} disabled={busy || tiers.length === 0}>
              <SelectTrigger id="ws-tier"><SelectValue placeholder={t('create_workspace.tier_placeholder')} /></SelectTrigger>
              <SelectContent>
                {tiers.map(tier => (
                  <SelectItem key={tier.id} value={tier.tier_key}>{tierName(t, tier.tier_key, tier.name)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              {t('create_workspace.tier_hint')}
            </p>
          </div>

          <Separator />

          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-primary" />
              {t('create_workspace.demo_title')}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t('create_workspace.demo_desc')}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCreateDemo}
              disabled={busy}
              className="w-full gap-1.5"
            >
              {seedingDemo
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('create_workspace.demo_creating_label')}</>
                : <><Sparkles className="h-3.5 w-3.5" /> {t('create_workspace.demo_create_btn')}</>}
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleCreate} disabled={busy || !name.trim()}>
            {loading ? t('create_workspace.creating_btn') : t('create_workspace.create_btn')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
