import { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Crumb {
  label: string;
  onClick?: () => void;
}

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  crumbs?: Crumb[];
  actions?: ReactNode;
  /** Render a sticky header (default true). */
  sticky?: boolean;
  className?: string;
}

/**
 * Reusable page header for the redesigned shell. Provides title, description,
 * breadcrumbs, and a primary-actions slot. Density-aware via the shell tokens.
 */
export function PageHeader({
  title,
  description,
  crumbs,
  actions,
  sticky = true,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        'w-full border-b border-border/60 bg-background/85 backdrop-blur-md',
        sticky && 'sticky top-0 z-20',
        className
      )}
      style={{ paddingInline: 'var(--density-page-pad-x)' }}
    >
      <div className="flex flex-col gap-2 py-3 lg:py-4">
        {crumbs && crumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-muted-foreground">
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3 opacity-60" />}
                {c.onClick ? (
                  <button
                    type="button"
                    onClick={c.onClick}
                    className="rounded-sm px-0.5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {c.label}
                  </button>
                ) : (
                  <span className={i === crumbs.length - 1 ? 'text-foreground font-medium' : ''}>
                    {c.label}
                  </span>
                )}
              </span>
            ))}
          </nav>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-xl sm:text-2xl xl:text-[1.75rem] font-semibold tracking-tight truncate">
              {title}
            </h1>
            {description && (
              <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">{description}</p>
            )}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
        </div>
      </div>
    </header>
  );
}
