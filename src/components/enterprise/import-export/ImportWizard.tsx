import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, FileText, AlertCircle, CheckCircle2, ArrowLeft, ArrowRight, Loader2, FileDown, AlertTriangle, X, Info, Sparkles, Database } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import type { EntityConfig } from './config/entity-registry';
import { fetchEntityRows } from './utils/data-fetcher';
import { generateCSV, generateExcelXML, downloadFile, parseUploadedFile } from './utils/file-parser';
import { autoMapColumns, validateRows, detectGuidanceRow, type ValidationSummary, type RowError } from './utils/validator';

interface Props {
  entity: EntityConfig;
  workspaceId: string;
  userId: string;
  onClose: () => void;
}

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7;
type ImportMode = 'create' | 'upsert';

interface ImportResultData {
  success: boolean;
  summary: { total: number; created: number; updated: number; skipped: number; failed: number };
  errors: { row_index: number; field: string; value: string; code: string; message: string }[];
}

export function ImportWizard({ entity, workspaceId, userId, onClose }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [file, setFile] = useState<File | null>(null);
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [validation, setValidation] = useState<ValidationSummary | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>('create');
  const [confirmed, setConfirmed] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResultData | null>(null);

  const importableFields = useMemo(() => entity.fields.filter(f => f.importable), [entity]);
  const requiredFieldKeys = useMemo(() => importableFields.filter(f => f.required).map(f => f.key), [importableFields]);

  const goNext = () => setStep((s) => Math.min(7, s + 1) as Step);
  const goBack = () => setStep((s) => Math.max(1, s - 1) as Step);

  // Map row arrays to row objects keyed by file header
  const rowObjects = useMemo<Record<string, string>[]>(() => {
    if (parsedHeaders.length === 0) return [];
    return parsedRows.map(r => {
      const o: Record<string, string> = {};
      parsedHeaders.forEach((h, i) => { o[h] = r[i] ?? ''; });
      return o;
    });
  }, [parsedHeaders, parsedRows]);

  // ===== Step 1: Instructions + Template =====

  const downloadBlankTemplate = () => {
    const fields = importableFields;
    const headers = fields.map(f => f.required ? `${f.key} *` : f.key);
    const guidance = fields.map(f => f.templateExample || (f.type === 'date' ? '(YYYY-MM-DD)' : f.type === 'enum' ? f.enumValues?.join(' | ') || '' : ''));
    const requiredFlags = fields.map(f => f.required);
    const xml = generateExcelXML(headers, [], { requiredFlags, guidanceRow: guidance, sheetName: entity.label });
    downloadFile(xml, `effectime_${entity.key}_sablon.xls`, 'application/vnd.ms-excel');
    toast.success('Üres sablon letöltve');
  };

  const downloadCurrentDataAsTemplate = async () => {
    try {
      const rows = await fetchEntityRows(entity, workspaceId);
      const fields = importableFields;
      const headers = fields.map(f => f.required ? `${f.key} *` : f.key);
      const guidance = fields.map(f => f.templateExample || '');
      const dataRows = rows.map(r => fields.map(f => r[f.key] ?? ''));
      const requiredFlags = fields.map(f => f.required);
      const xml = generateExcelXML(headers, dataRows, { requiredFlags, guidanceRow: guidance, sheetName: entity.label });
      downloadFile(xml, `effectime_${entity.key}_jelenlegi_adatok.xls`, 'application/vnd.ms-excel');
      toast.success(`${dataRows.length} sor letöltve sablon formátumban`);
    } catch (e: any) {
      toast.error(`Hiba: ${e?.message}`);
    }
  };

  // ===== Step 2: File Upload =====

  const handleFileSelect = async (f: File) => {
    if (f.size > 5 * 1024 * 1024) {
      toast.error('A fájl mérete túl nagy (max 5 MB)');
      return;
    }
    try {
      const parsed = await parseUploadedFile(f);
      if (parsed.headers.length === 0) {
        toast.error('A fájl üres vagy nincs fejléc sor');
        return;
      }
      if (parsed.rows.length > 2000) {
        toast.error(`Túl sok sor (${parsed.rows.length}). Maximum 2000 sor importálható.`);
        return;
      }
      setFile(f);
      setParsedHeaders(parsed.headers);
      setParsedRows(parsed.rows);
      // Auto-map columns
      const mapping = autoMapColumns(entity, parsed.headers);
      setColumnMapping(mapping);
      // Auto-detect and skip guidance row
      if (parsed.rows.length > 0) {
        const firstRowObj: Record<string, string> = {};
        parsed.headers.forEach((h, i) => { firstRowObj[h] = parsed.rows[0][i] ?? ''; });
        if (detectGuidanceRow(entity, mapping, firstRowObj)) {
          setParsedRows(parsed.rows.slice(1));
          toast.info('Útmutató sor automatikusan kihagyva');
        }
      }
      goNext();
    } catch (e: any) {
      toast.error(`Fájl olvasási hiba: ${e?.message || 'ismeretlen'}`);
    }
  };

  // ===== Step 3 → 4: Mapping → Validation =====

  const runValidation = () => {
    const v = validateRows(entity, rowObjects, columnMapping);
    setValidation(v);
    goNext();
  };

  const unmappedRequiredFields = useMemo(() => {
    const mapped = new Set(Object.values(columnMapping));
    return requiredFieldKeys.filter(k => !mapped.has(k));
  }, [columnMapping, requiredFieldKeys]);

  // ===== Step 6: Confirm + Submit =====

  const submitImport = async () => {
    if (!validation) return;
    setImporting(true);
    setResult(null);
    try {
      const validRowsData = validation.perRow.filter(r => r.status === 'valid').map(r => r.cleanedRow);
      const { data, error } = await supabase.functions.invoke('import-entity-data', {
        body: {
          workspace_id: workspaceId,
          entity: entity.key,
          mode: importMode,
          rows: validRowsData,
          dry_run: false,
        },
      });

      if (error) {
        toast.error(`Importálás meghiúsult: ${error.message}`);
        setResult({
          success: false,
          summary: { total: validRowsData.length, created: 0, updated: 0, skipped: 0, failed: validRowsData.length },
          errors: [{ row_index: -1, field: 'general', value: '', code: 'EDGE_FUNCTION_ERROR', message: error.message }],
        });
        setStep(7);
        return;
      }

      setResult(data as ImportResultData);
      setStep(7);
      const s = (data as any)?.summary;
      if (s?.created || s?.updated) toast.success(`Import kész: ${s.created} létrehozva, ${s.updated} frissítve`);
    } catch (e: any) {
      toast.error(`Hiba: ${e?.message}`);
      setResult({
        success: false,
        summary: { total: 0, created: 0, updated: 0, skipped: 0, failed: 0 },
        errors: [{ row_index: -1, field: 'general', value: '', code: 'CLIENT_ERROR', message: e?.message || 'unknown' }],
      });
      setStep(7);
    } finally {
      setImporting(false);
    }
  };

  const downloadErrorReport = () => {
    if (!validation && !result) return;
    const errors = result?.errors || validation?.errors || [];
    const headers = ['row_index', 'field', 'value', 'code', 'message'];
    const rows = errors.map(e => [String(e.row_index ?? ''), e.field || '', e.value || '', e.code || '', e.message || '']);
    const csv = generateCSV(headers, rows);
    downloadFile(csv, `effectime_${entity.key}_import_errors.csv`, 'text/csv;charset=utf-8');
  };

  const stepTitles: Record<Step, string> = {
    1: 'Útmutató és sablon',
    2: 'Fájl feltöltése',
    3: 'Oszlop-leképezés',
    4: 'Ellenőrzés',
    5: 'Importálási mód',
    6: 'Megerősítés',
    7: 'Eredmény',
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
            <p className="font-medium flex items-center gap-1.5"><Info className="h-3.5 w-3.5" />Hogyan működik</p>
            <ol className="list-decimal pl-4 space-y-1 text-muted-foreground">
              <li>Tölts le egy üres sablont vagy a jelenlegi adatokat sablon formátumban</li>
              <li>Excelben szerkeszd a fájlt — adj hozzá új sorokat</li>
              <li>Töltsd fel a fájlt (max 5 MB, 2000 sor)</li>
              <li>Ellenőrizd az oszlop-leképezést és a validációt</li>
              <li>Erősítsd meg az importálást</li>
            </ol>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button type="button" variant="outline" onClick={downloadBlankTemplate} className="justify-start text-xs h-auto py-3 flex-col items-start gap-1">
              <span className="flex items-center gap-1.5 font-semibold"><FileDown className="h-3.5 w-3.5" />Üres sablon letöltése</span>
              <span className="text-[11px] text-muted-foreground font-normal text-left">Új adatok hozzáadásához. Útmutató sorral.</span>
            </Button>
            <Button type="button" variant="outline" onClick={downloadCurrentDataAsTemplate} className="justify-start text-xs h-auto py-3 flex-col items-start gap-1">
              <span className="flex items-center gap-1.5 font-semibold"><Database className="h-3.5 w-3.5" />Jelenlegi adatok letöltése</span>
              <span className="text-[11px] text-muted-foreground font-normal text-left">Sablon formátumban — round-trip frissítéshez.</span>
            </Button>
          </div>
          <div className="rounded-md border-2 border-dashed p-6 text-center">
            <input id="ie-file-input" type="file" accept=".csv,.xls,.xlsx,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
            <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-xs mt-2">Ide ejtsd a fájlt vagy kattints a kiválasztáshoz</p>
            <p className="text-[10px] text-muted-foreground">CSV, .xls (Excel XML) — max 5 MB</p>
            <Button type="button" size="sm" className="mt-3" onClick={() => document.getElementById('ie-file-input')?.click()}>
              <Upload className="h-3.5 w-3.5 mr-1" />Fájl kiválasztása
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
              <p className="font-medium">Fájl betöltve: {file.name}</p>
              <p className="text-[11px] text-muted-foreground">{parsedHeaders.length} oszlop · {parsedRows.length} sor · {(file.size / 1024).toFixed(1)} KB</p>
            </div>
            <Button type="button" size="sm" variant="ghost" onClick={() => { setFile(null); setParsedHeaders([]); setParsedRows([]); setStep(1); }}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Column Mapping */}
      {step === 3 && (
        <div className="space-y-3">
          <div className="rounded-md border bg-muted/30 p-3 text-xs">
            <p className="font-medium flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" />Oszlop-leképezés</p>
            <p className="text-muted-foreground mt-1">A fájl oszlopait automatikusan megpróbáltuk leképezni. Ellenőrizd, és állítsd be a hiányzó kötelező mezőket.</p>
          </div>

          {unmappedRequiredFields.length > 0 && (
            <div className="rounded-md border-2 border-destructive bg-destructive/5 p-3 text-xs">
              <p className="font-medium text-destructive flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" />Hiányzó kötelező mezők</p>
              <ul className="list-disc pl-5 mt-1 text-destructive">
                {unmappedRequiredFields.map(k => {
                  const f = importableFields.find(x => x.key === k);
                  return <li key={k}>{f?.label || k} (<code>{k}</code>)</li>;
                })}
              </ul>
            </div>
          )}

          <ScrollArea className="max-h-[40vh]">
            <table className="w-full text-xs border rounded-md">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-2 font-medium">Fájl oszlop</th>
                  <th className="text-left p-2 font-medium">Rendszer mező</th>
                  <th className="text-left p-2 font-medium w-20">Státusz</th>
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
                        <Select value={mapped} onValueChange={(v) => setColumnMapping(prev => ({ ...prev, [h]: v }))}>
                          <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__ignore__"><span className="text-muted-foreground">— Figyelmen kívül hagyni —</span></SelectItem>
                            {importableFields.map(f => (
                              <SelectItem key={f.key} value={f.key}>
                                {f.label} {f.required && <span className="text-destructive">*</span>}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2">
                        {!isMapped && <Badge variant="secondary" className="text-[9px] h-4">Kihagyva</Badge>}
                        {isMapped && isRequired && <Badge variant="outline" className="text-[9px] h-4 border-warning text-warning">Kötelező</Badge>}
                        {isMapped && !isRequired && <Badge variant="outline" className="text-[9px] h-4 text-success border-success">Leképezve</Badge>}
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
              <p className="text-[10px] text-muted-foreground uppercase">Érvényes</p>
              <p className="text-lg font-bold text-success">{validation.validRows}</p>
            </CardContent></Card>
            <Card><CardContent className="p-2 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Figyelmeztetés</p>
              <p className="text-lg font-bold text-warning">{validation.warningRows}</p>
            </CardContent></Card>
            <Card><CardContent className="p-2 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Hibás</p>
              <p className="text-lg font-bold text-destructive">{validation.errorRows}</p>
            </CardContent></Card>
          </div>

          {validation.errors.length > 0 && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-1 max-h-32 overflow-y-auto text-xs">
              <p className="font-medium text-destructive">Talált hibák ({validation.errors.length}):</p>
              {validation.errors.slice(0, 30).map((e, i) => (
                <p key={i} className="text-[11px]">
                  <span className="text-muted-foreground">Sor {e.rowIndex + 1}</span> — <code>{e.field}</code>: {e.message}
                </p>
              ))}
              {validation.errors.length > 30 && <p className="text-[11px] text-muted-foreground">...és további {validation.errors.length - 30} hiba</p>}
            </div>
          )}

          <ScrollArea className="max-h-[35vh]">
            <table className="w-full text-[11px] border rounded-md">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="text-left p-1.5 w-10">#</th>
                  <th className="text-left p-1.5 w-16">Státusz</th>
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
                      <td className="p-1.5 text-muted-foreground">{rv.rowIndex + 1}</td>
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
            {validation.perRow.length > 100 && <p className="text-[11px] text-muted-foreground p-2">...első 100 sor megjelenítve, összesen {validation.perRow.length}</p>}
          </ScrollArea>

          {validation.errorRows > 0 && (
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={downloadErrorReport}>
                <FileDown className="h-3.5 w-3.5 mr-1" />Hibák letöltése (CSV)
              </Button>
              <p className="text-[11px] text-muted-foreground">A hibás sorok kijavítva újra-importálhatók.</p>
            </div>
          )}
        </div>
      )}

      {/* Step 5: Import Mode */}
      {step === 5 && (
        <div className="space-y-3">
          <Label className="text-xs">Importálási mód</Label>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setImportMode('create')}
              className={cn('w-full text-left rounded-md border p-3 text-xs transition',
                importMode === 'create' ? 'border-primary bg-primary/5 ring-2 ring-primary/30' : 'hover:bg-accent/30')}
            >
              <p className="font-medium">Csak új sorok</p>
              <p className="text-[11px] text-muted-foreground">A meglévő rekordok érintetlenek. Ha egy sor már létezik (azonos egyedi kulccsal), kihagyjuk.</p>
            </button>
            {entity.supportsUpsert && (
              <button
                type="button"
                onClick={() => setImportMode('upsert')}
                className={cn('w-full text-left rounded-md border p-3 text-xs transition',
                  importMode === 'upsert' ? 'border-primary bg-primary/5 ring-2 ring-primary/30' : 'hover:bg-accent/30')}
              >
                <p className="font-medium flex items-center gap-1.5">Frissítés is (upsert) <Badge variant="outline" className="h-4 text-[9px]">Visszafordíthatatlan</Badge></p>
                <p className="text-[11px] text-muted-foreground">A meglévő rekordokat is felülírjuk az importált értékekkel. A védett mezők (pl. user_id) sosem változnak.</p>
              </button>
            )}
          </div>
          {importMode === 'upsert' && (
            <div className="rounded-md border-warning border bg-warning/10 p-3 text-xs flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
              <span>Frissítés módban a meglévő rekordok adatai felülírásra kerülnek. Ez nem visszavonható.</span>
            </div>
          )}
          <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-0.5">
            <p>Egyedi kulcs(ok): <code className="text-[10px]">{entity.uniqueKeyFields.join(', ')}</code></p>
            <p className="text-muted-foreground">Ezek alapján azonosítjuk, hogy egy sor új-e vagy meglévő.</p>
          </div>
        </div>
      )}

      {/* Step 6: Confirm */}
      {step === 6 && validation && (
        <div className="space-y-3">
          <Card>
            <CardContent className="p-4 space-y-2">
              <p className="text-sm font-semibold">Összegzés</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Entitás:</span><span className="font-medium">{entity.label}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Mód:</span><span className="font-medium">{importMode === 'create' ? 'Csak új sorok' : 'Frissítés is'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Importálható:</span><span className="font-medium text-success">{validation.validRows} sor</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Kihagyandó (hibás):</span><span className="font-medium text-destructive">{validation.errorRows} sor</span></div>
              </div>
            </CardContent>
          </Card>
          <label className="flex items-start gap-2 text-xs cursor-pointer rounded-md border p-3 hover:bg-accent/30">
            <Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(!!v)} />
            <span>Megértem, hogy az importálás visszavonhatatlan adatbázis-módosítás. Ellenőriztem az adatokat.</span>
          </label>
        </div>
      )}

      {/* Step 7: Result */}
      {step === 7 && result && (
        <div className="space-y-3">
          <div className={cn('rounded-md border p-3 text-xs flex items-start gap-2',
            result.success !== false ? 'border-success/40 bg-success/10' : 'border-destructive/40 bg-destructive/10')}>
            {result.success !== false ? <CheckCircle2 className="h-4 w-4 text-success" /> : <AlertCircle className="h-4 w-4 text-destructive" />}
            <div>
              <p className="font-medium">{result.success !== false ? 'Importálás befejezve' : 'Importálás meghiúsult'}</p>
              <p className="text-[11px] text-muted-foreground">
                {result.summary.created} létrehozva · {result.summary.updated} frissítve · {result.summary.skipped} kihagyva · {result.summary.failed} hibás
              </p>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="space-y-2">
              <Button type="button" size="sm" variant="outline" onClick={downloadErrorReport}>
                <FileDown className="h-3.5 w-3.5 mr-1" />Hibák letöltése (CSV)
              </Button>
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 max-h-32 overflow-y-auto text-[11px]">
                {result.errors.slice(0, 20).map((e, i) => (
                  <p key={i}>Sor {e.row_index + 1} — {e.field}: {e.message}</p>
                ))}
                {result.errors.length > 20 && <p className="text-muted-foreground mt-1">...és további {result.errors.length - 20} hiba</p>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer navigation */}
      <div className="flex items-center justify-between gap-2 pt-3 border-t">
        <div>
          {step > 1 && step < 7 && (
            <Button type="button" variant="ghost" size="sm" onClick={goBack} disabled={importing}>
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />Vissza
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={importing}>
            {step === 7 ? 'Bezárás' : 'Mégsem'}
          </Button>
          {step === 3 && (
            <Button type="button" size="sm" onClick={runValidation} disabled={unmappedRequiredFields.length > 0}>
              Ellenőrzés <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          )}
          {step === 4 && validation && (
            <Button type="button" size="sm" onClick={goNext} disabled={validation.validRows === 0}>
              Tovább <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          )}
          {step === 5 && (
            <Button type="button" size="sm" onClick={goNext}>
              Tovább <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          )}
          {step === 6 && (
            <Button type="button" size="sm" onClick={submitImport} disabled={!confirmed || importing}>
              {importing ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
              {importing ? 'Importálás...' : 'Importálás indítása'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
