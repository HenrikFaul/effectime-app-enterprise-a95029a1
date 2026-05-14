/**
 * Password policy validator (v3.33.0).
 *
 * Mirrors the server-side `validate_password_policy()` Postgres function
 * and the create-workspace-user edge function check. Used by the
 * frontend for live UX feedback; the server is still the
 * source-of-truth.
 *
 * Rules:
 *   - min 10 chars
 *   - at least 1 uppercase letter
 *   - at least 1 lowercase letter
 *   - at least 1 digit
 *   - at least 1 special (non-alphanumeric) character
 */

export type PasswordPolicyFailure =
  | 'min_length_10'
  | 'requires_uppercase'
  | 'requires_lowercase'
  | 'requires_digit'
  | 'requires_special_char';

export interface PasswordPolicyResult {
  ok: boolean;
  failures: PasswordPolicyFailure[];
}

export function validatePasswordPolicy(password: string): PasswordPolicyResult {
  const failures: PasswordPolicyFailure[] = [];
  if (!password || password.length < 10) failures.push('min_length_10');
  if (!/[A-Z]/.test(password)) failures.push('requires_uppercase');
  if (!/[a-z]/.test(password)) failures.push('requires_lowercase');
  if (!/[0-9]/.test(password)) failures.push('requires_digit');
  if (!/[^A-Za-z0-9]/.test(password)) failures.push('requires_special_char');
  return { ok: failures.length === 0, failures };
}

/** Rules enumerated in order — used by the UI checklist. */
export const PASSWORD_POLICY_RULES: PasswordPolicyFailure[] = [
  'min_length_10',
  'requires_uppercase',
  'requires_lowercase',
  'requires_digit',
  'requires_special_char',
];
