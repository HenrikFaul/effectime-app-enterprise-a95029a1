import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mail, Trash2, ChevronDown, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/i18n/I18nProvider';

interface Props {
  workspaceId: string;
  isAdmin: boolean;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  created_at: string;
  accepted_at: string | null;
}

type StatusFilter = 'sent' | 'used' | 'all';

export function InvitationsPanel({ workspaceId, isAdmin }: Props) {
  const { t } = useI18n();

  const ROLE_LABEL: Record<string, string> = {
    owner: t('members.roles.owner'),
    resourceAssistant: t('members.roles.resource_assistant'),
    member: t('members.roles.member'),
  };

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('sent');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const fetchInvitations = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('enterprise_invitations')
      .select('id, email, role, created_at, accepted_at')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });
    setInvitations((data as Invitation[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (open) fetchInvitations();
  }, [open, workspaceId]);

  const handleDelete = async (id: string) => {
    await supabase.from('enterprise_invitations').delete().eq('id', id);
    toast.success(t('members.invitation_deleted'));
    fetchInvitations();
  };

  const filtered = useMemo(() => {
    return invitations.filter((inv) => {
      const isUsed = !!inv.accepted_at;
      if (statusFilter === 'sent' && isUsed) return false;
      if (statusFilter === 'used' && !isUsed) return false;
      if (fromDate) {
        if (new Date(inv.created_at) < new Date(fromDate + 'T00:00:00')) return false;
      }
      if (toDate) {
        if (new Date(inv.created_at) > new Date(toDate + 'T23:59:59')) return false;
      }
      return true;
    });
  }, [invitations, statusFilter, fromDate, toDate]);

  const sentCount = invitations.filter((i) => !i.accepted_at).length;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors">
          <CardContent className="flex items-center justify-between py-3 px-4">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">{t('members.invitations_title')}</span>
              {sentCount > 0 && (
                <Badge variant="outline" className="text-[10px] border-orange-400 text-orange-500">
                  {sentCount} {t('invitations.sent_label')}
                </Badge>
              )}
            </div>
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
            />
          </CardContent>
        </Card>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-2">
        {/* Filters */}
        <Card>
          <CardContent className="py-3 px-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1">
                <Filter className="h-3 w-3" /> {t('common.status')}
              </Label>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sent">{t('invitations.filter_sent')}</SelectItem>
                  <SelectItem value="used">{t('invitations.filter_used')}</SelectItem>
                  <SelectItem value="all">{t('invitations.filter_all')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('invitations.date_from_label')}</Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('invitations.date_to_label')}</Label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center py-6">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="text-center py-6 text-sm text-muted-foreground">
              {t('invitations.no_matching')}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((inv) => {
              const isUsed = !!inv.accepted_at;
              return (
                <Card key={inv.id}>
                  <CardContent className="flex items-center justify-between py-3 px-4 gap-3">
                    <div className="min-w-0 flex-1">
                      <p
                        className={`font-medium text-sm truncate ${
                          isUsed
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-orange-500 dark:text-orange-400'
                        }`}
                      >
                        {inv.email}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            isUsed
                              ? 'border-emerald-500/50 text-emerald-600 dark:text-emerald-400'
                              : 'border-orange-400/60 text-orange-500 dark:text-orange-400'
                          }`}
                        >
                          {isUsed ? t('invitations.status_used') : t('invitations.status_sent')}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {ROLE_LABEL[inv.role] || inv.role}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(inv.created_at).toLocaleDateString('hu-HU')}
                        </span>
                        {isUsed && inv.accepted_at && (
                          <span className="text-[11px] text-muted-foreground">
                            · {t('invitations.accepted_label')} {new Date(inv.accepted_at).toLocaleDateString('hu-HU')}
                          </span>
                        )}
                      </div>
                    </div>
                    {isAdmin && !isUsed && (
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(inv.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
