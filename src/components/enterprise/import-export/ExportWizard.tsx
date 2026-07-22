import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Lock, FileSpreadsheet, FileText, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { EntityConfig } from './config/entity-registry';
import { fetchEntityRows } from './utils/data-fetcher';
import { generateCSV, generateExcelXML, downloadFile } from './utils/file-parser';
import { buildTemplateGuidanceRow } from './utils/validator';
import { useI18n } from '@/i18n/I18nProvider';
import {
  executeEntityExport,
  type EntityExportAuditClient,
  type EntityExportDependencies,
  type EntityExportFormat,
} from './utils/entity-export';

interface Props {
  entity: EntityConfig;
  workspaceId: string;
  userId: string;
  onClose: () => void;
}

const exportAuditClient = supabase as unknown as EntityExportAuditClient;

const exportDependencies: EntityExportDependencies = {
  auditClient: exportAuditClient,
  fetchRows: fetchEntityRows,
  buildGuidanceRow: buildTemplateGuidanceRow,
  generateCsv: generateCSV,
  generateExcelXml: generateExcelXML,
  download: (artifact) => downloadFile(artifact.content, artifact.fileName, artifact.mimeType),
  now: () => new Date(),
};

export function ExportWizard({ entity, workspaceId, userId, onClose }: Props) {
  const { t } = useI18n();

  const exportableFields = useMemo(() => entity.fields.filter(f => f.exportable), [entity]);
  const requiredKeys = useMemo(() => exportableFields.filter(f => f.required && f.importable).map(f => f.key), [exportableFields]);

  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() =>
    new Set(exportableFields.filter(f => !f.computed).map(f => f.key))
  );
  const [format, setFormat] = useState<EntityExportFormat>('xls');
  const [importCompatible, setImportCompatible] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [busy, setBusy] = useState(false);
  const formatLabelId = useId();
  const statusFilterLabelId = useId();
  const activeOperationRef = useRef<symbol | null>(null);
  const mountedRef = useRef(false);
  const scopeKey = `${workspaceId}:${userId}:${entity.key}`;
  const latestScopeRef = useRef(scopeKey);
  latestScopeRef.current = scopeKey;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      activeOperationRef.current = null;
    };
  }, []);

  useEffect(() => {
    activeOperationRef.current = null;
    setBusy(false);
  }, [scopeKey]);

  // Group fields
  const groups = useMemo(() => {
    const m = new Map<string, typeof exportableFields>();
    exportableFields.forEach(f => {
      const g = f.group || t('export_wizard.other_group');
      if (!m.has(g)) m.set(g, []);
      m.get(g)!.push(f);
    });
    return Array.from(m.entries());
  }, [exportableFields, t]);

  const toggleField = (key: string) => {
    if (requiredKeys.includes(key)) return; // locked
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => setSelectedKeys(new Set(exportableFields.map(f => f.key)));
  const selectRequiredOnly = () => setSelectedKeys(new Set(requiredKeys));

  const handleExport = async () => {
    if (activeOperationRef.current) return;
    const operationToken = Symbol('entity-export');
    const operationScope = scopeKey;
    activeOperationRef.current = operationToken;
    setBusy(true);
    const isCurrent = () => (
      mountedRef.current
      && activeOperationRef.current === operationToken
      && latestScopeRef.current === operationScope
    );
    try {
      const result = await executeEntityExport({
        entity,
        workspaceId,
        userId,
        selectedKeys: [...selectedKeys],
        format,
        importCompatible,
        statusFilter,
      }, exportDependencies, isCurrent);
      if (!isCurrent()) return;
      toast.success(t('export_wizard.export_ready', { count: result.rowCount }));
      onClose();
    } catch {
      if (isCurrent()) toast.error(t('export_wizard.export_error'));
    } finally {
      if (activeOperationRef.current === operationToken) {
        activeOperationRef.current = null;
        if (mountedRef.current) setBusy(false);
      }
    }
  };

  return (
    <div className="space-y-4" aria-busy={busy}>
      <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
        <p className="font-medium">{t('import_export.export_label')} — {entity.label}</p>
        <p className="text-muted-foreground">{t('export_wizard.header_description')}</p>
      </div>

      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">{t('export_wizard.fields_label')}</Label>
        <div className="flex gap-1.5">
          <Button type="button" size="sm" variant="ghost" className="h-7 text-[11px]" onClick={selectAll}>{t('export_wizard.btn_select_all')}</Button>
          <Button type="button" size="sm" variant="ghost" className="h-7 text-[11px]" onClick={selectRequiredOnly}>{t('export_wizard.btn_required_only')}</Button>
        </div>
      </div>

      <div className="space-y-3 rounded-md border max-h-[40vh] overflow-y-auto p-3">
        {groups.map(([group, fields]) => (
          <div key={group} className="space-y-1.5">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{group}</p>
            <div className="space-y-1 pl-1">
              {fields.map(f => {
                const isLocked = requiredKeys.includes(f.key);
                const isChecked = selectedKeys.has(f.key);
                return (
                  <label key={f.key} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-accent/30 px-1.5 py-1 rounded">
                    <Checkbox checked={isChecked} disabled={isLocked} onCheckedChange={() => toggleField(f.key)} />
                    <span className="flex-1 flex items-center gap-1.5">
                      <span className={isLocked ? 'font-medium' : ''}>{f.label}</span>
                      <code className="text-[9px] text-muted-foreground">({f.key})</code>
                      {f.required && f.importable && <Badge variant="outline" className="h-4 text-[9px] px-1 border-warning text-warning gap-0.5"><Lock className="h-2 w-2" />{t('export_wizard.badge_required')}</Badge>}
                      {f.computed && <Badge variant="secondary" className="h-4 text-[9px] px-1">{t('export_wizard.badge_export_only')}</Badge>}
                      {f.protected && <Badge variant="outline" className="h-4 text-[9px] px-1 border-destructive text-destructive">{t('export_wizard.badge_protected')}</Badge>}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label id={formatLabelId} className="text-xs">{t('export_wizard.format_label')}</Label>
          <Select value={format} onValueChange={(value) => {
            if (value === 'csv' || value === 'xls') setFormat(value);
          }}>
            <SelectTrigger aria-labelledby={formatLabelId} className="mt-1 h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="xls"><span className="flex items-center gap-2"><FileSpreadsheet className="h-3.5 w-3.5" />Excel (.xls)</span></SelectItem>
              <SelectItem value="csv"><span className="flex items-center gap-2"><FileText className="h-3.5 w-3.5" />CSV (UTF-8)</span></SelectItem>
            </SelectContent>
          </Select>
        </div>
        {entity.key === 'leave' && (
          <div>
            <Label id={statusFilterLabelId} className="text-xs">{t('export_wizard.status_filter_label')}</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger aria-labelledby={statusFilterLabelId} className="mt-1 h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('export_wizard.status_all')}</SelectItem>
                <SelectItem value="approved">{t('export_wizard.status_approved')}</SelectItem>
                <SelectItem value="pending">{t('export_wizard.status_pending')}</SelectItem>
                <SelectItem value="rejected">{t('export_wizard.status_rejected')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <label className="flex items-start gap-2 text-xs cursor-pointer">
        <Checkbox checked={importCompatible} onCheckedChange={(v) => setImportCompatible(!!v)} />
        <div>
          <span className="font-medium">{t('export_wizard.import_compat_label')}</span>
          <p className="text-[11px] text-muted-foreground">{t('export_wizard.import_compat_desc')}</p>
        </div>
      </label>

      {importCompatible && (
        <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-2 text-[11px]">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-warning" />
          <span>{t('export_wizard.guidance_row_note')}</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-2 border-t">
        <p className="text-[11px] text-muted-foreground">{t('export_wizard.fields_selected', { count: selectedKeys.size })}</p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={busy}>{t('export_wizard.btn_cancel')}</Button>
          <Button type="button" size="sm" onClick={handleExport} disabled={busy || selectedKeys.size === 0}>
            {busy ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
            {busy ? t('export_wizard.btn_exporting') : t('export_wizard.btn_download')}
          </Button>
        </div>
      </div>
    </div>
  );
}
