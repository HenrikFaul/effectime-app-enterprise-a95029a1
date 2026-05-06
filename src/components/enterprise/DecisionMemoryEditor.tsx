import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { BookMarked } from 'lucide-react';
import { toast } from 'sonner';
import { useT } from '@/i18n/I18nProvider';

interface Props {
  workspaceId: string;
  subjectType: string;
  subjectId: string;
  authoredBy?: string;
  collapsedByDefault?: boolean;
}

interface Memory {
  rationale: string;
  expected_outcome: string;
  observed_outcome: string;
}

const EMPTY: Memory = { rationale: '', expected_outcome: '', observed_outcome: '' };

export function DecisionMemoryEditor({ workspaceId, subjectType, subjectId, authoredBy, collapsedByDefault = true }: Props) {
  const t = useT();
  const [open, setOpen] = useState(!collapsedByDefault);
  const [memory, setMemory] = useState<Memory>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [exists, setExists] = useState(false);

  const load = useCallback(async () => {
    const { data } = await (supabase as any)
      .from('enterprise_decision_memory')
      .select('rationale, expected_outcome, observed_outcome')
      .eq('workspace_id', workspaceId)
      .eq('subject_type', subjectType)
      .eq('subject_id', subjectId)
      .maybeSingle();
    if (data) {
      setMemory({
        rationale: data.rationale ?? '',
        expected_outcome: data.expected_outcome ?? '',
        observed_outcome: data.observed_outcome ?? '',
      });
      setExists(true);
    }
  }, [workspaceId, subjectType, subjectId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const save = async () => {
    setBusy(true);
    const payload = {
      workspace_id: workspaceId,
      subject_type: subjectType,
      subject_id: subjectId,
      rationale: memory.rationale.trim() || null,
      expected_outcome: memory.expected_outcome.trim() || null,
      observed_outcome: memory.observed_outcome.trim() || null,
      authored_by: authoredBy ?? null,
      authored_at: new Date().toISOString(),
    };
    const { error } = exists
      ? await (supabase as any)
          .from('enterprise_decision_memory')
          .update(payload)
          .eq('workspace_id', workspaceId)
          .eq('subject_type', subjectType)
          .eq('subject_id', subjectId)
      : await (supabase as any).from('enterprise_decision_memory').insert(payload);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setExists(true);
    toast.success(t('decision.saved'));
  };

  return (
    <Card>
      <CardContent className="p-3 space-y-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 text-xs font-medium text-primary"
        >
          <BookMarked className="h-3.5 w-3.5" />
          {t('decision.memory_title')}
        </button>
        {open ? (
          <div className="space-y-2">
            <div>
              <label className="text-[11px] uppercase tracking-wide text-muted-foreground">{t('decision.rationale')}</label>
              <textarea
                value={memory.rationale}
                onChange={(e) => setMemory((m) => ({ ...m, rationale: e.target.value }))}
                placeholder={t('decision.placeholder_rationale')}
                rows={2}
                className="w-full rounded-md border bg-background px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wide text-muted-foreground">{t('decision.expected')}</label>
              <textarea
                value={memory.expected_outcome}
                onChange={(e) => setMemory((m) => ({ ...m, expected_outcome: e.target.value }))}
                placeholder={t('decision.placeholder_expected')}
                rows={2}
                className="w-full rounded-md border bg-background px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wide text-muted-foreground">{t('decision.observed')}</label>
              <textarea
                value={memory.observed_outcome}
                onChange={(e) => setMemory((m) => ({ ...m, observed_outcome: e.target.value }))}
                placeholder={t('decision.placeholder_observed')}
                rows={2}
                className="w-full rounded-md border bg-background px-2 py-1 text-sm"
              />
            </div>
            <Button size="sm" onClick={save} disabled={busy}>
              {t('decision.save')}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
