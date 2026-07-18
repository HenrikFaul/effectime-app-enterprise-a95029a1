import { describe, expect, it } from 'vitest';
import {
  assertRequiredWorkspaceContext,
  collectSensitiveNameTerms,
  DEFAULT_COPILOT_MODEL,
  isRateLimitExceeded,
  redactExternalPromptText,
  resolveCopilotModel,
  WorkspaceContextUnavailableError,
} from '../../supabase/functions/ai-copilot/security';

describe('ai-copilot security boundary', () => {
  it('uses only the allowlisted Gemini model', () => {
    expect(resolveCopilotModel(undefined)).toBe(DEFAULT_COPILOT_MODEL);
    expect(resolveCopilotModel('')).toBe(DEFAULT_COPILOT_MODEL);
    expect(resolveCopilotModel(DEFAULT_COPILOT_MODEL)).toBe(DEFAULT_COPILOT_MODEL);
    expect(resolveCopilotModel('gemini-2.5-pro')).toBeNull();
    expect(resolveCopilotModel('../models/attacker-controlled')).toBeNull();
  });

  it('removes identifiable prompt segments but preserves aggregate questions', () => {
    const names = collectSensitiveNameTerms(['Anna Kovács', 'Ferenc Horváth']);
    const prompt = [
      'Anna Kovács szabadsága július 20-án kezdődik.',
      'Hány ember lesz összesen elérhető azon a héten?',
      'Kapcsolat: anna.kovacs@example.com.',
    ].join(' ');

    const redacted = redactExternalPromptText(prompt, names);

    expect(redacted).not.toContain('Anna');
    expect(redacted).not.toContain('Kovács');
    expect(redacted).not.toContain('anna.kovacs@example.com');
    expect(redacted).not.toContain('július 20');
    expect(redacted).toContain('Hány ember lesz összesen elérhető azon a héten?');
  });

  it('redacts user identifiers sent in a prompt', () => {
    const redacted = redactExternalPromptText(
      'Check 4f693383-0b77-4ff8-8df6-6d4edb9d2271 leave balance. Show aggregate capacity.',
      [],
    );
    expect(redacted).not.toContain('4f693383-0b77-4ff8-8df6-6d4edb9d2271');
    expect(redacted).toContain('Show aggregate capacity.');
  });

  it('redacts inflected member names in Hungarian text', () => {
    const redacted = redactExternalPromptText(
      'Kovácsnak 8 nap szabadsága maradt. Mutasd az összesített keretet.',
      collectSensitiveNameTerms(['Anna Kovács']),
    );
    expect(redacted).not.toContain('Kovácsnak');
    expect(redacted).not.toContain('8 nap');
    expect(redacted).toContain('Mutasd az összesített keretet.');
  });

  it('allows the twentieth rolling-hour hit and rejects the twenty-first', () => {
    expect(isRateLimitExceeded(20)).toBe(false);
    expect(isRateLimitExceeded(21)).toBe(true);
  });

  it('fails closed when any required aggregate context query fails', () => {
    expect(() => assertRequiredWorkspaceContext([
      { name: 'memberships', error: null },
      { name: 'leave_requests', error: { message: 'relation unavailable' } },
    ])).toThrow(WorkspaceContextUnavailableError);
    expect(() => assertRequiredWorkspaceContext([
      { name: 'memberships', error: null },
      { name: 'leave_requests', error: null },
    ])).not.toThrow();
  });
});
