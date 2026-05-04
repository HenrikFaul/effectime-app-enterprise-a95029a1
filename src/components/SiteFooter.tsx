export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="container mx-auto px-6 py-12 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
          <div className="flex items-center gap-2">
            <span className="inline-block h-6 w-6 rounded-md bg-gradient-to-br from-brand to-primary" />
            <span className="font-display text-lg font-bold text-foreground">Effectime</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Effectime. Minden jog fenntartva.
          </p>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground">
              Adatvédelem
            </a>
            <a href="#" className="hover:text-foreground">
              ÁSZF
            </a>
            <a href="mailto:hello@effectime.app" className="hover:text-foreground">
              Kapcsolat
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
