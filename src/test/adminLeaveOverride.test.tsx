import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  PropsWithChildren,
  TextareaHTMLAttributes,
} from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AdminLeaveOverride } from '@/components/enterprise/AdminLeaveOverride';

const { calendarDates, from, i18nState, rpc, toastError, toastSuccess, validateLeaveRequest } = vi.hoisted(() => ({
  calendarDates: {
    start: new Date(2026, 6, 21),
    end: new Date(2026, 6, 23),
  },
  from: vi.fn(),
  i18nState: { t: (key: string) => key },
  rpc: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  validateLeaveRequest: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from, rpc },
}));

vi.mock('@/lib/conflictEngine', () => ({ validateLeaveRequest }));
vi.mock('@/lib/conflictEngineI18n', () => ({
  formatConflict: (conflict: { code: string }) => conflict.code,
}));

vi.mock('@/i18n/I18nProvider', () => ({
  useI18n: () => ({ t: i18nState.t }),
  useDateLocale: () => undefined,
}));

vi.mock('sonner', () => ({
  toast: { error: toastError, success: toastSuccess },
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: PropsWithChildren<{ open: boolean }>) => open ? <>{children}</> : null,
  DialogContent: ({ children }: PropsWithChildren) => <div>{children}</div>,
  DialogHeader: ({ children }: PropsWithChildren) => <div>{children}</div>,
  DialogTitle: ({ children }: PropsWithChildren) => <h2>{children}</h2>,
  DialogFooter: ({ children }: PropsWithChildren) => <div>{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    variant: _variant,
    size: _size,
    asChild: _asChild,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: string;
    size?: string;
    asChild?: boolean;
  }) => <button {...props}>{children}</button>,
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: LabelHTMLAttributes<HTMLLabelElement>) => <label {...props}>{children}</label>,
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: (props: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
}));

vi.mock('@/components/ui/select', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  const SelectContext = React.createContext<(value: string) => void>(() => undefined);
  return {
    Select: ({ onValueChange, children }: PropsWithChildren<{ onValueChange: (value: string) => void }>) => (
      <SelectContext.Provider value={onValueChange}>{children}</SelectContext.Provider>
    ),
    SelectTrigger: ({ children }: PropsWithChildren) => <div>{children}</div>,
    SelectValue: () => null,
    SelectContent: ({ children }: PropsWithChildren) => <div>{children}</div>,
    SelectItem: ({ value, children }: PropsWithChildren<{ value: string }>) => {
      const onValueChange = React.useContext(SelectContext);
      return <button type="button" onClick={() => onValueChange(value)}>{children}</button>;
    },
  };
});

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: PropsWithChildren) => <div>{children}</div>,
  PopoverTrigger: ({ children }: PropsWithChildren<{ asChild?: boolean }>) => <>{children}</>,
  PopoverContent: ({ children }: PropsWithChildren) => <div>{children}</div>,
}));

vi.mock('@/components/ui/calendar', () => ({
  Calendar: ({ onSelect, disabled }: { onSelect: (date: Date) => void; disabled?: unknown }) => {
    const isEndDate = typeof disabled === 'function';
    return (
      <button
        type="button"
        aria-label={isEndDate ? 'pick-end-date' : 'pick-start-date'}
        onClick={() => onSelect(isEndDate ? calendarDates.end : calendarDates.start)}
      >
        {isEndDate ? 'pick-end-date' : 'pick-start-date'}
      </button>
    );
  },
}));

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({ checked, onCheckedChange, ...props }: InputHTMLAttributes<HTMLInputElement> & {
    onCheckedChange?: (checked: boolean) => void;
  }) => (
    <input
      {...props}
      type="checkbox"
      checked={checked === true}
      onChange={(event) => onCheckedChange?.(event.target.checked)}
    />
  ),
}));

