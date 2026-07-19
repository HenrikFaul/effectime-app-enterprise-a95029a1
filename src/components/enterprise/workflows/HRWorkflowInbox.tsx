import { useCallback, useEffect, useRef, useState } from 'react';
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
import { useT, useDateLocale } from '@/i18n/I18nProvider';
import {
  fetchHRWorkflowInstances,
  fetchHRWorkflowTasks,
  type WorkflowDataClient,
} from './hrWorkflowInboxData';

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

const CATEGORY_I18N_KEY: Record<string, string> = {
  medical_exam: 'hr_workflow.cat_medical_exam',
  salary_advance: 'hr_workflow.cat_salary_advance',
  contract_amendment: 'hr_workflow.cat_contract_amendment',
  probation_review: 'hr_workflow.cat_probation_review',
  fixed_term_expiry: 'hr_workflow.cat_fixed_term_expiry',
  offboarding: 'hr_workflow.cat_offboarding',
  custom: 'hr_workflow.cat_custom',
};

const STATUS_META: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  open:        { variant: 'secondary' },
  in_progress: { variant: 'default' },
  completed:   { variant: 'outline' },
  cancelled:   { variant: 'destructive' },
};

const PRIORITY_META: Record<string, { color: string }> = {
  low:    { color: 'text-muted-foreground' },
  normal: { color: 'text-foreground' },
  high:   { color: 'text-amber-600' },
  urgent: { color: 'text-red-600 font-semibold' },
};

function dueDateClass(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isPast(d)) return 'text-red-600';
  if (isWithinInterval(d, { start: new Date(), end: addDays(new Date(), 3) })) return 'text-amber-600';
  return 'text-muted-foreground';
}

