import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, ChevronDown, Loader2, Save, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

// ── Types ─────────────────────────────────────────────────────────────────────

type Qty = Record<string, number>;

// Default quantities — mirror DEFAULT_SEED_QUANTITIES in seed-data.ts
const DEFAULTS: Qty = {
  members:               22,
  offices:                3,
  teams:                  4,
  leave_types:            4,
  holidays:               8,
  skills:                12,
  projects:               5,
  daily_rules:            7,
  office_coverage_rules: 10,
  approval_chains:        2,
  rule_templates:         5,
  reports:                4,
  scenarios:              2,
  access_systems:         4,
  onboarding_templates:   3,
  role_definitions:       3,
  member_templates:       5,
  translation_overrides:  4,
  agile_issues:           4,
  ical_tokens:            4,
};

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

const TREE: Group[] = [
  {
    id: 'members',
    label: 'Tagok',
    badge: 'Members',
    children: [
      { key: 'members', label: 'Demo tagok',         path: 'Tagok → Tagok listája',                    max: 22 },
      { key: 'member_templates', label: 'Meghívó sablonok', path: 'Tagok → Meghívás → Sablonok',      max: 5  },
      { key: 'ical_tokens',      label: 'iCal tokenek',     path: 'Beállítások → iCal előfizetés',     max: 4  },
    ],
  },
  {
    id: 'org',
    label: 'Szervezet',
    badge: 'Organization',
    children: [
      { key: 'offices',          label: 'Irodák',            path: 'Szervezet → Irodák',                max: 3  },
      { key: 'teams',            label: 'Csapatok',          path: 'Szervezet → Csapatok',              max: 4  },
      { key: 'skills',           label: 'Készségek',         path: 'Szervezet → Készségek',             max: 12 },
      { key: 'role_definitions', label: 'Szerepkör definíciók', path: 'Szervezet → Jogosultság-menedzsment', max: 3 },
    ],
  },
  {
    id: 'leave',
    label: 'Szabadság',
    badge: 'Leave',
    children: [
      { key: 'leave_types',           label: 'Szabadság típusok', path: 'Szabadság → Szabadság típusok',    max: 4  },
      { key: 'holidays',              label: 'Ünnepnapok',         path: 'Szabadság → Ünnepnapok',           max: 8  },
      { key: 'daily_rules',           label: 'Napi szabályok',     path: 'Szabadság → Napi szabályok',       max: 7  },
      { key: 'office_coverage_rules', label: 'Jelenlét szabályok', path: 'Szabadság → Jelenlét szabályok',   max: 10 },
      {
        id: 'workflow',
        label: 'Munkafolyamatok',
        children: [
          { key: 'approval_chains',  label: 'Jóváhagyási lánc lépések', path: 'Szabadság → Jóváhagyás → Lánc', max: 2 },
          { key: 'rule_templates',   label: 'Szabály sablonok',          path: 'Szabadság → Szabály sablonok',  max: 5 },
        ],
      },
    ],
  },
  {
    id: 'resources',
    label: 'Erőforrások',
    badge: 'Resources',
    children: [
      { key: 'projects',   label: 'Projektek',           path: 'Erőforrások → Projektek',              max: 5 },
      { key: 'scenarios',  label: 'Kapacitástervek',     path: 'Erőforrások → Kapacitástervező',       max: 2 },
      { key: 'agile_issues', label: 'Agile issue-ok',   path: 'Erőforrások → Agile panel',            max: 4 },
    ],
  },
  {
    id: 'reporting',
    label: 'Riportok',
    badge: 'Reporting',
    children: [
      { key: 'reports', label: 'Riport definíciók', path: 'Riportok → Riport lista', max: 4 },
    ],
  },
  {
    id: 'onboarding',
    label: 'Folyamatok',
    badge: 'Processes',
    children: [
      { key: 'access_systems',       label: 'Hozzáférési rendszerek', path: 'Folyamatok → Hozzáférés-menedzsment → Rendszerek', max: 4 },
      { key: 'onboarding_templates', label: 'Onboarding sablonok',    path: 'Folyamatok → Onboarding sablonok',                 max: 3 },
    ],
  },
  {
    id: 'settings',
    label: 'Beállítások',
    badge: 'Settings',
    children: [
      { key: 'translation_overrides', label: 'Lokalizáció felülírások', path: 'Beállítások → Lokalizáció', max: 4 },
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
      toast.error('Mentés sikertelen: ' + error.message);
      return;
    }
    toast.success('Demo konfiguráció mentve. A következő demo workspace ezeket a mennyiségeket fogja használni.');
    onOpenChange(false);
  };

  const handleReset = () => {
    setQtyState({ ...DEFAULTS });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b shrink-0">
          <DialogTitle className="text-base">Demo workspace alapértelmezett mennyiségek</DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Minden kategória megmutatja hol hozhatók létre az entitások az appban, és mennyit hozzon létre a seed.
            A mentett értékek a következő demo workspace létrehozáskor érvényesülnek.
          </p>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto py-2 px-1">
            <div className="flex items-center justify-between px-3 py-1.5 mb-1">
              <Label className="text-xs text-muted-foreground font-normal">Entitás neve (és helye az appban)</Label>
              <Label className="text-xs text-muted-foreground font-normal mr-10">Darab</Label>
            </div>
            {TREE.map(group => (
              <TreeNode key={group.id} node={group} qty={qty} setQty={setQty} depth={0} />
            ))}
          </div>
        )}

        <DialogFooter className="px-6 py-4 border-t shrink-0 gap-2">
          <Button variant="ghost" size="sm" onClick={handleReset} className="mr-auto gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" /> Alapértelmezések visszaállítása
          </Button>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Mégse</Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Mentés
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
