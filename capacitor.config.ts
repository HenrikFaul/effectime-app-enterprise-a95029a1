import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // The reverse-domain identifier is the proposed Effectime store identity.
  // It must be reserved in App Store Connect and Google Play before signing a
  // production build; changing it after publication creates a different app.
  appId: 'app.effectime',
  appName: 'Effectime',
  // Native builds use a separate CSP-hardened shell. The JavaScript source,
  // Supabase runtime configuration and backend contracts remain shared.
  webDir: 'dist-mobile',
};

export default config;
