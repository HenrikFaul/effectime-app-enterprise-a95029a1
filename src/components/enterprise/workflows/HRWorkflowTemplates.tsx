import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, Trash2, ChevronDown, Stethoscope, Wallet, FileSignature, ClipboardCheck, CalendarClock, UserMinus, Settings2, Layers } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  workspaceId: string;
}

interface StepDef {
  id: string;
  title: string;
  description?: string;
  due_offset_days: number;
  is_required: boolean;
}

interface Template {
  id: string;
  name: string;
  category: string;
  description: string | null;
  steps: StepDef[];
  is_active: boolean;
  recurrence_months: number | null;
  created_at: string;
}

const CATEGORY_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  medical_exam:        { label: 'Orvosi vizsgálat',       icon: Stethoscope,     color: 'bg-red-100 text-red-700 border-red-200' },
  salary_advance:      { label: 'Előleg-igény',           icon: Wallet,          color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  contract_amendment:  { label: 'Szerződésmódosítás',     icon: FileSignature,   color: 'bg-blue-100 text-blue-700 border-blue-200' },
  probation_review:    { label: 'Próbaidő-értékelés',     icon: ClipboardCheck,  color: 'bg-amber-100 text-amber-700 border-amber-200' },
  fixed_term_expiry:   { label: 'Határozott szerz. lejár', icon: CalendarClock,  color: 'bg-orange-100 text-orange-700 border-orange-200' },
  offboarding:         { label: 'Kiléptetés',             icon: UserMinus,       color: 'bg-slate-100 text-slate-700 border-slate-200' },
  custom:              { label: 'Egyedi',                 icon: Settings2,       color: 'bg-violet-100 text-violet-700 border-violet-200' },
};

const BUILTIN_TEMPLATES: Omit<Template, 'id' | 'created_at' | 'is_active'>[] = [
  {
    name: 'Éves munkavédelmi orvosi vizsgálat',
    category: 'medical_exam',
    description: 'Kötelező éves foglalkozás-egészségügyi vizsgálat szervezése és dokumentálása.',
    recurrence_months: 12,
    steps: [
      { id: '1', title: 'Időpont-foglalás orvosi vizsgálathoz', description: 'Egyeztetés a munkaegészségügyi szolgálattal', due_offset_days: -14, is_required: true },
      { id: '2', title: 'Munkaköri leírás megküldése', description: 'Aktuális munkaköri leírás eljuttatása az orvoshoz', due_offset_days: -10, is_required: true },
      { id: '3', title: 'Vizsgálat megtartása', due_offset_days: 0, is_required: true },
      { id: '4', title: 'Alkalmasságot igazoló dokumentum archiválása', due_offset_days: 3, is_required: true },
    ],
  },
  {
    name: 'Bér-előleg igény feldolgozása',
    category: 'salary_advance',
    description: 'Rendkívüli bér-előleg kérelem értékelése és kifizetése.',
    recurrence_months: null,
    steps: [
      { id: '1', title: 'Kérelem befogadása és ellenőrzése', due_offset_days: 0, is_required: true },
      { id: '2', title: 'Pénzügyi elfogadhatóság ellenőrzése', description: 'Bérszámfejtéssel egyeztetés', due_offset_days: 1, is_required: true },
      { id: '3', title: 'Vezető jóváhagyás', due_offset_days: 2, is_required: true },
      { id: '4', title: 'Kifizetés elindítása', due_offset_days: 3, is_required: true },
      { id: '5', title: 'Visszaigazolás küldése a munkavállalónak', due_offset_days: 4, is_required: false },
    ],
  },
  {
    name: 'Munkaszerződés-módosítás',
    category: 'contract_amendment',
    description: 'Munkabér-, munkakör- vagy munkaidő-módosítás dokumentálási folyamata.',
    recurrence_months: null,
    steps: [
      { id: '1', title: 'Módosítás indoklásának rögzítése', due_offset_days: -7, is_required: true },
      { id: '2', title: 'Szerződésmódosítás tervezetének elkészítése', due_offset_days: -5, is_required: true },
      { id: '3', title: 'Jogi/HR-vezető jóváhagyás', due_offset_days: -3, is_required: true },
      { id: '4', title: 'Aláírás mindkét féltől', due_offset_days: 0, is_required: true },
      { id: '5', title: 'Szkennelt példány feltöltése', due_offset_days: 1, is_required: true },
      { id: '6', title: 'Bérszámfejtés értesítése', due_offset_days: 1, is_required: true },
    ],
  },
  {
    name: 'Próbaidő-értékelés',
    category: 'probation_review',
    description: 'Próbaidő lejáratakor végzett strukturált teljesítményértékelés.',
    recurrence_months: null,
    steps: [
      { id: '1', title: 'Értékelési kérdőív kitöltése (közvetlen vezető)', due_offset_days: -7, is_required: true },
      { id: '2', title: 'Visszajelzési megbeszélés a munkavállalóval', due_offset_days: -3, is_required: true },
      { id: '3', title: 'Döntés rögzítése (véglegesítés / meghosszabbítás / megszüntetés)', due_offset_days: 0, is_required: true },
      { id: '4', title: 'HR értesítése a döntésről', due_offset_days: 0, is_required: true },
      { id: '5', title: 'Dokumentáció archiválása', due_offset_days: 2, is_required: true },
    ],
  },
  {
    name: 'Határozott idejű szerződés lejárata',
    category: 'fixed_term_expiry',
    description: 'Határozott idejű munkaszerződés meghosszabbításának vagy megszüntetésének kezelése.',
    recurrence_months: null,
    steps: [
      { id: '1', title: 'Vezető értesítése a közelgő lejáratról', due_offset_days: -30, is_required: true },
      { id: '2', title: 'Döntés a meghosszabbításról', due_offset_days: -21, is_required: true },
      { id: '3', title: 'Szerződés-módosítás VAGY kilépési folyamat elindítása', due_offset_days: -14, is_required: true },
      { id: '4', title: 'Munkavállaló írásban értesítve', due_offset_days: -10, is_required: true },
    ],
  },
  {
    name: 'Kiléptetés (offboarding)',
    category: 'offboarding',
    description: 'Munkaviszonyt megszüntető folyamat teljes körű végrehajtása.',
    recurrence_months: null,
    steps: [
      { id: '1', title: 'Felmondólevél / megállapodás befogadása', due_offset_days: 0, is_required: true },
      { id: '2', title: 'IT: hozzáférések megvonásának ütemezése', due_offset_days: 1, is_required: true },
      { id: '3', title: 'Eszközök visszavételének megszervezése', due_offset_days: 2, is_required: false },
      { id: '4', title: 'Utolsó bér és elszámolás előkészítése', due_offset_days: -3, is_required: true },
      { id: '5', title: 'Kilépési interjú lefolytatása', due_offset_days: -1, is_required: false },
      { id: '6', title: 'Munkáltatói igazolások kiállítása', due_offset_days: 0, is_required: true },
      { id: '7', title: 'Rendszerekből való törlés végrehajtása', due_offset_days: 1, is_required: true },
    ],
  },
];

