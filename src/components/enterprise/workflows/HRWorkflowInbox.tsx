import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CheckCircle2, Circle, ChevronDown, Plus, XCircle, AlertTriangle, CalendarDays, User2 } from 'lucide-react';
import { toast } from 'sonner';
import { format, isPast, isWithinInterval, addDays } from 'date-fns';
import { hu } from 'date-fns/locale';

interface Props {
  workspaceId: string;
  isAdmin: boolean;
  userId: string;
}

interface InstanceRow {
  id: string;
  template_id: string | null;
  membership_id: string | null;
  title: string;
  category: string;
  status: string;
  priority: string;
  due_date: string | null;
  started_at: string;
  completed_at: string | null;
  notes: string | null;
  member_name: string;
  total_tasks: number;
  done_tasks: number;
}

interface Task {
  id: string;
  instance_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: string;
}

interface Template {
  id: string;
  name: string;
  category: string;
}

interface Membership {
  id: string;
  user_id: string;
  display_name?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  medical_exam: 'Orvosi vizsgálat',
  salary_advance: 'Előleg-igény',
  contract_amendment: 'Szerződésmódosítás',
  probation_review: 'Próbaidő-értékelés',
  fixed_term_expiry: 'Határozott szerz.',
  offboarding: 'Kiléptetés',
  custom: 'Egyedi',
};

const STATUS_META: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  open:        { label: 'Nyitott',    variant: 'secondary' },
  in_progress: { label: 'Folyamatban', variant: 'default' },
  completed:   { label: 'Lezárva',    variant: 'outline' },
  cancelled:   { label: 'Törölve',    variant: 'destructive' },
};

const PRIORITY_META: Record<string, { label: string; color: string }> = {
  low:    { label: 'Alacsony', color: 'text-muted-foreground' },
  normal: { label: 'Normál',   color: 'text-foreground' },
  high:   { label: 'Magas',    color: 'text-amber-600' },
  urgent: { label: 'Sürgős',   color: 'text-red-600 font-semibold' },
};

function dueDateClass(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isPast(d)) return 'text-red-600';
  if (isWithinInterval(d, { start: new Date(), end: addDays(new Date(), 3) })) return 'text-amber-600';
  return 'text-muted-foreground';
}

