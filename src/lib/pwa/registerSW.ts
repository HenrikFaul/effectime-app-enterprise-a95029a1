import { isNativeRuntime } from '@/lib/platform/mobile';

/**
 * Service Worker registration helper (v3.32.0 — Top-20 Rank 7).
 *
 * Registers /sw.js at app startup. The SW caches the app shell and
 * static assets for offline access; Supabase auth/edge/realtime traffic
 * bypasses the SW so live sessions are never cached.
 *
 * Full Workbox + vite-plugin-pwa + IndexedDB write queue + FCM push are
 * deferred to v3.32.1+ when the build pipeline is upgraded.
 */

export async function registerEffectimeServiceWorker(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (isNativeRuntime()) return;
  if (!('serviceWorker' in navigator)) return;

  // Skip only Vite's development build. Production previews must exercise the
  // same service-worker registration path as the deployed artifact.
  if (import.meta.env.DEV) return;

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    // Listen for updates
    reg.addEventListener('updatefound', () => {
      const installing = reg.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          // New version available — log but don't force reload (UX choice).
          console.info('[Effectime SW] New version installed; refresh to activate.');
        }
      });
    });
  } catch (e: unknown) {
    console.warn('[Effectime SW] Registration failed:', e instanceof Error ? e.message : String(e));
  }
}

// BeforeInstallPrompt event capture (Add to Home Screen support on
// Chromium-based browsers). Stored on window so the InstallPwaPrompt
// component can trigger it when the user clicks the install button.
type BeforeInstallPromptEvent = Event & {
  readonly platforms: ReadonlyArray<string>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  prompt(): Promise<void>;
};

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
  interface Window {
    __effectimePwaInstallEvent?: BeforeInstallPromptEvent;
  }
}

export function captureInstallPrompt(): void {
  if (typeof window === 'undefined') return;
  if (isNativeRuntime()) return;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.__effectimePwaInstallEvent = e;
  });
}
