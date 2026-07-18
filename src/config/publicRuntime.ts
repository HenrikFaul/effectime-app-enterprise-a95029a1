const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export type PublicRuntimeConfig = {
  supabaseUrl: string;
  supabasePublishableKey: string;
  supabaseProjectRef: string | null;
};

type PublicRuntimeInput = {
  supabaseUrl: string | undefined;
  supabasePublishableKey: string | undefined;
  supabaseProjectId?: string | undefined;
  allowLocalHttp?: boolean;
};

function required(name: string, value: string | undefined): string {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`[Effectime configuration] ${name} is required.`);
  return normalized;
}

function decodeJwtPayload(candidate: string): Record<string, unknown> | null {
  const parts = candidate.split('.');
  if (parts.length !== 3) return null;

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    return JSON.parse(globalThis.atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function validatePublishableKey(candidate: string | undefined): string {
  const key = required('VITE_SUPABASE_PUBLISHABLE_KEY', candidate);
  const payload = decodeJwtPayload(key);

  if (
    key.startsWith('sb_secret_') ||
    /service[_-]?role/i.test(key) ||
    payload?.role === 'service_role'
  ) {
    throw new Error(
      '[Effectime configuration] A service-role/secret key must never be exposed through VITE_*.',
    );
  }

  return key;
}

function projectRefFromHostname(hostname: string): string | null {
  const suffix = '.supabase.co';
  if (!hostname.endsWith(suffix)) return null;
  const projectRef = hostname.slice(0, -suffix.length);
  return projectRef && !projectRef.includes('.') ? projectRef : null;
}

function validateProjectRef(candidate: string | undefined): string | null {
  const normalized = candidate?.trim();
  if (!normalized) return null;
  if (!/^[a-z0-9](?:[a-z0-9-]{0,62})$/.test(normalized)) {
    throw new Error('[Effectime configuration] VITE_SUPABASE_PROJECT_ID is invalid.');
  }
  return normalized;
}

export function createPublicRuntimeConfig(input: PublicRuntimeInput): PublicRuntimeConfig {
  const rawUrl = required('VITE_SUPABASE_URL', input.supabaseUrl);
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('[Effectime configuration] VITE_SUPABASE_URL must be an absolute URL.');
  }

  const localHttpAllowed =
    input.allowLocalHttp === true && url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname);
  if (url.protocol !== 'https:' && !localHttpAllowed) {
    throw new Error('[Effectime configuration] VITE_SUPABASE_URL must use HTTPS outside local development.');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('[Effectime configuration] VITE_SUPABASE_URL must not contain credentials or parameters.');
  }
  if (url.pathname !== '/' && url.pathname !== '') {
    throw new Error('[Effectime configuration] VITE_SUPABASE_URL must contain only an origin.');
  }

  const projectRef = projectRefFromHostname(url.hostname);
  const configuredProjectId = validateProjectRef(input.supabaseProjectId);
  if (projectRef && configuredProjectId && configuredProjectId !== projectRef) {
    throw new Error(
      '[Effectime configuration] VITE_SUPABASE_PROJECT_ID does not match VITE_SUPABASE_URL.',
    );
  }

  return {
    supabaseUrl: url.origin,
    supabasePublishableKey: validatePublishableKey(input.supabasePublishableKey),
    // A reviewed project ID keeps client-side storage and native configuration
    // stable if Supabase is later exposed through a custom HTTPS domain.
    supabaseProjectRef: configuredProjectId ?? projectRef,
  };
}

export function buildSupabaseFunctionUrl(functionName: string, supabaseUrl: string): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(functionName)) {
    throw new Error('[Effectime configuration] Invalid Supabase Edge Function name.');
  }
  return new URL(`/functions/v1/${functionName}`, `${supabaseUrl}/`).toString();
}

export const publicRuntimeConfig = createPublicRuntimeConfig({
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabasePublishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  supabaseProjectId: import.meta.env.VITE_SUPABASE_PROJECT_ID,
  allowLocalHttp: import.meta.env.DEV,
});

export const SUPABASE_URL = publicRuntimeConfig.supabaseUrl;
export const SUPABASE_PUBLISHABLE_KEY = publicRuntimeConfig.supabasePublishableKey;
