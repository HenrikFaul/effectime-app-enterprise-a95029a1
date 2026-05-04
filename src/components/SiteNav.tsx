import { Link } from "@tanstack/react-router";
import { EffectimeLogo } from './EffectimeLogo';

export function SiteNav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="container mx-auto flex items-center justify-between px-6 py-5 lg:px-8">
        <Link to="/" className="flex items-center gap-2">
          <EffectimeLogo size={36} variant="full" />
        </Link>

        <div className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
          <a href="#features" className="transition-colors hover:text-foreground">
            Funkciók
          </a>
          <a href="#workflow" className="transition-colors hover:text-foreground">
            Munkafolyamat
          </a>
          <a href="#pricing" className="transition-colors hover:text-foreground">
            Árazás
          </a>
        </div>

        <div className="flex items-center gap-3">
          <button className="hidden rounded-lg border border-border/60 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary sm:inline-flex">
            Bejelentkezés
          </button>
          <button className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/40">
            Próbálja ingyen
          </button>
        </div>
      </div>
    </nav>
  );
}
