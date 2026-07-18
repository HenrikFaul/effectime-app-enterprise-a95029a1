import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), 'utf8');
}

describe('documented feature integration regressions', () => {
  it('keeps the documented project Gantt on a reachable resource path', () => {
    const resources = source('src/components/enterprise/resources/ResourcesTab.tsx');
    expect(resources).toContain("import { GanttTimeline } from './GanttTimeline'");
    expect(resources).toContain('<GanttTimeline workspaceId={workspaceId} />');
    expect(resources).toContain('shouldShowProjectGantt(isEnabled)');
  });

  it('keeps the documented decision-memory editor wired to approval subjects', () => {
    const inbox = source('src/components/enterprise/ApprovalInbox.tsx');
    expect(inbox).toContain("useFeature(workspaceId, 'decision_memory')");
    expect(inbox).toContain('<DecisionMemoryEditor');
    expect(inbox).toContain('subjectType="leave_request"');
  });
});
