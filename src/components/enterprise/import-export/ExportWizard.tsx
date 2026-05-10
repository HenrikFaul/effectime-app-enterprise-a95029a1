import { useMemo, useState } from 'react';
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

interface Props {
  entity: EntityConfig;
  workspaceId: string;
  userId: string;
  onClose: () => void;
}

type FileFormat = 'xlsx' | 'csv';

export function ExportWizard({ entity, workspaceId, userId, onClose }: Props) {
  const exportableFields = useMemo(() => entity.fields.filter(f => f.exportable), [entity]);
  const requiredKeys = useMemo(() => exportableFields.filter(f => f.required && f.importable).map(f => f.key), [exportableFields]);

  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() =>
    new Set(exportableFields.filter(f => !f.computed).map(f => f.key))
  );
  const [format, setFormat] = useState<FileFormat>('xlsx');
  const [importCompatible, setImportCompatible] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [busy, setBusy] = useState(false);

  // Group fields
  const groups = useMemo(() => {
    const m = new Map<string, typeof exportableFields>();
    exportableFields.forEach(f => {
      const g = f.group || 'Egyéb';
      if (!m.has(g)) m.set(g, []);
      m.get(g)!.push(f);
    });
    return Array.from(m.entries());
  }, [exportableFields]);

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
    setBusy(true);
    try {
      const filters = entity.key === 'leave' ? { statusFilter } : undefined;
      const rows = await fetchEntityRows(entity, workspaceId, filters);

      const fields = exportableFields.filter(f => selectedKeys.has(f.key));
      // Headers: machine keys + asterisk for required
      const headers = fields.map(f => importCompatible && f.required ? `${f.key} *` : f.key);
      const dataRows = rows.map(r => fields.map(f => r[f.key] ?? ''));

      const guidanceRow = importCompatible
        ? fields.map(f => f.templateExample || (f.type === 'date' ? '(YYYY-MM-DD)' : f.type === 'boolean' ? 'true/false' : ''))
        : undefined;

      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const fileName = `effectime_${entity.key}_${dateStr}`;

      if (format === 'csv') {
        const allRows = guidanceRow ? [guidanceRow, ...dataRows] : dataRows;
        const csv = generateCSV(headers, allRows);
        downloadFile(csv, `${fileName}.csv`, 'text/csv;charset=utf-8');
      } else {
        const requiredFlags = fields.map(f => f.required && f.importable);
        const xml = generateExcelXML(headers, dataRows, {
          requiredFlags,
          guidanceRow,
          sheetName: entity.label,
        });
        downloadFile(xml, `${fileName}.xls`, 'application/vnd.ms-excel');
      }

      // Audit
      await (supabase as any).from('enterprise_audit_events').insert({
        workspace_id: workspaceId,
        actor_id: userId,
        action: 'export.created',
        metadata: {
          entity: entity.key,
          field_count: fields.length,
          row_count: dataRows.length,
          format,
          import_compatible: importCompatible,
        },
      });

      toast.success(`${entity.label} export kész — ${dataRows.length} sor`);
      onClose();
    } catch (e: any) {
      toast.error(`Export hiba: ${e?.message || 'ismeretlen'}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
        <p className="font-medium">Export — {entity.label}</p>
        <p className="text-muted-foreground">Válaszd ki, mely mezőket szeretnéd exportálni. A kötelező mezők zárolva vannak (importhoz szükségesek).</p>
      </div>

      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">Mezők</Label>
        <div className="flex gap-1.5">
          <Button type="button" size="sm" variant="ghost" className="h-7 text-[11px]" onClick={selectAll}>Összes</Button>
          <Button type="button" size="sm" variant="ghost" className="h-7 text-[11px]" onClick={selectRequiredOnly}>Csak kötelező</Button>
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
                      {f.required && f.importable && <Badge variant="outline" className="h-4 text-[9px] px-1 border-warning text-warning gap-0.5"><Lock className="h-2 w-2" />Kötelező</Badge>}
                      {f.computed && <Badge variant="secondary" className="h-4 text-[9px] px-1">Csak export</Badge>}
                      {f.protected && <Badge variant="outline" className="h-4 text-[9px] px-1 border-destructive text-destructive">Védett</Badge>}
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
          <Label className="text-xs">Formátum</Label>
          <Select value={format} onValueChange={(v: any) => setFormat(v)}>
            <SelectTrigger className="mt-1 h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="xlsx"><span className="flex items-center gap-2"><FileSpreadsheet className="h-3.5 w-3.5" />Excel (.xls)</span></SelectItem>
              <SelectItem value="csv"><span className="flex items-center gap-2"><FileText className="h-3.5 w-3.5" />CSV (UTF-8)</span></SelectItem>
            </SelectContent>
          </Select>
        </div>
        {entity.key === 'leave' && (
          <div>
            <Label className="text-xs">Státusz szűrő</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="mt-1 h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Összes</SelectItem>
                <SelectItem value="approved">Csak jóváhagyott</SelectItem>
                <SelectItem value="pending">Csak függőben</SelectItem>
                <SelectItem value="rejected">Csak elutasított</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <label className="flex items-start gap-2 text-xs cursor-pointer">
        <Checkbox checked={importCompatible} onCheckedChange={(v) => setImportCompatible(!!v)} />
        <div>
          <span className="font-medium">Import-kompatibilis sablon</span>
          <p className="text-[11px] text-muted-foreground">Hozzáadunk egy második útmutató sort példa értékekkel, és a kötelező oszlopokat csillaggal jelöljük. Ezzel a fájllal közvetlenül importálni lehet új sorokat.</p>
        </div>
      </label>

      {importCompatible && (
        <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-2 text-[11px]">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-warning" />
          <span>A 2. sor (útmutató sor) nem adat — automatikusan kihagyjuk importnál.</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-2 border-t">
        <p className="text-[11px] text-muted-foreground">{selectedKeys.size} mező kiválasztva</p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={busy}>Mégsem</Button>
          <Button type="button" size="sm" onClick={handleExport} disabled={busy || selectedKeys.size === 0}>
            {busy ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1" />}
            {busy ? 'Exportálás...' : 'Letöltés'}
          </Button>
        </div>
      </div>
    </div>
  );
}
