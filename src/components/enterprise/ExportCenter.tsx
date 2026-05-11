import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Download, FileSpreadsheet } from 'lucide-react';
import { format, eachDayOfInterval } from 'date-fns';
import { hu } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useI18n } from '@/i18n/I18nProvider';

interface Props {
  workspaceId: string;
  userId: string;
}

export function ExportCenter({ workspaceId, userId }: Props) {
  const { t } = useI18n();

  const TYPE_MAP: Record<string, string> = {
    vacation: t('leave_request.type_vacation'),
    sick_leave: t('leave_request.type_sick_leave'),
    unpaid_leave: t('leave_request.type_unpaid_leave'),
    other: t('leave_request.type_other'),
  };
  const STATUS_MAP: Record<string, string> = {
    pending: t('leave_request.status_pending'),
    approved: t('leave_request.status_approved'),
    rejected: t('leave_request.status_rejected'),
    cancelled: t('leave_request.status_cancelled'),
    expired: t('leave_request.status_expired'),
    draft: t('leave_request.status_draft'),
  };
  const DOW = t('export_center.dow').split(',');

  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [statusFilter, setStatusFilter] = useState('all');
  const [exportFormat, setExportFormat] = useState('csv');
  const [teamFilter, setTeamFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [exporting, setExporting] = useState(false);
  const [teams, setTeams] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>([]);

  // Fetch filter options on first interaction
  const loadFilterOptions = async () => {
    if (teams.length > 0) return;
    const { data } = await supabase.from('enterprise_memberships').select('team, business_role').eq('workspace_id', workspaceId).eq('status', 'active' as any);
    const teamSet = new Set<string>();
    const r = new Set<string>();
    (data || []).forEach((m: any) => { if (m.team) teamSet.add(m.team); if (m.business_role) r.add(m.business_role); });
    setTeams(Array.from(teamSet).sort());
    setRoles(Array.from(r).sort());
  };

  const handleExport = async () => {
    if (!startDate || !endDate) { toast.error(t('export_center.toast_no_date')); return; }
    setExporting(true);

    let query = supabase
      .from('leave_requests')
      .select('*')
      .eq('workspace_id', workspaceId)
      .gte('start_date', format(startDate, 'yyyy-MM-dd'))
      .lte('end_date', format(endDate, 'yyyy-MM-dd'))
      .order('start_date');

    if (statusFilter !== 'all') query = query.eq('status', statusFilter as any);

    const { data: requests } = await query;

    // Fetch profiles & memberships
    const userIds = [...new Set((requests || []).map((r: any) => r.user_id))];
    let profiles: Record<string, string> = {};
    let memberInfo: Record<string, { team: string | null; role: string | null }> = {};
    if (userIds.length > 0) {
      const [{ data: profileData }, { data: memberData }] = await Promise.all([
        supabase.from('profiles').select('user_id, display_name').in('user_id', userIds),
        supabase.from('enterprise_memberships').select('user_id, team, business_role').eq('workspace_id', workspaceId).in('user_id', userIds),
      ]);
      (profileData || []).forEach((p: any) => { profiles[p.user_id] = p.display_name || t('export_center.unknown_person'); });
      (memberData || []).forEach((m: any) => { memberInfo[m.user_id] = { team: m.team, role: m.business_role }; });
    }

    // Apply team/role filters
    let filteredRequests = requests || [];
    if (teamFilter !== 'all') filteredRequests = filteredRequests.filter((r: any) => memberInfo[r.user_id]?.team === teamFilter);
    if (roleFilter !== 'all') filteredRequests = filteredRequests.filter((r: any) => memberInfo[r.user_id]?.role === roleFilter);

    // Fetch holidays & company leave days
    const [{ data: holidays }, { data: companyDays }] = await Promise.all([
      supabase.from('enterprise_holidays').select('holiday_date, name').eq('workspace_id', workspaceId),
      supabase.from('enterprise_company_leave_days').select('leave_date, name').eq('workspace_id', workspaceId),
    ]);
    const holidayMap = new Map((holidays || []).map((h: any) => [h.holiday_date, h.name]));
    const companyDayMap = new Map((companyDays || []).map((c: any) => [c.leave_date, c.name]));

    // Build rows
    const headers = [
      t('export_center.col_date'),
      t('export_center.col_day'),
      t('export_center.col_name'),
      t('export_center.col_team'),
      t('export_center.col_position'),
      t('export_center.col_type'),
      t('export_center.col_status'),
      t('export_center.col_half_day'),
      t('export_center.col_holiday'),
      t('export_center.col_company_day'),
      t('export_center.col_comment'),
    ];
    const rows: string[][] = [];

    const allDays = eachDayOfInterval({ start: startDate, end: endDate });
    for (const day of allDays) {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayName = DOW[day.getDay()];
      const holiday = holidayMap.get(dateStr) || '';
      const companyDay = companyDayMap.get(dateStr) || '';

      const dayRequests = filteredRequests.filter((r: any) => r.start_date <= dateStr && r.end_date >= dateStr);

      if (dayRequests.length === 0) {
        rows.push([dateStr, dayName, '', '', '', '', '', '', holiday, companyDay, '']);
      } else {
        for (const req of dayRequests) {
          const mi = memberInfo[req.user_id] || { team: '', role: '' };
          const halfDay = req.is_half_day ? (req.half_day_period === 'morning' ? t('leave_request.half_day_morning') : t('leave_request.half_day_afternoon')) : '';
          rows.push([
            dateStr, dayName,
            profiles[req.user_id] || t('export_center.unknown_person'),
            mi.team || '', mi.role || '',
            TYPE_MAP[req.leave_type] || req.leave_type,
            STATUS_MAP[req.status] || req.status,
            halfDay, holiday, companyDay,
            req.comment || '',
          ]);
        }
      }
    }

    // Generate file based on format
    const fileName = `syncfolk_export_${format(startDate, 'yyyyMMdd')}_${format(endDate, 'yyyyMMdd')}`;

    if (exportFormat === 'csv') {
      downloadCSV(headers, rows, fileName);
    } else if (exportFormat === 'xlsx') {
      downloadXLSX(headers, rows, fileName);
    } else if (exportFormat === 'xml') {
      downloadXML(headers, rows, fileName);
    } else if (exportFormat === 'html') {
      downloadHTML(headers, rows, fileName, startDate, endDate,
        t('export_center.html_title'),
        t('export_center.html_date_rows', { start: format(startDate, 'yyyy.MM.dd'), end: format(endDate, 'yyyy.MM.dd'), rows: rows.length })
      );
    }

    await supabase.from('enterprise_audit_events').insert({
      workspace_id: workspaceId, actor_id: userId, action: 'export.created',
      metadata: { start_date: format(startDate, 'yyyy-MM-dd'), end_date: format(endDate, 'yyyy-MM-dd'), row_count: rows.length, format: exportFormat },
    });

    toast.success(t('export_center.toast_export_done', { rows: rows.length, format: exportFormat.toUpperCase() }));
    setExporting(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <FileSpreadsheet className="h-4 w-4" />
        <h3 className="text-sm font-semibold">Export</h3>
      </div>

      <Card>
        <CardContent className="py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">{t('export_center.label_start_date')}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full mt-1 h-8 justify-start text-left text-xs", !startDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-1 h-3 w-3" />
                    {startDate ? format(startDate, 'yyyy.MM.dd', { locale: hu }) : t('export_center.date_placeholder')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={startDate} onSelect={setStartDate} locale={hu} className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label className="text-xs">{t('export_center.label_end_date')}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full mt-1 h-8 justify-start text-left text-xs", !endDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-1 h-3 w-3" />
                    {endDate ? format(endDate, 'yyyy.MM.dd', { locale: hu }) : t('export_center.date_placeholder')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={endDate} onSelect={setEndDate} locale={hu} disabled={d => startDate ? d < startDate : false} className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">{t('export_center.label_status_filter')}</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('export_center.option_all')}</SelectItem>
                  <SelectItem value="approved">{t('leave_request.status_approved')}</SelectItem>
                  <SelectItem value="pending">{t('leave_request.status_pending')}</SelectItem>
                  <SelectItem value="rejected">{t('leave_request.status_rejected')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{t('export_center.label_format')}</Label>
              <Select value={exportFormat} onValueChange={setExportFormat}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                  <SelectItem value="xml">XML</SelectItem>
                  <SelectItem value="html">HTML</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">{t('export_center.label_team')}</Label>
              <Select value={teamFilter} onValueChange={setTeamFilter} onOpenChange={() => loadFilterOptions()}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('export_center.option_all')}</SelectItem>
                  {teams.map(team => <SelectItem key={team} value={team}>{team}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{t('export_center.label_position')}</Label>
              <Select value={roleFilter} onValueChange={setRoleFilter} onOpenChange={() => loadFilterOptions()}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('export_center.option_all')}</SelectItem>
                  {roles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={handleExport} disabled={exporting || !startDate || !endDate} className="w-full text-xs">
            <Download className="h-3 w-3 mr-1" />
            {exporting ? t('export_center.btn_exporting') : t('export_center.btn_download', { format: exportFormat.toUpperCase() })}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ===== Format Helpers =====

function downloadFile(content: string, fileName: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName; a.click();
  URL.revokeObjectURL(url);
}

function downloadCSV(headers: string[], rows: string[][], fileName: string) {
  const BOM = '﻿';
  const all = [headers, ...rows];
  const csv = BOM + all.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
  downloadFile(csv, `${fileName}.csv`, 'text/csv;charset=utf-8');
}

function downloadXLSX(headers: string[], rows: string[][], fileName: string) {
  // Generate Excel XML Spreadsheet (compatible with Excel without external libs)
  const escXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const makeRow = (cells: string[]) =>
    '<Row>' + cells.map(c => `<Cell><Data ss:Type="String">${escXml(c)}</Data></Cell>`).join('') + '</Row>';

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles>
  <Style ss:ID="header"><Font ss:Bold="1"/><Interior ss:Color="#E2EFDA" ss:Pattern="Solid"/></Style>
</Styles>
<Worksheet ss:Name="Export">
<Table>
${headers.map(h => `<Column ss:Width="100"/>`).join('\n')}
<Row ss:StyleID="header">${headers.map(h => `<Cell><Data ss:Type="String">${escXml(h)}</Data></Cell>`).join('')}</Row>
${rows.map(r => makeRow(r)).join('\n')}
</Table>
</Worksheet>
</Workbook>`;
  downloadFile(xml, `${fileName}.xls`, 'application/vnd.ms-excel');
}

function downloadXML(headers: string[], rows: string[][], fileName: string) {
  const escXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const tagName = (h: string) => h.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]/g, '_').replace(/^_+|_+$/g, '') || 'field';

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<export>
${rows.map(r => `  <record>\n${headers.map((h, i) => `    <${tagName(h)}>${escXml(r[i] || '')}</${tagName(h)}>`).join('\n')}\n  </record>`).join('\n')}
</export>`;
  downloadFile(xml, `${fileName}.xml`, 'application/xml');
}

function downloadHTML(headers: string[], rows: string[][], fileName: string, startDate: Date, endDate: Date, title: string, dateRowsLabel: string) {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = `<!DOCTYPE html>
<html lang="hu">
<head><meta charset="UTF-8"><title>Syncfolk Export</title>
<style>
  body { font-family: system-ui, sans-serif; padding: 2rem; color: #1a1a2e; }
  h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
  .meta { color: #666; font-size: 0.85rem; margin-bottom: 1.5rem; }
  table { border-collapse: collapse; width: 100%; font-size: 0.85rem; }
  th { background: #e2efda; font-weight: 600; text-align: left; padding: 8px 10px; border: 1px solid #ccc; }
  td { padding: 6px 10px; border: 1px solid #ddd; }
  tr:nth-child(even) td { background: #f9f9f9; }
  @media print { body { padding: 0; } }
</style></head>
<body>
<h1>${esc(title)}</h1>
<p class="meta">${esc(dateRowsLabel)}</p>
<table>
<thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
<tbody>${rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('\n')}</tbody>
</table>
</body></html>`;
  downloadFile(html, `${fileName}.html`, 'text/html;charset=utf-8');
}
