import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type CalendarFilterId =
  | 'office'
  | 'team'
  | 'business_role'
  | 'leave_type'
  | 'status'
  | 'skill'
  | 'location'
  | 'site_priority'
  | 'utilization'
  | 'assignment_state'
  | 'capacity_band';

export interface CalendarFilterConfig {
  id: CalendarFilterId;
  enabled: boolean;
  order: number;
}

export const FILTER_LABELS: Record<CalendarFilterId, string> = {
  office: 'Telephely / Iroda',
  team: 'Csapat',
  business_role: 'Pozíció',
  leave_type: 'Szabadság típusa',
  status: 'Státusz',
  skill: 'Képesség / Skill',
  location: 'Helyszín (város)',
  site_priority: 'Telephely prioritás',
  utilization: 'Kihasználtság',
  assignment_state: 'Beosztási állapot',
  capacity_band: 'Kapacitás-sáv',
};

const DEFAULT_CONFIG: CalendarFilterConfig[] = [
  { id: 'office', enabled: true, order: 1 },
  { id: 'team', enabled: true, order: 2 },
  { id: 'business_role', enabled: true, order: 3 },
  { id: 'leave_type', enabled: true, order: 4 },
  { id: 'status', enabled: true, order: 5 },
  { id: 'skill', enabled: true, order: 6 },
  { id: 'location', enabled: true, order: 7 },
  { id: 'site_priority', enabled: false, order: 8 },
  { id: 'utilization', enabled: false, order: 9 },
  { id: 'assignment_state', enabled: false, order: 10 },
  { id: 'capacity_band', enabled: false, order: 11 },
];

export function useCalendarFilterConfig(workspaceId: string) {
  const [config, setConfig] = useState<CalendarFilterConfig[]>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('tenant_calendar_settings')
      .select('filters_config')
      .eq('workspace_id', workspaceId)
      .maybeSingle();
    if (!error && data?.filters_config) {
      const arr = (data.filters_config as CalendarFilterConfig[])
        .filter(c => c && DEFAULT_CONFIG.some(d => d.id === c.id))
        .sort((a, b) => a.order - b.order);
      // Ensure all known filters present (forward-compat: new filter types added here get appended)
      const missing = DEFAULT_CONFIG.filter(d => !arr.some(a => a.id === d.id))
        .map((d, i) => ({ ...d, order: arr.length + i + 1 }));
      setConfig([...arr, ...missing]);
    } else {
      setConfig(DEFAULT_CONFIG);
    }
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (next: CalendarFilterConfig[], userId?: string) => {
    setSaving(true);
    const normalized = next.map((c, i) => ({ ...c, order: i + 1 }));
    const { error } = await (supabase as any)
      .from('tenant_calendar_settings')
      .upsert(
        { workspace_id: workspaceId, filters_config: normalized, updated_by: userId },
        { onConflict: 'workspace_id' }
      );
    setSaving(false);
    if (error) {
      toast.error(`Mentési hiba: ${error.message}`);
      return false;
    }
    setConfig(normalized);
    toast.success('Szűrő-beállítások mentve');
    return true;
  }, [workspaceId]);

  return { config, setConfig, save, loading, saving, reload: load };
}
