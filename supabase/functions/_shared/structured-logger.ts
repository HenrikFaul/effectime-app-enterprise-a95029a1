export const REDACTED_VALUE = "[REDACTED]";
export const REDACTED_EMAIL = "[REDACTED_EMAIL]";

const CIRCULAR_VALUE = "[Circular]";
const MAX_DEPTH_VALUE = "[MaxDepth]";
const MAX_DEPTH = 8;
const MAX_ARRAY_ITEMS = 50;
const MAX_OBJECT_KEYS = 100;
const MAX_STRING_LENGTH = 4_096;
const MAX_JSON_PARSE_LENGTH = 32_768;

const EMAIL_PATTERN = /[\p{L}\p{N}._%+-]+@(?:[\p{L}\p{N}-]+\.)+[\p{L}]{2,}/giu;
const BEARER_PATTERN = /\bBearer\s+[^\s"',;]+/gi;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const COOKIE_HEADER_PATTERN = /(\b(?:cookie|set-cookie)\s*:\s*)[^\r\n]+/gi;
const INLINE_SECRET_PATTERN =
  /((?:["']?(?:access[_-]?token|refresh[_-]?token|token|api[_-]?key|password|passcode|secret(?:[_-]?key)?|private[_-]?key|session(?:[_-]?id)?|sid)["']?\s*[=:]\s*["']?))[^&\s,"';}\]]+/gi;

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogContext = Readonly<Record<string, unknown>>;

export interface LogSink {
  debug: (entry: string) => void;
  info: (entry: string) => void;
  warn: (entry: string) => void;
  error: (entry: string) => void;
}

export interface StructuredLoggerOptions {
  service: string;
  now?: () => Date;
  sink?: LogSink;
}

export interface StructuredLogger {
  debug: (event: string, context?: LogContext) => boolean;
  info: (event: string, context?: LogContext) => boolean;
  warn: (event: string, context?: LogContext) => boolean;
  error: (event: string, context?: LogContext) => boolean;
}

const defaultSink: LogSink = {
  debug: (entry) => console.debug(entry),
  info: (entry) => console.info(entry),
  warn: (entry) => console.warn(entry),
  error: (entry) => console.error(entry),
};

function normalizeKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function isSensitiveKey(key: string): boolean {
  const normalized = normalizeKey(key);
  if (
    normalized === "authorization" ||
    normalized === "cookie" ||
    normalized === "set_cookie" ||
    normalized === "api_key" ||
    normalized === "apikey" ||
    normalized === "service_role_key" ||
    normalized === "password" ||
    normalized === "passcode" ||
    normalized === "secret" ||
    normalized === "token" ||
    normalized === "email" ||
    normalized === "recipient" ||
    normalized === "effective_recipient" ||
    normalized === "private_key" ||
    normalized.includes("credential") ||
    /(?:^|_)(?:password|passcode|secret|token|email|cookie|authorization)(?:_|$)/.test(normalized)
  ) {
    return true;
  }

  return /_(?:password|passcode|secret|token|email|cookie|authorization|api_key)$/.test(normalized);
}

function redactJsonString(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length > MAX_JSON_PARSE_LENGTH) return null;
  if (!(
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  )) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed === null || typeof parsed !== "object") return null;
    return JSON.stringify(redactLogValueInternal(parsed, undefined, new WeakSet<object>(), 0));
  } catch {
    return null;
  }
}

function redactString(value: string): string {
  const redactedJson = redactJsonString(value);
  if (redactedJson !== null) {
    if (redactedJson.length <= MAX_STRING_LENGTH) return redactedJson;
    return `${redactedJson.slice(0, MAX_STRING_LENGTH)}...[truncated]`;
  }

  const redacted = value
    .replace(COOKIE_HEADER_PATTERN, `$1${REDACTED_VALUE}`)
    .replace(BEARER_PATTERN, `Bearer ${REDACTED_VALUE}`)
    .replace(JWT_PATTERN, REDACTED_VALUE)
    .replace(INLINE_SECRET_PATTERN, `$1${REDACTED_VALUE}`)
    .replace(EMAIL_PATTERN, REDACTED_EMAIL);

  if (redacted.length <= MAX_STRING_LENGTH) return redacted;
  return `${redacted.slice(0, MAX_STRING_LENGTH)}...[truncated]`;
}

