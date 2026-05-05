import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useT, useI18n } from '@/i18n/I18nProvider';
import { LOCALE_LABEL, SUPPORTED_LOCALES, type Locale } from '@/i18n/locales';
import { Globe } from 'lucide-react';

interface Props {
  workspaceId: string;
}

export function LocalizationSettings({ workspaceId }: Props) {
  void workspaceId;
  const t = useT();
  const { locale } = useI18n();

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
          <div className="text-sm text-muted-foreground">
            {t('settings.localization.none_missing')}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
