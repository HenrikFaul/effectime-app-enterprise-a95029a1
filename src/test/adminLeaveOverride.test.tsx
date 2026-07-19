import type {
  ButtonHTMLAttributes,
  ComponentProps,
  HTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  PropsWithChildren,
  TextareaHTMLAttributes,
} from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AdminLeaveOverride as ProductionAdminLeaveOverride } from '@/components/enterprise/AdminLeaveOverride';

const {
  calendarDates,
  from,
  i18nState,
  outboxComplete,
  outboxEntries,
  outboxGetOrCreate,
  rpc,
  toastError,
  toastSuccess,
  validateLeaveRequest,
} = vi.hoisted(() => ({
  calendarDates: {
    start: new Date(2026, 6, 21),
    end: new Date(2026, 6, 23),
  },
  from: vi.fn(),
  i18nState: { t: (key: string) => key },
  outboxComplete: vi.fn(),
  outboxEntries: new Map<string, {
    version: 1;
    scope: { workspaceId: string; actorId: string };
    payloadDigest: string;
    key: string;
    createdAt: number;
  }>(),
  outboxGetOrCreate: vi.fn(),
  rpc: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  validateLeaveRequest: vi.fn(),
}));

const successfulOverrideResponse = {
  ok: true,
  request_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  status: 'approved',
} as const;

type PendingRpcResponse = {
  data: typeof successfulOverrideResponse;
  error: null;
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from, rpc },
}));

vi.mock('@/lib/adminLeaveOverrideOutbox', () => ({
  createAdminLeaveOverrideOutbox: () => ({
    getOrCreate: outboxGetOrCreate,
    complete: outboxComplete,
  }),
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
  DialogContent: ({
    children,
    closeLabel = 'Close',
    closeDisabled = false,
    onCloseAutoFocus: _onCloseAutoFocus,
    onEscapeKeyDown: _onEscapeKeyDown,
    onInteractOutside: _onInteractOutside,
    ...props
  }: PropsWithChildren<HTMLAttributes<HTMLDivElement> & {
    closeLabel?: string;
    closeDisabled?: boolean;
    onCloseAutoFocus?: unknown;
    onEscapeKeyDown?: unknown;
    onInteractOutside?: unknown;
  }>) => (
    <div role="dialog" {...props}>
      <button type="button" aria-label={closeLabel} disabled={closeDisabled} />
      {children}
    </div>
  ),
  DialogHeader: ({ children }: PropsWithChildren) => <div>{children}</div>,
  DialogTitle: ({ children }: PropsWithChildren) => <h2>{children}</h2>,
  DialogFooter: ({ children }: PropsWithChildren) => <div>{children}</div>,
}));

vi.mock('@/components/ui/button', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  return {
    Button: React.forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: string;
    size?: string;
    asChild?: boolean;
    }>(({
      children,
      variant: _variant,
      size: _size,
      asChild: _asChild,
      ...props
    }, ref) => <button ref={ref} {...props}>{children}</button>),
  };
});

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: LabelHTMLAttributes<HTMLLabelElement>) => <label {...props}>{children}</label>,
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: (props: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
}));

