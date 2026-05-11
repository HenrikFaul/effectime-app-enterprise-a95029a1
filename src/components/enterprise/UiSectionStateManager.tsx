import { useEffect, useState } from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { LayoutPanelLeft } from 'lucide-react';
import { toast } from 'sonner';
import { setWorkspaceSectionState, type SectionState } from '@/hooks/useWorkspaceSectionState';

interface Props { workspaceId: string; userId: string }

interface SectionDef { key: string; label: string; group: string }

export function UiSectionStateManager({ workspaceId, userId }: Props) {
  const { t } = useI18n();
  const [states, setStates] = useState<Record<string, SectionState>>({});
  const [loading, setLoading] = useState(true);

  // A cégszinten konfigurálható szekciók katalógusa.
  // Új szekció hozzáadásához: regisztráld itt + használd a useWorkspaceSectionState hookot.
  const SECTIONS: SectionDef[] = [
    { group: t('ui_section_mgr.group_settings'), key: 'settings.workspace_general', label: t('ui_section_mgr.section_ws_general') },
    { group: t('ui_section_mgr.group_settings'), key: 'settings.branding', label: t('ui_section_mgr.section_branding') },
    { group: t('ui_section_mgr.group_settings'), key: 'settings.allowances', label: t('ui_section_mgr.section_allowances') },
    { group: t('ui_section_mgr.group_settings'), key: 'settings.csv_import', label: t('ui_section_mgr.section_csv_import') },
    { group: t('ui_section_mgr.group_settings'), key: 'settings.integrations', label: t('ui_section_mgr.section_integrations') },
    { group: t('ui_section_mgr.group_settings'), key: 'settings.ical', label: t('ui_section_mgr.section_ical') },
    { group: t('ui_section_mgr.group_settings'), key: 'settings.quota_admin', label: t('ui_section_mgr.section_quota_admin') },
    { group: t('ui_section_mgr.group_requests'), key: 'requests.quota_balance', label: t('ui_section_mgr.section_quota_balance') },
    { group: t('ui_section_mgr.group_requests'), key: 'requests.substitute_inbox', label: t('ui_section_mgr.section_substitute_inbox') },
    { group: t('ui_section_mgr.group_calendar'), key: 'calendar.annual_grid', label: t('ui_section_mgr.section_annual_grid') },
  ];

  const STATE_LABELS: Record<SectionState, string> = {
    default: t('ui_section_mgr.state_default'),
    opened: t('ui_section_mgr.state_opened'),
    collapsed: t('ui_section_mgr.state_collapsed'),
  };

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('enterprise_ui_section_states')
      .select('section_key,state')
      .eq('workspace_id', workspaceId);
    const m: Record<string, SectionState> = {};
    (data || []).forEach((r: any) => { m[r.section_key] = r.state; });
    setStates(m);
    setLoading(false);
  };

  useEffect(() => { load(); }, [workspaceId]);

  const change = async (key: string, state: SectionState) => {
    setStates(p => ({ ...p, [key]: state }));
    const error = await setWorkspaceSectionState(workspaceId, key, state, userId);
    if (error) {
      toast.error(t('ui_section_mgr.save_error', { msg: error.message }));
      load();
    } else {
      toast.success(t('ui_section_mgr.saved'));
    }
  };

  if (loading) return <div className="flex justify-center py-4"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  const grouped = SECTIONS.reduce<Record<string, SectionDef[]>>((acc, s) => {
    (acc[s.group] ||= []).push(s);
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <LayoutPanelLeft className="h-4 w-4 text-primary" /> {t('ui_section_mgr.card_title')}
        </CardTitle>
        <p className="text-[11px] text-muted-foreground">
          {t('ui_section_mgr.description')} {t('ui_section_mgr.description_note')}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(grouped).map(([group, sections]) => (
          <div key={group} className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{group}</p>
            <div className="space-y-1">
              {sections.map(s => {
                const cur = states[s.key] || 'default';
                return (
                  <div key={s.key} className="flex items-center justify-between gap-2 p-2 rounded-md border">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{s.label}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{s.key}</p>
                    </div>
                    {cur !== 'default' && <Badge variant="secondary" className="text-[10px]">{t('ui_section_mgr.overridden_badge')}</Badge>}
                    <Select value={cur} onValueChange={v => change(s.key, v as SectionState)}>
                      <SelectTrigger className="w-56 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(STATE_LABELS) as SectionState[]).map(k => (
                          <SelectItem key={k} value={k}>{STATE_LABELS[k]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
