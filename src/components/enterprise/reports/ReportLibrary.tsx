import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useI18n } from '@/i18n/I18nProvider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Plus, Play, Pencil, Trash2, Pin, PinOff, BarChart3, FileText, Layers, Sparkles, CalendarClock } from 'lucide-react';
import { toast } from 'sonner';
import { ReportBuilder } from './ReportBuilder';
import { ReportRunner } from './ReportRunner';
import { ReportSchedulesManager } from './ReportSchedulesManager';
import { getReportTemplates, getDataSourceLabels, type ReportDataSource, type ReportChartType, type ReportConfig } from './reportTemplates';

export interface SavedReport {
  id: string;
  name: string;
  description: string | null;
  data_source: ReportDataSource;
  config: ReportConfig;
  chart_type: ReportChartType;
  is_template: boolean;
  is_shared: boolean;
  is_pinned: boolean;
  dashboard_slot?: number | null;
  widget_size?: 'small' | 'medium' | 'large' | null;
  dataset_key?: string | null;
  created_by: string;
  workspace_id: string;
  created_at: string;
  updated_at: string;
}

interface Props {
  workspaceId: string;
  userId: string;
}

export function ReportLibrary({ workspaceId, userId }: Props) {
  const { t } = useI18n();
  const REPORT_TEMPLATES = getReportTemplates(t);
  const DATA_SOURCE_LABELS = getDataSourceLabels(t);
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'mine' | 'shared' | 'templates' | 'pinned' | 'schedules'>('mine');
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<SavedReport | null>(null);
  const [runningReport, setRunningReport] = useState<SavedReport | null>(null);

  const fetchReports = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('enterprise_reports')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('updated_at', { ascending: false });
    if (error) {
      console.error('Fetch reports error:', error);
      toast.error(t('report_library.load_error'));
    } else {
      setReports((data as SavedReport[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchReports(); }, [workspaceId]);

  const handleDelete = async (id: string) => {
    if (!confirm(t('report_library.confirm_delete'))) return;
    const { error } = await (supabase as any).from('enterprise_reports').delete().eq('id', id);
    if (error) toast.error(t('report_library.delete_failed'));
    else { toast.success(t('report_library.deleted')); fetchReports(); }
  };

  const handlePin = async (r: SavedReport) => {
    const { error } = await (supabase as any).from('enterprise_reports').update({ is_pinned: !r.is_pinned }).eq('id', r.id);
    if (error) toast.error(t('report_library.action_failed'));
    else { toast.success(r.is_pinned ? t('report_library.unpinned') : t('report_library.pinned')); fetchReports(); }
  };

  const openBuilder = (report?: SavedReport) => {
    setEditingReport(report || null);
    setBuilderOpen(true);
  };

  const handleBuilderSaved = () => {
    setBuilderOpen(false);
    setEditingReport(null);
    fetchReports();
  };

  const myReports = reports.filter(r => r.created_by === userId && !r.is_template);
  const sharedReports = reports.filter(r => r.is_shared && r.created_by !== userId && !r.is_template);
  const pinnedReports = reports.filter(r => r.is_pinned);

  if (runningReport) {
    return (
      <ReportRunner
        report={runningReport}
        workspaceId={workspaceId}
        onBack={() => setRunningReport(null)}
        onEdit={() => { setEditingReport(runningReport); setRunningReport(null); setBuilderOpen(true); }}
      />
    );
  }

  if (builderOpen) {
    return (
      <ReportBuilder
        workspaceId={workspaceId}
        userId={userId}
        existing={editingReport}
        onCancel={() => { setBuilderOpen(false); setEditingReport(null); }}
        onSaved={handleBuilderSaved}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> {t('report_library.title')}
          </h3>
          <p className="text-xs text-muted-foreground">{t('report_library.description')}</p>
        </div>
        <Button size="sm" onClick={() => openBuilder()}>
          <Plus className="h-4 w-4 mr-1" /> {t('report_library.btn_new_report')}
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="flex w-full justify-start overflow-x-auto">
          <TabsTrigger value="mine" className="gap-1"><FileText className="h-3.5 w-3.5" /> {t('report_library.tab_mine')} ({myReports.length})</TabsTrigger>
          <TabsTrigger value="shared" className="gap-1"><Layers className="h-3.5 w-3.5" /> {t('report_library.tab_shared')} ({sharedReports.length})</TabsTrigger>
          <TabsTrigger value="pinned" className="gap-1"><Pin className="h-3.5 w-3.5" /> {t('report_library.tab_pinned')} ({pinnedReports.length})</TabsTrigger>
          <TabsTrigger value="templates" className="gap-1"><Sparkles className="h-3.5 w-3.5" /> {t('report_library.tab_templates')} ({REPORT_TEMPLATES.length})</TabsTrigger>
          <TabsTrigger value="schedules" className="gap-1"><CalendarClock className="h-3.5 w-3.5" /> {t('report_library.tab_schedules')}</TabsTrigger>
        </TabsList>

        <TabsContent value="mine" className="mt-3">
          <ReportGrid reports={myReports} loading={loading} onRun={setRunningReport} onEdit={openBuilder} onDelete={handleDelete} onPin={handlePin} canManage />
        </TabsContent>
        <TabsContent value="shared" className="mt-3">
          <ReportGrid reports={sharedReports} loading={loading} onRun={setRunningReport} onEdit={openBuilder} onDelete={handleDelete} onPin={handlePin} />
        </TabsContent>
        <TabsContent value="pinned" className="mt-3">
          <ReportGrid reports={pinnedReports} loading={loading} onRun={setRunningReport} onEdit={openBuilder} onDelete={handleDelete} onPin={handlePin} />
        </TabsContent>
        <TabsContent value="templates" className="mt-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {REPORT_TEMPLATES.map(tmpl => (
              <Card key={tmpl.id} className="hover:border-primary/40 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm">{tmpl.name}</CardTitle>
                    <Badge variant="outline" className="text-[10px]">{DATA_SOURCE_LABELS[tmpl.data_source]}</Badge>
                  </div>
                  <CardDescription className="text-xs">{tmpl.description}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setRunningReport({
                      id: 'template-' + tmpl.id,
                      name: tmpl.name,
                      description: tmpl.description,
                      data_source: tmpl.data_source,
                      config: tmpl.config,
                      chart_type: tmpl.chart_type,
                      is_template: true,
                      is_shared: false,
                      is_pinned: false,
                      created_by: userId,
                      workspace_id: workspaceId,
                      created_at: '',
                      updated_at: '',
                    })}
                  >
                    <Play className="h-3.5 w-3.5 mr-1" /> {t('report_library.btn_run')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openBuilder({
                      id: '',
                      name: tmpl.name + t('report_library.template_copy_suffix'),
                      description: tmpl.description,
                      data_source: tmpl.data_source,
                      config: tmpl.config,
                      chart_type: tmpl.chart_type,
                      is_template: false,
                      is_shared: false,
                      is_pinned: false,
                      created_by: userId,
                      workspace_id: workspaceId,
                      created_at: '',
                      updated_at: '',
                    })}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" /> {t('report_library.btn_from_template')}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="schedules" className="mt-3">
          <ReportSchedulesManager workspaceId={workspaceId} userId={userId} reports={reports.filter(r => !r.is_template)} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ReportGrid({ reports, loading, onRun, onEdit, onDelete, onPin, canManage }: {
  reports: SavedReport[];
  loading: boolean;
  onRun: (r: SavedReport) => void;
  onEdit: (r: SavedReport) => void;
  onDelete: (id: string) => void;
  onPin: (r: SavedReport) => void;
  canManage?: boolean;
}) {
  const { t } = useI18n();
  const DATA_SOURCE_LABELS = getDataSourceLabels(t);
  if (loading) return <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  if (reports.length === 0) {
    return (
      <Card><CardContent className="text-center py-10 text-muted-foreground text-sm">
        {t('report_library.empty_category')}
      </CardContent></Card>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {reports.map(r => (
        <Card key={r.id} className="hover:border-primary/40 transition-colors">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <BarChart3 className="h-3.5 w-3.5 text-primary" /> {r.name}
              </CardTitle>
              <div className="flex items-center gap-1">
                {r.is_pinned && <Pin className="h-3 w-3 text-primary" />}
                <Badge variant="outline" className="text-[10px]">{DATA_SOURCE_LABELS[r.data_source]}</Badge>
              </div>
            </div>
            {r.description && <CardDescription className="text-xs">{r.description}</CardDescription>}
          </CardHeader>
          <CardContent className="pt-0 flex flex-wrap gap-1.5">
            <Button size="sm" variant="outline" className="flex-1 min-w-0" onClick={() => onRun(r)}>
              <Play className="h-3.5 w-3.5 mr-1" /> {t('report_library.btn_run')}
            </Button>
            {canManage && (
              <>
                <Button size="sm" variant="ghost" onClick={() => onEdit(r)} title={t('report_library.btn_edit')}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onPin(r)} title={r.is_pinned ? t('report_library.btn_unpin') : t('report_library.btn_pin')}>
                  {r.is_pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onDelete(r.id)} title={t('report_library.btn_delete')}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
