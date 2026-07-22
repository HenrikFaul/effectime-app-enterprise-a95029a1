import { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, AlertCircle, CheckCircle2, ArrowLeft, ArrowRight, Loader2, FileDown, AlertTriangle, X, Info, Sparkles, Database } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import type { EntityConfig } from './config/entity-registry';
import { fetchEntityRows } from './utils/data-fetcher';
import { generateCSV, generateExcelXML, downloadFile, parseUploadedFile } from './utils/file-parser';
import {
  autoMapColumns,
  buildTemplateGuidanceRow,
  validateRows,
  detectGuidanceRow,
  getDuplicateMappedFieldKeys,
  getImportHeaderIssue,
  type ValidationSummary,
} from './utils/validator';
import { useI18n } from '@/i18n/I18nProvider';
import {
  invokeImportEntityData,
  type ImportEntityDataEntity,
  type ImportEntityDataOutcome,
} from '@/lib/importEntityDataApi';

interface Props {
  entity: EntityConfig;
  workspaceId: string;
  userId: string;
  onClose: () => void;
}

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7;
type ImportMode = 'create' | 'upsert';

export function ImportWizard({ entity, workspaceId, onClose }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [file, setFile] = useState<File | null>(null);
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<string[][]>([]);
  const [sourceRowOffset, setSourceRowOffset] = useState(0);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [validation, setValidation] = useState<ValidationSummary | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>('create');
  const [confirmed, setConfirmed] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportEntityDataOutcome | null>(null);
  const fileSelectionGeneration = useRef(0);
  const submissionInFlight = useRef(false);
  const { t } = useI18n();

  const importableFields = useMemo(() => entity.fields.filter(f => f.importable), [entity]);
  const requiredFieldKeys = useMemo(() => importableFields.filter(f => f.required).map(f => f.key), [importableFields]);

  const goNext = () => setStep((s) => Math.min(7, s + 1) as Step);
  const goBack = () => setStep((s) => Math.max(1, s - 1) as Step);

  const resetDerivedImportState = () => {
    setValidation(null);
    setConfirmed(false);
    setResult(null);
  };

  // Map row arrays to row objects keyed by file header
  const rowObjects = useMemo<Record<string, string>[]>(() => {
    if (parsedHeaders.length === 0) return [];
    return parsedRows.map(r => {
      const o = Object.create(null) as Record<string, string>;
      parsedHeaders.forEach((h, i) => { o[h] = r[i] ?? ''; });
      return o;
    });
  }, [parsedHeaders, parsedRows]);

  // ===== Step 1: Instructions + Template =====

  const downloadBlankTemplate = () => {
    const fields = importableFields;
    const headers = fields.map(f => f.required ? `${f.key} *` : f.key);
    const guidance = buildTemplateGuidanceRow(fields);
    const requiredFlags = fields.map(f => f.required);
    const xml = generateExcelXML(headers, [], { requiredFlags, guidanceRow: guidance, sheetName: entity.label });
    downloadFile(xml, `effectime_${entity.key}_sablon.xls`, 'application/vnd.ms-excel');
    toast.success(t('import_wizard.toast_blank_downloaded'));
  };

  const downloadCurrentDataAsTemplate = async () => {
    try {
      const rows = await fetchEntityRows(entity, workspaceId);
      const fields = importableFields;
      const headers = fields.map(f => f.required ? `${f.key} *` : f.key);
      const guidance = buildTemplateGuidanceRow(fields);
      const dataRows = rows.map(r => fields.map(f => r[f.key] ?? ''));
      const requiredFlags = fields.map(f => f.required);
      const xml = generateExcelXML(headers, dataRows, { requiredFlags, guidanceRow: guidance, sheetName: entity.label });
      downloadFile(xml, `effectime_${entity.key}_jelenlegi_adatok.xls`, 'application/vnd.ms-excel');
      toast.success(t('import_wizard.toast_data_downloaded', { count: dataRows.length }));
    } catch {
      toast.error(t('import_wizard.toast_error'));
    }
  };

  // ===== Step 2: File Upload =====

  const handleFileSelect = async (f: File) => {
    const selectionGeneration = ++fileSelectionGeneration.current;
    resetDerivedImportState();
    if (f.size > 5 * 1024 * 1024) {
      toast.error(t('import_wizard.toast_file_too_large'));
      return;
    }
    try {
      const parsed = await parseUploadedFile(f);
      if (selectionGeneration !== fileSelectionGeneration.current) return;
      if (parsed.headers.length === 0) {
        toast.error(t('import_wizard.toast_empty_file'));
        return;
      }
      if (getImportHeaderIssue(parsed.headers)) {
        toast.error(t('import_wizard.toast_invalid_headers'));
        return;
      }
      // Auto-map columns
      const mapping = autoMapColumns(entity, parsed.headers);
      // Auto-detect and skip guidance row
      let rows = parsed.rows;
      let rowOffset = 0;
      if (parsed.rows.length > 0) {
        const firstRowObj = Object.create(null) as Record<string, string>;
        parsed.headers.forEach((h, i) => { firstRowObj[h] = parsed.rows[0][i] ?? ''; });
        if (detectGuidanceRow(entity, mapping, firstRowObj)) {
          rows = parsed.rows.slice(1);
          rowOffset = 1;
          toast.info(t('import_wizard.toast_guidance_skipped'));
        }
      }
      if (rows.length > 2000) {
        toast.error(t('import_wizard.toast_too_many_rows', { count: rows.length }));
        return;
      }
      setFile(f);
      setParsedHeaders(parsed.headers);
      setColumnMapping(mapping);
      setParsedRows(rows);
      setSourceRowOffset(rowOffset);
      setStep(3);
    } catch {
      if (selectionGeneration !== fileSelectionGeneration.current) return;
      toast.error(t('import_wizard.toast_file_read_error'));
    }
  };

  const clearSelectedFile = () => {
    fileSelectionGeneration.current += 1;
    setFile(null);
    setParsedHeaders([]);
    setParsedRows([]);
    setSourceRowOffset(0);
    setColumnMapping({});
    resetDerivedImportState();
    setStep(1);
  };

  const updateColumnMapping = (header: string, field: string) => {
    setColumnMapping((previous) => ({ ...previous, [header]: field }));
    resetDerivedImportState();
  };

  // ===== Step 3 → 4: Mapping → Validation =====

  const runValidation = () => {
    const mapped = new Set(Object.values(columnMapping));
    if (
      requiredFieldKeys.some((fieldKey) => !mapped.has(fieldKey))
      || getDuplicateMappedFieldKeys(columnMapping).length > 0
    ) {
      return;
    }
    const v = validateRows(entity, rowObjects, columnMapping, sourceRowOffset);
    setValidation(v);
    setConfirmed(false);
    setResult(null);
    goNext();
  };

  const updateImportMode = (mode: ImportMode) => {
    setImportMode(mode);
    setConfirmed(false);
    setResult(null);
  };

  const unmappedRequiredFields = useMemo(() => {
    const mapped = new Set(Object.values(columnMapping));
    return requiredFieldKeys.filter(k => !mapped.has(k));
  }, [columnMapping, requiredFieldKeys]);
  const duplicateMappedFields = useMemo(
    () => getDuplicateMappedFieldKeys(columnMapping),
    [columnMapping],
  );

  // ===== Step 6: Confirm + Submit =====

  const submitImport = async () => {
    if (!validation || submissionInFlight.current) return;
    submissionInFlight.current = true;
    setImporting(true);
    setResult(null);
    try {
      const validRows = validation.perRow
        .filter((row) => row.status === 'valid')
        .map((row) => ({
          sourceRowIndex: row.rowIndex + sourceRowOffset,
          data: row.cleanedRow,
        }));
      const outcome = await invokeImportEntityData(
        (functionName, options) => supabase.functions.invoke(functionName, options),
        {
          workspaceId,
          entity: entity.key as ImportEntityDataEntity,
          mode: importMode,
          rows: validRows,
          dryRun: false,
        },
      );

      setResult(outcome);
      setStep(7);
      if (outcome.kind === 'completed') {
        if (outcome.summary.created || outcome.summary.updated) {
          toast.success(t('import_wizard.toast_import_success', {
            created: outcome.summary.created,
            updated: outcome.summary.updated,
          }));
        }
      } else {
        toast.error(t(outcome.outcomeUnknown
          ? 'import_wizard.toast_import_uncertain'
          : 'import_wizard.toast_import_failed'));
      }
    } catch {
      toast.error(t('import_wizard.toast_import_uncertain'));
      setResult({
        kind: 'failure',
        failureKind: 'network',
        serverCode: null,
        requestId: null,
        httpStatus: null,
        outcomeUnknown: true,
      });
      setStep(7);
    } finally {
      submissionInFlight.current = false;
      setImporting(false);
    }
  };

  const downloadErrorReport = () => {
    if (!validation && !result) return;
    const errors = result?.kind === 'completed' ? result.errors : validation?.errors || [];
    const headers = ['row_index', 'field', 'value', 'code', 'message'];
    const rows = errors.map((error) => [
      String('row_index' in error ? error.row_index : error.rowIndex + sourceRowOffset),
      error.field || '',
      error.value || '',
      error.code || '',
      error.message || '',
    ]);
    const csv = generateCSV(headers, rows);
    downloadFile(csv, `effectime_${entity.key}_import_errors.csv`, 'text/csv;charset=utf-8');
  };

  const stepTitles: Record<Step, string> = {
    1: t('import_wizard.step_instructions'),
    2: t('import_wizard.step_upload'),
    3: t('import_wizard.step_mapping'),
    4: t('import_wizard.step_validation'),
    5: t('import_wizard.step_mode'),
    6: t('import_wizard.step_confirm'),
    7: t('import_wizard.step_result'),
  };

  return (
    <div className="space-y-3">
      {/* Step indicator */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
          <div key={n} className={cn(
            'flex items-center gap-1 text-[10px] shrink-0 px-2 py-1 rounded-full',
            n === step ? 'bg-primary text-primary-foreground font-medium' :
            n < step ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
          )}>
            <span>{n}.</span>
            <span className="hidden sm:inline">{stepTitles[n as Step]}</span>
          </div>
        ))}
      </div>

      {/* Step 1: Instructions */}
      {step === 1 && (
        <div className="space-y-3">
          <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1.5">
            <p className="font-medium flex items-center gap-1.5"><Info className="h-3.5 w-3.5" />{t('import_wizard.how_it_works')}</p>
            <ol className="list-decimal pl-4 space-y-1 text-muted-foreground">
              <li>{t('import_wizard.instruction_1')}</li>
              <li>{t('import_wizard.instruction_2')}</li>
              <li>{t('import_wizard.instruction_3')}</li>
              <li>{t('import_wizard.instruction_4')}</li>
              <li>{t('import_wizard.instruction_5')}</li>
            </ol>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button type="button" variant="outline" onClick={downloadBlankTemplate} className="justify-start text-xs h-auto py-3 flex-col items-start gap-1">
              <span className="flex items-center gap-1.5 font-semibold"><FileDown className="h-3.5 w-3.5" />{t('import_wizard.btn_blank_template')}</span>
              <span className="text-[11px] text-muted-foreground font-normal text-left">{t('import_wizard.btn_blank_template_desc')}</span>
            </Button>
            <Button type="button" variant="outline" onClick={downloadCurrentDataAsTemplate} className="justify-start text-xs h-auto py-3 flex-col items-start gap-1">
              <span className="flex items-center gap-1.5 font-semibold"><Database className="h-3.5 w-3.5" />{t('import_wizard.btn_current_data')}</span>
              <span className="text-[11px] text-muted-foreground font-normal text-left">{t('import_wizard.btn_current_data_desc')}</span>
            </Button>
          </div>
          <div className="rounded-md border-2 border-dashed p-6 text-center">
            <input id="ie-file-input" type="file" accept=".csv,.xls,.xlsx,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
            <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-xs mt-2">{t('import_wizard.drop_hint')}</p>
            <p className="text-[10px] text-muted-foreground">{t('import_wizard.file_type_hint')}</p>
            <Button type="button" size="sm" className="mt-3" onClick={() => document.getElementById('ie-file-input')?.click()}>
              <Upload className="h-3.5 w-3.5 mr-1" />{t('import_wizard.btn_select_file')}
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: File preview (auto-skipped to Step 3 after upload, but rendered if user navigates back) */}
      {step === 2 && file && (
        <div className="space-y-3">
          <div className="rounded-md border bg-success/10 p-3 text-xs flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium">{t('import_wizard.file_loaded', { name: file.name })}</p>
              <p className="text-[11px] text-muted-foreground">{t('import_wizard.file_stats', { cols: parsedHeaders.length, rows: parsedRows.length, size: (file.size / 1024).toFixed(1) })}</p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-label={t('import_wizard.btn_remove_file')}
              onClick={clearSelectedFile}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Column Mapping */}
      {step === 3 && (
        <div className="space-y-3">
          <div className="rounded-md border bg-muted/30 p-3 text-xs">
            <p className="font-medium flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" />{t('import_wizard.mapping_title')}</p>
            <p className="text-muted-foreground mt-1">{t('import_wizard.mapping_desc')}</p>
          </div>

          {unmappedRequiredFields.length > 0 && (
            <div className="rounded-md border-2 border-destructive bg-destructive/5 p-3 text-xs">
              <p className="font-medium text-destructive flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" />{t('import_wizard.missing_required')}</p>
              <ul className="list-disc pl-5 mt-1 text-destructive">
                {unmappedRequiredFields.map(k => {
                  const f = importableFields.find(x => x.key === k);
                  return <li key={k}>{f?.label || k} (<code>{k}</code>)</li>;
                })}
              </ul>
            </div>
          )}

          {duplicateMappedFields.length > 0 && (
            <div className="rounded-md border-2 border-destructive bg-destructive/5 p-3 text-xs">
              <p className="font-medium text-destructive flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" />
                {t('import_wizard.duplicate_mapping', {
                  fields: duplicateMappedFields.join(', '),
                })}
              </p>
            </div>
          )}

          <ScrollArea className="max-h-[40vh]">
            <table className="w-full text-xs border rounded-md">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-2 font-medium">{t('import_wizard.col_file')}</th>
                  <th className="text-left p-2 font-medium">{t('import_wizard.col_system')}</th>
                  <th className="text-left p-2 font-medium w-20">{t('import_wizard.col_status')}</th>
                </tr>
              </thead>
              <tbody>
                {parsedHeaders.map(h => {
                  const mapped = columnMapping[h] || '__ignore__';
                  const isMapped = mapped !== '__ignore__';
                  const isRequired = isMapped && requiredFieldKeys.includes(mapped);
                  return (
                    <tr key={h} className="border-t">
                      <td className="p-2"><code className="text-[11px]">{h}</code></td>
                      <td className="p-2">
                        <Select value={mapped} onValueChange={(v) => updateColumnMapping(h, v)}>
                          <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__ignore__"><span className="text-muted-foreground">{t('import_wizard.opt_ignore')}</span></SelectItem>
                            {importableFields.map(f => (
                              <SelectItem key={f.key} value={f.key}>
                                {f.label} {f.required && <span className="text-destructive">*</span>}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2">
                        {!isMapped && <Badge variant="secondary" className="text-[9px] h-4">{t('import_wizard.badge_skipped')}</Badge>}
                        {isMapped && isRequired && <Badge variant="outline" className="text-[9px] h-4 border-warning text-warning">{t('import_wizard.badge_required')}</Badge>}
                        {isMapped && !isRequired && <Badge variant="outline" className="text-[9px] h-4 text-success border-success">{t('import_wizard.badge_mapped')}</Badge>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollArea>
        </div>
      )}

      {/* Step 4: Validation Preview */}
      {step === 4 && validation && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <Card><CardContent className="p-2 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">{t('import_wizard.label_valid')}</p>
              <p className="text-lg font-bold text-success">{validation.validRows}</p>
            </CardContent></Card>
            <Card><CardContent className="p-2 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">{t('import_wizard.label_warnings')}</p>
              <p className="text-lg font-bold text-warning">{validation.warningRows}</p>
            </CardContent></Card>
            <Card><CardContent className="p-2 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">{t('import_wizard.label_errors')}</p>
              <p className="text-lg font-bold text-destructive">{validation.errorRows}</p>
            </CardContent></Card>
          </div>

          {validation.errors.length > 0 && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-1 max-h-32 overflow-y-auto text-xs">
              <p className="font-medium text-destructive">{t('import_wizard.errors_found', { count: validation.errors.length })}</p>
              {validation.errors.slice(0, 30).map((e, i) => (
                <p key={i} className="text-[11px]">
                  <span className="text-muted-foreground">{t('import_wizard.row_ref', { n: e.rowIndex + sourceRowOffset + 1 })}</span> — <code>{e.field}</code>: {e.message}
                </p>
              ))}
              {validation.errors.length > 30 && <p className="text-[11px] text-muted-foreground">{t('import_wizard.more_errors', { count: validation.errors.length - 30 })}</p>}
            </div>
          )}

          <ScrollArea className="max-h-[35vh]">
            <table className="w-full text-[11px] border rounded-md">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="text-left p-1.5 w-10">#</th>
                  <th className="text-left p-1.5 w-16">{t('import_wizard.col_status')}</th>
                  {Object.entries(columnMapping).filter(([, k]) => k !== '__ignore__').map(([h, k]) => (
                    <th key={h} className="text-left p-1.5">
                      <span className="font-medium">{importableFields.find(f => f.key === k)?.label || k}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {validation.perRow.slice(0, 100).map((rv, idx) => {
                  const errMap = new Map(rv.errors.map(e => [e.field, e.message]));
                  return (
                    <tr key={idx} className={cn('border-t',
                      rv.status === 'error' && 'bg-destructive/5',
                      rv.status === 'warning' && 'bg-warning/5',
                    )}>
                      <td className="p-1.5 text-muted-foreground">{rv.rowIndex + sourceRowOffset + 1}</td>
                      <td className="p-1.5">
                        {rv.status === 'valid' && <CheckCircle2 className="h-3 w-3 text-success" />}
                        {rv.status === 'warning' && <AlertTriangle className="h-3 w-3 text-warning" />}
                        {rv.status === 'error' && <AlertCircle className="h-3 w-3 text-destructive" />}
                      </td>
                      {Object.entries(columnMapping).filter(([, k]) => k !== '__ignore__').map(([h, k]) => {
                        const err = errMap.get(k);
                        return (
                          <td key={h} className={cn('p-1.5 truncate max-w-[140px]', err && 'text-destructive font-medium')} title={err || ''}>
                            {rowObjects[rv.rowIndex]?.[h] || ''}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {validation.perRow.length > 100 && <p className="text-[11px] text-muted-foreground p-2">{t('import_wizard.preview_rows', { total: validation.perRow.length })}</p>}
          </ScrollArea>

          {validation.errorRows > 0 && (
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={downloadErrorReport}>
                <FileDown className="h-3.5 w-3.5 mr-1" />{t('import_wizard.btn_download_errors')}
              </Button>
              <p className="text-[11px] text-muted-foreground">{t('import_wizard.errors_can_fix')}</p>
            </div>
          )}
        </div>
      )}

      {/* Step 5: Import Mode */}
      {step === 5 && (
        <div className="space-y-3">
          <Label className="text-xs">{t('import_wizard.mode_label')}</Label>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => updateImportMode('create')}
              aria-pressed={importMode === 'create'}
              className={cn('w-full text-left rounded-md border p-3 text-xs transition',
                importMode === 'create' ? 'border-primary bg-primary/5 ring-2 ring-primary/30' : 'hover:bg-accent/30')}
            >
              <p className="font-medium">{t('import_wizard.mode_create_title')}</p>
              <p className="text-[11px] text-muted-foreground">{t('import_wizard.mode_create_desc')}</p>
            </button>
            {entity.supportsUpsert && (
              <button
                type="button"
                onClick={() => updateImportMode('upsert')}
                aria-pressed={importMode === 'upsert'}
                className={cn('w-full text-left rounded-md border p-3 text-xs transition',
                  importMode === 'upsert' ? 'border-primary bg-primary/5 ring-2 ring-primary/30' : 'hover:bg-accent/30')}
              >
                <p className="font-medium flex items-center gap-1.5">{t('import_wizard.mode_upsert_title')} <Badge variant="outline" className="h-4 text-[9px]">{t('import_wizard.mode_upsert_badge')}</Badge></p>
                <p className="text-[11px] text-muted-foreground">{t('import_wizard.mode_upsert_desc')}</p>
              </button>
            )}
          </div>
          {importMode === 'upsert' && (
            <div className="rounded-md border-warning border bg-warning/10 p-3 text-xs flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
              <span>{t('import_wizard.mode_upsert_warning')}</span>
            </div>
          )}
          <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-0.5">
            <p>{t('import_wizard.unique_key_label')} <code className="text-[10px]">{entity.uniqueKeyFields.join(', ')}</code></p>
            <p className="text-muted-foreground">{t('import_wizard.unique_key_desc')}</p>
          </div>
        </div>
      )}

      {/* Step 6: Confirm */}
      {step === 6 && validation && (
        <div className="space-y-3">
          <Card>
            <CardContent className="p-4 space-y-2">
              <p className="text-sm font-semibold">{t('import_wizard.summary_title')}</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">{t('import_wizard.summary_entity')}</span><span className="font-medium">{entity.label}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t('import_wizard.summary_mode')}</span><span className="font-medium">{importMode === 'create' ? t('import_wizard.mode_create_short') : t('import_wizard.mode_upsert_short')}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t('import_wizard.summary_importable')}</span><span className="font-medium text-success">{t('import_wizard.summary_rows', { n: validation.validRows })}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t('import_wizard.summary_invalid')}</span><span className="font-medium text-destructive">{t('import_wizard.summary_rows', { n: validation.errorRows })}</span></div>
              </div>
            </CardContent>
          </Card>
          <label className="flex items-start gap-2 text-xs cursor-pointer rounded-md border p-3 hover:bg-accent/30">
            <Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(!!v)} />
            <span>{t('import_wizard.confirm_text')}</span>
          </label>
        </div>
      )}

      {/* Step 7: Result */}
      {step === 7 && result?.kind === 'completed' && (
        <div className="space-y-3">
          <div
            className="rounded-md border border-success/40 bg-success/10 p-3 text-xs flex items-start gap-2"
            role="status"
            aria-live="polite"
          >
            <CheckCircle2 className="h-4 w-4 text-success" />
            <div>
              <p className="font-medium">{t('import_wizard.result_success')}</p>
              <p className="text-[11px] text-muted-foreground">
                {t('import_wizard.result_summary', { created: result.summary.created, updated: result.summary.updated, skipped: result.summary.skipped, failed: result.summary.failed })}
              </p>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="space-y-2">
              <Button type="button" size="sm" variant="outline" onClick={downloadErrorReport}>
                <FileDown className="h-3.5 w-3.5 mr-1" />{t('import_wizard.btn_download_errors')}
              </Button>
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 max-h-32 overflow-y-auto text-[11px]">
                {result.errors.slice(0, 20).map((e, i) => (
                  <p key={i}>{t('import_wizard.row_ref', { n: e.row_index + 1 })} — {e.field}: {e.message}</p>
                ))}
                {result.errors.length > 20 && <p className="text-muted-foreground mt-1">{t('import_wizard.more_result_errors', { count: result.errors.length - 20 })}</p>}
              </div>
            </div>
          )}
        </div>
      )}

      {step === 7 && result?.kind === 'failure' && (
        <div
          role="alert"
          className={cn(
            'rounded-md border p-3 text-xs flex items-start gap-2',
            result.outcomeUnknown
              ? 'border-warning/40 bg-warning/10'
              : 'border-destructive/40 bg-destructive/10',
          )}
        >
          <AlertCircle className={cn(
            'h-4 w-4 shrink-0',
            result.outcomeUnknown ? 'text-warning' : 'text-destructive',
          )} />
          <div className="space-y-1">
            <p className="font-medium">
              {t(result.outcomeUnknown
                ? 'import_wizard.result_uncertain'
                : 'import_wizard.result_failed')}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {t(result.outcomeUnknown
                ? 'import_wizard.result_uncertain_description'
                : 'import_wizard.result_failed_description')}
            </p>
            {result.serverCode && (
              <p className="text-[11px] font-mono">
                {t('import_wizard.support_code', { code: result.serverCode })}
              </p>
            )}
            {result.requestId && (
              <p className="text-[11px] font-mono">
                {t('import_wizard.support_reference', { requestId: result.requestId })}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Footer navigation */}
      <div className="flex items-center justify-between gap-2 pt-3 border-t">
        <div>
          {step > 1 && step < 7 && (
            <Button type="button" variant="ghost" size="sm" onClick={goBack} disabled={importing}>
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />{t('import_wizard.btn_back')}
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={importing}>
            {step === 7 ? t('import_wizard.btn_close') : t('import_wizard.btn_cancel')}
          </Button>
          {step === 2 && (
            <Button type="button" size="sm" onClick={goNext}>
              {t('import_wizard.btn_next')} <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          )}
          {step === 3 && (
            <Button
              type="button"
              size="sm"
              onClick={runValidation}
              disabled={unmappedRequiredFields.length > 0 || duplicateMappedFields.length > 0}
            >
              {t('import_wizard.btn_validate')} <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          )}
          {step === 4 && validation && (
            <Button type="button" size="sm" onClick={goNext} disabled={validation.validRows === 0}>
              {t('import_wizard.btn_next')} <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          )}
          {step === 5 && (
            <Button type="button" size="sm" onClick={goNext}>
              {t('import_wizard.btn_next')} <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          )}
          {step === 6 && (
            <Button type="button" size="sm" onClick={submitImport} disabled={!confirmed || importing}>
              {importing ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
              {importing ? t('import_wizard.btn_importing') : t('import_wizard.btn_start_import')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
