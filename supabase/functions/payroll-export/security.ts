export const PAYROLL_ACTION_FEATURE = {
  'calculate-period': 'payroll_engine',
  'lock-period': 'payroll_engine',
  'export-csv': 'payroll_export',
  'export-api': 'payroll_export',
} as const;

export type PayrollAction = keyof typeof PAYROLL_ACTION_FEATURE;

export function requiredPayrollFeature(action: unknown): string | null {
  if (typeof action !== 'string' || !(action in PAYROLL_ACTION_FEATURE)) return null;
  return PAYROLL_ACTION_FEATURE[action as PayrollAction];
}
