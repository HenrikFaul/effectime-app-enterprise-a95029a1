import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Building2, Plus, Trash2, MapPin, Edit2, Mail, Phone,
  User,
} from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/i18n/I18nProvider';
import { OfficeEditorDialog } from './OfficeEditorDialog';

// ── types ──────────────────────────────────────────────────────────────────

type OpeningHours = Record<string, { open: string; close: string; closed: boolean }>;

interface Office {
  id: string;
  workspace_id: string;
  name: string;
  address: string | null;
  city: string | null;
  email: string | null;
  phone: string | null;
  manager_name: string | null;
  deputy_name: string | null;
  opening_hours: OpeningHours | null;
}

interface Props { workspaceId: string; highlightOfficeId?: string | null; }

// ── main component ─────────────────────────────────────────────────────────

export function OfficeManager({ workspaceId, highlightOfficeId }: Props) {
  const { t } = useI18n();

  const [offices, setOffices] = useState<Office[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [flashingId, setFlashingId] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!highlightOfficeId) return;
    setFlashingId(highlightOfficeId);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashingId(null), 2500);
    const el = document.getElementById(`office-row-${highlightOfficeId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return () => { if (flashTimer.current) clearTimeout(flashTimer.current); };
  }, [highlightOfficeId]);

  // Dialog state
  const [dialogOfficeId, setDialogOfficeId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // ── data fetching ────────────────────────────────────────────────────────

  const fetchOffices = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('enterprise_offices')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('name');
    setOffices(((data as unknown) as Office[]) || []);

    const { data: members } = await supabase
      .from('enterprise_memberships')
      .select('office_id')
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')
      .not('office_id', 'is', null);

    const counts: Record<string, number> = {};
    (members || []).forEach((m: any) => {
      counts[m.office_id] = (counts[m.office_id] || 0) + 1;
    });
    setMemberCounts(counts);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => { fetchOffices(); }, [fetchOffices]);

  // ── delete office ────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('enterprise_offices').delete().eq('id', id);
    if (error) toast.error(t('office_mgr.delete_failed'));
    else { toast.success(t('office_mgr.deleted')); fetchOffices(); }
  };

  // ── render ───────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="flex justify-center py-4"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Building2 className="h-4 w-4" /> {t('office_mgr.title')}
            </span>
            <Button size="sm" variant="outline" onClick={() => { setDialogOfficeId(null); setDialogOpen(true); }}>
              <Plus className="h-3.5 w-3.5 mr-1" /> {t('office_mgr.btn_new')}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {offices.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">{t('office_mgr.empty')}</p>
          )}

          {offices.map(office => (
            <div
              key={office.id}
              id={`office-row-${office.id}`}
              className={`flex items-start justify-between border rounded-md px-3 py-2.5 gap-3 transition-all duration-300 ${flashingId === office.id ? 'ring-2 ring-primary/60 ring-offset-1 bg-primary/5' : ''}`}
            >
              <div className="flex items-start gap-3 min-w-0">
                <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{office.name}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                    {office.city && (
                      <span className="flex items-center gap-0.5">
                        <MapPin className="h-3 w-3" />{office.city}
                      </span>
                    )}
                    {office.address && <span>{office.address}</span>}
                    {office.phone && (
                      <span className="flex items-center gap-0.5">
                        <Phone className="h-3 w-3" />{office.phone}
                      </span>
                    )}
                    {office.email && (
                      <span className="flex items-center gap-0.5">
                        <Mail className="h-3 w-3" />{office.email}
                      </span>
                    )}
                    {office.manager_name && (
                      <span className="flex items-center gap-0.5">
                        <User className="h-3 w-3" />{office.manager_name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Badge variant="secondary" className="text-[10px]">
                  {t('office_mgr.member_count', { count: memberCounts[office.id] || 0 })}
                </Badge>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setDialogOfficeId(office.id); setDialogOpen(true); }}>
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(office.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <OfficeEditorDialog
        workspaceId={workspaceId}
        officeId={dialogOfficeId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={fetchOffices}
      />
    </>
  );
}
