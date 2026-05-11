import { useEffect, useState } from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit2, Coins } from 'lucide-react';
import { toast } from 'sonner';
import { logAuditEvent } from '@/lib/auditLog';

interface Props { workspaceId: string; adminUserId: string; }

export function QuotaManager({ workspaceId, adminUserId }: Props) {
  const { t } = useI18n();
  const LEAVE_TYPES = [
    { v: 'vacation', l: t('leave_request.type_vacation') },
    { v: 'sick_leave', l: t('leave_request.type_sick_leave') },
    { v: 'unpaid_leave', l: t('leave_request.type_unpaid_leave') },
    { v: 'other', l: t('leave_request.type_other') },
  ];
  const [members, setMembers] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [editing, setEditing] = useState<any>(null);
  const [editForm, setEditForm] = useState({ initial_days: 0, carryover_days: 0, manual_adjustment_days: 0, leave_type: 'vacation' });

  const load = async () => {
    const { data: m } = await supabase
      .from('enterprise_memberships')
      .select('id, user_id, business_role, team')
      .eq('workspace_id', workspaceId)
      .eq('status', 'active');
    const userIds = (m || []).map((x: any) => x.user_id);
    const { data: profiles } = await supabase.from('profiles').select('user_id, display_name').in('user_id', userIds);
    const merged = (m || []).map((mem: any) => ({
      ...mem,
      display_name: profiles?.find((p: any) => p.user_id === mem.user_id)?.display_name || mem.user_id.slice(0, 8),
    }));
    setMembers(merged);

    const { data: b } = await (supabase as any)
      .from('enterprise_leave_quota_balances')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('year', year);
    setBalances(b || []);
  };

  useEffect(() => { load(); }, [workspaceId, year]);

  const openEdit = (membership_id: string, leave_type: string) => {
    const existing = balances.find((b) => b.membership_id === membership_id && b.leave_type === leave_type);
    setEditForm({
      initial_days: existing?.initial_days ?? 25,
      carryover_days: existing?.carryover_days ?? 0,
      manual_adjustment_days: existing?.manual_adjustment_days ?? 0,
      leave_type,
    });
    setEditing({ membership_id, leave_type, quota_id: existing?.quota_id });
  };

  const save = async () => {
    if (!editing) return;
    const payload = {
      workspace_id: workspaceId,
      membership_id: editing.membership_id,
      leave_type: editForm.leave_type as any,
      year,
      initial_days: Number(editForm.initial_days),
      carryover_days: Number(editForm.carryover_days),
      manual_adjustment_days: Number(editForm.manual_adjustment_days),
    };
    let error;
    if (editing.quota_id) {
      ({ error } = await supabase.from('enterprise_leave_quotas').update(payload).eq('id', editing.quota_id));
    } else {
      ({ error } = await supabase.from('enterprise_leave_quotas').insert(payload));
    }
    if (error) { toast.error(t('quota_manager.save_error')); return; }
    await logAuditEvent({
      workspace_id: workspaceId,
      actor_id: adminUserId,
      action: 'leave_quota.upsert',
      metadata: payload as any,
    });
    toast.success(t('quota_manager.save_success'));
    setEditing(null);
    load();
  };

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2">
          <Coins className="h-4 w-4 text-primary" /> {t('quota_manager.title')}
        </CardTitle>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[year - 1, year, year + 1].map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">{t('quota_manager.col_member')}</TableHead>
              {LEAVE_TYPES.map((t) => <TableHead key={t.v} className="text-xs text-center">{t.l}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((mem) => (
              <TableRow key={mem.id}>
                <TableCell className="text-xs font-medium">{mem.display_name}</TableCell>
                {LEAVE_TYPES.map((t) => {
                  const b = balances.find((x) => x.membership_id === mem.id && x.leave_type === t.v);
                  const total = b ? Number(b.initial_days) + Number(b.carryover_days) + Number(b.manual_adjustment_days) : 0;
                  return (
                    <TableCell key={t.v} className="text-center">
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => openEdit(mem.id, t.v)}>
                        {b ? (
                          <Badge variant="secondary" className="font-mono text-[10px]">
                            {Number(b.available_days).toFixed(1)}/{total.toFixed(0)}
                          </Badge>
                        ) : (
                          <Plus className="h-3 w-3" />
                        )}
                        <Edit2 className="h-3 w-3 opacity-50" />
                      </Button>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle>{t('quota_manager.edit_title')}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">{t('quota_manager.base_days_label')}</Label>
                <Input type="number" step="0.5" value={editForm.initial_days} onChange={(e) => setEditForm({ ...editForm, initial_days: Number(e.target.value) })} />
              </div>
              <div>
                <Label className="text-xs">{t('quota_manager.carryover_label')}</Label>
                <Input type="number" step="0.5" value={editForm.carryover_days} onChange={(e) => setEditForm({ ...editForm, carryover_days: Number(e.target.value) })} />
              </div>
              <div>
                <Label className="text-xs">{t('quota_manager.correction_label')}</Label>
                <Input type="number" step="0.5" value={editForm.manual_adjustment_days} onChange={(e) => setEditForm({ ...editForm, manual_adjustment_days: Number(e.target.value) })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>{t('common.cancel')}</Button>
              <Button onClick={save}>{t('common.save')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
