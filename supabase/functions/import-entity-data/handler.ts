import {
  CSV_IMPORT_REQUIRED_FEATURE_KEYS,
  planCsvImportAccess,
  type TenantFeatureEntitlement,
} from "./entitlement.ts";
import { safeProviderCode } from "./errors.ts";
import type { ImportActorRole } from "./security.ts";

export const IMPORT_ENTITY_DATA_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "X-Request-Id",
};

export const IMPORT_ENTITY_DATA_MAX_ROWS = 2_000;

export const IMPORT_ENTITY_DATA_SUPPORTED_ENTITIES = [
  "members",
  "leave",
  "offices",
  "work_categories",
  "job_roles",
  "skills",
] as const;

export type ImportEntity =
  (typeof IMPORT_ENTITY_DATA_SUPPORTED_ENTITIES)[number];

export interface ImportRequest {
  workspace_id: string;
  entity: ImportEntity;
  mode: "create" | "upsert";
  rows: Record<string, unknown>[];
  dry_run?: boolean;
}

export interface ImportSummary {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
}

export interface ImportRowError {
  row_index: number;
  field: string;
  value: string;
  code: string;
  reason_code?: string;
  message: string;
}

export interface AuthorizedImportCommand extends ImportRequest {
  actor_id: string;
  actor_role: ImportActorRole;
}

export interface AuthorizedImportResult {
  summary: ImportSummary;
  errors: ImportRowError[];
}

export type ImportAuthenticationResult =
  | { kind: "authenticated"; userId: string }
  | { kind: "denied" }
  | { kind: "unavailable"; providerCode?: unknown };

export type ImportActorResult =
  | { kind: "authorized"; role: ImportActorRole }
  | { kind: "denied" }
  | { kind: "unavailable"; providerCode?: unknown };

export interface ImportEntityDataDependencies {
  authenticate: () => Promise<ImportAuthenticationResult>;
  resolveActor: (
    workspaceId: string,
    userId: string,
  ) => Promise<ImportActorResult>;
  resolveCsvImportEntitlement: (
    workspaceId: string,
  ) => Promise<TenantFeatureEntitlement>;
  executeAuthorizedImport: (
    command: AuthorizedImportCommand,
  ) => Promise<AuthorizedImportResult>;
}

type SafeLogContext = Readonly<{
  request_id: string;
  stage: string;
  code: string;
  provider_code?: string;
  entitlement_step?: string;
  required_features?: readonly string[];
}>;

export interface ImportEntityDataLogger {
  warn: (event: string, context: SafeLogContext) => unknown;
  error: (event: string, context: SafeLogContext) => unknown;
}

export interface ImportEntityDataHandlerOptions {
  createDependencies: (
    authHeader: string,
  ) => ImportEntityDataDependencies | Promise<ImportEntityDataDependencies>;
  logger: ImportEntityDataLogger;
  requestId?: () => string;
}

/**
 * Signals a recoverable provider outage without retaining or exposing the
 * provider's error object/message. Existing domain callers may pass a detail,
 * but it is intentionally discarded at this trust boundary.
 */
export class ImportDependencyError extends Error {
  readonly code = "IMPORT_DEPENDENCY_UNAVAILABLE";

  constructor(_internalDetail?: unknown) {
    super("import_dependency_unavailable");
    this.name = "ImportDependencyError";
  }
}

const jsonHeaders = {
  ...IMPORT_ENTITY_DATA_CORS_HEADERS,
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function createRequestId(candidateFactory?: () => string): string {
  try {
    const candidate = candidateFactory?.() ?? crypto.randomUUID();
    if (/^[A-Za-z0-9_-]{8,64}$/.test(candidate)) return candidate;
  } catch {
    // Request correlation must never change the request outcome.
  }
  return crypto.randomUUID();
}

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
  requestId?: string,
  extraHeaders?: Readonly<Record<string, string>>,
): Response {
  const headers = new Headers({ ...jsonHeaders, ...extraHeaders });
  if (requestId) headers.set("X-Request-Id", requestId);
  return new Response(JSON.stringify(body), { status, headers });
}

function errorResponse(input: {
  status: number;
  error: string;
  code: string;
  requestId: string;
  headers?: Readonly<Record<string, string>>;
}): Response {
  return jsonResponse(
    {
      error: input.error,
      code: input.code,
      ...(input.status >= 500 ? { request_id: input.requestId } : {}),
    },
    input.status,
    input.requestId,
    input.headers,
  );
}

function parseImportRequest(value: unknown):
  | { ok: true; request: ImportRequest }
  | { ok: false; status: number; error: string; code: string } {
  if (!isRecord(value)) {
    return {
      ok: false,
      status: 400,
      error: "Invalid import request",
      code: "INVALID_REQUEST",
    };
  }

  const workspaceId = typeof value.workspace_id === "string"
    ? value.workspace_id.trim()
    : "";
  const entity = value.entity;
  const mode = value.mode;
  const rows = value.rows;
  if (!workspaceId || typeof entity !== "string" || !Array.isArray(rows)) {
    return {
      ok: false,
      status: 400,
      error: "Missing required fields",
      code: "MISSING_REQUIRED_FIELDS",
    };
  }
  if (mode !== "create" && mode !== "upsert") {
    return {
      ok: false,
      status: 400,
      error: "Invalid import mode",
      code: "INVALID_IMPORT_MODE",
    };
  }
  if (rows.length > IMPORT_ENTITY_DATA_MAX_ROWS) {
    return {
      ok: false,
      status: 413,
      error: "Import row limit exceeded",
      code: "IMPORT_ROW_LIMIT_EXCEEDED",
    };
  }
  if (
    !IMPORT_ENTITY_DATA_SUPPORTED_ENTITIES.includes(entity as ImportEntity)
  ) {
    return {
      ok: false,
      status: 400,
      error: "Unsupported import entity",
      code: "UNSUPPORTED_ENTITY",
    };
  }
  if (!rows.every(isRecord)) {
    return {
      ok: false,
      status: 400,
      error: "Import rows must be objects",
      code: "INVALID_IMPORT_ROWS",
    };
  }
  if (value.dry_run !== undefined && typeof value.dry_run !== "boolean") {
    return {
      ok: false,
      status: 400,
      error: "Invalid dry-run flag",
      code: "INVALID_DRY_RUN",
    };
  }

  return {
    ok: true,
    request: {
      workspace_id: workspaceId,
      entity: entity as ImportEntity,
      mode,
      rows,
      ...(value.dry_run === undefined
        ? {}
        : { dry_run: value.dry_run }),
    },
  };
}

