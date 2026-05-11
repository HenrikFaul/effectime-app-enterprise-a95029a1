import { Link } from "react-router-dom";
import { EffectimeLogo } from './EffectimeLogo';
import { useI18n } from '@/i18n/I18nProvider';

export function SiteNav() {
  const { t } = useI18n();
  return (
    <nav className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="container mx-auto flex items-center justify-between px-6 py-5 lg:px-8">
        <Link to="/" className="flex items-center gap-2">
          <EffectimeLogo size={36} variant="full" />
        </Link>

        <div className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
          <a href="#features" className="transition-colors hover:text-foreground">
            {t('landing.nav_features')}
          </a>
          <a href="#workflow" className="transition-colors hover:text-foreground">
            {t('landing.nav_workflow')}
          </a>
          <a href="#pricing" className="transition-colors hover:text-foreground">
            {t('landing.nav_pricing')}
          </a>
        </div>

        <div className="flex items-center gap-3">
          <button className="hidden rounded-lg border border-border/60 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary sm:inline-flex">
            {t('landing.btn_signin')}
          </button>
          <button className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/40">
            {t('landing.btn_start_free')}
          </button>
        </div>
      </div>
    </nav>
  );
}
