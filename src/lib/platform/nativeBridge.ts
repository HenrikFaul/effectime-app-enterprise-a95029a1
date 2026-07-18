/**
 * Minimal, fail-closed access to Capacitor's native bridge.
 *
 * Capacitor injects this API at document start on Android and iOS. Keeping this
 * boundary independent from `@capacitor/core` avoids shipping the framework's
 * browser implementation in the shared web artifact while native plugin
 * packages remain installed and discovered by `cap sync`.
 */
export interface NativePluginListenerHandle {
  remove(): Promise<void>;
}

export interface NativeAppPlugin {
  getLaunchUrl(): Promise<{ url: string } | undefined>;
  getState(): Promise<{ isActive: boolean }>;
  addListener(
    eventName: "appUrlOpen",
    listener: (event: { url: string }) => void,
  ): NativePluginListenerHandle | Promise<NativePluginListenerHandle>;
  addListener(
    eventName: "appStateChange",
    listener: (event: { isActive: boolean }) => void,
  ): NativePluginListenerHandle | Promise<NativePluginListenerHandle>;
}

export interface NativeBrowserPlugin {
  open(options: { url: string }): Promise<void>;
  close(): Promise<void>;
}

interface InjectedCapacitorBridge {
  isNativePlatform?: () => boolean;
  Plugins?: {
    App?: unknown;
    Browser?: unknown;
  };
}

function injectedBridge(): InjectedCapacitorBridge | undefined {
  return (globalThis as typeof globalThis & { Capacitor?: InjectedCapacitorBridge }).Capacitor;
}

function hasMethods<T extends object>(
  candidate: unknown,
  methods: readonly (keyof T)[],
): candidate is T {
  if (!candidate || typeof candidate !== "object") return false;
  return methods.every(
    (method) => typeof (candidate as Record<PropertyKey, unknown>)[method] === "function",
  );
}

export function isCapacitorNativeRuntime(): boolean {
  const bridge = injectedBridge();
  if (!bridge) return false;

  // Once Capacitor has started injecting its global, an incomplete or failing
  // platform probe must stay on the PKCE/native path. Falling back to the web
  // implicit flow would be unsafe during a partial bridge initialization.
  if (typeof bridge.isNativePlatform !== "function") return true;
  try {
    return bridge.isNativePlatform() !== false;
  } catch {
    return true;
  }
}

export function getNativeAppPlugin(): NativeAppPlugin | null {
  const plugin = injectedBridge()?.Plugins?.App;
  return hasMethods<NativeAppPlugin>(plugin, ["getLaunchUrl", "getState", "addListener"])
    ? plugin
    : null;
}

export function getNativeBrowserPlugin(): NativeBrowserPlugin | null {
  const plugin = injectedBridge()?.Plugins?.Browser;
  return hasMethods<NativeBrowserPlugin>(plugin, ["open", "close"]) ? plugin : null;
}
