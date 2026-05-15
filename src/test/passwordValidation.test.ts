import { describe, it, expect } from 'vitest';
import { validatePassword, isPasswordValid } from '@/lib/passwordValidation';

describe('validatePassword', () => {
  it('returns all false for empty string', () => {
    const r = validatePassword('');
    expect(r.minLength).toBe(false);
    expect(r.hasLower).toBe(false);
    expect(r.hasUpper).toBe(false);
    expect(r.hasNumber).toBe(false);
    expect(r.hasSpecial).toBe(false);
  });

  it('detects minLength ≥ 10', () => {
    expect(validatePassword('abcdefghi').minLength).toBe(false);
    expect(validatePassword('abcdefghij').minLength).toBe(true);
    expect(validatePassword('abcdefghijk').minLength).toBe(true);
  });

  it('detects lowercase letter', () => {
    expect(validatePassword('ABC123!@').hasLower).toBe(false);
    expect(validatePassword('ABCa123!').hasLower).toBe(true);
  });

  it('detects uppercase letter', () => {
    expect(validatePassword('abc123!@').hasUpper).toBe(false);
    expect(validatePassword('abcA123!').hasUpper).toBe(true);
  });

  it('detects digit', () => {
    expect(validatePassword('abcABCD!').hasNumber).toBe(false);
    expect(validatePassword('abcABCD1').hasNumber).toBe(true);
  });

  it('detects special character', () => {
    expect(validatePassword('abcABCD1').hasSpecial).toBe(false);
    expect(validatePassword('abcABCD1!').hasSpecial).toBe(true);
    expect(validatePassword('abcABCD1@').hasSpecial).toBe(true);
    expect(validatePassword('abcABCD1 ').hasSpecial).toBe(true);
  });

  it('fully valid password passes all checks', () => {
    const r = validatePassword('Effectim3!');
    expect(r.minLength).toBe(true);
    expect(r.hasLower).toBe(true);
    expect(r.hasUpper).toBe(true);
    expect(r.hasNumber).toBe(true);
    expect(r.hasSpecial).toBe(true);
  });
});

describe('isPasswordValid', () => {
  it('returns false for weak password', () => {
    expect(isPasswordValid('weak')).toBe(false);
    expect(isPasswordValid('alllower1!')).toBe(false);
    expect(isPasswordValid('ALLUPPER1!')).toBe(false);
    expect(isPasswordValid('NoSpecial1')).toBe(false);
    expect(isPasswordValid('NoNumber!A')).toBe(false);
  });

  it('returns true for strong password', () => {
    expect(isPasswordValid('Effectim3!')).toBe(true);
    expect(isPasswordValid('P@ssw0rd#1')).toBe(true);
  });
});
