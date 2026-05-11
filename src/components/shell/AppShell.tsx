import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n/I18nProvider';

interface AppShellProps {
  children: ReactNode;
  /** Optional fixed sidebar element rendered on the left. */
  sidebar?: ReactNode;
  /** Optional sticky top bar. */
  topbar?: ReactNode;
  /** Extra class for the <main> region. */
  mainClassName?: string;
}

/**
 * AppShell — the root layout primitive of the redesigned Effectime UI.
 *
 * - Full-bleed: NEVER applies a max-width to the content region.
 * - Density-aware via the CSS variable layer in styles/density.css.
 * - Composable: pass any sidebar / topbar; both are optional so the same
 *   shell works for the workspace picker (no sidebar) and for the in-app
 *   workspace experience (with sidebar) without duplicating layout code.
 */
export function AppShell({ children, sidebar, topbar, mainClassName }: AppShellProps) {
  return (
    <div className="min-h-screen w-full bg-background text-foreground flex">
      {sidebar}
      <div className="flex min-w-0 flex-1 flex-col">
        {topbar}
        <main
          id="main-content"
          className={cn('flex-1 min-w-0 w-full', mainClassName)}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

/** Skip link for keyboard users — drop into the shell once near the top. */
export function SkipToContent() {
  const { t } = useI18n();
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground focus:shadow-lg"
    >
      {t('landing.skip_to_main')}
    </a>
  );
}