function redactObject(value: object, seen: WeakSet<object>, depth: number): unknown {
  if (seen.has(value)) return CIRCULAR_VALUE;
  if (depth >= MAX_DEPTH) return MAX_DEPTH_VALUE;

  seen.add(value);
  try {
    if (value instanceof Date) return value.toISOString();
    if (value instanceof URL) return redactString(value.toString());

    if (value instanceof Error) {
      const result: Record<string, unknown> = {
        name: redactString(value.name),
        message: redactString(value.message),
      };
      if (value.stack) result.stack = redactString(value.stack);
      if ("cause" in value) {
        result.cause = redactLogValueInternal(value.cause, "cause", seen, depth + 1);
      }
      for (const key of Object.keys(value).slice(0, MAX_OBJECT_KEYS)) {
        if (key in result) continue;
        result[key] = redactLogValueInternal(
          (value as unknown as Record<string, unknown>)[key],
          key,
          seen,
          depth + 1,
        );
      }
      return result;
    }

    if (Array.isArray(value)) {
      const result = value
        .slice(0, MAX_ARRAY_ITEMS)
        .map((item) => redactLogValueInternal(item, undefined, seen, depth + 1));
      if (value.length > MAX_ARRAY_ITEMS) result.push("[truncated]");
      return result;
    }

    if (value instanceof Map) {
      return redactObject(Object.fromEntries(value), seen, depth + 1);
    }

    if (value instanceof Set) {
      return redactObject(Array.from(value), seen, depth + 1);
    }

    const result: Record<string, unknown> = {};
    const keys = Object.keys(value).slice(0, MAX_OBJECT_KEYS);
    for (const key of keys) {
      try {
        result[key] = redactLogValueInternal(
          (value as Record<string, unknown>)[key],
          key,
          seen,
          depth + 1,
        );
      } catch {
        result[key] = "[Unreadable]";
      }
    }
    if (Object.keys(value).length > MAX_OBJECT_KEYS) result._truncated = true;
    return result;
  } finally {
    seen.delete(value);
  }
}

function redactLogValueInternal(
  value: unknown,
  key: string | undefined,
  seen: WeakSet<object>,
  depth: number,
): unknown {
  if (key && isSensitiveKey(key)) return REDACTED_VALUE;
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return value;
  }
  if (typeof value === "string") return redactString(value);
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "undefined") return "[undefined]";
  if (typeof value === "function") return "[Function]";
  if (typeof value === "symbol") return value.toString();
  if (typeof value === "object") return redactObject(value, seen, depth);
  return redactString(String(value));
}

export function redactLogValue(value: unknown): unknown {
  return redactLogValueInternal(value, undefined, new WeakSet<object>(), 0);
}

export function createStructuredLogger(options: StructuredLoggerOptions): StructuredLogger {
  const sink = options.sink ?? defaultSink;
  const now = options.now ?? (() => new Date());
  const service = redactString(options.service);

  const write = (level: LogLevel, event: string, context: LogContext = {}): boolean => {
    try {
      const entry = {
        timestamp: now().toISOString(),
        level,
        service,
        event: redactString(event),
        context: redactLogValue(context),
      };
      sink[level](JSON.stringify(entry));
      return true;
    } catch {
      // Logging must never change the request outcome or fall back to unsafe raw data.
      return false;
    }
  };

  return {
    debug: (event, context) => write("debug", event, context),
    info: (event, context) => write("info", event, context),
    warn: (event, context) => write("warn", event, context),
    error: (event, context) => write("error", event, context),
  };
}
