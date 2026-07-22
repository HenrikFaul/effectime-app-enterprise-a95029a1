import { createRef, useState, type FormEvent, type FormEventHandler, type Ref } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { CollapsibleCardTrigger } from '@/components/ui/collapsible-card-trigger';
import { Badge } from '@/components/ui/badge';

afterEach(cleanup);

function TriggerHarness({
  disabled = false,
  onSubmit,
  triggerRef,
}: {
  disabled?: boolean;
  onSubmit?: FormEventHandler<HTMLFormElement>;
  triggerRef?: Ref<HTMLButtonElement>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <form onSubmit={onSubmit}>
      <Collapsible open={open} onOpenChange={setOpen} disabled={disabled}>
        <CollapsibleCardTrigger
          ref={triggerRef}
          label="Members: 3"
          contentClassName="flex items-center gap-2"
        >
          <span>Members</span>
          <Badge>3</Badge>
        </CollapsibleCardTrigger>
        <CollapsibleContent>Member details</CollapsibleContent>
      </Collapsible>
    </form>
  );
}

describe('CollapsibleCardTrigger', () => {
  it('renders a focusable native non-submit button and keeps card content outside it', () => {
    const onSubmit = vi.fn((event: FormEvent<HTMLFormElement>) => event.preventDefault());
    const triggerRef = createRef<HTMLButtonElement>();
    render(<TriggerHarness onSubmit={onSubmit} triggerRef={triggerRef} />);

    const trigger = screen.getByRole('button', { name: 'Members: 3' });
    const visibleCount = screen.getByText('3');

    expect(trigger.tagName).toBe('BUTTON');
    expect(trigger).toHaveAttribute('type', 'button');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('aria-controls');
    expect(triggerRef.current).toBe(trigger);
    expect(trigger.contains(visibleCount)).toBe(false);
    expect(visibleCount.closest('[aria-hidden="true"]')).toBeInTheDocument();
    expect(document.querySelector('div[type="button"]')).not.toBeInTheDocument();

    trigger.focus();
    expect(document.activeElement).toBe(trigger);
    fireEvent.click(trigger);

    expect(onSubmit).not.toHaveBeenCalled();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Member details')).toBeVisible();

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Member details')).not.toBeInTheDocument();
  });

  it('honors a disabled Collapsible root without opening content', () => {
    render(<TriggerHarness disabled />);

    const trigger = screen.getByRole('button', { name: 'Members: 3' });
    expect(trigger).toBeDisabled();

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Member details')).not.toBeInTheDocument();
  });
});

function collectTsxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return collectTsxFiles(path);
    return entry.isFile() && entry.name.endsWith('.tsx') ? [path] : [];
  });
}

describe('collapsible card trigger source contract', () => {
  const componentsRoot = resolve(process.cwd(), 'src/components');
  const expectedSites = [
    ['enterprise/WorkspaceDashboard.tsx', 10],
    ['enterprise/ReportsAndAuditTab.tsx', 3],
    ['enterprise/InvitationsPanel.tsx', 1],
    ['enterprise/MemberList.tsx', 1],
    ['enterprise/workflows/OnboardingTemplates.tsx', 1],
    ['enterprise/workflows/AccessTemplates.tsx', 1],
  ] as const;

  it('eliminates every div-backed CollapsibleTrigger/Card composition', () => {
    const componentSource = collectTsxFiles(componentsRoot)
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n');

    expect(componentSource).not.toMatch(
      /<CollapsibleTrigger\b[^>]*\basChild(?:=\{true\})?[^>]*>\s*<Card\b/,
    );
  });

  it('routes all 17 audited sites through the shared native trigger', () => {
    for (const [relativePath, expectedCount] of expectedSites) {
      const source = readFileSync(resolve(componentsRoot, relativePath), 'utf8');
      expect(source.match(/<CollapsibleCardTrigger\b/g) ?? [], relativePath).toHaveLength(expectedCount);
    }
  });
});
