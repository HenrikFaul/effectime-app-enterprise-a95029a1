import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const importer = readFileSync(
  join(process.cwd(), 'supabase/functions/import-entity-data/index.ts'),
  'utf8',
);

describe('CSV import domain error sanitization contract', () => {
  it('never exposes provider write messages or unbounded row values', () => {
    expect(importer).not.toContain('message: error.message');
    expect(importer).not.toMatch(
      /new ImportDependencyError\([^\n)]*(?:\.message|\berror\b)[^\n)]*\)/,
    );
    expect(importer.match(/errors\.push\(rowWriteFailure\(/g)).toHaveLength(10);

    const directRowErrors = importer.match(/errors\.push\(\{[\s\S]*?\}\);/g) ?? [];
    expect(directRowErrors.length).toBeGreaterThan(0);
    for (const rowError of directRowErrors) {
      expect(rowError).toMatch(/value:\s*boundedImportRowValue\(/);
      expect(rowError).not.toMatch(/message:\s*`[^`]*\$\{/);
    }

    expect(importer).toContain('provider_code: safeProviderCode(error.code)');
    expect(importer).toContain("code: 'DB_ERROR'");
    expect(importer).toContain("reason_code: 'INVITATION_FAILED'");
    expect(importer).toContain("message: 'Invitation could not be issued'");
  });

  it.each([
    ['officesError', 'member_offices_lookup'],
    ['membershipsError', 'member_memberships_lookup'],
    ['workspaceMembershipsError', 'leave_memberships_lookup'],
    ['existingLeaveError', 'leave_existing_lookup'],
    ['officeLookupError', 'office_existing_lookup'],
    ['workCategoryLookupError', 'work_category_existing_lookup'],
    ['jobCategoryLookupError', 'job_category_lookup'],
    ['jobRoleLookupError', 'job_role_existing_lookup'],
    ['skillLookupError', 'skill_existing_lookup'],
  ])('fails closed when %s reports a provider outage', (errorName, step) => {
    expect(importer).toContain(`if (${errorName}) {`);
    expect(importer).toContain(`throw new ImportDependencyError('${step}')`);
  });

  it('blocks entity work when the start audit fails but does not invite unsafe retries after writes', () => {
    const startAudit = importer.indexOf("action: 'import.started'");
    const entitySwitch = importer.indexOf('switch (entity)');
    const completionAudit = importer.indexOf(
      "action: errors.length > 0 ? 'import.completed_with_errors' : 'import.completed'",
    );

    expect(startAudit).toBeGreaterThan(-1);
    expect(entitySwitch).toBeGreaterThan(startAudit);
    expect(completionAudit).toBeGreaterThan(entitySwitch);
    expect(importer.slice(startAudit, entitySwitch)).toContain(
      "throw new ImportDependencyError('audit_start_write')",
    );

    const completionPath = importer.slice(completionAudit, importer.indexOf('\n  return { summary, errors };'));
    expect(completionPath).toContain("logger.warn('import_completion_audit_failed_after_writes'");
    expect(completionPath).not.toContain('throw new ImportDependencyError');
    expect(completionPath).not.toContain('auditCompletionError.message');
  });
});
