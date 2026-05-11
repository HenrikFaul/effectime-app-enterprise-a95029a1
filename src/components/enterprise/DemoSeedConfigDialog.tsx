import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useI18n } from '@/i18n/I18nProvider';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, ChevronDown, Loader2, Save, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { DEMO_SEED_MAX_LIMITS } from '@/config/demo-seed-limits';

// ── Types ─────────────────────────────────────────────────────────────────────

type Qty = Record<string, number>;

// Default quantities — all keys match DEMO_SEED_MAX_LIMITS; defaults = max (full dataset)
const DEFAULTS: Qty = { ...DEMO_SEED_MAX_LIMITS };

// ── Tree definition ───────────────────────────────────────────────────────────
// Each leaf maps to a key in Qty. Path shows where in the app the entity lives.

type Leaf = {
  key: string;
  label: string;
  path: string;
  max: number;
};
type Group = {
  id: string;
  label: string;
  badge?: string;
  children: (Leaf | Group)[];
};

const isGroup = (n: Leaf | Group): n is Group => 'children' in n;

// Helper: get max from the central config file (src/config/demo-seed-limits.ts)
const lim = (key: string) => DEMO_SEED_MAX_LIMITS[key] ?? 99;

// Factory: builds the tree with translated labels/paths — must be called inside a component where t() is available
const buildTree = (t: (key: string) => string): Group[] => [
  {
    id: 'members',
    label: t('demo_seed.group_members'),
    badge: 'Members',
    children: [
      { key: 'members',          label: t('demo_seed.leaf_members'),          path: t('demo_seed.path_members'),          max: lim('members')          },
      { key: 'member_templates', label: t('demo_seed.leaf_member_templates'), path: t('demo_seed.path_member_templates'), max: lim('member_templates') },
      { key: 'ical_tokens',      label: t('demo_seed.leaf_ical_tokens'),      path: t('demo_seed.path_ical_tokens'),      max: lim('ical_tokens')      },
    ],
  },
  {
    id: 'org',
    label: t('demo_seed.group_org'),
    badge: 'Organization',
    children: [
      { key: 'offices',          label: t('demo_seed.leaf_offices'),          path: t('demo_seed.path_offices'),          max: lim('offices')          },
      { key: 'teams',            label: t('demo_seed.leaf_teams'),            path: t('demo_seed.path_teams'),            max: lim('teams')            },
      { key: 'skills',           label: t('demo_seed.leaf_skills'),           path: t('demo_seed.path_skills'),           max: lim('skills')           },
      { key: 'org_units',        label: t('demo_seed.leaf_org_units'),        path: t('demo_seed.path_org_units'),        max: lim('org_units')        },
      { key: 'role_definitions', label: t('demo_seed.leaf_role_definitions'), path: t('demo_seed.path_role_definitions'), max: lim('role_definitions') },
      {
        id: 'catalogs',
        label: t('demo_seed.group_catalogs'),
        children: [
          { key: 'job_families',      label: t('demo_seed.leaf_job_families'),      path: t('demo_seed.path_job_families'),      max: lim('job_families')      },
          { key: 'leadership_levels', label: t('demo_seed.leaf_leadership_levels'), path: t('demo_seed.path_leadership_levels'), max: lim('leadership_levels') },
          { key: 'contract_types',    label: t('demo_seed.leaf_contract_types'),    path: t('demo_seed.path_contract_types'),    max: lim('contract_types')    },
          { key: 'industries',        label: t('demo_seed.leaf_industries'),        path: t('demo_seed.path_industries'),        max: lim('industries')        },
          { key: 'work_categories',   label: t('demo_seed.leaf_work_categories'),   path: t('demo_seed.path_work_categories'),   max: lim('work_categories')   },
        ],
      },
    ],
  },
  {
    id: 'leave',
    label: t('demo_seed.group_leave'),
    badge: 'Leave',
    children: [
      { key: 'leave_types',           label: t('demo_seed.leaf_leave_types'),           path: t('demo_seed.path_leave_types'),           max: lim('leave_types')           },
      { key: 'holidays',              label: t('demo_seed.leaf_holidays'),              path: t('demo_seed.path_holidays'),              max: lim('holidays')              },
      { key: 'daily_rules',           label: t('demo_seed.leaf_daily_rules'),           path: t('demo_seed.path_daily_rules'),           max: lim('daily_rules')           },
      { key: 'office_coverage_rules', label: t('demo_seed.leaf_office_coverage_rules'), path: t('demo_seed.path_office_coverage_rules'), max: lim('office_coverage_rules') },
      {
        id: 'workflow',
        label: t('demo_seed.group_workflow'),
        children: [
          { key: 'approval_chains', label: t('demo_seed.leaf_approval_chains'), path: t('demo_seed.path_approval_chains'), max: lim('approval_chains') },
          { key: 'rule_templates',  label: t('demo_seed.leaf_rule_templates'),  path: t('demo_seed.path_rule_templates'),  max: lim('rule_templates')  },
        ],
      },
    ],
  },
  {
    id: 'resources',
    label: t('demo_seed.group_resources'),
    badge: 'Resources',
    children: [
      { key: 'projects',     label: t('demo_seed.leaf_projects'),     path: t('demo_seed.path_projects'),     max: lim('projects')     },
      { key: 'scenarios',    label: t('demo_seed.leaf_scenarios'),    path: t('demo_seed.path_scenarios'),    max: lim('scenarios')    },
      { key: 'agile_issues', label: t('demo_seed.leaf_agile_issues'), path: t('demo_seed.path_agile_issues'), max: lim('agile_issues') },
    ],
  },
  {
    id: 'reporting',
    label: t('demo_seed.group_reporting'),
    badge: 'Reporting',
    children: [
      { key: 'reports', label: t('demo_seed.leaf_reports'), path: t('demo_seed.path_reports'), max: lim('reports') },
    ],
  },
  {
    id: 'onboarding',
    label: t('demo_seed.group_onboarding'),
    badge: 'Processes',
    children: [
      { key: 'access_systems',       label: t('demo_seed.leaf_access_systems'),       path: t('demo_seed.path_access_systems'),       max: lim('access_systems')       },
      { key: 'onboarding_templates', label: t('demo_seed.leaf_onboarding_templates'), path: t('demo_seed.path_onboarding_templates'), max: lim('onboarding_templates') },
    ],
  },
  {
    id: 'settings',
    label: t('demo_seed.group_settings'),
    badge: 'Settings',
    children: [
      { key: 'translation_overrides', label: t('demo_seed.leaf_translation_overrides'), path: t('demo_seed.path_translation_overrides'), max: lim('translation_overrides') },
    ],
  },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function QtyInput({ label, path, value, max, onChange }: {
  label: string; path: string; value: number; max: number; onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3 py-1.5 px-3 rounded hover:bg-muted/40 group">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground truncate">{path}</div>
      </div>
      <div className="shrink-0 w-20">
        <Input
          type="number"
          min={0}
          max={max}
          value={value}
          onChange={e => onChange(Math.min(max, Math.max(0, parseInt(e.target.value, 10) || 0)))}
          className="h-7 text-center px-1 text-sm"
        />
      </div>
      <div className="text-xs text-muted-foreground w-10 text-right shrink-0">/ {max}</div>
    </div>
  );
}

function TreeNode({ node, qty, setQty, depth = 0 }: {
  node: Leaf | Group; qty: Qty; setQty: (k: string, v: number) => void; depth?: number;
}) {
  const [open, setOpen] = useState(depth < 1);

  if (!isGroup(node)) {
    return (
      <QtyInput
        label={node.label}
        path={node.path}
        value={qty[node.key] ?? DEFAULTS[node.key] ?? 0}
        max={node.max}
        onChange={v => setQty(node.key, v)}
      />
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full text-left px-3 py-1.5 rounded hover:bg-muted/50 font-medium text-sm"
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
        <span>{node.label}</span>
        {node.badge && <Badge variant="outline" className="text-[10px] h-4 px-1">{node.badge}</Badge>}
      </button>
      {open && (
        <div style={{ paddingLeft: `${depth * 8}px` }}>
          {node.children.map((child, i) => (
            <TreeNode key={isGroup(child) ? child.id : child.key + i} node={child} qty={qty} setQty={setQty} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main dialog ───────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

export function DemoSeedConfigDialog({ open, onOpenChange, userId }: Props) {
  const { t } = useI18n();
  const tree = useMemo(() => buildTree(t), [t]);
  const [qty, setQtyState] = useState<Qty>({ ...DEFAULTS });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const setQty = useCallback((k: string, v: number) => {
    setQtyState(prev => ({ ...prev, [k]: v }));
  }, []);

  // Load saved config when dialog opens
  useEffect(() => {
    if (!open || !userId) return;
    setLoading(true);
    supabase
      .from('enterprise_seed_config')
      .select('config')
      .eq('owner_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.config) {
          setQtyState({ ...DEFAULTS, ...(data.config as Qty) });
        } else {
          setQtyState({ ...DEFAULTS });
        }
        setLoading(false);
      });
  }, [open, userId]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('enterprise_seed_config')
      .upsert({ owner_id: userId, config: qty }, { onConflict: 'owner_id' });
    setSaving(false);
    if (error) {
      toast.error(t('demo_seed.save_error', { message: error.message }));
      return;
    }
    toast.success(t('demo_seed.save_success'));
    onOpenChange(false);
  };

  const handleReset = () => {
    setQtyState({ ...DEFAULTS });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b shrink-0">
          <DialogTitle className="text-base">{t('demo_seed.dialog_title')}</DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {t('demo_seed.dialog_description')}
          </p>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto py-2 px-1">
            <div className="flex items-center justify-between px-3 py-1.5 mb-1">
              <Label className="text-xs text-muted-foreground font-normal">{t('demo_seed.col_entity_name')}</Label>
              <Label className="text-xs text-muted-foreground font-normal mr-10">{t('demo_seed.col_quantity')}</Label>
            </div>
            {tree.map(group => (
              <TreeNode key={group.id} node={group} qty={qty} setQty={setQty} depth={0} />
            ))}
          </div>
        )}

        <DialogFooter className="px-6 py-4 border-t shrink-0 gap-2">
          <Button variant="ghost" size="sm" onClick={handleReset} className="mr-auto gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" /> {t('demo_seed.reset_defaults')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>{t('demo_seed.cancel')}</Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {t('demo_seed.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
