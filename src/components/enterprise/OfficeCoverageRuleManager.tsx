import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Pencil, Trash2, Building2, Archive, ArchiveRestore } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/i18n/I18nProvider';

interface Props { workspaceId: string; userId: string }

interface Rule {
  id: string;
  office_id: string;
  name: string | null;
  business_role: string | null;
  skill_id: string | null;
  min_skill_level: number | null;
  business_roles: string[] | null;
  skill_ids: string[] | null;
  min_headcount: number;
  days_of_week: number[] | null;
  rule_date: string | null;
  valid_from: string | null;
  valid_until: string | null;
  notes: string | null;
  status: 'active' | 'archived' | 'expired';
  archived_at: string | null;
}
interface Office { id: string; name: string; city: string | null }
interface Skill { id: string; name: string }

const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0];

function ruleRoles(r: Rule): string[] {
  if (r.business_roles && r.business_roles.length > 0) return r.business_roles;
  if (r.business_role) return [r.business_role];
  return [];
}
function ruleSkillIds(r: Rule): string[] {
  if (r.skill_ids && r.skill_ids.length > 0) return r.skill_ids;
  if (r.skill_id) return [r.skill_id];
  return [];
}

export function OfficeCoverageRuleManager({ workspaceId, userId }: Props) {
  const { t } = useI18n();
  const [rules, setRules] = useState<Rule[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [allPositions, setAllPositions] = useState<string[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'active' | 'archived'>('active');

  // Form state
  const [name, setName] = useState('');
  const [officeId, setOfficeId] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [roleHeadcounts, setRoleHeadcounts] = useState<Record<string, number>>({});
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [minSkillLevel, setMinSkillLevel] = useState('1');
  const [minHeadcount, setMinHeadcount] = useState('1');
  const [days, setDays] = useState<number[]>([]);
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: r }, { data: o }, { data: mem }, { data: alloc }, { data: sk }] = await Promise.all([
      (supabase as any).from('enterprise_office_coverage_rules').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }),
      (supabase as any).from('enterprise_offices').select('id,name,city').eq('workspace_id', workspaceId).order('name'),
      (supabase as any).from('enterprise_memberships').select('business_role').eq('workspace_id', workspaceId).not('business_role', 'is', null),
      (supabase as any).from('enterprise_member_role_allocations').select('business_role').eq('workspace_id', workspaceId).not('business_role', 'is', null),
      (supabase as any).from('enterprise_skills').select('id,name').eq('workspace_id', workspaceId).order('name'),
    ]);
    setRules((r as Rule[]) || []);
    setOffices((o as Office[]) || []);
    setSkills((sk as Skill[]) || []);

    const roleSet = new Set<string>();
    ((mem as any[]) || []).forEach(x => x.business_role && roleSet.add(x.business_role));
    ((alloc as any[]) || []).forEach(x => x.business_role && roleSet.add(x.business_role));
    setAllPositions(Array.from(roleSet).sort());

    setLoading(false);
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]);

  const reset = () => {
    setEditingId(null); setName(''); setOfficeId(''); setSelectedRoles([]); setSelectedSkillIds([]);
    setMinSkillLevel('1'); setMinHeadcount('1'); setDays([]);
    setValidFrom(''); setValidUntil(''); setNotes(''); setRoleHeadcounts({});
  };

  const openEdit = (r: Rule) => {
    setEditingId(r.id);
    setName(r.name || '');
    setOfficeId(r.office_id);
    const roles = ruleRoles(r);
    setSelectedRoles(Array.from(new Set(roles)));
    const counts: Record<string, number> = {};
    roles.forEach((role) => { counts[role] = (counts[role] || 0) + 1; });
    setRoleHeadcounts(counts);
    setSelectedSkillIds(ruleSkillIds(r));
    setMinSkillLevel(String(r.min_skill_level || 1));
    setMinHeadcount(String(r.min_headcount));
    setDays(r.days_of_week || []);
    setValidFrom(r.valid_from || '');
    setValidUntil(r.valid_until || '');
    setNotes(r.notes || '');
    setOpen(true);
  };

  const save = async () => {
    if (!officeId) { toast.error(t('coverage_rule_mgr.office_required')); return; }
    if (!minHeadcount || parseInt(minHeadcount) < 1) { toast.error(t('coverage_rule_mgr.headcount_required')); return; }
    if (selectedRoles.length === 0 && selectedSkillIds.length === 0) {
      toast.error(t('coverage_rule_mgr.role_or_skill_required'));
      return;
    }
    if (validFrom && validUntil && validUntil < validFrom) {
      toast.error(t('coverage_rule_mgr.date_range_invalid'));
      return;
    }

    const expandedRoles = selectedRoles.flatMap((role) => Array.from({ length: Math.max(1, roleHeadcounts[role] || 1) }, () => role));
    const payload: any = {
      workspace_id: workspaceId,
      office_id: officeId,
      name: name.trim() || null,
      // Legacy mirrors (backward compat for older readers)
      business_role: expandedRoles.length > 0 ? expandedRoles[0] : null,
      skill_id: selectedSkillIds.length > 0 ? selectedSkillIds[0] : null,
      min_skill_level: selectedSkillIds.length > 0 ? parseInt(minSkillLevel) : null,
      // Multi-value
      business_roles: expandedRoles.length > 0 ? expandedRoles : null,
      skill_ids: selectedSkillIds.length > 0 ? selectedSkillIds : null,
      min_headcount: expandedRoles.length > 0 ? expandedRoles.length : parseInt(minHeadcount),
      days_of_week: days.length > 0 ? days : null,
      valid_from: validFrom || null,
      valid_until: validUntil || null,
      notes: notes || null,
      created_by: userId,
      status: 'active',
      archived_at: null,
    };

    const { error } = editingId
      ? await (supabase as any).from('enterprise_office_coverage_rules').update(payload).eq('id', editingId)
      : await (supabase as any).from('enterprise_office_coverage_rules').insert(payload);

    if (error) { toast.error(t('coverage_rule_mgr.save_failed', { message: error.message })); return; }
    toast.success(t(editingId ? 'coverage_rule_mgr.updated' : 'coverage_rule_mgr.created'));
    setOpen(false); reset(); load();
  };

  const remove = async (id: string) => {
    if (!confirm(t('coverage_rule_mgr.delete_confirm'))) return;
    const { error } = await (supabase as any).from('enterprise_office_coverage_rules').delete().eq('id', id);
    if (error) { toast.error(t('coverage_rule_mgr.delete_failed')); return; }
    toast.success(t('coverage_rule_mgr.deleted')); load();
  };

  const archive = async (id: string) => {
    const { error } = await (supabase as any)
      .from('enterprise_office_coverage_rules')
      .update({ status: 'archived', archived_at: new Date().toISOString() })
      .eq('id', id);
    if (error) { toast.error(t('coverage_rule_mgr.archive_failed')); return; }
    toast.success(t('coverage_rule_mgr.archived')); load();
  };

  const restore = async (id: string) => {
    const { error } = await (supabase as any)
      .from('enterprise_office_coverage_rules')
      .update({ status: 'active', archived_at: null })
      .eq('id', id);
    if (error) { toast.error(t('coverage_rule_mgr.restore_failed')); return; }
    toast.success(t('coverage_rule_mgr.restored')); load();
  };

  const toggleDay = (d: number) => setDays(p => p.includes(d) ? p.filter(x => x !== d) : [...p, d].sort());
  const toggleRole = (r: string) => setSelectedRoles(p => p.includes(r) ? p.filter(x => x !== r) : [...p, r]);
  const updateRoleHeadcount = (role: string, value: string) => {
    const parsed = Number.parseInt(value, 10);
    setRoleHeadcounts((prev) => ({ ...prev, [role]: Number.isNaN(parsed) ? 1 : Math.max(1, parsed) }));
  };
  const toggleSkill = (id: string) => setSelectedSkillIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const officeName = (id: string) => offices.find(o => o.id === id)?.name || '—';
  const skillName = (id: string) => skills.find(s => s.id === id)?.name || '—';

  if (loading) return <div className="flex justify-center py-4"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  const visibleRules = rules.filter(r => filter === 'active' ? r.status === 'active' : r.status !== 'active');
  const today = new Date().toISOString().slice(0, 10);
  const effectiveMinHeadcount = selectedRoles.length > 0
    ? selectedRoles.reduce((sum, role) => sum + Math.max(1, roleHeadcounts[role] || 1), 0)
    : parseInt(minHeadcount || '1', 10);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" /> {t('coverage_rule_mgr.title')}
        </h3>
        <div className="flex items-center gap-2">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
            <TabsList className="h-7">
              <TabsTrigger value="active" className="text-xs h-6">{t('coverage_rule_mgr.tab_active')}</TabsTrigger>
              <TabsTrigger value="archived" className="text-xs h-6">{t('coverage_rule_mgr.tab_archived')}</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button size="sm" variant="outline" onClick={() => { reset(); setOpen(true); }} disabled={offices.length === 0}>
            <Plus className="h-3 w-3 mr-1" /> {t('coverage_rule_mgr.btn_new')}
          </Button>
        </div>
      </div>

      {offices.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('coverage_rule_mgr.no_offices_hint')}</p>
      ) : visibleRules.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {filter === 'active' ? t('coverage_rule_mgr.empty_active') : t('coverage_rule_mgr.empty_archived')}
        </p>
      ) : (
        <div className="space-y-1">
          {visibleRules.map(r => {
            const roles = ruleRoles(r);
            const skillIds = ruleSkillIds(r);
            const isExpiringSoon = r.valid_until && r.valid_until >= today && r.valid_until <= new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
            return (
              <div key={r.id} className="flex items-center gap-2 p-2 rounded-md border text-sm flex-wrap">
                {r.name && <Badge variant="default" className="text-[10px]">{r.name}</Badge>}
                <Badge variant="secondary" className="text-[10px]">{officeName(r.office_id)}</Badge>
                {roles.map(role => (
                  <Badge key={role} variant="outline" className="text-[10px] bg-primary/5">{role}</Badge>
                ))}
                {skillIds.map(sid => (
                  <Badge key={sid} variant="outline" className="text-[10px]">
                    {skillName(sid)}{r.min_skill_level && r.min_skill_level > 1 ? ` (≥${r.min_skill_level})` : ''}
                  </Badge>
                ))}
                <span className="text-xs text-muted-foreground">{t('coverage_rule_mgr.headcount_label', { count: r.min_headcount })}</span>
                {r.days_of_week && r.days_of_week.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {r.days_of_week.slice().sort((a, b) => DOW_ORDER.indexOf(a) - DOW_ORDER.indexOf(b)).map(d => t(`coverage_rule_mgr.dow_${d}` as any)).join(', ')}
                  </span>
                )}
                {(r.valid_from || r.valid_until) && (
                  <span className={`text-xs ${isExpiringSoon ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-muted-foreground'}`}>
                    {r.valid_from || '—'} – {r.valid_until || '∞'}
                    {isExpiringSoon ? ' ⚠' : ''}
                  </span>
                )}
                {r.status !== 'active' && <Badge variant="outline" className="text-[10px] bg-muted">{t('coverage_rule_mgr.badge_archived')}</Badge>}
                <div className="ml-auto flex items-center gap-1">
                  {r.status === 'active' ? (
                    <>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)} title={t('common.edit')}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => archive(r.id)} title={t('common.archive')}>
                        <Archive className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => restore(r.id)} title={t('common.restore')}>
                      <ArchiveRestore className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(r.id)} title={t('common.permanent_delete')}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogContent className="w-[95vw] max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editingId ? t('coverage_rule_mgr.dialog_edit_title') : t('coverage_rule_mgr.dialog_create_title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[82vh] overflow-y-auto pr-2">
            {/* Name */}
            <div>
              <Label>{t('coverage_rule_mgr.label_name')} <span className="text-muted-foreground text-xs font-normal">{t('coverage_rule_mgr.label_name_optional')}</span></Label>
              <Input className="mt-1" value={name} onChange={e => setName(e.target.value)} placeholder={t('coverage_rule_mgr.name_placeholder')} maxLength={100} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('coverage_rule_mgr.label_office')}</Label>
                <Select value={officeId} onValueChange={setOfficeId}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder={t('coverage_rule_mgr.select_placeholder')} /></SelectTrigger>
                  <SelectContent>
                    {offices.map(o => <SelectItem key={o.id} value={o.id}>{o.name}{o.city ? ` (${o.city})` : ''}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('coverage_rule_mgr.label_min_headcount')}</Label>
                <Input className="mt-1" type="number" min="1" value={effectiveMinHeadcount} onChange={e => setMinHeadcount(e.target.value)} />
              </div>
            </div>

            <div>
              <Label className="flex items-center justify-between">
                <span>{t('coverage_rule_mgr.label_positions')}{selectedRoles.length > 0 && <span className="ml-1 text-primary font-normal">{t('coverage_rule_mgr.positions_selected', { count: selectedRoles.length })}</span>}</span>
              </Label>
              {allPositions.length === 0 ? (
                <p className="text-xs text-muted-foreground mt-1">{t('coverage_rule_mgr.no_positions_hint')}</p>
              ) : (
                <ScrollArea className="mt-1 h-52 border rounded-md p-2">
                  <div className="space-y-1">
                    {allPositions.map(pos => (
                      <label key={pos} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-accent cursor-pointer text-sm">
                        <Checkbox checked={selectedRoles.includes(pos)} onCheckedChange={() => toggleRole(pos)} />
                        <span>{pos}</span>
                        {selectedRoles.includes(pos) && (
                          <Input
                            className="ml-auto h-7 w-16"
                            type="number"
                            min="1"
                            value={roleHeadcounts[pos] || 1}
                            onChange={(e) => updateRoleHeadcount(pos, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                      </label>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>

            {skills.length > 0 && (
              <div>
                <Label className="flex items-center justify-between">
                  <span>{t('coverage_rule_mgr.label_skills')}{selectedSkillIds.length > 0 && <span className="ml-1 text-primary font-normal">{t('coverage_rule_mgr.skills_selected', { count: selectedSkillIds.length })}</span>}</span>
                </Label>
                <ScrollArea className="mt-1 h-32 border rounded-md p-2">
                  <div className="space-y-1">
                    {skills.map(sk => (
                      <label key={sk.id} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-accent cursor-pointer text-sm">
                        <Checkbox checked={selectedSkillIds.includes(sk.id)} onCheckedChange={() => toggleSkill(sk.id)} />
                        <span>{sk.name}</span>
                      </label>
                    ))}
                  </div>
                </ScrollArea>
                {selectedSkillIds.length > 0 && (
                  <div className="mt-2">
                    <Label>{t('coverage_rule_mgr.label_min_level_range')}</Label>
                    <Input className="mt-1 w-24" type="number" min="1" max="5" value={minSkillLevel} onChange={e => setMinSkillLevel(e.target.value)} />
                  </div>
                )}
              </div>
            )}

            <div>
              <Label>{t('coverage_rule_mgr.label_days_hint')}</Label>
              <div className="grid grid-cols-7 gap-1 mt-1">
                {DOW_ORDER.map(d => (
                  <label key={d} className="flex flex-col items-center gap-1 cursor-pointer">
                    <Checkbox checked={days.includes(d)} onCheckedChange={() => toggleDay(d)} />
                    <span className="text-[10px]">{t(`coverage_rule_mgr.dow_${d}` as any)}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('coverage_rule_mgr.label_valid_from')}</Label>
                <Input className="mt-1" type="date" value={validFrom} onChange={e => setValidFrom(e.target.value)} />
              </div>
              <div>
                <Label>{t('coverage_rule_mgr.label_valid_until')} <span className="text-[10px] text-muted-foreground">{t('coverage_rule_mgr.label_valid_until_note')}</span></Label>
                <Input className="mt-1" type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
              </div>
            </div>

            <div>
              <Label>{t('coverage_rule_mgr.label_notes')}</Label>
              <Input className="mt-1" value={notes} onChange={e => setNotes(e.target.value)} placeholder={t('coverage_rule_mgr.notes_placeholder')} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); reset(); }}>{t('coverage_rule_mgr.btn_cancel')}</Button>
            <Button onClick={save}>{editingId ? t('coverage_rule_mgr.btn_save') : t('coverage_rule_mgr.btn_add')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