function installMemberQueries() {
  from.mockImplementation((table: string) => {
    if (table === 'enterprise_memberships') {
      let equalityCount = 0;
      const query = {
        eq: vi.fn(() => {
          equalityCount += 1;
          return equalityCount === 2
            ? Promise.resolve({ data: [{ user_id: 'member-a' }], error: null })
            : query;
        }),
      };
      return { select: vi.fn(() => query) };
    }
    if (table === 'profiles') {
      return {
        select: vi.fn(() => ({
          in: vi.fn().mockResolvedValue({
            data: [{ user_id: 'member-a', display_name: 'Member A' }],
            error: null,
          }),
        })),
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  });
}

function membershipQuery<T>(result: Promise<T>) {
  let equalityCount = 0;
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  query.eq = vi.fn(() => {
    equalityCount += 1;
    return equalityCount === 2 ? result : query;
  });
  return { select: vi.fn(() => query) };
}

async function renderReadyOverride() {
  const onOpenChange = vi.fn();
  const onCreated = vi.fn();
  render(
    <AdminLeaveOverride
      open
      onOpenChange={onOpenChange}
      workspaceId="workspace-a"
      onCreated={onCreated}
    />,
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Member A' }));
  return { onCreated, onOpenChange };
}

function enableHalfDay() {
  fireEvent.click(screen.getByRole('checkbox', { name: 'admin_leave_override.label_half_day' }));
}

function pickStartDate() {
  fireEvent.click(screen.getByRole('button', { name: 'pick-start-date' }));
}

function enterJustification() {
  fireEvent.change(screen.getByPlaceholderText('admin_leave_override.justification_placeholder'), {
    target: { value: 'Documented operational exception' },
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

async function prepareValidatedHalfDay() {
  const callbacks = await renderReadyOverride();
  enableHalfDay();
  pickStartDate();
  fireEvent.click(screen.getByRole('button', { name: 'admin_leave_override.btn_validate' }));
  await screen.findByRole('button', { name: 'admin_leave_override.btn_create' });
  enterJustification();
  return callbacks;
}

beforeEach(() => {
  vi.clearAllMocks();
  calendarDates.start = new Date(2026, 6, 21);
  calendarDates.end = new Date(2026, 6, 23);
  i18nState.t = (key: string) => key;
  installMemberQueries();
  validateLeaveRequest.mockResolvedValue([]);
  rpc.mockResolvedValue({ data: { ok: true }, error: null });
});

describe('admin leave override half-day and validation contract', () => {
  it('validates and creates a fresh half-day with start date as the effective end date', async () => {
    const { onCreated, onOpenChange } = await renderReadyOverride();
    enableHalfDay();
    pickStartDate();

    const validateButton = screen.getByRole('button', { name: 'admin_leave_override.btn_validate' });
    expect(validateButton).toBeEnabled();
    fireEvent.click(validateButton);

    await waitFor(() => expect(validateLeaveRequest).toHaveBeenCalledWith(
      'workspace-a',
      'member-a',
      new Date(2026, 6, 21),
      new Date(2026, 6, 21),
    ));
    enterJustification();
    fireEvent.click(await screen.findByRole('button', { name: 'admin_leave_override.btn_create' }));

    await waitFor(() => expect(rpc).toHaveBeenCalledWith('create_admin_leave_override', expect.objectContaining({
      _workspace_id: 'workspace-a',
      _user_id: 'member-a',
      _start_date: '2026-07-21',
      _end_date: '2026-07-21',
      _is_half_day: true,
      _half_day_period: 'morning',
    })));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onCreated).toHaveBeenCalledOnce();
  }, 10_000);

  it('keeps a full-day override end-date-required and validates the selected range', async () => {
    await renderReadyOverride();
    pickStartDate();
    expect(screen.getByRole('button', { name: 'admin_leave_override.btn_validate' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'pick-end-date' }));
    const validateButton = screen.getByRole('button', { name: 'admin_leave_override.btn_validate' });
    expect(validateButton).toBeEnabled();
    fireEvent.click(validateButton);

    await waitFor(() => expect(validateLeaveRequest).toHaveBeenCalledWith(
      'workspace-a',
      'member-a',
      new Date(2026, 6, 21),
      new Date(2026, 6, 23),
    ));
  });

  it('invalidates prior validation when half-day mode changes and never validates a hidden stale end date', async () => {
    await renderReadyOverride();
    pickStartDate();
    fireEvent.click(screen.getByRole('button', { name: 'pick-end-date' }));
    fireEvent.click(screen.getByRole('button', { name: 'admin_leave_override.btn_validate' }));
    expect(await screen.findByRole('button', { name: 'admin_leave_override.btn_create' })).toBeInTheDocument();

    enableHalfDay();
    const revalidateButton = screen.getByRole('button', { name: 'admin_leave_override.btn_validate' });
    fireEvent.click(revalidateButton);

    await waitFor(() => expect(validateLeaveRequest).toHaveBeenLastCalledWith(
      'workspace-a',
      'member-a',
      new Date(2026, 6, 21),
      new Date(2026, 6, 21),
    ));
  });

  it('clears a hidden end date when a later half-day start is selected before returning to full-day mode', async () => {
    await renderReadyOverride();
    pickStartDate();
    fireEvent.click(screen.getByRole('button', { name: 'pick-end-date' }));

    enableHalfDay();
    calendarDates.start = new Date(2026, 6, 25);
    pickStartDate();
    enableHalfDay();

    const validateButton = screen.getByRole('button', { name: 'admin_leave_override.btn_validate' });
    expect(validateButton).toBeDisabled();
    fireEvent.click(validateButton);
    expect(validateLeaveRequest).not.toHaveBeenCalled();

    calendarDates.end = new Date(2026, 6, 26);
    fireEvent.click(screen.getByRole('button', { name: 'pick-end-date' }));
    expect(validateButton).toBeEnabled();
    fireEvent.click(validateButton);
    await waitFor(() => expect(validateLeaveRequest).toHaveBeenCalledWith(
      'workspace-a',
      'member-a',
      new Date(2026, 6, 25),
      new Date(2026, 6, 26),
    ));
  });

  it('preserves an in-progress form when the translation function identity changes', async () => {
    const callbacks = { onCreated: vi.fn(), onOpenChange: vi.fn() };
    const view = render(
      <AdminLeaveOverride open workspaceId="workspace-a" {...callbacks} />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Member A' }));
    enableHalfDay();
    pickStartDate();
    enterJustification();

    i18nState.t = (key: string) => `translated:${key}`;
    view.rerender(<AdminLeaveOverride open workspaceId="workspace-a" {...callbacks} />);

    expect(screen.getByPlaceholderText(
      'translated:admin_leave_override.justification_placeholder',
    )).toHaveValue('Documented operational exception');
    expect(screen.getByRole('button', { name: 'Member A' })).toBeInTheDocument();
    expect(screen.getByRole('button', {
      name: 'translated:admin_leave_override.btn_validate',
    })).toBeEnabled();
  });

  it('keeps infrastructure validation failures fail-closed and retryable', async () => {
    validateLeaveRequest
      .mockRejectedValueOnce(new Error('validation backend unavailable'))
      .mockResolvedValueOnce([]);
    await renderReadyOverride();
    enableHalfDay();
    pickStartDate();
    fireEvent.click(screen.getByRole('button', { name: 'admin_leave_override.btn_validate' }));

    enterJustification();
    const retryButton = await screen.findByRole('button', { name: 'admin_leave_override.btn_validate' });
    expect(rpc).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith('leave_request.error_validation_failed');

    fireEvent.click(retryButton);
    expect(await screen.findByRole('button', { name: 'admin_leave_override.btn_create' })).toBeEnabled();
    expect(validateLeaveRequest).toHaveBeenCalledTimes(2);
  });

  it('preserves the documented admin ability to override a validated business conflict', async () => {
    validateLeaveRequest.mockResolvedValue([{
      code: 'BLOCKED_DATE',
      severity: 'blocking',
      message: 'Business rule conflict',
    }]);
    await renderReadyOverride();
    enableHalfDay();
    pickStartDate();
    fireEvent.click(screen.getByRole('button', { name: 'admin_leave_override.btn_validate' }));

    enterJustification();
    const createButton = await screen.findByRole('button', { name: 'admin_leave_override.btn_create' });
    expect(createButton).toBeEnabled();
    fireEvent.click(createButton);
    await waitFor(() => expect(rpc).toHaveBeenCalledOnce());
  });

  it('ignores an out-of-order validation result from an obsolete form context', async () => {
    const firstValidation = deferred<Array<{ code: string; severity: string; message: string }>>();
    const secondValidation = deferred<Array<{ code: string; severity: string; message: string }>>();
    validateLeaveRequest
      .mockImplementationOnce(() => firstValidation.promise)
      .mockImplementationOnce(() => secondValidation.promise);

    await renderReadyOverride();
    enableHalfDay();
    pickStartDate();
    fireEvent.click(screen.getByRole('button', { name: 'admin_leave_override.btn_validate' }));

    fireEvent.click(screen.getByRole('button', { name: 'leave_request.afternoon' }));
    fireEvent.click(screen.getByRole('button', { name: 'admin_leave_override.btn_validate' }));

    secondValidation.resolve([]);
    expect(await screen.findByRole('button', { name: 'admin_leave_override.btn_create' })).toBeInTheDocument();

    firstValidation.resolve([{
      code: 'VALIDATION_ERROR',
      severity: 'blocking',
      message: 'obsolete backend response',
    }]);
    await waitFor(() => expect(screen.queryByText('VALIDATION_ERROR')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'admin_leave_override.btn_create' })).toBeInTheDocument();
  });

  it('recovers from an RPC rejection and permits a safe retry', async () => {
    const { onCreated } = await prepareValidatedHalfDay();
    rpc
      .mockRejectedValueOnce(new Error('internal endpoint details'))
      .mockResolvedValueOnce({ data: { ok: true }, error: null });

    fireEvent.click(screen.getByRole('button', { name: 'admin_leave_override.btn_create' }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('admin_leave_override.create_failed'));
    expect(onCreated).not.toHaveBeenCalled();
    expect(screen.queryByText('internal endpoint details')).not.toBeInTheDocument();

    const retryButton = screen.getByRole('button', { name: 'admin_leave_override.btn_create' });
    expect(retryButton).toBeEnabled();
    fireEvent.click(retryButton);
    await waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it('uses a synchronous guard against re-entrant duplicate RPC submissions', async () => {
    const { onCreated } = await prepareValidatedHalfDay();
    const pendingRpc = deferred<{ data: { ok: boolean }; error: null }>();
    const createButton = screen.getByRole('button', { name: 'admin_leave_override.btn_create' });
    rpc.mockImplementationOnce(() => {
      createButton.click();
      return pendingRpc.promise;
    });

    fireEvent.click(createButton);
    expect(rpc).toHaveBeenCalledOnce();

    pendingRpc.resolve({ data: { ok: true }, error: null });
    await waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
    expect(rpc).toHaveBeenCalledOnce();
  });

  it('discards an obsolete member-directory response after the workspace changes', async () => {
    const firstMembershipLoad = deferred<{
      data: Array<{ user_id: string }>;
      error: null;
    }>();
    let membershipCalls = 0;
    from.mockImplementation((table: string) => {
      if (table === 'enterprise_memberships') {
        membershipCalls += 1;
        return membershipQuery(membershipCalls === 1
          ? firstMembershipLoad.promise
          : Promise.resolve({ data: [{ user_id: 'member-b' }], error: null }));
      }
      if (table === 'profiles') {
        return {
          select: vi.fn(() => ({
            in: vi.fn((_column: string, userIds: string[]) => Promise.resolve({
              data: userIds.map(userId => ({
                user_id: userId,
                display_name: userId === 'member-b' ? 'Member B' : 'Member A',
              })),
              error: null,
            })),
          })),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const callbacks = { onCreated: vi.fn(), onOpenChange: vi.fn() };
    const view = render(
      <AdminLeaveOverride open workspaceId="workspace-a" {...callbacks} />,
    );
    await waitFor(() => expect(membershipCalls).toBe(1));
    view.rerender(<AdminLeaveOverride open workspaceId="workspace-b" {...callbacks} />);
    expect(await screen.findByRole('button', { name: 'Member B' })).toBeInTheDocument();

    await act(async () => {
      firstMembershipLoad.resolve({ data: [{ user_id: 'member-a' }], error: null });
      await firstMembershipLoad.promise;
    });
    expect(screen.queryByRole('button', { name: 'Member A' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Member B' })).toBeInTheDocument();
  });

  it('clears the selected member and validated dates when the workspace changes', async () => {
    const callbacks = { onCreated: vi.fn(), onOpenChange: vi.fn() };
    const view = render(
      <AdminLeaveOverride open workspaceId="workspace-a" {...callbacks} />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Member A' }));
    enableHalfDay();
    pickStartDate();
    fireEvent.click(screen.getByRole('button', { name: 'admin_leave_override.btn_validate' }));
    expect(await screen.findByRole('button', { name: 'admin_leave_override.btn_create' })).toBeInTheDocument();

    view.rerender(<AdminLeaveOverride open workspaceId="workspace-b" {...callbacks} />);
    await waitFor(() => expect(
      screen.getByRole('button', { name: 'admin_leave_override.btn_validate' }),
    ).toBeDisabled());
    expect(screen.queryByRole('button', { name: 'admin_leave_override.btn_create' })).not.toBeInTheDocument();
  });

  it('surfaces member-directory failures without rendering backend details', async () => {
    from.mockImplementation((table: string) => {
      if (table === 'enterprise_memberships') {
        return membershipQuery(Promise.resolve({
          data: null,
          error: { message: 'sensitive tenant policy details' },
        }));
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    render(
      <AdminLeaveOverride
        open
        workspaceId="workspace-a"
        onCreated={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );

    await waitFor(() => expect(toastError).toHaveBeenCalledWith(
      'admin_leave_override.members_load_failed',
    ));
    expect(screen.queryByText('sensitive tenant policy details')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'admin_leave_override.btn_validate' })).toBeDisabled();
  });

  it('fails closed when a same-workspace reopen cannot refresh the member directory', async () => {
    let membershipCalls = 0;
    from.mockImplementation((table: string) => {
      if (table === 'enterprise_memberships') {
        membershipCalls += 1;
        return membershipQuery(Promise.resolve(membershipCalls === 1
          ? { data: [{ user_id: 'member-a' }], error: null }
          : { data: null, error: { message: 'directory unavailable' } }));
      }
      if (table === 'profiles') {
        return {
          select: vi.fn(() => ({
            in: vi.fn().mockResolvedValue({
              data: [{ user_id: 'member-a', display_name: 'Member A' }],
              error: null,
            }),
          })),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const callbacks = { onCreated: vi.fn(), onOpenChange: vi.fn() };
    const view = render(<AdminLeaveOverride open workspaceId="workspace-a" {...callbacks} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Member A' }));
    enableHalfDay();
    pickStartDate();
    fireEvent.click(screen.getByRole('button', { name: 'admin_leave_override.btn_validate' }));
    expect(await screen.findByRole('button', { name: 'admin_leave_override.btn_create' })).toBeInTheDocument();

    view.rerender(<AdminLeaveOverride open={false} workspaceId="workspace-a" {...callbacks} />);
    view.rerender(<AdminLeaveOverride open workspaceId="workspace-a" {...callbacks} />);
    await waitFor(() => expect(toastError).toHaveBeenCalledWith(
      'admin_leave_override.members_load_failed',
    ));

    expect(screen.queryByRole('button', { name: 'admin_leave_override.btn_create' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'admin_leave_override.btn_validate' })).toBeDisabled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('discards an obsolete profile-stage response after the workspace changes', async () => {
    const firstProfileLoad = deferred<{
      data: Array<{ user_id: string; display_name: string }>;
      error: null;
    }>();
    let membershipCalls = 0;
    let profileCalls = 0;
    from.mockImplementation((table: string) => {
      if (table === 'enterprise_memberships') {
        membershipCalls += 1;
        const userId = membershipCalls === 1 ? 'member-a' : 'member-b';
        return membershipQuery(Promise.resolve({ data: [{ user_id: userId }], error: null }));
      }
      if (table === 'profiles') {
        profileCalls += 1;
        return {
          select: vi.fn(() => ({
            in: vi.fn(() => profileCalls === 1
              ? firstProfileLoad.promise
              : Promise.resolve({
                data: [{ user_id: 'member-b', display_name: 'Member B' }],
                error: null,
              })),
          })),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const callbacks = { onCreated: vi.fn(), onOpenChange: vi.fn() };
    const view = render(<AdminLeaveOverride open workspaceId="workspace-a" {...callbacks} />);
    await waitFor(() => expect(profileCalls).toBe(1));
    view.rerender(<AdminLeaveOverride open workspaceId="workspace-b" {...callbacks} />);
    expect(await screen.findByRole('button', { name: 'Member B' })).toBeInTheDocument();

    await act(async () => {
      firstProfileLoad.resolve({
        data: [{ user_id: 'member-a', display_name: 'Member A' }],
        error: null,
      });
      await firstProfileLoad.promise;
    });
    expect(screen.queryByRole('button', { name: 'Member A' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Member B' })).toBeInTheDocument();
  });

  it('does not continue directory enrichment after unmount', async () => {
    const membershipLoad = deferred<{
      data: Array<{ user_id: string }>;
      error: null;
    }>();
    from.mockImplementation((table: string) => {
      if (table === 'enterprise_memberships') return membershipQuery(membershipLoad.promise);
      if (table === 'profiles') throw new Error('profiles must not load after unmount');
      throw new Error(`Unexpected table: ${table}`);
    });

    const view = render(
      <AdminLeaveOverride
        open
        workspaceId="workspace-a"
        onCreated={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );
    view.unmount();
    await act(async () => {
      membershipLoad.resolve({ data: [{ user_id: 'member-a' }], error: null });
      await membershipLoad.promise;
    });
    expect(from).toHaveBeenCalledTimes(1);
  });
});
