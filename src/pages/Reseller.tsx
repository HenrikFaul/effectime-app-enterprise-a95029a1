import { ResellerPortal } from '@/components/reseller/ResellerPortal';
import { Card, CardContent } from '@/components/ui/card';
import { useI18n } from '@/i18n/I18nProvider';

/**
 * Reseller page — top-level route for reseller admins.
 * RLS on `resellers` table restricts visibility to users with a row in
 * `reseller_admins`, so non-reseller users see an empty state.
 */
export default function Reseller() {
  const { t } = useI18n();
  return (
    <div className="min-h-dvh bg-background p-4 space-y-4 max-w-5xl mx-auto">
      <Card className="border-primary/40 bg-primary/5">
        <CardContent className="py-3">
          <h1 className="text-base font-semibold">{t('reseller.page_title')}</h1>
          <p className="text-xs text-muted-foreground">{t('reseller.page_subtitle')}</p>
        </CardContent>
      </Card>
      <ResellerPortal />
    </div>
  );
}