export function HRWorkflowInbox({ workspaceId, isAdmin, userId }: Props) {
  const t = useT();
  const dateFnsLocale = useDateLocale();
  const [instances, setInstances] = useState<InstanceRow[]>([]);
  const [tasksByInstance, setTasksByInstance] = useState<Record<string, Task[]>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('open');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [taskLoadingByInstance, setTaskLoadingByInstance] = useState<Record<string, boolean>>({});
  const [taskErrorsByInstance, setTaskErrorsByInstance] = useState<Record<string, boolean>>({});
  const [showStartDialog, setShowStartDialog] = useState(false);
  const loadRequestId = useRef(0);
  const taskLoadRequestSequence = useRef(0);
  const activeTaskLoadRequestIds = useRef<Record<string, number>>({});

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
    const requestId = ++loadRequestId.current;
    setLoading(true);
    setLoadError(false);
    try {
      const { data, error } = await fetchHRWorkflowInstances(
        supabase as unknown as WorkflowDataClient,
        workspaceId,
        isAdmin,
        statusFilter,
      );
      if (requestId !== loadRequestId.current) return;
      if (error) {
        setInstances([]);
        setLoadError(true);
        toast.error(t('hr_workflow.load_error'));
        return;
      }

      if (isAdmin) {
        setInstances((data as InstanceRow[]) || []);
      } else {
        const memberInstances = (data || []) as Array<
          Omit<InstanceRow, 'member_name' | 'total_tasks' | 'done_tasks'>
        >;
        setInstances(memberInstances.map((instance) => ({
          ...instance,
          member_name: t('hr_workflow.self_member'),
          total_tasks: 0,
          done_tasks: 0,
        })));
      }
    } catch {
      if (requestId !== loadRequestId.current) return;
      setInstances([]);
      setLoadError(true);
      toast.error(t('hr_workflow.load_error'));
    } finally {
      if (requestId === loadRequestId.current) setLoading(false);
    }
  }, [workspaceId, isAdmin, statusFilter, t]);

  useEffect(() => {
    loadInstances();
    return () => { loadRequestId.current += 1; };
  }, [loadInstances]);

  useEffect(() => {
    activeTaskLoadRequestIds.current = {};
    setTasksByInstance({});
    setTaskLoadingByInstance({});
    setTaskErrorsByInstance({});
    setOpenId(null);
    return () => { activeTaskLoadRequestIds.current = {}; };
  }, [workspaceId]);

  const loadTasks = async (instanceId: string, force = false) => {
    if (!force && tasksByInstance[instanceId] && !taskErrorsByInstance[instanceId]) return;
    if (!force && activeTaskLoadRequestIds.current[instanceId] !== undefined) return;
    const requestId = ++taskLoadRequestSequence.current;
    activeTaskLoadRequestIds.current[instanceId] = requestId;
    const isCurrentRequest = () => activeTaskLoadRequestIds.current[instanceId] === requestId;
    setTaskLoadingByInstance(prev => ({ ...prev, [instanceId]: true }));
    setTaskErrorsByInstance(prev => ({ ...prev, [instanceId]: false }));
    try {
      const { data, error } = await fetchHRWorkflowTasks(
        supabase as unknown as WorkflowDataClient,
        instanceId,
      );
      if (!isCurrentRequest()) return;
      if (error) {
        setTaskErrorsByInstance(prev => ({ ...prev, [instanceId]: true }));
        toast.error(t('hr_workflow.task_load_error'));
        return;
      }
      setTasksByInstance(prev => ({ ...prev, [instanceId]: (data as Task[]) || [] }));
    } catch {
      if (!isCurrentRequest()) return;
      setTaskErrorsByInstance(prev => ({ ...prev, [instanceId]: true }));
      toast.error(t('hr_workflow.task_load_error'));
    } finally {
      if (isCurrentRequest()) {
        delete activeTaskLoadRequestIds.current[instanceId];
        setTaskLoadingByInstance(prev => ({ ...prev, [instanceId]: false }));
      }
    }
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
    toast.success(status === 'completed' ? t('hr_workflow.toast_closed') : t('hr_workflow.toast_cancelled'));
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
      const nameMap = new Map((prof || []).map((p: any) => [p.user_id, p.display_name || t('hr_workflow.unknown_member')]));
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
    toast.success(t('hr_workflow.toast_started'));
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
          <Badge variant="secondary">{t('hr_workflow.active_count', { count: activeCount })}</Badge>
          {overdueCount > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />{t('hr_workflow.overdue_count', { count: overdueCount })}
            </Badge>
          )}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="open">{t('hr_workflow.status_open')}</SelectItem>
              <SelectItem value="in_progress">{t('hr_workflow.status_in_progress')}</SelectItem>
              <SelectItem value="completed">{t('hr_workflow.status_completed')}</SelectItem>
              <SelectItem value="cancelled">{t('hr_workflow.status_cancelled')}</SelectItem>
              <SelectItem value="all">{t('hr_workflow.filter_all')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={openStartDialog}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            {t('hr_workflow.start_workflow_btn')}
          </Button>
        )}
      </div>

      {loading && <p className="text-sm text-muted-foreground py-4">{t('hr_workflow.loading')}</p>}
      {!loading && loadError && (
        <Card role="alert">
          <CardContent className="py-6 text-center text-sm text-destructive space-y-3">
            <p>{t('hr_workflow.load_error')}</p>
            <Button size="sm" variant="outline" onClick={loadInstances}>
              {t('hr_workflow.retry')}
            </Button>
          </CardContent>
        </Card>
      )}
      {!loading && !loadError && instances.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {t('hr_workflow.empty_filter')}
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
                        {CATEGORY_I18N_KEY[inst.category] ? t(CATEGORY_I18N_KEY[inst.category] as any) : inst.category}
                      </Badge>
                      <Badge variant={sm.variant} className="text-xs">{t(`hr_workflow.status_${inst.status}` as any)}</Badge>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 mt-2 pl-6 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User2 className="h-3 w-3" />{inst.member_name}
                    </span>
                    {inst.due_date && (
                      <span className={`flex items-center gap-1 ${dueDateClass(inst.due_date)}`}>
                        <CalendarDays className="h-3 w-3" />
                        {t('hr_workflow.due_label')} {format(new Date(inst.due_date), 'MMM d.', { locale: dateFnsLocale })}
                      </span>
                    )}
                    {inst.total_tasks > 0 && (
                      <span>{t('hr_workflow.tasks_done_of_total', { done: inst.done_tasks, total: inst.total_tasks })}</span>
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
                    {taskLoadingByInstance[inst.id] ? (
                      <p className="text-xs text-muted-foreground" aria-live="polite">
                        {t('hr_workflow.loading')}
                      </p>
                    ) : taskErrorsByInstance[inst.id] ? (
                      <div role="alert" className="text-xs text-destructive flex items-center gap-2">
                        <span>{t('hr_workflow.task_load_error')}</span>
                        <Button size="sm" variant="outline" onClick={() => loadTasks(inst.id, true)}>
                          {t('hr_workflow.retry')}
                        </Button>
                      </div>
                    ) : (tasksByInstance[inst.id] || []).length > 0 ? (
                      <ul className="space-y-1.5">
                        {(tasksByInstance[inst.id] || []).map(task => (
                          <li key={task.id} className="flex items-start gap-2">
                            <button
                              className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors"
                              onClick={() => toggleTask(task, inst.id)}
                              disabled={!isAdmin && inst.status === 'completed'}
                              aria-label={task.status === 'done'
                                ? t('hr_workflow.task_mark_pending', { title: task.title })
                                : t('hr_workflow.task_mark_done', { title: task.title })}
                              aria-pressed={task.status === 'done'}
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
                      <p className="text-xs text-muted-foreground">{t('hr_workflow.no_tasks')}</p>
                    )}

                    {/* Admin actions */}
                    {isAdmin && ['open', 'in_progress'].includes(inst.status) && (
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" variant="outline" onClick={() => closeInstance(inst.id, 'completed')}>
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                          {t('hr_workflow.btn_close_action')}
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => closeInstance(inst.id, 'cancelled')}>
                          <XCircle className="h-3.5 w-3.5 mr-1.5" />
                          {t('hr_workflow.btn_cancel_action')}
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
            <DialogTitle>{t('hr_workflow.dialog_title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t('hr_workflow.label_template')}</Label>
              <Select value={fTemplateId} onValueChange={v => {
                setFTemplateId(v);
                const tpl = templates.find(x => x.id === v);
                if (tpl && !fTitle) setFTitle(tpl.name);
              }}>
                <SelectTrigger><SelectValue placeholder={t('hr_workflow.placeholder_select_template')} /></SelectTrigger>
                <SelectContent>
                  {templates.map(tpl => (
                    <SelectItem key={tpl.id} value={tpl.id}>{tpl.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('hr_workflow.label_title')}</Label>
              <Input value={fTitle} onChange={e => setFTitle(e.target.value)} placeholder={t('hr_workflow.placeholder_workflow_name')} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('hr_workflow.label_member')}</Label>
              <Select value={fMemberId} onValueChange={setFMemberId}>
                <SelectTrigger><SelectValue placeholder={t('hr_workflow.placeholder_select_member')} /></SelectTrigger>
                <SelectContent>
                  {members.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.display_name || m.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('hr_workflow.label_due')}</Label>
                <Input type="date" value={fDueDate} onChange={e => setFDueDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('hr_workflow.label_priority')}</Label>
                <Select value={fPriority} onValueChange={setFPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(PRIORITY_META).map(k => (
                      <SelectItem key={k} value={k}>{t(`hr_workflow.priority_${k}` as any)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t('hr_workflow.label_notes')}</Label>
              <Textarea value={fNotes} onChange={e => setFNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStartDialog(false)}>{t('hr_workflow.btn_dialog_cancel')}</Button>
            <Button onClick={startWorkflow} disabled={busy || !fTitle.trim()}>{t('hr_workflow.btn_dialog_start')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
