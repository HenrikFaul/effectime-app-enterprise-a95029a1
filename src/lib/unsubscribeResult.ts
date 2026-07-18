export type UnsubscribeOutcome = 'done' | 'already' | 'error';

export function resolveUnsubscribeOutcome(data: unknown, error: unknown): UnsubscribeOutcome {
  if (error) return 'error';
  if (typeof data !== 'object' || data === null) return 'error';
  if ('success' in data && data.success === true) return 'done';
  if ('reason' in data && data.reason === 'already_unsubscribed') return 'already';
  return 'error';
}