export function HRWorkflowInbox({ workspaceId, isAdmin, userId }: Props) {
  const [instances, setInstances] = useState<InstanceRow[]>([]);
  const [tasksByInstance, setTasksByInstance] = useState<Record<string, Task[]>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('open');
  const [loading, setLoading] = useState(true);
  const [showStartDialog, setShowStartDialog] = useState(false);

  // Start-workflow form
  const [templates, setTemplates] = useState<Template[]>([]);
  const [members, setMembers] = useState<Membership[]>([]);
  const [fTemplateId, setFTemplateId] = useState('');
  const [fMemberId, setFMemberId] = useState('');
  const [fTitle, setFTitle] = useState('');
  const [fDueDate, setFDueDate] = useState('');
  const [fPriority, setFPriority] = useState('normal');
  const [fNotes, setFNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const loadInstances = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).rpc('hr_workflow_list_instances', {
      p_workspace_id: workspaceId,
      p_status: statusFilter === 'all' ? null : statusFilter,
    });
    if (error) {
      // Non-admin: fall back to member view
      const { data: memberInstances } = await (supabase as any)
        .from('enterprise_hr_workflow_instances')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('status', statusFilter === 'all' ? undefined : statusFilter)
        .order('due_date', { ascending: true, nullsFirst: false });
      setInstances((memberInstances || []).map((i: any) => ({ ...i, member_name: 'Én', total_tasks: 0, done_tasks: 0 })));
    } else {
      setInstances((data as InstanceRow[]) || []);
    }
    setLoading(false);
  }, [workspaceId, statusFilter]);

  useEffect(() => { loadInstances(); }, [loadInstances]);

  const loadTasks = async (instanceId: string) => {
    if (tasksByInstance[instanceId]) return;
    const { data } = await (supabase as any)
      .from('enterprise_hr_workflow_tasks')
      .select('*')
      .eq('instance_id', instanceId)
      .order('sort_order');
    setTasksByInstance(prev => ({ ...prev, [instanceId]: (data as Task[]) || [] }));
  };

  const handleOpen = (id: string) => {
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id);
    loadTasks(id);
  };

  const toggleTask = async (task: Task, instanceId: string) => {
    const newStatus = task.status === 'done' ? 'pending' : 'done';
    const { error } = await (supabase as any).rpc('hr_workflow_update_task', {
      p_task_id: task.id,
      p_status: newStatus,
    });
    if (error) { toast.error(error.message); return; }
    setTasksByInstance(prev => ({
      ...prev,
      [instanceId]: (prev[instanceId] || []).map(t =>
        t.id === task.id ? { ...t, status: newStatus } : t
      ),
    }));
    setInstances(prev => prev.map(i =>
      i.id === instanceId
        ? { ...i, done_tasks: (i.done_tasks || 0) + (newStatus === 'done' ? 1 : -1) }
        : i
    ));
  };

  const closeInstance = async (id: string, status: 'completed' | 'cancelled') => {
    const { error } = await (supabase as any).rpc('hr_workflow_close_instance', {
      p_instance_id: id,
      p_status: status,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(status === 'completed' ? 'Folyamat lezárva' : 'Folyamat törölve');
    loadInstances();
  };

  const openStartDialog = async () => {
    const [{ data: tpls }, { data: ms }] = await Promise.all([
      (supabase as any).from('enterprise_hr_workflow_templates').select('id, name, category').eq('workspace_id', workspaceId).eq('is_active', true).order('name'),
      (supabase as any).from('enterprise_memberships').select('id, user_id').eq('workspace_id', workspaceId).eq('status', 'active'),
    ]);
    setTemplates((tpls as Template[]) || []);

    const ids = ((ms as any[]) || []).map((m: any) => m.user_id);
    if (ids.length > 0) {
      const { data: prof } = await supabase.from('profiles').select('user_id, display_name').in('user_id', ids);
      const nameMap = new Map((prof || []).map((p: any) => [p.user_id, p.display_name || 'Ismeretlen']));
      setMembers(((ms as any[]) || []).map((m: any) => ({ ...m, display_name: nameMap.get(m.user_id) })));
    } else {
      setMembers([]);
    }

    setFTemplateId(''); setFMemberId(''); setFTitle(''); setFDueDate('');
    setFPriority('normal'); setFNotes('');
    setShowStartDialog(true);
  };

  const startWorkflow = async () => {
    setBusy(true);
    const { error } = await (supabase as any).rpc('hr_workflow_create_instance', {
      p_workspace_id: workspaceId,
      p_template_id: fTemplateId || null,
      p_membership_id: fMemberId || null,
      p_title: fTitle.trim() || null,
      p_due_date: fDueDate || null,
      p_priority: fPriority,
      p_notes: fNotes.trim() || null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Folyamat elindítva');
    setShowStartDialog(false);
    loadInstances();
  };

  const activeCount = instances.filter(i => ['open', 'in_progress'].includes(i.status)).length;
  const overdueCount = instances.filter(i =>
    ['open', 'in_progress'].includes(i.status) && i.due_date && isPast(new Date(i.due_date))
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary">{activeCount} aktív</Badge>
          {overdueCount > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />{overdueCount} késő
            </Badge>
          )}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Nyitott</SelectItem>
              <SelectItem value="in_progress">Folyamatban</SelectItem>
              <SelectItem value="completed">Lezárva</SelectItem>
              <SelectItem value="cancelled">Törölve</SelectItem>
              <SelectItem value="all">Mind</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={openStartDialog}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Folyamat indítása
          </Button>
        )}
      </div>

      {loading && <p className="text-sm text-muted-foreground py-4">Betöltés…</p>}
      {!loading && instances.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Nincs találat a kiválasztott szűrőre.
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {instances.map(inst => {
          const pct = inst.total_tasks > 0 ? Math.round((inst.done_tasks / inst.total_tasks) * 100) : 0;
          const isOpen = openId === inst.id;
          const sm = STATUS_META[inst.status] ?? STATUS_META.open;
          const pm = PRIORITY_META[inst.priority] ?? PRIORITY_META.normal;

          return (
            <Collapsible key={inst.id} open={isOpen} onOpenChange={() => handleOpen(inst.id)}>
              <Card className={inst.due_date && isPast(new Date(inst.due_date)) && inst.status !== 'completed' && inst.status !== 'cancelled' ? 'border-red-200' : ''}>
                <div className="px-4 py-3">
                  <div className="flex flex-wrap items-start gap-2">
                    <CollapsibleTrigger asChild>
                      <button className="flex items-center gap-2 flex-1 min-w-0 text-left group">
                        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                        <span className={`text-sm font-medium truncate flex-1 ${pm.color}`}>{inst.title}</span>
                      </button>
                    </CollapsibleTrigger>
                    <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                      <Badge variant="outline" className="text-xs">
                        {CATEGORY_LABELS[inst.category] ?? inst.category}
                      </Badge>
                      <Badge variant={sm.variant} className="text-xs">{sm.label}</Badge>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 mt-2 pl-6 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User2 className="h-3 w-3" />{inst.member_name}
                    </span>
                    {inst.due_date && (
                      <span className={`flex items-center gap-1 ${dueDateClass(inst.due_date)}`}>
                        <CalendarDays className="h-3 w-3" />
                        Határidő: {format(new Date(inst.due_date), 'MMM d.', { locale: hu })}
                      </span>
                    )}
                    {inst.total_tasks > 0 && (
                      <span>{inst.done_tasks}/{inst.total_tasks} kész</span>
                    )}
                  </div>

                  {inst.total_tasks > 0 && (
                    <div className="mt-2 pl-6">
                      <Progress value={pct} className="h-1" />
                    </div>
                  )}
                </div>

                <CollapsibleContent>
                  <div className="border-t px-4 py-3 space-y-3">
                    {inst.notes && (
                      <p className="text-xs text-muted-foreground italic">{inst.notes}</p>
                    )}

                    {/* Tasks */}
                    {(tasksByInstance[inst.id] || []).length > 0 ? (
                      <ul className="space-y-1.5">
                        {(tasksByInstance[inst.id] || []).map(task => (
                          <li key={task.id} className="flex items-start gap-2">
                            <button
                              className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors"
                              onClick={() => toggleTask(task, inst.id)}
                              disabled={!isAdmin && inst.status === 'completed'}
                            >
                              {task.status === 'done'
                                ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                                : task.status === 'skipped'
                                ? <XCircle className="h-4 w-4 text-muted-foreground" />
                                : <Circle className="h-4 w-4" />
                              }
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm leading-snug ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                                {task.title}
                              </p>
                              {task.description && (
                                <p className="text-xs text-muted-foreground">{task.description}</p>
                              )}
                            </div>
                            {task.due_date && (
                              <span className={`text-xs shrink-0 ${dueDateClass(task.due_date)}`}>
                                {format(new Date(task.due_date), 'MM.dd')}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground">Nincsenek feladatlépések rögzítve.</p>
                    )}

                    {/* Admin actions */}
                    {isAdmin && ['open', 'in_progress'].includes(inst.status) && (
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" variant="outline" onClick={() => closeInstance(inst.id, 'completed')}>
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                          Lezárás
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => closeInstance(inst.id, 'cancelled')}>
                          <XCircle className="h-3.5 w-3.5 mr-1.5" />
                          Törlés
                        </Button>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })}
      </div>

      {/* Start Workflow Dialog */}
      <Dialog open={showStartDialog} onOpenChange={setShowStartDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>HR folyamat indítása</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Sablon (opcionális)</Label>
              <Select value={fTemplateId} onValueChange={v => {
                setFTemplateId(v);
                const t = templates.find(x => x.id === v);
                if (t && !fTitle) setFTitle(t.name);
              }}>
                <SelectTrigger><SelectValue placeholder="Válassz sablont…" /></SelectTrigger>
                <SelectContent>
                  {templates.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Cím *</Label>
              <Input value={fTitle} onChange={e => setFTitle(e.target.value)} placeholder="Folyamat neve" />
            </div>
            <div className="space-y-1.5">
              <Label>Érintett munkavállaló</Label>
              <Select value={fMemberId} onValueChange={setFMemberId}>
                <SelectTrigger><SelectValue placeholder="Válassz tagot…" /></SelectTrigger>
                <SelectContent>
                  {members.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.display_name || m.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Határidő</Label>
                <Input type="date" value={fDueDate} onChange={e => setFDueDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Prioritás</Label>
                <Select value={fPriority} onValueChange={setFPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_META).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Megjegyzés</Label>
              <Textarea value={fNotes} onChange={e => setFNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStartDialog(false)}>Mégse</Button>
            <Button onClick={startWorkflow} disabled={busy || !fTitle.trim()}>Indítás</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
