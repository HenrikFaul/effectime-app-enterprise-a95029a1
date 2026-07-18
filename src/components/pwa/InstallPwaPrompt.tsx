import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, X, Smartphone } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import { isNativeRuntime } from '@/lib/platform/mobile';

const STORAGE_KEY = 'effectime.pwa.install_dismissed_at';
const REMIND_AFTER_DAYS = 30;

/**
 * InstallPwaPrompt — Top-20 Rank 7, v3.32.0.
 *
 * Floating bottom-right "Install app" prompt. Shown only when:
 *   1. The browser fired `beforeinstallprompt` (Chromium-based).
 *   2. The user is not already running standalone (added to home screen).
 *   3. The user hasn't dismissed within the last 30 days.
 *
 * Captured prompt lives on `window.__effectimePwaInstallEvent`,
 * populated by `captureInstallPrompt()` (called in main.tsx).
 */
export function InstallPwaPrompt() {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isNativeRuntime()) return;

    // Already running standalone (added to home screen) → never prompt
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches
      || (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    // Recently dismissed?
    try {
      const dismissedAt = Number(localStorage.getItem(STORAGE_KEY) || 0);
      if (dismissedAt && Date.now() - dismissedAt < REMIND_AFTER_DAYS * 24 * 60 * 60 * 1000) {
        return;
      }
    } catch { /* ignore */ }

    const check = () => setVisible(Boolean(window.__effectimePwaInstallEvent));

    // Initial check (event may have already fired before mount)
    check();

    // Listen for the event in case it fires after mount
    const handler = () => setTimeout(check, 0);
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!visible) return null;

  const handleInstall = async () => {
    const evt = window.__effectimePwaInstallEvent;
    if (!evt) {
      setVisible(false);
      return;
    }
    try {
      await evt.prompt();
      const { outcome } = await evt.userChoice;
      if (outcome === 'accepted') {
        delete window.__effectimePwaInstallEvent;
      }
    } catch { /* ignore */ }
    setVisible(false);
  };

  const handleDismiss = () => {
    try { localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch { /* ignore */ }
    setVisible(false);
  };

  return (
    <div className="fixed bottom-4 right-4 z-40 w-[320px] max-w-[calc(100vw-2rem)] animate-in slide-in-from-bottom-4">
      <Card className="border-primary shadow-elevated">
        <CardContent className="py-3">
          <div className="flex items-start gap-2">
            <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
              <Smartphone className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{t('pwa.install_title')}</p>
              <p className="text-xs text-muted-foreground">{t('pwa.install_subtitle')}</p>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleDismiss} aria-label={t('common.dismiss')}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="flex justify-end mt-2">
            <Button size="sm" onClick={handleInstall}>
              <Download className="h-3.5 w-3.5 mr-1.5" /> {t('pwa.install_button')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
