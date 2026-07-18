import { describe, expect, it } from 'vitest';
import { resolveUnsubscribeOutcome } from '@/lib/unsubscribeResult';

describe('unsubscribe result handling', () => {
  it('shows success only for an explicit successful suppression', () => {
    expect(resolveUnsubscribeOutcome({ success: true }, null)).toBe('done');
  });

  it('preserves the idempotent already-unsubscribed state', () => {
    expect(resolveUnsubscribeOutcome(
      { success: false, reason: 'already_unsubscribed' },
      null,
    )).toBe('already');
  });

  it.each([
    [null, null],
    [{ success: false }, null],
    [{ error: 'failed' }, null],
    [{ success: true }, new Error('HTTP 500')],
  ])('never reports a failed or malformed response as done', (data, error) => {
    expect(resolveUnsubscribeOutcome(data, error)).toBe('error');
  });
});
