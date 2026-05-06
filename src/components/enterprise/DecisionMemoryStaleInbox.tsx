import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookMarked, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useT } from '@/i18n/I18nProvider';

interface Props {
  workspaceId: string;
  isAdmin: boolean;
  authoredBy?: string;
}

interface StaleRow {
  id: string;
  subject_type: string;
  subject_id: string;
  rationale: string | null;
  expected_outcome: string | null;
  observed_outcome: string | null;
  authored_at: string;
  observation_due_at: string | null;
}

export function DecisionMemoryStaleInbox({ workspaceId, isAdmin, authoredBy }: Props) {
  const t = useT();
  const [rows, setRows] = useState<StaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const nowIso = new Date().toISOString();
    const { data } = await (supabase as any)
      .from('enterprise_decision_memory')
      .select('id, subject_type, subject_id, rationale, expected_outcome, observed_outcome, authored_at, observation_due_at')
      .eq('workspace_id', workspaceId)
      .is('observed_outcome', null)
      .lte('observation_due_at', nowIso)
      .order('observation_due_at', { ascending: true })
      .limit(50);
    setRows((data as StaleRow[]) || []);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (id: string) => {
    const text = (drafts[id] || '').trim();
    if (!text) return;
    const { error } = await (supabase as any)
      .from('enterprise_decision_memory')
      .update({
        observed_outcome: text,
        observed_at: new Date().toISOString(),
        authored_by: authoredBy ?? null,
      })
      .eq('id', id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t('decision.saved'));
    setDrafts((d) => {
      const next = { ...d };
      delete next[id];
      return next;
    });
    load();
  };

  const daysOverdue = (dueIso: string | null) => {
    if (!dueIso) return 0;
    const ms = Date.now() - new Date(dueIso).getTime();
    return Math.max(0, Math.floor(ms / 86400_000));
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <BookMarked className="h-5 w-5 text-primary" />
          <div>
            <CardTitle className="text-base">{t('decision.stale_inbox_title')}</CardTitle>
            <CardDescription className="text-xs">{t('decision.stale_inbox_description')}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <div className="text-sm text-muted-foreground">{t('common.loading')}</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground italic">{t('decision.no_stale')}</div>
        ) : (
          rows.map((r) => {
            const overdue = daysOverdue(r.observation_due_at);
            return (
              <div key={r.id} className="rounded-md border bg-card px-3 py-2 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] font-mono">{r.subject_type}</Badge>
                  <span className="text-[11px] font-mono text-muted-foreground truncate flex-1">{r.subject_id}</span>
                  <Badge variant="secondary" className="text-[10px] gap-1">
                    <Clock className="h-3 w-3" />
                    {t('decision.days_overdue', { count: overdue })}
                  </Badge>
                </div>
                {r.rationale ? (
                  <div className="text-[11px] text-muted-foreground">
                    <strong>{t('decision.rationale')}:</strong> {r.rationale}
                  </div>
                ) : null}
                {r.expected_outcome ? (
                  <div className="text-[11px] text-muted-foreground">
                    <strong>{t('decision.expected')}:</strong> {r.expected_outcome}
                  </div>
                ) : null}
                {isAdmin ? (
                  <div className="space-y-1">
                    <textarea
                      value={drafts[r.id] || ''}
                      onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                      placeholder={t('decision.placeholder_observed')}
                      rows={2}
                      className="w-full rounded-md border bg-background px-2 py-1 text-sm"
                    />
                    <Button size="sm" onClick={() => save(r.id)} disabled={!(drafts[r.id] || '').trim()}>
                      {t('decision.capture_observed')}
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