export function createImportEntityDataHandler(
  options: ImportEntityDataHandlerOptions,
): (request: Request) => Promise<Response> {
  const logger = options.logger;

  return async (request: Request): Promise<Response> => {
    const requestId = createRequestId(options.requestId);
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: IMPORT_ENTITY_DATA_CORS_HEADERS,
      });
    }
    if (request.method !== "POST") {
      return errorResponse({
        status: 405,
        error: "Method not allowed",
        code: "METHOD_NOT_ALLOWED",
        requestId,
        headers: { Allow: "POST, OPTIONS" },
      });
    }

    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse({
        status: 401,
        error: "Missing Authorization header",
        code: "AUTH_REQUIRED",
        requestId,
      });
    }

    let stage = "dependency_factory";
    try {
      const dependencies = await options.createDependencies(authHeader);

      stage = "authentication";
      const authentication = await dependencies.authenticate();
      if (authentication.kind === "unavailable") {
        logger.error("import_authentication_unavailable", {
          request_id: requestId,
          stage,
          code: "AUTHENTICATION_UNAVAILABLE",
          provider_code: safeProviderCode(authentication.providerCode),
        });
        return errorResponse({
          status: 503,
          error: "Authentication is temporarily unavailable",
          code: "AUTHENTICATION_UNAVAILABLE",
          requestId,
        });
      }
      if (authentication.kind === "denied") {
        return errorResponse({
          status: 401,
          error: "Unauthorized",
          code: "UNAUTHORIZED",
          requestId,
        });
      }

      stage = "request_parse";
      let rawBody: unknown;
      try {
        rawBody = await request.json();
      } catch {
        return errorResponse({
          status: 400,
          error: "Invalid JSON body",
          code: "INVALID_JSON",
          requestId,
        });
      }
      const parsed = parseImportRequest(rawBody);
      if (!parsed.ok) {
        return errorResponse({
          status: parsed.status,
          error: parsed.error,
          code: parsed.code,
          requestId,
        });
      }

      stage = "workspace_authorization";
      const actor = await dependencies.resolveActor(
        parsed.request.workspace_id,
        authentication.userId,
      );
      if (actor.kind === "unavailable") {
        logger.error("import_workspace_authorization_unavailable", {
          request_id: requestId,
          stage,
          code: "AUTHORIZATION_UNAVAILABLE",
          provider_code: safeProviderCode(actor.providerCode),
        });
        return errorResponse({
          status: 503,
          error: "Workspace authorization is temporarily unavailable",
          code: "AUTHORIZATION_UNAVAILABLE",
          requestId,
        });
      }
      if (actor.kind === "denied") {
        logger.warn("import_workspace_authorization_denied", {
          request_id: requestId,
          stage,
          code: "ADMIN_ROLE_REQUIRED",
        });
        return errorResponse({
          status: 403,
          error: "Forbidden: admin role required",
          code: "ADMIN_ROLE_REQUIRED",
          requestId,
        });
      }

      // This preflight completes before the authorized executor. The executor
      // owns all audit events, dry-run accounting and entity reads/writes.
      stage = "csv_import_entitlement";
      const entitlement = await dependencies.resolveCsvImportEntitlement(
        parsed.request.workspace_id,
      );
      const access = planCsvImportAccess(entitlement);
      if (access.kind === "blocked") {
        if (!entitlement.enabled && entitlement.reason === "lookup_error") {
          logger.error("csv_import_entitlement_unavailable", {
            request_id: requestId,
            stage,
            code: access.code,
            entitlement_step: entitlement.step,
            required_features: CSV_IMPORT_REQUIRED_FEATURE_KEYS,
          });
        }
        return errorResponse({
          status: access.status,
          error: access.message,
          code: access.code,
          requestId,
        });
      }

      stage = "authorized_import";
      const result = await dependencies.executeAuthorizedImport({
        ...parsed.request,
        actor_id: authentication.userId,
        actor_role: actor.role,
      });
      return jsonResponse({
        success: true,
        summary: result.summary,
        errors: result.errors,
      }, 200, requestId);
    } catch (error: unknown) {
      const dependencyFailure = error instanceof ImportDependencyError;
      const code = dependencyFailure
        ? "IMPORT_DEPENDENCY_UNAVAILABLE"
        : "INTERNAL_ERROR";
      logger.error("import_request_failed", {
        request_id: requestId,
        stage,
        code,
      });
      return errorResponse({
        status: dependencyFailure ? 503 : 500,
        error: dependencyFailure
          ? "Import dependency is temporarily unavailable"
          : "Internal error",
        code,
        requestId,
      });
    }
  };
}