vi.mock('@/components/ui/select', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  const SelectContext = React.createContext<{
    disabled: boolean;
    onValueChange: (value: string) => void;
  }>({ disabled: false, onValueChange: () => undefined });
  return {
    Select: ({ disabled = false, onValueChange, children }: PropsWithChildren<{
      disabled?: boolean;
      onValueChange: (value: string) => void;
    }>) => (
      <SelectContext.Provider value={{ disabled, onValueChange }}>{children}</SelectContext.Provider>
    ),
    SelectTrigger: React.forwardRef<HTMLButtonElement, PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>>(
      ({ children, ...props }, ref) => {
        const { disabled } = React.useContext(SelectContext);
        return (
          <button ref={ref} type="button" role="combobox" {...props} disabled={disabled || props.disabled}>
            {children}
          </button>
        );
      },
    ),
    SelectValue: () => null,
    SelectContent: ({ children }: PropsWithChildren) => <div>{children}</div>,
    SelectItem: ({ value, children }: PropsWithChildren<{ value: string }>) => {
      const { onValueChange } = React.useContext(SelectContext);
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

const defaultActorId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
type TestAdminLeaveOverrideProps = Omit<
  ComponentProps<typeof ProductionAdminLeaveOverride>,
  'actorId'
> & { actorId?: string };

function AdminLeaveOverride({
  actorId = defaultActorId,
  ...props
}: TestAdminLeaveOverrideProps) {
  return <ProductionAdminLeaveOverride actorId={actorId} {...props} />;
}

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
  const view = render(
    <AdminLeaveOverride
      open
      onOpenChange={onOpenChange}
      workspaceId="workspace-a"
      onCreated={onCreated}
    />,
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Member A' }, { timeout: 5_000 }));
  return { onCreated, onOpenChange, view };
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
  outboxEntries.clear();
  outboxGetOrCreate.mockImplementation(async (
    scope: { workspaceId: string; actorId: string },
    payload: string,
  ) => {
    const storageKey = JSON.stringify([scope.workspaceId, scope.actorId, payload]);
    const existing = outboxEntries.get(storageKey);
    if (existing) return existing;
    const unresolvedInScope = Array.from(outboxEntries.values()).some(entry => (
      entry.scope.workspaceId === scope.workspaceId
      && entry.scope.actorId === scope.actorId
    ));
    if (unresolvedInScope) {
      const error = new Error('The scope has an unresolved admin leave override') as Error & {
        code: 'unresolved-operation';
      };
      error.name = 'AdminLeaveOverrideOutboxError';
      error.code = 'unresolved-operation';
      throw error;
    }
    const entry = {
      version: 1 as const,
      scope,
      payloadDigest: 'a'.repeat(64),
      key: crypto.randomUUID(),
      createdAt: Date.now(),
    };
    outboxEntries.set(storageKey, entry);
    return entry;
  });
  outboxComplete.mockImplementation(async (entry: { key: string; scope: {
    workspaceId: string;
    actorId: string;
  } }) => {
    const match = Array.from(outboxEntries.entries()).find(([, persisted]) => (
      persisted.key === entry.key
      && persisted.scope.workspaceId === entry.scope.workspaceId
      && persisted.scope.actorId === entry.scope.actorId
    ));
    if (!match) return false;
    outboxEntries.delete(match[0]);
    return true;
  });
  calendarDates.start = new Date(2026, 6, 21);
  calendarDates.end = new Date(2026, 6, 23);
  i18nState.t = (key: string) => key;
  installMemberQueries();
  validateLeaveRequest.mockResolvedValue([]);
  rpc.mockResolvedValue({ data: successfulOverrideResponse, error: null });
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

    await waitFor(() => expect(rpc).toHaveBeenCalledWith('create_admin_leave_override_v2', expect.objectContaining({
      _workspace_id: 'workspace-a',
      _user_id: 'member-a',
      _start_date: '2026-07-21',
      _end_date: '2026-07-21',
      _is_half_day: true,
      _half_day_period: 'morning',
      _idempotency_key: expect.stringMatching(/^[0-9a-f-]{36}$/i),
    })));
    expect(outboxGetOrCreate).toHaveBeenCalledWith(
      { workspaceId: 'workspace-a', actorId: defaultActorId },
      expect.any(String),
    );
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

  it('keeps an uncertain transport outcome fail-closed when the payload changes', async () => {
    const { onCreated } = await prepareValidatedHalfDay();
    rpc.mockRejectedValueOnce(new Error('internal endpoint details'));

    fireEvent.click(screen.getByRole('button', { name: 'admin_leave_override.btn_create' }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith(
      'admin_leave_override.outcome_uncertain',
    ));
    expect(onCreated).not.toHaveBeenCalled();
    expect(screen.queryByText('internal endpoint details')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('admin_leave_override.outcome_uncertain');

    fireEvent.change(screen.getByRole('textbox', {
      name: 'admin_leave_override.label_justification',
    }), { target: { value: 'Updated documented exception' } });
    expect(screen.getByRole('alert')).toHaveTextContent('admin_leave_override.outcome_uncertain');

    const retryButton = screen.getByRole('button', { name: 'admin_leave_override.btn_create' });
    fireEvent.click(retryButton);

    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(2));
    expect(toastError).toHaveBeenLastCalledWith('admin_leave_override.outcome_uncertain');
    expect(onCreated).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledOnce();
    expect(outboxEntries.size).toBe(1);
  }, 10_000);

  it('retains a rejected key and blocks a changed payload until an exact retry succeeds', async () => {
    const { onCreated } = await prepareValidatedHalfDay();
    rpc
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'sensitive tenant policy details' },
        status: 400,
      })
      .mockResolvedValueOnce({ data: successfulOverrideResponse, error: null });

    fireEvent.click(screen.getByRole('button', { name: 'admin_leave_override.btn_create' }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith(
      'admin_leave_override.create_failed',
    ));
    const rejectedKey = rpc.mock.calls[0][1]._idempotency_key;
    expect(screen.queryByText('sensitive tenant policy details')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('admin_leave_override.create_failed');
    expect(outboxEntries.size).toBe(1);

    const justification = screen.getByRole('textbox', {
      name: 'admin_leave_override.label_justification',
    });
    fireEvent.change(justification, { target: { value: 'Updated documented exception' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'admin_leave_override.btn_create' }));

    await waitFor(() => expect(toastError).toHaveBeenLastCalledWith(
      'admin_leave_override.outcome_uncertain',
    ));
    expect(onCreated).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledOnce();
    expect(outboxEntries.size).toBe(1);

    fireEvent.change(justification, { target: { value: 'Documented operational exception' } });
    fireEvent.click(screen.getByRole('button', { name: 'admin_leave_override.btn_create' }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[1][1]._idempotency_key).toBe(rejectedKey);
    expect(outboxEntries.size).toBe(0);
  }, 10_000);

  it('reuses the same idempotency key for an unchanged RPC retry', async () => {
    const { onCreated } = await prepareValidatedHalfDay();
    rpc
      .mockRejectedValueOnce(new Error('response lost after commit'))
      .mockResolvedValueOnce({ data: successfulOverrideResponse, error: null });

    const createButton = screen.getByRole('button', { name: 'admin_leave_override.btn_create' });
    fireEvent.click(createButton);
    await waitFor(() => expect(toastError).toHaveBeenCalledWith(
      'admin_leave_override.outcome_uncertain',
    ));
    fireEvent.click(createButton);

    await waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[1][1]._idempotency_key).toBe(
      rpc.mock.calls[0][1]._idempotency_key,
    );
  }, 10_000);

  it('restores the same durable key after an uncertain response and component restart', async () => {
    const first = await prepareValidatedHalfDay();
    rpc.mockRejectedValueOnce(new Error('transport ended after an unknown commit state'));

    fireEvent.click(screen.getByRole('button', { name: 'admin_leave_override.btn_create' }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith(
      'admin_leave_override.outcome_uncertain',
    ));
    const firstKey = rpc.mock.calls[0][1]._idempotency_key;
    first.view.unmount();

    const second = await prepareValidatedHalfDay();
    fireEvent.click(screen.getByRole('button', { name: 'admin_leave_override.btn_create' }));
    await waitFor(() => expect(second.onCreated).toHaveBeenCalledOnce());

    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[1][1]._idempotency_key).toBe(firstKey);
    expect(outboxEntries.size).toBe(0);
  }, 10_000);

  it('uses a synchronous guard against re-entrant duplicate RPC submissions', async () => {
    const { onCreated } = await prepareValidatedHalfDay();
    const pendingRpc = deferred<PendingRpcResponse>();
    const createButton = screen.getByRole('button', { name: 'admin_leave_override.btn_create' });
    rpc.mockImplementationOnce(() => {
      createButton.click();
      return pendingRpc.promise;
    });

    fireEvent.click(createButton);
    await waitFor(() => expect(rpc).toHaveBeenCalledOnce());

    pendingRpc.resolve({ data: successfulOverrideResponse, error: null });
    await waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
    expect(rpc).toHaveBeenCalledOnce();
  });

  it('ignores an obsolete successful RPC response after the workspace scope changes', async () => {
    const { onCreated, onOpenChange, view } = await prepareValidatedHalfDay();
    const pendingRpc = deferred<PendingRpcResponse>();
    rpc.mockReturnValueOnce(pendingRpc.promise);
    fireEvent.click(screen.getByRole('button', { name: 'admin_leave_override.btn_create' }));
    await waitFor(() => expect(rpc).toHaveBeenCalledOnce());

    view.rerender(
      <AdminLeaveOverride
        open
        workspaceId="workspace-b"
        onCreated={onCreated}
        onOpenChange={onOpenChange}
      />,
    );
    await act(async () => {
      pendingRpc.resolve({ data: successfulOverrideResponse, error: null });
      await pendingRpc.promise;
    });

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it('does not publish stale RPC side effects after unmount', async () => {
    const { onCreated, onOpenChange, view } = await prepareValidatedHalfDay();
    const pendingRpc = deferred<PendingRpcResponse>();
    rpc.mockReturnValueOnce(pendingRpc.promise);
    fireEvent.click(screen.getByRole('button', { name: 'admin_leave_override.btn_create' }));
    await waitFor(() => expect(rpc).toHaveBeenCalledOnce());

    view.unmount();
    await act(async () => {
      pendingRpc.resolve({ data: successfulOverrideResponse, error: null });
      await pendingRpc.promise;
    });

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
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

  it('reloads the member directory and clears validated state when the actor changes', async () => {
    const callbacks = { onCreated: vi.fn(), onOpenChange: vi.fn() };
    const view = render(
      <AdminLeaveOverride open workspaceId="workspace-a" {...callbacks} />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Member A' }));
    enableHalfDay();
    pickStartDate();
    fireEvent.click(screen.getByRole('button', { name: 'admin_leave_override.btn_validate' }));
    expect(await screen.findByRole('button', { name: 'admin_leave_override.btn_create' })).toBeInTheDocument();

    view.rerender(
      <AdminLeaveOverride
        open
        workspaceId="workspace-a"
        actorId="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
        {...callbacks}
      />,
    );

    await waitFor(() => expect(
      screen.getByRole('button', { name: 'admin_leave_override.btn_validate' }),
    ).toBeDisabled());
    expect(screen.queryByRole('button', { name: 'admin_leave_override.btn_create' })).not.toBeInTheDocument();
    expect(from.mock.calls.filter(([table]) => table === 'enterprise_memberships')).toHaveLength(2);
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

  it('associates every visible field label with its control and exposes required state', async () => {
    await renderReadyOverride();

    expect(screen.getByRole('combobox', {
      name: 'admin_leave_override.label_member (common.required)',
    })).toHaveAttribute('aria-required', 'true');
    expect(screen.getByRole('combobox', {
      name: 'admin_leave_override.label_type',
    })).toHaveAttribute('aria-required', 'true');
    expect(screen.getByRole('button', {
      name: 'admin_leave_override.label_start_date (common.required) admin_leave_override.pick_date',
    })).not.toHaveAttribute('aria-required');
    expect(screen.getByRole('button', {
      name: 'admin_leave_override.label_end_date (common.required) admin_leave_override.pick_date',
    })).not.toHaveAttribute('aria-required');
    expect(screen.getByRole('textbox', {
      name: 'admin_leave_override.label_comment',
    })).toHaveAttribute('maxlength', '4000');
    expect(screen.getByRole('textbox', {
      name: 'admin_leave_override.label_justification',
    })).toBeRequired();
    expect(screen.getByRole('textbox', {
      name: 'admin_leave_override.label_justification',
    })).toHaveAttribute('maxlength', '2000');
    expect(screen.getByRole('checkbox', {
      name: 'admin_leave_override.auto_approve_label',
    })).toBeChecked();

    const halfDay = screen.getByRole('checkbox', {
      name: 'admin_leave_override.label_half_day',
    });
    expect(halfDay.id).not.toBe('halfday');
    fireEvent.click(halfDay);
    expect(screen.getByRole('combobox', {
      name: 'admin_leave_override.label_half_day_period',
    })).toHaveAttribute('aria-required', 'true');
  });

  it('generates collision-free half-day identifiers across concurrent dialogs', async () => {
    render(
      <>
        <AdminLeaveOverride open workspaceId="workspace-a" onCreated={vi.fn()} onOpenChange={vi.fn()} />
        <AdminLeaveOverride open workspaceId="workspace-a" onCreated={vi.fn()} onOpenChange={vi.fn()} />
      </>,
    );

    const halfDayControls = await screen.findAllByRole('checkbox', {
      name: 'admin_leave_override.label_half_day',
    });
    expect(halfDayControls).toHaveLength(2);
    expect(halfDayControls[0].id).not.toBe(halfDayControls[1].id);
  });

  it('keeps an empty member directory fail-closed and explains the state', async () => {
    from.mockImplementation((table: string) => {
      if (table === 'enterprise_memberships') {
        return membershipQuery(Promise.resolve({ data: [], error: null }));
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

    const emptyMessage = await screen.findByText('admin_leave_override.members_empty');
    expect(emptyMessage).toHaveAttribute('role', 'status');
    expect(screen.getByRole('combobox', {
      name: 'admin_leave_override.label_member (common.required)',
    })).toBeDisabled();
    expect(screen.getByRole('button', {
      name: 'admin_leave_override.btn_validate',
    })).toBeDisabled();
  });

  it('announces and exposes busy state while conflict validation is in flight', async () => {
    const pendingValidation = deferred<Array<{ code: string; severity: string; message: string }>>();
    validateLeaveRequest.mockReturnValueOnce(pendingValidation.promise);
    await renderReadyOverride();
    enableHalfDay();
    pickStartDate();

    fireEvent.click(screen.getByRole('button', {
      name: 'admin_leave_override.btn_validate',
    }));

    const validatingButton = screen.getByRole('button', {
      name: 'admin_leave_override.btn_validating',
    });
    expect(validatingButton).toBeDisabled();
    expect(validatingButton).toHaveAttribute('aria-busy', 'true');
    const liveMessage = screen.getByText('admin_leave_override.btn_validating', {
      selector: 'p',
    });
    const busyRegion = screen.getByRole('textbox', {
      name: 'admin_leave_override.label_justification',
    }).closest('[aria-busy]');
    expect(busyRegion).toHaveAttribute('aria-busy', 'true');
    expect(busyRegion).not.toContainElement(liveMessage);
    expect(liveMessage).toHaveAttribute('role', 'status');
    expect(liveMessage).toHaveAttribute('aria-live', 'polite');
    expect(liveMessage).toHaveAttribute('aria-atomic', 'true');

    pendingValidation.resolve([]);
    const noConflictMessage = await screen.findByText('admin_leave_override.no_conflicts');
    expect(noConflictMessage).toHaveAttribute('role', 'status');
  });

  it('announces blocking validation results as alerts', async () => {
    validateLeaveRequest.mockResolvedValueOnce([{
      code: 'BLOCKED_DATE',
      severity: 'blocking',
      message: 'Business rule conflict',
    }]);
    await renderReadyOverride();
    enableHalfDay();
    pickStartDate();
    fireEvent.click(screen.getByRole('button', {
      name: 'admin_leave_override.btn_validate',
    }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('BLOCKED_DATE');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
  });

  it('locks visible dismissal actions and mutable controls while creation is in flight', async () => {
    await prepareValidatedHalfDay();
    const pendingRpc = deferred<PendingRpcResponse>();
    rpc.mockReturnValueOnce(pendingRpc.promise);

    fireEvent.click(screen.getByRole('button', {
      name: 'admin_leave_override.btn_create',
    }));

    const busyRegion = screen.getByRole('textbox', {
      name: 'admin_leave_override.label_justification',
    }).closest('[aria-busy]');
    expect(busyRegion).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: 'common.close' })).toBeDisabled();
    expect(screen.getByRole('button', {
      name: 'admin_leave_override.btn_cancel',
    })).toBeDisabled();
    expect(screen.getByRole('button', {
      name: 'admin_leave_override.btn_creating',
    })).toHaveAttribute('aria-busy', 'true');
    const liveMessage = screen.getByText('admin_leave_override.btn_creating', {
      selector: 'p',
    });
    expect(liveMessage).toHaveAttribute('role', 'status');
    expect(liveMessage).toHaveAttribute('aria-live', 'polite');
    expect(busyRegion).not.toContainElement(liveMessage);
    expect(screen.getByRole('combobox', {
      name: 'admin_leave_override.label_member (common.required)',
    })).toBeDisabled();
    expect(screen.getByRole('textbox', {
      name: 'admin_leave_override.label_justification',
    })).toBeDisabled();
    expect(screen.getByRole('checkbox', {
      name: 'admin_leave_override.auto_approve_label',
    })).toBeDisabled();

    pendingRpc.resolve({ data: successfulOverrideResponse, error: null });
    await waitFor(() => expect(busyRegion).toHaveAttribute('aria-busy', 'false'));
  });

  it('restores focus after retrying the member directory', async () => {
    let membershipCalls = 0;
    from.mockImplementation((table: string) => {
      if (table === 'enterprise_memberships') {
        membershipCalls += 1;
        return membershipQuery(Promise.resolve(membershipCalls === 1
          ? { data: null, error: { message: 'temporary failure' } }
          : { data: [{ user_id: 'member-a' }], error: null }));
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

    render(
      <AdminLeaveOverride
        open
        workspaceId="workspace-a"
        onCreated={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );
    const retry = await screen.findByRole('button', {
      name: 'admin_leave_override.members_retry',
    });
    retry.focus();
    fireEvent.click(retry);

    const memberSelect = await screen.findByRole('combobox', {
      name: 'admin_leave_override.label_member (common.required)',
    });
    await waitFor(() => expect(memberSelect).toHaveFocus());
  });

  it('returns focus to the retry action when the directory remains unavailable', async () => {
    let membershipCalls = 0;
    from.mockImplementation((table: string) => {
      if (table === 'enterprise_memberships') {
        membershipCalls += 1;
        return membershipQuery(Promise.resolve({
          data: null,
          error: { message: 'temporary failure' },
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
    const retry = await screen.findByRole('button', {
      name: 'admin_leave_override.members_retry',
    });
    fireEvent.click(retry);

    await waitFor(() => expect(membershipCalls).toBe(2));
    const retryAgain = await screen.findByRole('button', {
      name: 'admin_leave_override.members_retry',
    });
    await waitFor(() => expect(retryAgain).toHaveFocus());
  });

  it('moves focus to the empty-state explanation after a successful empty retry', async () => {
    let membershipCalls = 0;
    from.mockImplementation((table: string) => {
      if (table === 'enterprise_memberships') {
        membershipCalls += 1;
        return membershipQuery(Promise.resolve(membershipCalls === 1
          ? { data: null, error: { message: 'temporary failure' } }
          : { data: [], error: null }));
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
    fireEvent.click(await screen.findByRole('button', {
      name: 'admin_leave_override.members_retry',
    }));

    const emptyMessage = await screen.findByText('admin_leave_override.members_empty');
    await waitFor(() => expect(emptyMessage).toHaveFocus());
  });

  it('does not restore stale retry focus after leaving and returning to a workspace', async () => {
    const staleRetryLoad = deferred<{
      data: Array<{ user_id: string }>;
      error: null;
    }>();
    let membershipCalls = 0;
    from.mockImplementation((table: string) => {
      if (table === 'enterprise_memberships') {
        membershipCalls += 1;
        if (membershipCalls === 1) {
          return membershipQuery(Promise.resolve({
            data: null,
            error: { message: 'temporary failure' },
          }));
        }
        if (membershipCalls === 2) return membershipQuery(staleRetryLoad.promise);
        const userId = membershipCalls === 3 ? 'member-b' : 'member-a';
        return membershipQuery(Promise.resolve({ data: [{ user_id: userId }], error: null }));
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
    const renderScope = (workspaceId: string) => (
      <>
        <button type="button">Stable focus target</button>
        <AdminLeaveOverride open workspaceId={workspaceId} {...callbacks} />
      </>
    );
    const view = render(renderScope('workspace-a'));
    fireEvent.click(await screen.findByRole('button', {
      name: 'admin_leave_override.members_retry',
    }));

    view.rerender(renderScope('workspace-b'));
    expect(await screen.findByRole('button', { name: 'Member B' })).toBeInTheDocument();
    const stableTarget = screen.getByRole('button', { name: 'Stable focus target' });
    stableTarget.focus();

    view.rerender(renderScope('workspace-a'));
    expect(await screen.findByRole('button', { name: 'Member A' })).toBeInTheDocument();
    await act(async () => {
      staleRetryLoad.resolve({ data: [{ user_id: 'member-a' }], error: null });
      await staleRetryLoad.promise;
    });
    expect(stableTarget).toHaveFocus();
  });
});
