/**
 * Fallback shown when a feature is hidden by the tier system. Renders a
 * minimal "upgrade your plan" card so users understand the section exists
 * and can ask their admin to enable it, rather than silently dropping the UI.
 */
import { Lock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useI18n } from '@/i18n/I18nProvider';

interface Props {
  feature: string;
  /** Optional title override (already localized). */
  title?: string;
}

export function LockedFeatureNotice({ feature, title }: Props) {
  const { t } = useI18n();
  return (
    <Card className="border-dashed">
      <CardContent className="py-10 flex flex-col items-center text-center gap-3 text-sm">
        <div className="rounded-full bg-muted p-3">
          <Lock className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <div className="font-medium">{title ?? t('feature_gate.locked_title')}</div>
          <div className="text-muted-foreground text-xs max-w-md">
            {t('feature_gate.locked_desc', { feature })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
