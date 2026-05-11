import { EffectimeLogo } from './EffectimeLogo';
import { useI18n } from '@/i18n/I18nProvider';

export function SiteFooter() {
  const { t } = useI18n();
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="container mx-auto px-6 py-12 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
          <div className="flex items-center gap-2">
            <EffectimeLogo size={26} variant="full" />
          </div>
          <p className="text-sm text-muted-foreground">
            {t('landing.footer_copyright', { year: new Date().getFullYear() })}
          </p>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground">
              {t('landing.footer_privacy')}
            </a>
            <a href="#" className="hover:text-foreground">
              {t('landing.footer_terms')}
            </a>
            <a href="mailto:hello@effectime.app" className="hover:text-foreground">
              {t('landing.footer_contact')}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
