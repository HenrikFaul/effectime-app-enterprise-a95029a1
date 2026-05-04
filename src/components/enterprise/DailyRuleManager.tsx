import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Pencil, X } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Props {
  workspaceId: string;
  userId: string;
}

interface DailyRule {
  id: string;
  rule_date: string | null;
  day_of_week: number | null;
  days_of_week: number[] | null;
  valid_from: string | null;
  valid_until: string | null;
  max_off: number | null;
  min_coverage: number | null;
  role_filters: string[] | null;
  team_filter: string | null;
  role_filter: string | null;
}

const DOW_LABELS = ['Vasárnap', 'Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat'];
const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Hé–Vas megjelenítési sorrend

export function DailyRuleManager({ workspaceId, userId }: Props) {
  const [rules, setRules] = useState<DailyRule[]>([]);
  const [businessRoles, setBusinessRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [selectedDays, setSelectedDays] = useState<number[]>([1]);
  const [validFrom, setValidFrom] = useState<Date>();
  const [validUntil, setValidUntil] = useState<Date>();
  const [maxOff, setMaxOff] = useState('');
  const [minCoverage, setMinCoverage] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [roleToAdd, setRoleToAdd] = useState<string>('');

  const fetchRules = useCallback(async () => {
    setLoading(true);
    const [{ data: rulesData }, { data: memberData }] = await Promise.all([
      supabase
        .from('enterprise_daily_rules')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false }),
      supabase
        .from('enterprise_memberships')
        .select('business_role')
        .eq('workspace_id', workspaceId)
        .not('business_role', 'is', null),
    ]);
    setRules((rulesData as any[]) || []);
    const roleSet = new Set<string>();
    ((memberData as any[]) || []).forEach((m: any) => {
      if (m.business_role) roleSet.add(m.business_role);
    });
    setBusinessRoles(Array.from(roleSet).sort());
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const resetForm = () => {
    setEditingId(null);
    setSelectedDays([1]);
    setValidFrom(undefined);
    setValidUntil(undefined);
    setMaxOff('');
    setMinCoverage('');
    setSelectedRoles([]);
    setRoleToAdd('');
  };

  const openEdit = (rule: DailyRule) => {
    setEditingId(rule.id);
    const days = rule.days_of_week && rule.days_of_week.length > 0
      ? rule.days_of_week
      : (rule.day_of_week !== null ? [rule.day_of_week] : []);
    setSelectedDays(days);
    setValidFrom(rule.valid_from ? new Date(rule.valid_from) : undefined);
    setValidUntil(rule.valid_until ? new Date(rule.valid_until) : undefined);
    setMaxOff(rule.max_off?.toString() || '');
    setMinCoverage(rule.min_coverage?.toString() || '');
    const roles = rule.role_filters && rule.role_filters.length > 0
      ? rule.role_filters
      : (rule.role_filter ? [rule.role_filter] : (rule.team_filter ? [rule.team_filter] : []));
    setSelectedRoles(roles);
    setShowForm(true);
  };

  const toggleDay = (day: number) => {
    setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort());
  };

  const addRole = () => {
    if (!roleToAdd) return;
    if (selectedRoles.includes(roleToAdd)) { toast.error('Már hozzáadva'); return; }
    setSelectedRoles(prev => [...prev, roleToAdd]);
    setRoleToAdd('');
  };

  const removeRole = (role: string) => {
    setSelectedRoles(prev => prev.filter(r => r !== role));
  };

  const handleSave = async () => {
    if (selectedDays.length === 0) { toast.error('Válassz legalább egy napot'); return; }
    if (!maxOff && !minCoverage) { toast.error('Add meg a max távollévők számát vagy a minimum lefedettséget'); return; }

    const payload: any = {
      workspace_id: workspaceId,
      created_by: userId,
      days_of_week: selectedDays,
      day_of_week: selectedDays.length === 1 ? selectedDays[0] : null, // backwards compat
      rule_date: null,
      valid_from: validFrom ? format(validFrom, 'yyyy-MM-dd') : null,
      valid_until: validUntil ? format(validUntil, 'yyyy-MM-dd') : null,
      max_off: maxOff ? parseInt(maxOff) : null,
      min_coverage: minCoverage ? parseInt(minCoverage) : null,
      role_filters: selectedRoles.length > 0 ? selectedRoles : null,
      role_filter: null,
      team_filter: null,
    };

    let error: any;
    if (editingId) {
      ({ error } = await supabase.from('enterprise_daily_rules').update(payload).eq('id', editingId));
    } else {
      ({ error } = await supabase.from('enterprise_daily_rules').insert(payload));
    }
    if (error) {
      console.error('Daily rule save error:', error);
      toast.error(`Hiba a szabály mentésekor: ${error.message || 'ismeretlen hiba'}`);
      return;
    }
    toast.success(editingId ? 'Szabály frissítve' : 'Szabály hozzáadva');
    setShowForm(false);
    resetForm();
    fetchRules();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('enterprise_daily_rules').delete().eq('id', id);
    toast.success('Szabály törölve');
    fetchRules();
  };

  const formatDays = (rule: DailyRule): string => {
    const days = rule.days_of_week && rule.days_of_week.length > 0
      ? rule.days_of_week
      : (rule.day_of_week !== null ? [rule.day_of_week] : []);
    if (days.length === 0) return '—';
    return days
      .slice()
      .sort((a, b) => DOW_ORDER.indexOf(a) - DOW_ORDER.indexOf(b))
      .map(d => DOW_LABELS[d].slice(0, 3))
      .join(', ');
  };

  const formatValidity = (rule: DailyRule): string | null => {
    if (!rule.valid_from && !rule.valid_until) return null;
    const from = rule.valid_from ? format(new Date(rule.valid_from), 'yyyy.MM.dd', { locale: hu }) : '—';
    const until = rule.valid_until ? format(new Date(rule.valid_until), 'yyyy.MM.dd', { locale: hu }) : '∞';
    return `${from} – ${until}`;
  };

  const getRolesForRule = (rule: DailyRule): string[] => {
    if (rule.role_filters && rule.role_filters.length > 0) return rule.role_filters;
    if (rule.role_filter) return [rule.role_filter];
    if (rule.team_filter) return [rule.team_filter];
    return [];
  };

  const availableRolesToAdd = businessRoles.filter(r => !selectedRoles.includes(r));

  if (loading) return <div className="flex justify-center py-4"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Napi szabályok (max távollévők, min lefedettség)</h3>
        <Button size="sm" variant="outline" onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus className="h-3 w-3 mr-1" /> Szabály
        </Button>
      </div>

      {rules.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nincs napi szabály definiálva.</p>
      ) : (
        <div className="space-y-1">
          {rules.map(r => {
            const roles = getRolesForRule(r);
            const validity = formatValidity(r);
            return (
              <div key={r.id} className="flex items-center gap-2 p-2 rounded-md border text-sm flex-wrap">
                <span className="font-medium">{formatDays(r)}</span>
                {r.max_off !== null && <span className="text-xs text-muted-foreground">Max távollévő: {r.max_off}</span>}
                {r.min_coverage !== null && <span className="text-xs text-muted-foreground">Min jelenlét: {r.min_coverage}</span>}
                {roles.length > 0 && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
                    Munkakör:
                    {roles.map(role => (
                      <Badge key={role} variant="secondary" className="text-[10px] h-4">{role}</Badge>
                    ))}
                  </span>
                )}
                {validity && <span className="text-xs text-muted-foreground">Érvényes: {validity}</span>}
                <div className="ml-auto flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(r.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Napi szabály szerkesztése' : 'Napi szabály hozzáadása'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Days of week */}
            <div>
              <Label>Mely napokra vonatkozik?</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {DOW_ORDER.map(d => (
                  <label key={d} className="flex items-center gap-2 text-sm cursor-pointer rounded-md border p-2 hover:bg-accent/30">
                    <Checkbox checked={selectedDays.includes(d)} onCheckedChange={() => toggleDay(d)} />
                    <span>{DOW_LABELS[d]}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Validity period */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Érvényes ettől (opcionális)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full mt-1 justify-start text-left font-normal", !validFrom && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {validFrom ? format(validFrom, 'yyyy.MM.dd', { locale: hu }) : 'Bármikor'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={validFrom} onSelect={setValidFrom} locale={hu} className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>Érvényes eddig (opcionális)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full mt-1 justify-start text-left font-normal", !validUntil && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {validUntil ? format(validUntil, 'yyyy.MM.dd', { locale: hu }) : 'Korlátlan'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={validUntil} onSelect={setValidUntil} locale={hu} className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Limits */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Max távollévő</Label>
                <Input className="mt-1" type="number" min="0" value={maxOff} onChange={e => setMaxOff(e.target.value)} placeholder="pl. 3" />
              </div>
              <div>
                <Label>Min jelenlét</Label>
                <Input className="mt-1" type="number" min="0" value={minCoverage} onChange={e => setMinCoverage(e.target.value)} placeholder="pl. 5" />
              </div>
            </div>

            {/* Role filters */}
            <div>
              <Label>Munkakör szűrő (opcionális)</Label>
              <p className="text-xs text-muted-foreground mt-0.5">A szabály csak a kiválasztott munkakörökre vonatkozik. Ha üres, mindenkire érvényes.</p>
              {selectedRoles.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {selectedRoles.map(role => (
                    <Badge key={role} variant="secondary" className="text-xs gap-1 pr-1">
                      {role}
                      <button onClick={() => removeRole(role)} className="hover:bg-background rounded-sm">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              {businessRoles.length === 0 ? (
                <p className="text-xs text-muted-foreground mt-2 italic">Nincsenek munkakörök. Hozz létre munkaköröket a Beállítások / Munkakörök részben.</p>
              ) : availableRolesToAdd.length === 0 ? (
                <p className="text-xs text-muted-foreground mt-2 italic">Minden munkakör hozzáadva.</p>
              ) : (
                <div className="flex gap-2 mt-2">
                  <Select value={roleToAdd} onValueChange={setRoleToAdd}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Válassz munkakört..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRolesToAdd.map(r => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" onClick={addRole} disabled={!roleToAdd}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Hozzáadás
                  </Button>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowForm(false); resetForm(); }}>Mégse</Button>
            <Button onClick={handleSave}>{editingId ? 'Mentés' : 'Hozzáadás'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
