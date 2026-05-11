import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, UserPlus } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

interface Member { user_id: string; display_name: string; }

interface Props {
  workspaceId: string;
  selfUserId: string;
  value: string[]; // ordered list of user_ids
  onChange: (next: string[]) => void;
}

export function SubstitutePicker({ workspaceId, selfUserId, value, onChange }: Props) {
  const { t } = useI18n();
  const [members, setMembers] = useState<Member[]>([]);
  const [picking, setPicking] = useState<string>('');

  useEffect(() => {
    (async () => {
      const { data: m } = await supabase
        .from('enterprise_memberships')
        .select('user_id')
        .eq('workspace_id', workspaceId)
        .eq('status', 'active');
      const ids = (m || []).map((x: any) => x.user_id).filter((id: string) => id !== selfUserId);
      if (ids.length === 0) { setMembers([]); return; }
      const { data: p } = await supabase.from('profiles').select('user_id, display_name').in('user_id', ids);
      setMembers((p || []).map((x: any) => ({ user_id: x.user_id, display_name: x.display_name || x.user_id.slice(0, 8) })));
    })();
  }, [workspaceId, selfUserId]);

  const add = () => {
    if (!picking || value.includes(picking)) return;
    onChange([...value, picking]);
    setPicking('');
  };

  const remove = (id: string) => onChange(value.filter((x) => x !== id));

  return (
    <div>
      <Label className="text-xs">{t('substitute_picker.label')}</Label>
      <div className="flex gap-2 mt-1">
        <Select value={picking} onValueChange={setPicking}>
          <SelectTrigger className="flex-1 h-9 text-xs"><SelectValue placeholder={t('substitute_picker.placeholder')} /></SelectTrigger>
          <SelectContent>
            {members.filter((m) => !value.includes(m.user_id)).map((m) => (
              <SelectItem key={m.user_id} value={m.user_id}>{m.display_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" size="sm" onClick={add} disabled={!picking}><UserPlus className="h-4 w-4" /></Button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {value.map((id, i) => {
            const m = members.find((x) => x.user_id === id);
            return (
              <Badge key={id} variant="secondary" className="gap-1 text-xs">
                <span className="font-mono opacity-60">{i + 1}.</span> {m?.display_name || id.slice(0, 8)}
                <button type="button" onClick={() => remove(id)} className="ml-1 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
      <p className="text-[10px] text-muted-foreground mt-1">{t('substitute_picker.description')}</p>
    </div>
  );
}
