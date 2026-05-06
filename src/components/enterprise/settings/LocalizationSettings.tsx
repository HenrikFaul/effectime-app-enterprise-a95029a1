import { useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useT, useI18n } from '@/i18n/I18nProvider';
import { LOCALE_LABEL, SUPPORTED_LOCALES, type Locale } from '@/i18n/locales';
import { Download, Globe, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { buildI18nCsv, bundleStats, parseI18nCsv, type ImportSummary } from '@/lib/i18n/csv';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  workspaceId: string;
  isAdmin?: boolean;
  userId?: string;
}

export function LocalizationSettings({ workspaceId, isAdmin = false, userId }: Props) {
  const t = useT();
  const { locale, loadWorkspaceOverrides } = useI18n();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [lastImport, setLastImport] = useState<ImportSummary | null>(null);
  const [persisting, setPersisting] = useState(false);

  const stats = useMemo(() => bundleStats(), []);

  const downloadCsv = () => {
    const csv = buildI18nCsv();
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `effectime-i18n-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const persistOverrides = async (summary: ImportSummary) => {
    if (!isAdmin) return;
    setPersisting(true);
    const rows: { workspace_id: string; locale: Locale; key: string; value: string; source: string; authored_by: string | null }[] = [];
    (Object.keys(summary.overrides) as Locale[]).forEach((l) => {
      summary.overrides[l].forEach((value, key) => {
        rows.push({
          workspace_id: workspaceId,
          locale: l,
          key,
          value,
          source: 'csv_import',
          authored_by: userId ?? null,
        });
      });
    });
    if (rows.length === 0) {
      setPersisting(false);
      return;
    }
    const { error } = await (supabase as any)
      .from('enterprise_translation_overrides')
      .upsert(rows, { onConflict: 'workspace_id,locale,key' });
    setPersisting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t('settings.localization.persisted'));
    await loadWorkspaceOverrides(workspaceId);
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const summary = parseI18nCsv(text);
      setLastImport(summary);
      toast.success(
        t('settings.localization.import_summary', {
          added: summary.added,
          updated: summary.updated,
          skipped: summary.skipped,
        }),
      );
      if (isAdmin) {
        await persistOverrides(summary);
      }
    } catch (err: any) {
      toast.error(err?.message ?? 'CSV parse failed');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" />
          <div>
            <CardTitle className="text-base">{t('settings.localization.title')}</CardTitle>
            <CardDescription className="text-xs">
              {t('settings.localization.description')}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
            {t('settings.localization.languages')}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SUPPORTED_LOCALES.map((l: Locale) => {
              const meta = LOCALE_LABEL[l];
              const isActive = l === locale;
              return (
                <div
                  key={l}
                  className="flex items-center justify-between rounded-md border bg-card px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg" aria-hidden>
                      {meta.flag}
                    </span>
                    <div className="leading-tight">
                      <div className="text-sm font-medium">{meta.native}</div>
                      <div className="text-[11px] text-muted-foreground">{meta.english} · {l}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant="secondary" className="text-[10px]">
                      {t('settings.localization.enabled')}
                    </Badge>
                    {isActive ? (
                      <Badge className="text-[10px]">{t('settings.localization.default')}</Badge>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <strong>{t('settings.localization.workspace_default')}:</strong> {t('settings.localization.configure_default')}
        </div>

        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
            {t('settings.localization.missing_keys')}
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">total keys: {stats.totalKeys}</Badge>
            <Badge variant={stats.missingHu === 0 ? 'outline' : 'secondary'}>
              hu: {stats.missingHu === 0 ? t('settings.localization.none_missing') : t('settings.localization.missing_count', { count: stats.missingHu })}
            </Badge>
            <Badge variant={stats.missingEn === 0 ? 'outline' : 'secondary'}>
              en: {stats.missingEn === 0 ? t('settings.localization.none_missing') : t('settings.localization.missing_count', { count: stats.missingEn })}
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          <Button size="sm" variant="outline" onClick={downloadCsv}>
            <Download className="h-3.5 w-3.5 mr-1" /> {t('settings.localization.export_csv')}
          </Button>
          <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-3.5 w-3.5 mr-1" /> {t('settings.localization.import_csv')}
          </Button>
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
        </div>
        <p className="text-[11px] text-muted-foreground">{t('settings.localization.import_help')}</p>
        {lastImport ? (
          <div className="text-xs text-muted-foreground">
            {t('settings.localization.import_summary', {
              added: lastImport.added,
              updated: lastImport.updated,
              skipped: lastImport.skipped,
            })}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
