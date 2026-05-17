import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Building2, Plus, Trash2, MapPin, Edit2, Mail, Phone,
  User, Wrench, Users, ChevronDown, ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/i18n/I18nProvider';

// ── types ──────────────────────────────────────────────────────────────────

type DayHours = { open: string; close: string; closed: boolean };
type OpeningHours = Record<string, DayHours>; // keys "1"–"7" (1=Mon … 7=Sun)

interface Office {
  id: string;
  workspace_id: string;
  name: string;
  address: string | null;
  city: string | null;
  email: string | null;
  phone: string | null;
  manager_name: string | null;
  deputy_name: string | null;
  opening_hours: OpeningHours | null;
}

interface Equipment {
  id: string;
  name: string;
  description: string | null;
  quantity: number;
  required_skill_id: string | null;
}

interface MinStaffing {
  id: string;
  business_role: string | null;
  skill_id: string | null;
  min_headcount: number;
  notes: string | null;
}

interface Skill { id: string; name: string; }

interface Props { workspaceId: string; highlightOfficeId?: string | null; }

// ── helpers ────────────────────────────────────────────────────────────────

const ISO_DAYS = ['1', '2', '3', '4', '5', '6', '7'] as const;

const DEFAULT_HOURS: OpeningHours = {
  '1': { open: '08:00', close: '17:00', closed: false },
  '2': { open: '08:00', close: '17:00', closed: false },
  '3': { open: '08:00', close: '17:00', closed: false },
  '4': { open: '08:00', close: '17:00', closed: false },
  '5': { open: '08:00', close: '17:00', closed: false },
  '6': { open: '09:00', close: '13:00', closed: true },
  '7': { open: '09:00', close: '13:00', closed: true },
};

function mergeHours(stored: OpeningHours | null): OpeningHours {
  const base = { ...DEFAULT_HOURS };
  if (!stored) return base;
  ISO_DAYS.forEach(d => { if (stored[d]) base[d] = { ...base[d], ...stored[d] }; });
  return base;
}

// ── sub-components ─────────────────────────────────────────────────────────

