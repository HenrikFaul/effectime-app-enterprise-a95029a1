/**
 * Locale-aware renderer for `ConflictResult` objects emitted by `validateLeaveRequest`.
 *
 * The engine in `conflictEngine.ts` emits a structured `{ code, params }` plus
 * a Hungarian fallback `message`. UI consumers should call `formatConflict(c, t)`
 * with the `t` function from `useI18n()` so the user sees a message in their
 * current locale. The Hungarian fallback is preserved on the engine output so
 * legacy consumers (toasts, debug logs) keep working.
 */
import type { ConflictResult } from './conflictEngine';

type TFn = (key: any, vars?: Record<string, string>) => string;

function stringifyParams(params: Record<string, string | number> | undefined): Record<string, string> {
  if (!params) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    out[k] = String(v);
  }
  return out;
}

export function formatConflict(c: ConflictResult, t: TFn): string {
  const p = stringifyParams(c.params);
  const hasRole = (p.roleLabel ?? '').length > 0;

  switch (c.code) {
    case 'BLOCKED_DATE':
      return p.reason
        ? t('conflict.blocked_date_with_reason', p)
        : t('conflict.blocked_date', p);
    case 'HOLIDAY_OVERLAP':
      return t('conflict.holiday_overlap', { date: p.date, name: p.name || t('conflict.unknown') });
    case 'MAX_OFF_EXCEEDED':
      return hasRole
        ? t('conflict.max_off_exceeded_scoped', p)
        : t('conflict.max_off_exceeded', p);
    case 'MAX_OFF_WARNING':
      return hasRole
        ? t('conflict.max_off_warning_scoped', p)
        : t('conflict.max_off_warning', p);
    case 'OFFICE_COVERAGE_BREACH':
      return t('conflict.office_coverage_breach', p);
    case 'OFFICE_COVERAGE_WARNING':
      return t('conflict.office_coverage_warning', p);
    case 'SELF_OVERLAP':
      return t('conflict.self_overlap');
    case 'VALIDATION_ERROR':
      // Infrastructure errors may contain internal endpoint or policy details.
      // Always show the localized generic retry message to end users.
      return t('leave_request.error_validation_failed');
    default:
      // Unknown code — fall back to the engine's HU message rather than show a key.
      return c.message;
  }
}