function CategoryBadge({ category }: { category: string }) {
  const meta = CATEGORY_META[category] ?? CATEGORY_META.custom;
  const Icon = meta.icon;
  return (
    <Badge variant="outline" className={`gap-1 text-xs ${meta.color}`}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </Badge>
  );
}

export function HRWorkflowTemplates({ workspaceId }: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editTemplate, setEditTemplate] = useState<Template | null>(null);
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  // Form state
  const [fName, setFName] = useState('');
  const [fCategory, setFCategory] = useState('custom');
  const [fDescription, setFDescription] = useState('');
  const [fRecurrence, setFRecurrence] = useState('');
  const [fSteps, setFSteps] = useState<StepDef[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('enterprise_hr_workflow_templates')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('category')
      .order('name');
    setTemplates((data as Template[]) || []);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setEditTemplate(null);
    setFName(''); setFCategory('custom'); setFDescription(''); setFRecurrence('');
    setFSteps([]);
    setShowDialog(true);
  };

  const openEdit = (t: Template) => {
    setEditTemplate(t);
    setFName(t.name); setFCategory(t.category); setFDescription(t.description || '');
    setFRecurrence(t.recurrence_months ? String(t.recurrence_months) : '');
    setFSteps(t.steps || []);
    setShowDialog(true);
  };

  const addStep = () => {
    setFSteps(s => [...s, { id: crypto.randomUUID(), title: '', due_offset_days: 0, is_required: true }]);
  };
  const removeStep = (id: string) => setFSteps(s => s.filter(x => x.id !== id));
  const updateStep = (id: string, field: keyof StepDef, val: string | number | boolean) =>
    setFSteps(s => s.map(x => x.id === id ? { ...x, [field]: val } : x));

  const save = async () => {
    if (!fName.trim()) { toast.error('Adj meg nevet'); return; }
    setBusy(true);
    const payload = {
      workspace_id: workspaceId,
      name: fName.trim(),
      category: fCategory,
      description: fDescription.trim() || null,
      steps: fSteps,
      recurrence_months: fRecurrence ? parseInt(fRecurrence) : null,
    };
    let err: any;
    if (editTemplate) {
      ({ error: err } = await (supabase as any)
        .from('enterprise_hr_workflow_templates')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', editTemplate.id));
    } else {
      ({ error: err } = await (supabase as any)
        .from('enterprise_hr_workflow_templates')
        .insert(payload));
    }
    setBusy(false);
    if (err) { toast.error(err.message); return; }
    toast.success(editTemplate ? 'Sablon frissítve' : 'Sablon létrehozva');
    setShowDialog(false);
    load();
  };

  const archive = async (id: string) => {
    await (supabase as any)
      .from('enterprise_hr_workflow_templates')
      .update({ is_active: false })
      .eq('id', id);
    toast.success('Sablon archiválva');
    load();
  };

  const loadBuiltins = async () => {
    setBusy(true);
    const rows = BUILTIN_TEMPLATES.map(t => ({ ...t, workspace_id: workspaceId }));
    const { error } = await (supabase as any)
      .from('enterprise_hr_workflow_templates')
      .insert(rows);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${rows.length} alapértelmezett sablon betöltve`);
    load();
  };

  if (loading) return <p className="text-sm text-muted-foreground py-4">Betöltés…</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {templates.length} aktív sablon
        </p>
        <div className="flex gap-2 flex-wrap">
          {templates.length === 0 && (
            <Button variant="outline" size="sm" onClick={loadBuiltins} disabled={busy}>
              <Layers className="h-3.5 w-3.5 mr-1.5" />
              6 alapértelmezett betöltése
            </Button>
          )}
          <Button size="sm" onClick={openNew}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Új sablon
          </Button>
        </div>
      </div>

      {templates.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Még nincsenek sablonok. Kattints a „6 alapértelmezett betöltése" gombra az előre definiált HR folyamatsablonokhoz.
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {templates.filter(t => t.is_active).map(t => (
          <Collapsible key={t.id} open={openId === t.id} onOpenChange={v => setOpenId(v ? t.id : null)}>
            <Card>
              <CardHeader className="py-3 px-4">
                <div className="flex flex-wrap items-center gap-2">
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center gap-2 flex-1 min-w-0 text-left hover:text-primary transition-colors">
                      <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${openId === t.id ? 'rotate-180' : ''}`} />
                      <CardTitle className="text-sm font-medium truncate flex-1">{t.name}</CardTitle>
                    </button>
                  </CollapsibleTrigger>
                  <CategoryBadge category={t.category} />
                  {t.recurrence_months && (
                    <Badge variant="secondary" className="text-xs">
                      {t.recurrence_months === 12 ? 'Éves' : t.recurrence_months === 6 ? 'Félévente' : `${t.recurrence_months} havonta`}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">{(t.steps || []).length} lépés</span>
                  <div className="flex gap-1 ml-auto shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}>
                      <Settings2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => archive(t.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {t.description && (
                  <p className="text-xs text-muted-foreground pl-6 mt-0.5">{t.description}</p>
                )}
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="pt-0 pb-3 px-4">
                  <ol className="space-y-1 pl-2">
                    {(t.steps || []).map((s, i) => (
                      <li key={s.id} className="flex items-start gap-2 text-xs">
                        <span className="font-mono text-muted-foreground w-5 shrink-0">{i + 1}.</span>
                        <span className="flex-1">{s.title}</span>
                        {s.due_offset_days !== 0 && (
                          <span className="text-muted-foreground shrink-0">
                            {s.due_offset_days > 0 ? `+${s.due_offset_days}` : s.due_offset_days} nap
                          </span>
                        )}
                        {s.is_required && <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">kötelező</Badge>}
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        ))}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTemplate ? 'Sablon szerkesztése' : 'Új HR folyamatsablon'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Sablon neve *</Label>
                <Input value={fName} onChange={e => setFName(e.target.value)} placeholder="pl. Éves orvosi vizsgálat" />
              </div>
              <div className="space-y-1.5">
                <Label>Kategória</Label>
                <Select value={fCategory} onValueChange={setFCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_META).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Ismétlődés (hónapokban, opcionális)</Label>
                <Input
                  type="number" min={1} value={fRecurrence}
                  onChange={e => setFRecurrence(e.target.value)}
                  placeholder="pl. 12 = évente"
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Leírás (opcionális)</Label>
                <Textarea value={fDescription} onChange={e => setFDescription(e.target.value)} rows={2} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Lépések</Label>
                <Button variant="outline" size="sm" onClick={addStep}>
                  <Plus className="h-3.5 w-3.5 mr-1" />Lépés hozzáadása
                </Button>
              </div>
              {fSteps.length === 0 && (
                <p className="text-xs text-muted-foreground">Még nincsenek lépések. Add hozzá az első lépést.</p>
              )}
              {fSteps.map((s, i) => (
                <div key={s.id} className="flex items-start gap-2 p-2 border rounded-md bg-muted/30">
                  <span className="text-xs text-muted-foreground mt-2 w-5 shrink-0">{i + 1}.</span>
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <Input
                      className="col-span-2 h-8 text-sm"
                      placeholder="Lépés neve *"
                      value={s.title}
                      onChange={e => updateStep(s.id, 'title', e.target.value)}
                    />
                    <Input
                      className="h-8 text-sm"
                      type="number"
                      placeholder="Eltolás (nap)"
                      value={s.due_offset_days}
                      onChange={e => updateStep(s.id, 'due_offset_days', parseInt(e.target.value) || 0)}
                    />
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={s.is_required}
                        onChange={e => updateStep(s.id, 'is_required', e.target.checked)}
                      />
                      Kötelező
                    </label>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 mt-0.5 shrink-0 text-destructive" onClick={() => removeStep(s.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Mégse</Button>
            <Button onClick={save} disabled={busy}>{editTemplate ? 'Mentés' : 'Létrehozás'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
