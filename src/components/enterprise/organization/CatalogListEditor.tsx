import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useT } from '@/i18n/I18nProvider';

interface Props {
  workspaceId: string;
  isAdmin: boolean;
  table: string;
  /** Optional helper to seed defaults (calls a Postgres function if provided). */
  seedRpc?: string;
  description: string;
  addLabel: string;
  emptyLabel?: string;
  /** Extra header / banner content rendered above the form. */
  headerExtra?: ReactNode;
}

interface Row {
  id: string;
  workspace_id: string;
  code: string;
  label: string;
  is_default?: boolean;
  archived_at: string | null;
  sort_order?: number;
}

/**
 * Generic editor for simple workspace-scoped catalog tables that share the
 * (id, workspace_id, code, label, archived_at) shape. Used for leadership
 * levels, contract types, industries, work categories, and job families.
 */
export function CatalogListEditor({
  workspaceId,
  isAdmin,
  table,
  seedRpc,
  description,
  addLabel,
  emptyLabel,
  headerExtra,
}: Props) {
  const t = useT();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from(table)
      .select('*')
      .eq('workspace_id', workspaceId)
      .is('archived_at', null)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('label');
    if (error) {
      // eslint-disable-next-line no-console
      console.warn(`[${table}] load error`, error.message);
      setRows([]);
    } else {
      setRows((data as Row[]) || []);
    }
    setLoading(false);
  }, [table, workspaceId]);

  useEffect(() => {
    load();
  }, [load]);

  const slug = (s: string) =>
    s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);

  const handleAdd = async () => {
    const c = code.trim() ? slug(code) : slug(label);
    const l = label.trim();
    if (!c || !l) return;
    setBusy(true);
    const { error } = await (supabase as any)
      .from(table)
      .insert({ workspace_id: workspaceId, code: c, label: l });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setCode('');
    setLabel('');
    toast.success(t('common.save'));
    load();
  };

  const handleSeed = async () => {
    if (!seedRpc) return;
    setBusy(true);
    const { error } = await (supabase as any).rpc(seedRpc, { p_workspace_id: workspaceId });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Seeded');
    load();
  };

  const handleArchive = async (id: string) => {
    const { error } = await (supabase as any)
      .from(table)
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id);
    if (error) toast.error(error.message);
    else load();
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{description}</p>
      {headerExtra}

      {isAdmin ? (
        <Card>
          <CardContent className="p-3 flex flex-wrap items-end gap-2">
            <div className="min-w-[140px]">
              <label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {t('common.name')}
              </label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label" />
            </div>
            <div className="min-w-[140px]">
              <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Code</label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="auto" />
            </div>
            <Button onClick={handleAdd} disabled={busy || !label.trim()} size="sm">
              <Plus className="h-4 w-4 mr-1" /> {addLabel}
            </Button>
            {seedRpc ? (
              <Button onClick={handleSeed} disabled={busy} size="sm" variant="outline">
                Seed defaults
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {loading ? (
        <div className="text-sm text-muted-foreground">{t('common.loading')}</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-muted-foreground italic">{emptyLabel ?? t('common.empty')}</div>
      ) : (
        <div className="space-y-1">
          {rows.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-2 rounded-md border bg-card px-2 py-1.5"
            >
              <span className="text-sm flex-1">{r.label}</span>
              <span className="text-[11px] text-muted-foreground font-mono">{r.code}</span>
              {isAdmin ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleArchive(r.id)}
                  aria-label={t('common.archive')}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
