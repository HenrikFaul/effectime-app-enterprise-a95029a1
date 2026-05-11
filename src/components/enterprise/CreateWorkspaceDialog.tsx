import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/i18n/I18nProvider';

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

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error(t('create_workspace.name_required'));
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.rpc('create_workspace_with_owner', {
        _name: name.trim(),
        _description: description.trim() || null,
      });

      if (error) throw error;

      toast.success(t('create_workspace.created_toast'));
      setName('');
      setDescription('');
      onOpenChange(false);
      onCreated();
    } catch (err: unknown) {
      console.error(err);
      toast.error(t('create_workspace.creation_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDemo = async () => {
    setSeedingDemo(true);
    const toastId = toast.loading(t('create_workspace.demo_creating_toast'));
    try {
      const { data, error } = await supabase.functions.invoke('seed-demo-workspace', {
        body: {
          name: name.trim() || `${t('create_workspace.demo_default_name')} ${new Date().toLocaleDateString()}`,
          description: description.trim() || null,
        },
      });
      if (error) throw error;
      const payload = data as { ok?: boolean; error?: string; summary?: Record<string, number>; members_created?: number } | null;
      if (!payload?.ok) {
        throw new Error(payload?.error ?? t('create_workspace.demo_unknown_error'));
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
      toast.error(t('create_workspace.demo_creation_error'), { id: toastId });
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