function SectionToggle({ label, open, onToggle }: { label: string; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
    >
      {label}
      {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
    </button>
  );
}

// ── main component ─────────────────────────────────────────────────────────

export function OfficeManager({ workspaceId, highlightOfficeId }: Props) {
  const { t } = useI18n();

  const [offices, setOffices] = useState<Office[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [flashingId, setFlashingId] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!highlightOfficeId) return;
    setFlashingId(highlightOfficeId);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashingId(null), 2500);
    const el = document.getElementById(`office-row-${highlightOfficeId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return () => { if (flashTimer.current) clearTimeout(flashTimer.current); };
  }, [highlightOfficeId]);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form: basic
  const [form, setForm] = useState({
    name: '', city: '', address: '',
    email: '', phone: '', manager_name: '', deputy_name: '',
  });
  const [hours, setHours] = useState<OpeningHours>(DEFAULT_HOURS);

  // Relation data
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [minStaffing, setMinStaffing] = useState<MinStaffing[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);

  // New-item forms for inline lists
  const [newEquip, setNewEquip] = useState({ name: '', description: '', quantity: 1, required_skill_id: '' });
  const [newStaff, setNewStaff] = useState({ business_role: '', skill_id: '', min_headcount: 1, notes: '' });

  // Currently editing office id (null when adding new)
  const [editingId, setEditingId] = useState<string | null>(null);

  // Section visibility toggles inside dialog
  const [sectHours, setSectHours] = useState(false);
  const [sectEquip, setSectEquip] = useState(false);
  const [sectStaff, setSectStaff] = useState(false);

  // ── data fetching ────────────────────────────────────────────────────────

  const fetchOffices = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('enterprise_offices')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('name');
    setOffices(((data as unknown) as Office[]) || []);

    const { data: members } = await supabase
      .from('enterprise_memberships')
      .select('office_id')
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')
      .not('office_id', 'is', null);

    const counts: Record<string, number> = {};
    (members || []).forEach((m: any) => {
      counts[m.office_id] = (counts[m.office_id] || 0) + 1;
    });
    setMemberCounts(counts);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => { fetchOffices(); }, [fetchOffices]);

  const loadMetadata = useCallback(async () => {
    const [{ data: skillData }, { data: memData }, { data: allocData }] = await Promise.all([
      (supabase as any).from('enterprise_skills').select('id,name').eq('workspace_id', workspaceId).order('name'),
      (supabase as any).from('enterprise_memberships').select('business_role').eq('workspace_id', workspaceId).not('business_role', 'is', null),
      (supabase as any).from('enterprise_member_role_allocations').select('business_role').eq('workspace_id', workspaceId).not('business_role', 'is', null),
    ]);
    setSkills((skillData as Skill[]) || []);
    const roleSet = new Set<string>();
    ((memData as any[]) || []).forEach((x: any) => x.business_role && roleSet.add(x.business_role));
    ((allocData as any[]) || []).forEach((x: any) => x.business_role && roleSet.add(x.business_role));
    setAvailableRoles([...roleSet].sort());
  }, [workspaceId]);

  const loadEquipment = async (officeId: string) => {
    const { data } = await (supabase as any)
      .from('enterprise_office_equipment')
      .select('*')
      .eq('office_id', officeId)
      .order('name');
    setEquipment((data as Equipment[]) || []);
  };

  const loadMinStaffing = async (officeId: string) => {
    const { data } = await (supabase as any)
      .from('enterprise_office_min_staffing')
      .select('*')
      .eq('office_id', officeId)
      .order('created_at');
    setMinStaffing((data as MinStaffing[]) || []);
  };

  // ── open dialog ──────────────────────────────────────────────────────────

  const openNew = () => {
    setIsNew(true);
    setEditingId(null);
    setForm({ name: '', city: '', address: '', email: '', phone: '', manager_name: '', deputy_name: '' });
    setHours({ ...DEFAULT_HOURS });
    setEquipment([]);
    setMinStaffing([]);
    setNewEquip({ name: '', description: '', quantity: 1, required_skill_id: '' });
    setNewStaff({ business_role: '', skill_id: '', min_headcount: 1, notes: '' });
    setSectHours(false); setSectEquip(false); setSectStaff(false);
    loadMetadata();
    setDialogOpen(true);
  };

  const openEdit = (office: Office) => {
    setIsNew(false);
    setEditingId(office.id);
    setForm({
      name: office.name,
      city: office.city || '',
      address: office.address || '',
      email: office.email || '',
      phone: office.phone || '',
      manager_name: office.manager_name || '',
      deputy_name: office.deputy_name || '',
    });
    setHours(mergeHours(office.opening_hours));
    setNewEquip({ name: '', description: '', quantity: 1, required_skill_id: '' });
    setNewStaff({ business_role: '', skill_id: '', min_headcount: 1, notes: '' });
    setSectHours(false); setSectEquip(false); setSectStaff(false);
    loadMetadata();
    loadEquipment(office.id);
    loadMinStaffing(office.id);
    setDialogOpen(true);
  };

  // ── save basic office ────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);

    const payload = {
      workspace_id: workspaceId,
      name: form.name.trim(),
      city: form.city.trim() || null,
      address: form.address.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      manager_name: form.manager_name.trim() || null,
      deputy_name: form.deputy_name.trim() || null,
      opening_hours: hours,
    };

    if (isNew) {
      const { error } = await supabase.from('enterprise_offices').insert(payload as any);
      if (error) { toast.error(t('office_mgr.add_failed')); setSaving(false); return; }
      toast.success(t('office_mgr.added'));
    } else {
      const { error } = await supabase.from('enterprise_offices').update(payload as any).eq('id', editingId!);
      if (error) { toast.error(t('office_mgr.save_failed')); setSaving(false); return; }
      toast.success(t('office_mgr.updated'));
    }

    setSaving(false);
    setDialogOpen(false);
    fetchOffices();
  };

  // ── delete office ────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('enterprise_offices').delete().eq('id', id);
    if (error) toast.error(t('office_mgr.delete_failed'));
    else { toast.success(t('office_mgr.deleted')); fetchOffices(); }
  };

  // ── equipment CRUD ───────────────────────────────────────────────────────

  const addEquipment = async () => {
    if (!newEquip.name.trim() || !editingId) return;
    const { data, error } = await (supabase as any).from('enterprise_office_equipment').insert({
      workspace_id: workspaceId,
      office_id: editingId,
      name: newEquip.name.trim(),
      description: newEquip.description.trim() || null,
      quantity: newEquip.quantity,
      required_skill_id: newEquip.required_skill_id || null,
    }).select().single();
    if (error) { toast.error(t('office_mgr.equip_add_failed')); return; }
    setEquipment(prev => [...prev, data as Equipment]);
    setNewEquip({ name: '', description: '', quantity: 1, required_skill_id: '' });
  };

  const deleteEquipment = async (id: string) => {
    await (supabase as any).from('enterprise_office_equipment').delete().eq('id', id);
    setEquipment(prev => prev.filter(e => e.id !== id));
  };

  // ── min staffing CRUD ────────────────────────────────────────────────────

  const addMinStaff = async () => {
    if (!editingId) return;
    if (!newStaff.business_role && !newStaff.skill_id) return;
    const { data, error } = await (supabase as any).from('enterprise_office_min_staffing').insert({
      workspace_id: workspaceId,
      office_id: editingId,
      business_role: newStaff.business_role || null,
      skill_id: newStaff.skill_id || null,
      min_headcount: newStaff.min_headcount,
      notes: newStaff.notes.trim() || null,
    }).select().single();
    if (error) { toast.error(t('office_mgr.staff_add_failed')); return; }
    setMinStaffing(prev => [...prev, data as MinStaffing]);
    setNewStaff({ business_role: '', skill_id: '', min_headcount: 1, notes: '' });
  };

  const deleteMinStaff = async (id: string) => {
    await (supabase as any).from('enterprise_office_min_staffing').delete().eq('id', id);
    setMinStaffing(prev => prev.filter(s => s.id !== id));
  };

  // ── opening hours helper ─────────────────────────────────────────────────

  const setDayHours = (day: string, patch: Partial<DayHours>) =>
    setHours(prev => ({ ...prev, [day]: { ...prev[day], ...patch } }));

  // ── day labels ───────────────────────────────────────────────────────────

  const dayLabels: Record<string, string> = {
    '1': t('office_mgr.day_mon'), '2': t('office_mgr.day_tue'), '3': t('office_mgr.day_wed'),
    '4': t('office_mgr.day_thu'), '5': t('office_mgr.day_fri'),
    '6': t('office_mgr.day_sat'), '7': t('office_mgr.day_sun'),
  };

  // ── render ───────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="flex justify-center py-4"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Building2 className="h-4 w-4" /> {t('office_mgr.title')}
            </span>
            <Button size="sm" variant="outline" onClick={openNew}>
              <Plus className="h-3.5 w-3.5 mr-1" /> {t('office_mgr.btn_new')}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {offices.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">{t('office_mgr.empty')}</p>
          )}

          {offices.map(office => (
            <div
              key={office.id}
              id={`office-row-${office.id}`}
              className={`flex items-start justify-between border rounded-md px-3 py-2.5 gap-3 transition-all duration-300 ${flashingId === office.id ? 'ring-2 ring-primary/60 ring-offset-1 bg-primary/5' : ''}`}
            >
              <div className="flex items-start gap-3 min-w-0">
                <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{office.name}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                    {office.city && (
                      <span className="flex items-center gap-0.5">
                        <MapPin className="h-3 w-3" />{office.city}
                      </span>
                    )}
                    {office.address && <span>{office.address}</span>}
                    {office.phone && (
                      <span className="flex items-center gap-0.5">
                        <Phone className="h-3 w-3" />{office.phone}
                      </span>
                    )}
                    {office.email && (
                      <span className="flex items-center gap-0.5">
                        <Mail className="h-3 w-3" />{office.email}
                      </span>
                    )}
                    {office.manager_name && (
                      <span className="flex items-center gap-0.5">
                        <User className="h-3 w-3" />{office.manager_name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Badge variant="secondary" className="text-[10px]">
                  {t('office_mgr.member_count', { count: memberCounts[office.id] || 0 })}
                </Badge>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(office)}>
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(office.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ── Edit / New Dialog ───────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {isNew ? t('office_mgr.dialog_new_title') : t('office_mgr.dialog_edit_title')}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[70vh] pr-3">
            <div className="space-y-4 py-1">

              {/* ── Basic info ─────────────────────────────────────────── */}
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-3 sm:col-span-1">
                    <Label className="text-xs">{t('office_mgr.label_name')}</Label>
                    <Input
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder={t('office_mgr.name_placeholder')}
                      className="h-8 text-sm mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">{t('office_mgr.label_city')}</Label>
                    <Input
                      value={form.city}
                      onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                      placeholder={t('office_mgr.city_placeholder')}
                      className="h-8 text-sm mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">{t('office_mgr.label_address')}</Label>
                    <Input
                      value={form.address}
                      onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                      placeholder={t('office_mgr.address_placeholder')}
                      className="h-8 text-sm mt-1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs flex items-center gap-1">
                      <Mail className="h-3 w-3" />{t('office_mgr.label_email')}
                    </Label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      placeholder={t('office_mgr.email_placeholder')}
                      className="h-8 text-sm mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs flex items-center gap-1">
                      <Phone className="h-3 w-3" />{t('office_mgr.label_phone')}
                    </Label>
                    <Input
                      value={form.phone}
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      placeholder={t('office_mgr.phone_placeholder')}
                      className="h-8 text-sm mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs flex items-center gap-1">
                      <User className="h-3 w-3" />{t('office_mgr.label_manager')}
                    </Label>
                    <Input
                      value={form.manager_name}
                      onChange={e => setForm(f => ({ ...f, manager_name: e.target.value }))}
                      placeholder={t('office_mgr.manager_placeholder')}
                      className="h-8 text-sm mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs flex items-center gap-1">
                      <User className="h-3 w-3" />{t('office_mgr.label_deputy')}
                    </Label>
                    <Input
                      value={form.deputy_name}
                      onChange={e => setForm(f => ({ ...f, deputy_name: e.target.value }))}
                      placeholder={t('office_mgr.deputy_placeholder')}
                      className="h-8 text-sm mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* ── Opening hours ──────────────────────────────────────── */}
              <div>
                <SectionToggle
                  label={t('office_mgr.section_hours')}
                  open={sectHours}
                  onToggle={() => setSectHours(v => !v)}
                />
                {sectHours && (
                  <div className="mt-2 border rounded-md p-3 space-y-2">
                    {ISO_DAYS.map(day => {
                      const h = hours[day];
                      return (
                        <div key={day} className="grid grid-cols-[80px_1fr_1fr_auto] items-center gap-2">
                          <span className="text-sm font-medium">{dayLabels[day]}</span>
                          <Input
                            type="time"
                            value={h.open}
                            disabled={h.closed}
                            onChange={e => setDayHours(day, { open: e.target.value })}
                            className="h-8 text-sm"
                          />
                          <Input
                            type="time"
                            value={h.close}
                            disabled={h.closed}
                            onChange={e => setDayHours(day, { close: e.target.value })}
                            className="h-8 text-sm"
                          />
                          <div className="flex items-center gap-1.5">
                            <Switch
                              checked={h.closed}
                              onCheckedChange={val => setDayHours(day, { closed: val })}
                              className="scale-75"
                            />
                            <span className="text-xs text-muted-foreground whitespace-nowrap">{t('office_mgr.hours_closed')}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── Equipment (only for existing offices) ─────────────── */}
              {!isNew && (
                <div>
                  <SectionToggle
                    label={t('office_mgr.section_equipment')}
                    open={sectEquip}
                    onToggle={() => setSectEquip(v => !v)}
                  />
                  {sectEquip && (
                    <div className="mt-2 border rounded-md p-3 space-y-3">
                      {/* existing items */}
                      {equipment.map(e => {
                        const skillName = skills.find(s => s.id === e.required_skill_id)?.name;
                        return (
                          <div key={e.id} className="flex items-start justify-between gap-2 border-b pb-2 last:border-0 last:pb-0">
                            <div className="flex items-start gap-2">
                              <Wrench className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                              <div>
                                <p className="text-sm font-medium">{e.name} {e.quantity > 1 && <span className="text-muted-foreground text-xs">×{e.quantity}</span>}</p>
                                {e.description && <p className="text-xs text-muted-foreground">{e.description}</p>}
                                {skillName && (
                                  <p className="text-xs text-amber-600 mt-0.5">
                                    {t('office_mgr.equip_requires_skill', { skill: skillName })}
                                  </p>
                                )}
                              </div>
                            </div>
                            <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => deleteEquipment(e.id)}>
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        );
                      })}

                      {/* add new equipment */}
                      <div className="pt-1 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">{t('office_mgr.equip_add_label')}</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">{t('office_mgr.equip_name')}</Label>
                            <Input
                              value={newEquip.name}
                              onChange={e => setNewEquip(p => ({ ...p, name: e.target.value }))}
                              placeholder={t('office_mgr.equip_name_placeholder')}
                              className="h-8 text-sm mt-0.5"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">{t('office_mgr.equip_description')}</Label>
                            <Input
                              value={newEquip.description}
                              onChange={e => setNewEquip(p => ({ ...p, description: e.target.value }))}
                              placeholder={t('office_mgr.equip_description_placeholder')}
                              className="h-8 text-sm mt-0.5"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">{t('office_mgr.equip_quantity')}</Label>
                            <Input
                              type="number"
                              min={1}
                              value={newEquip.quantity}
                              onChange={e => setNewEquip(p => ({ ...p, quantity: Math.max(1, parseInt(e.target.value) || 1) }))}
                              className="h-8 text-sm mt-0.5"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">{t('office_mgr.equip_required_skill')}</Label>
                            <Select
                              value={newEquip.required_skill_id || '__none__'}
                              onValueChange={v => setNewEquip(p => ({ ...p, required_skill_id: v === '__none__' ? '' : v }))}
                            >
                              <SelectTrigger className="h-8 text-sm mt-0.5">
                                <SelectValue placeholder={t('office_mgr.equip_skill_none')} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">{t('office_mgr.equip_skill_none')}</SelectItem>
                                {skills.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <Button size="sm" variant="outline" onClick={addEquipment} disabled={!newEquip.name.trim()}>
                          <Plus className="h-3.5 w-3.5 mr-1" />{t('office_mgr.equip_btn_add')}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Min staffing (only for existing offices) ───────────── */}
              {!isNew && (
                <div>
                  <SectionToggle
                    label={t('office_mgr.section_min_staffing')}
                    open={sectStaff}
                    onToggle={() => setSectStaff(v => !v)}
                  />
                  {sectStaff && (
                    <div className="mt-2 border rounded-md p-3 space-y-3">
                      {/* existing items */}
                      {minStaffing.map(s => {
                        const skillName = skills.find(sk => sk.id === s.skill_id)?.name;
                        return (
                          <div key={s.id} className="flex items-center justify-between gap-2 border-b pb-2 last:border-0 last:pb-0">
                            <div className="flex items-center gap-2">
                              <Users className="h-3.5 w-3.5 text-muted-foreground" />
                              <div>
                                <p className="text-sm">
                                  <span className="font-medium">{s.min_headcount} {t('office_mgr.staff_persons')}</span>
                                  {' — '}
                                  {s.business_role && <span>{s.business_role}</span>}
                                  {s.business_role && skillName && <span className="text-muted-foreground mx-1">+</span>}
                                  {skillName && <span className="text-blue-600">{skillName}</span>}
                                </p>
                                {s.notes && <p className="text-xs text-muted-foreground">{s.notes}</p>}
                              </div>
                            </div>
                            <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => deleteMinStaff(s.id)}>
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        );
                      })}

                      {/* add new staffing requirement */}
                      <div className="pt-1 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">{t('office_mgr.staff_add_label')}</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">{t('office_mgr.staff_role')}</Label>
                            <Select
                              value={newStaff.business_role || '__none__'}
                              onValueChange={v => setNewStaff(p => ({ ...p, business_role: v === '__none__' ? '' : v }))}
                            >
                              <SelectTrigger className="h-8 text-sm mt-0.5">
                                <SelectValue placeholder={t('office_mgr.staff_role_none')} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">{t('office_mgr.staff_role_none')}</SelectItem>
                                {availableRoles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">{t('office_mgr.staff_skill')}</Label>
                            <Select
                              value={newStaff.skill_id || '__none__'}
                              onValueChange={v => setNewStaff(p => ({ ...p, skill_id: v === '__none__' ? '' : v }))}
                            >
                              <SelectTrigger className="h-8 text-sm mt-0.5">
                                <SelectValue placeholder={t('office_mgr.staff_skill_none')} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">{t('office_mgr.staff_skill_none')}</SelectItem>
                                {skills.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">{t('office_mgr.staff_headcount')}</Label>
                            <Input
                              type="number"
                              min={1}
                              value={newStaff.min_headcount}
                              onChange={e => setNewStaff(p => ({ ...p, min_headcount: Math.max(1, parseInt(e.target.value) || 1) }))}
                              className="h-8 text-sm mt-0.5"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">{t('office_mgr.staff_notes')}</Label>
                            <Input
                              value={newStaff.notes}
                              onChange={e => setNewStaff(p => ({ ...p, notes: e.target.value }))}
                              placeholder={t('office_mgr.staff_notes_placeholder')}
                              className="h-8 text-sm mt-0.5"
                            />
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={addMinStaff}
                          disabled={!newStaff.business_role && !newStaff.skill_id}
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" />{t('office_mgr.staff_btn_add')}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {isNew && (
                <p className="text-xs text-muted-foreground italic">
                  {t('office_mgr.new_hint_equip_staff')}
                </p>
              )}

            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>{t('office_mgr.btn_cancel')}</Button>
            <Button onClick={handleSave} disabled={!form.name.trim() || saving}>
              {saving ? t('office_mgr.saving') : isNew ? t('office_mgr.btn_add') : t('office_mgr.btn_save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
