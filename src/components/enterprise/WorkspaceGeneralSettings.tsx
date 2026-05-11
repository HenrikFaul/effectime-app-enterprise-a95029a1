import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

interface Props { workspaceId: string }

interface WSSettings {
  fiscal_year_start_month: number;
  name_format: string;
  show_past_absences: boolean;
  allow_other_dept_view: boolean;
  allow_manager_retroactive: boolean;
}

export function WorkspaceGeneralSettings({ workspaceId }: Props) {
  const { t } = useI18n();
  const MONTHS = Array.from({ length: 12 }, (_, i) => t(`ws_general_settings.month_${i + 1}` as any));
  const [s, setS] = useState<WSSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('enterprise_workspaces')
      .select('fiscal_year_start_month,name_format,show_past_absences,allow_other_dept_view,allow_manager_retroactive')
      .eq('id', workspaceId)
      .single();
    setS(data as WSSettings);
    setLoading(false);
  };
  useEffect(() => { load(); }, [workspaceId]);

  const save = async () => {
    if (!s) return;
    setSaving(true);
    const { error } = await (supabase as any).from('enterprise_workspaces').update(s).eq('id', workspaceId);
    if (error) toast.error(t('ws_general_settings.save_error')); else toast.success(t('ws_general_settings.save_success'));
    setSaving(false);
  };

  if (loading || !s) return <div className="flex justify-center py-4"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">{t('ws_general_settings.fy_month_label')}</Label>
          <Select value={String(s.fiscal_year_start_month)} onValueChange={v => setS({ ...s, fiscal_year_start_month: parseInt(v) })}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => <SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">{t('ws_general_settings.name_format_label')}</Label>
          <Select value={s.name_format} onValueChange={v => setS({ ...s, name_format: v })}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="full_name">{t('ws_general_settings.name_format_full')}</SelectItem>
              <SelectItem value="first_last">{t('ws_general_settings.name_format_first_last')}</SelectItem>
              <SelectItem value="last_first">{t('ws_general_settings.name_format_last_first')}</SelectItem>
              <SelectItem value="email">{t('ws_general_settings.name_format_email')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase text-muted-foreground">{t('ws_general_settings.privacy_section')}</h4>

        <div className="flex items-start justify-between rounded-md border p-3 gap-3">
          <div className="flex-1">
            <Label className="text-sm cursor-pointer">{t('ws_general_settings.cross_dept_label')}</Label>
            <p className="text-[11px] text-muted-foreground mt-0.5">{t('ws_general_settings.cross_dept_desc')}</p>
          </div>
          <Switch checked={s.allow_other_dept_view} onCheckedChange={v => setS({ ...s, allow_other_dept_view: v })} />
        </div>

        <div className="flex items-start justify-between rounded-md border p-3 gap-3">
          <div className="flex-1">
            <Label className="text-sm cursor-pointer">{t('ws_general_settings.past_leave_label')}</Label>
            <p className="text-[11px] text-muted-foreground mt-0.5">{t('ws_general_settings.past_leave_desc')}</p>
          </div>
          <Switch checked={s.show_past_absences} onCheckedChange={v => setS({ ...s, show_past_absences: v })} />
        </div>

        <div className="flex items-start justify-between rounded-md border p-3 gap-3">
          <div className="flex-1">
            <Label className="text-sm cursor-pointer">{t('ws_general_settings.retroactive_label')}</Label>
            <p className="text-[11px] text-muted-foreground mt-0.5">{t('ws_general_settings.retroactive_desc')}</p>
          </div>
          <Switch checked={s.allow_manager_retroactive} onCheckedChange={v => setS({ ...s, allow_manager_retroactive: v })} />
        </div>
      </div>

      <Button onClick={save} disabled={saving} className="w-full sm:w-auto">
        <Save className="h-3 w-3 mr-1" /> {saving ? t('ws_general_settings.btn_saving') : t('ws_general_settings.btn_save')}
      </Button>
    </div>
  );
}
