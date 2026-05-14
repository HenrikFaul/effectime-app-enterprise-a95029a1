import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Palette, TrendingUp, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/i18n/I18nProvider';
import {
  useMyResellers,
  useResellerUsage,
  provisionWorkspaceUnderReseller,
  updateResellerTheme,
} from '@/hooks/useReseller';

/**
 * ResellerPortal — Top-20 Rank 4, v3.25.0.
 *
 * Shown to authenticated users who have a `reseller_admins` row.
 * Three sections:
 *   1. Reseller picker (multi-tenant: a user might admin several resellers).
 *   2. Portfolio dashboard: workspaces under this reseller, MRR proxy, tier mix.
 *   3. Provision a new workspace under the reseller umbrella.
 *   4. Theme editor (brand color + logo URL).
 */
export function ResellerPortal() {
  const { t } = useI18n();
  const { data: resellers, isLoading: loadingResellers } = useMyResellers();
  const [activeResellerId, setActiveResellerId] = useState<string | null>(null);
  const active = useMemo(
    () => (resellers ?? []).find((r) => r.id === activeResellerId) ?? (resellers ?? [])[0] ?? null,
    [resellers, activeResellerId],
  );
  const resellerId = active?.id ?? null;

  const { data: usage, refetch: refetchUsage } = useResellerUsage(resellerId);

  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newTier, setNewTier] = useState('pro');
  const [provisioning, setProvisioning] = useState(false);

  const [themePrimary, setThemePrimary] = useState('');
  const [themeLogo, setThemeLogo] = useState('');
  const [savingTheme, setSavingTheme] = useState(false);

  // Sync theme fields when active reseller changes
  useMemo(() => {
    if (active) {
      setThemePrimary(active.theme_config?.brand_primary ?? '');
      setThemeLogo(active.theme_config?.logo_url ?? '');
    }
  }, [active]);

  const handleProvision = async () => {
    if (!resellerId || !newName.trim()) {
      toast.error(t('reseller.provision_name_required'));
      return;
    }
    setProvisioning(true);
    try {
      await provisionWorkspaceUnderReseller({
        resellerId,
        name: newName.trim(),
        description: newDesc.trim() || undefined,
        tierKey: newTier,
      });
      toast.success(t('reseller.provision_success'));
      setNewName('');
      setNewDesc('');
      await refetchUsage();
    } catch (e: unknown) {
      toast.error(t('reseller.provision_error') + ': ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setProvisioning(false);
    }
  };

  const handleSaveTheme = async () => {
    if (!resellerId) return;
    setSavingTheme(true);
    try {
      await updateResellerTheme(resellerId, {
        brand_primary: themePrimary || undefined,
        logo_url: themeLogo || undefined,
      });
      toast.success(t('reseller.theme_saved'));
    } catch (e: unknown) {
      toast.error(t('reseller.theme_save_error') + ': ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSavingTheme(false);
    }
  };

  if (loadingResellers) return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>;
  if (!resellers || resellers.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          {t('reseller.no_resellers_for_user')}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Reseller picker (only if user admins multiple) */}
      {resellers.length > 1 && (
        <Card>
          <CardContent className="py-3">
            <Select value={resellerId ?? ''} onValueChange={setActiveResellerId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {resellers.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* Portfolio dashboard */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            {t('reseller.portfolio_title', { name: active?.name ?? '' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border p-3 text-center">
              <div className="text-2xl font-bold">{usage?.active_workspaces ?? 0}</div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {t('reseller.kpi_active')}
              </div>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <div className="text-2xl font-bold">{usage?.total_workspaces ?? 0}</div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {t('reseller.kpi_total')}
              </div>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <div className="text-2xl font-bold">{usage?.total_members ?? 0}</div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {t('reseller.kpi_members')}
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {t('reseller.workspaces_list')}
            </p>
            {(usage?.workspaces ?? []).map((w) => (
              <div key={w.workspace_id} className="flex items-center justify-between gap-2 text-xs px-2 py-1.5 rounded border bg-background/60">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{w.name}</span>
                    {w.is_archived && (
                      <Badge variant="outline" className="text-[10px]">{t('reseller.archived')}</Badge>
                    )}
                  </div>
                  <span className="text-muted-foreground text-[10px]">
                    {w.member_count} {t('reseller.members_short')} · {new Date(w.created_at).toLocaleDateString()}
                  </span>
                </div>
                {w.tier_key && (
                  <Badge variant="outline" className="text-[10px] uppercase">{w.tier_key}</Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Provision new workspace */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            {t('reseller.provision_title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="prov-name" className="text-xs">{t('reseller.workspace_name')}</Label>
              <Input id="prov-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Acme Corp" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="prov-tier" className="text-xs">{t('reseller.workspace_tier')}</Label>
              <Select value={newTier} onValueChange={setNewTier}>
                <SelectTrigger id="prov-tier"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="freemium">Freemium</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="prov-desc" className="text-xs">{t('reseller.workspace_description')}</Label>
            <Input id="prov-desc" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder={t('reseller.description_placeholder')} />
          </div>
          <Button onClick={handleProvision} disabled={provisioning || !newName.trim()}>
            {provisioning ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> {t('reseller.provisioning')}</> : t('reseller.provision_button')}
          </Button>
        </CardContent>
      </Card>

      {/* Theme editor */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" />
            {t('reseller.theme_title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="theme-primary" className="text-xs">{t('reseller.brand_primary')}</Label>
              <Input id="theme-primary" value={themePrimary} onChange={(e) => setThemePrimary(e.target.value)} placeholder="#0ea5e9" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="theme-logo" className="text-xs">{t('reseller.logo_url')}</Label>
              <Input id="theme-logo" value={themeLogo} onChange={(e) => setThemeLogo(e.target.value)} placeholder="https://…/logo.svg" />
            </div>
          </div>
          <Button onClick={handleSaveTheme} disabled={savingTheme}>
            {savingTheme ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> {t('reseller.theme_saving')}</> : t('reseller.theme_save')}
          </Button>
        </CardContent>
      </Card>

      {/* Revenue share info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            {t('reseller.revenue_title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            {t('reseller.revenue_share_explainer', { pct: active?.revenue_share_pct ?? 30 })}
          </p>
          {!active?.stripe_connect_account_id && (
            <p className="text-xs text-amber-600 mt-2">{t('reseller.stripe_not_connected')}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
