import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useI18n } from '@/i18n/I18nProvider';

interface Props { workspaceId: string; userId: string }

interface ImportResult { ok: number; skipped: number; errors: string[] }

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    // simple CSV split (no embedded commas in quotes)
    const cells = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = cells[i] || ''; });
    return row;
  });
}

export function CsvImportPanel({ workspaceId, userId }: Props) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const importInvitations = async (file: File) => {
    setBusy(true); setResult(null);
    const text = await file.text();
    const rows = parseCSV(text);
    const errors: string[] = []; let ok = 0; let skipped = 0;
    for (const r of rows) {
      const email = (r.email || r.Email || '').trim().toLowerCase();
      const role = (r.role || 'member').trim();
      if (!email || !email.includes('@')) { skipped++; continue; }
      const { error } = await (supabase as any).from('enterprise_invitations').insert({
        workspace_id: workspaceId, email, role, invited_by: userId,
      });
      if (error) {
        if (error.code === '23505') skipped++;
        else errors.push(`${email}: ${error.message}`);
      } else ok++;
    }
    setResult({ ok, skipped, errors });
    setBusy(false);
    if (ok > 0) toast.success(t('csv_import.invite_success', { ok }));
  };

  const importLeaveRequests = async (file: File) => {
    setBusy(true); setResult(null);
    const text = await file.text();
    const rows = parseCSV(text);
    const errors: string[] = []; let ok = 0; let skipped = 0;
    for (const r of rows) {
      const email = (r.email || r.user_email || '').trim().toLowerCase();
      const start = (r.start_date || r.start || '').trim();
      const end = (r.end_date || r.end || '').trim();
      const leaveType = (r.leave_type || r.type || 'vacation').trim();
      const status = (r.status || 'approved').trim();
      if (!email || !start || !end) { skipped++; continue; }

      // Lookup membership by email via memberships join
      const { data: memberships } = await (supabase as any)
        .from('enterprise_memberships').select('id,user_id').eq('workspace_id', workspaceId);
      // Profiles join — find user_id by email
      const { data: profiles } = await (supabase as any).from('profiles').select('id,email').eq('email', email).maybeSingle();
      const userIdMatch = profiles?.id;
      const membership = memberships?.find((m: any) => m.user_id === userIdMatch);
      if (!membership) { errors.push(t('csv_import.member_not_found', { email })); continue; }

      const { error } = await (supabase as any).from('leave_requests').insert({
        workspace_id: workspaceId,
        user_id: membership.user_id,
        leave_type: leaveType,
        start_date: start,
        end_date: end,
        status,
        comment: r.comment || null,
      });
      if (error) errors.push(`${email}: ${error.message}`); else ok++;
    }
    setResult({ ok, skipped, errors });
    setBusy(false);
    if (ok > 0) toast.success(t('csv_import.leave_success', { ok }));
  };

  return (
    <div className="space-y-3">
      <Tabs defaultValue="users">
        <TabsList className="grid grid-cols-2 w-full h-auto">
          <TabsTrigger value="users" className="text-xs">{t('csv_import.tab_invite')}</TabsTrigger>
          <TabsTrigger value="requests" className="text-xs">{t('csv_import.tab_leave')}</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-2 mt-3">
          <p className="text-[11px] text-muted-foreground" dangerouslySetInnerHTML={{ __html: t('csv_import.invite_instructions') }} />
          <Label className="block">
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) importInvitations(f); }} />
            <Button asChild variant="outline" size="sm" disabled={busy}>
              <span><Upload className="h-3 w-3 mr-1" /> {t('csv_import.select_file_btn')}</span>
            </Button>
          </Label>
        </TabsContent>

        <TabsContent value="requests" className="space-y-2 mt-3">
          <p className="text-[11px] text-muted-foreground" dangerouslySetInnerHTML={{ __html: t('csv_import.leave_instructions') }} />
          <Label className="block">
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) importLeaveRequests(f); }} />
            <Button asChild variant="outline" size="sm" disabled={busy}>
              <span><FileSpreadsheet className="h-3 w-3 mr-1" /> {t('csv_import.select_file_btn')}</span>
            </Button>
          </Label>
        </TabsContent>
      </Tabs>

      {busy && <p className="text-xs text-muted-foreground flex items-center gap-2"><div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" /> {t('csv_import.importing_label')}</p>}

      {result && (
        <div className="rounded-md border p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <CheckCircle2 className="h-3 w-3 text-green-600" /> {result.ok} {t('csv_import.result_summary', { skipped: result.skipped })}
          </div>
          {result.errors.length > 0 && (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {result.errors.slice(0, 10).map((e, i) => (
                <p key={i} className="text-[10px] text-destructive flex items-start gap-1"><AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />{e}</p>
              ))}
              {result.errors.length > 10 && <p className="text-[10px] text-muted-foreground">{t('csv_import.more_errors', { count: result.errors.length - 10 })}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
