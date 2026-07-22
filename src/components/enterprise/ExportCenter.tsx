import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Download, FileSpreadsheet } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useI18n, useDateLocale } from '@/i18n/I18nProvider';
import { downloadFile } from './import-export/utils/file-parser';
import {
  executeLegacyLeaveExport,
  loadLegacyLeaveExportFilterOptions,
  type LegacyLeaveExportClient,
  type LegacyLeaveExportFormat,
} from '@/lib/legacyLeaveExport';

interface Props {
  workspaceId: string;
  userId: string;
}

export function ExportCenter({ workspaceId, userId }: Props) {
  const { t } = useI18n();
  const dateFnsLocale = useDateLocale();

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
  const [exportFormat, setExportFormat] = useState<LegacyLeaveExportFormat>('csv');
  const [teamFilter, setTeamFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [exporting, setExporting] = useState(false);
  const [teams, setTeams] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [filtersLoaded, setFiltersLoaded] = useState(false);
  const filterLoadInFlightRef = useRef<symbol | null>(null);
  const exportInFlightRef = useRef<symbol | null>(null);
  const mountedRef = useRef(false);
  const requestScopeKey = `${workspaceId}:${userId}`;
  const requestScopeRef = useRef(requestScopeKey);
  requestScopeRef.current = requestScopeKey;

  const legacyExportClient = supabase as unknown as LegacyLeaveExportClient;

  useEffect(() => {
    mountedRef.current = true;
    setTeams([]);
    setRoles([]);
    setFiltersLoaded(false);
    filterLoadInFlightRef.current = null;
    exportInFlightRef.current = null;
    setExporting(false);
    return () => {
      mountedRef.current = false;
    };
  }, [requestScopeKey]);

  // Fetch filter options on first interaction
  const loadFilterOptions = async () => {
    if (filtersLoaded || filterLoadInFlightRef.current) return;
    const requestToken = Symbol('filter-load');
    filterLoadInFlightRef.current = requestToken;
    const requestedScopeKey = requestScopeKey;
    try {
      const options = await loadLegacyLeaveExportFilterOptions(legacyExportClient, workspaceId);
      if (!mountedRef.current || requestScopeRef.current !== requestedScopeKey) return;
      setTeams(options.teams);
      setRoles(options.roles);
      setFiltersLoaded(true);
    } catch {
      if (mountedRef.current && requestScopeRef.current === requestedScopeKey) {
        toast.error(t('export_center.toast_export_error'));
      }
    } finally {
      if (filterLoadInFlightRef.current === requestToken) {
        filterLoadInFlightRef.current = null;
      }
    }
  };

  const handleExport = async () => {
    if (!startDate || !endDate) { toast.error(t('export_center.toast_no_date')); return; }
    if (exportInFlightRef.current) return;
    const requestToken = Symbol('leave-export');
    exportInFlightRef.current = requestToken;
    const requestedScopeKey = requestScopeKey;
    setExporting(true);
    try {
      const result = await executeLegacyLeaveExport(
        legacyExportClient,
        {
          workspaceId,
          userId,
          startDate,
          endDate,
          statusFilter,
          teamFilter,
          roleFilter,
          format: exportFormat,
        },
        {
          dayNames: DOW,
          headers: [
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
          ],
          unknownPerson: t('export_center.unknown_person'),
          leaveType: TYPE_MAP,
          leaveStatus: STATUS_MAP,
          halfDayMorning: t('leave_request.half_day_morning'),
          halfDayAfternoon: t('leave_request.half_day_afternoon'),
          htmlTitle: t('export_center.html_title'),
          htmlDateRows: (start, end, rowCount) => t('export_center.html_date_rows', {
            start,
            end,
            rows: rowCount,
          }),
        },
        ({ content, fileName, mimeType }) => downloadFile(content, fileName, mimeType),
        () => mountedRef.current && requestScopeRef.current === requestedScopeKey
      );
      toast.success(t('export_center.toast_export_done', {
        rows: result.rowCount,
        format: exportFormat.toUpperCase(),
      }));
    } catch {
      if (mountedRef.current && requestScopeRef.current === requestedScopeKey) {
        toast.error(t('export_center.toast_export_error'));
      }
    } finally {
      if (exportInFlightRef.current === requestToken) {
        exportInFlightRef.current = null;
        setExporting(false);
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <FileSpreadsheet className="h-4 w-4" />
        <h3 className="text-sm font-semibold">{t('export_center.heading')}</h3>
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
                    {startDate ? format(startDate, 'yyyy.MM.dd', { locale: dateFnsLocale }) : t('export_center.date_placeholder')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={startDate} onSelect={setStartDate} locale={dateFnsLocale} className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label className="text-xs">{t('export_center.label_end_date')}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full mt-1 h-8 justify-start text-left text-xs", !endDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-1 h-3 w-3" />
                    {endDate ? format(endDate, 'yyyy.MM.dd', { locale: dateFnsLocale }) : t('export_center.date_placeholder')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={endDate} onSelect={setEndDate} locale={dateFnsLocale} disabled={d => startDate ? d < startDate : false} className={cn("p-3 pointer-events-auto")} />
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
              <Select value={exportFormat} onValueChange={(value) => {
                if (value === 'csv' || value === 'xls' || value === 'xml' || value === 'html') {
                  setExportFormat(value);
                }
              }}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="xls">Excel (.xls)</SelectItem>
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
