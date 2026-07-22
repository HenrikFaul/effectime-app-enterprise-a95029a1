import { describe, expect, it, vi } from 'vitest';
import {
  deleteWorkspaceBusinessRole,
  type WorkspaceBusinessRoleDeleteRpcClient,
} from '@/lib/workspaceBusinessRoleApi';

const WORKSPACE_ID = '11111111-1111-4111-8111-111111111111';
const ROLE = 'Developer';

function resolvedClient(data: unknown, error: unknown = null) {
  const abortSignal = vi.fn(() => Promise.resolve({ data, error }));
  const rpc = vi.fn(() => ({
    abortSignal,
    then: Promise.resolve({ data, error }).then.bind(Promise.resolve({ data, error })),
  }));
  return { client: { rpc } as WorkspaceBusinessRoleDeleteRpcClient, rpc, abortSignal };
}

function validResponse() {
  return {
    ok: true,
    workspace_id: WORKSPACE_ID,
    business_role: ROLE,
    changed: true,
    affected_membership_count: 4,
    deleted_allocation_count: 3,
    audit_event_id: '22222222-2222-4222-8222-222222222222',
  };
}

describe('deleteWorkspaceBusinessRole', () => {
  it('calls the tenant-wide RPC exactly once without a browser membership target set', async () => {
    const { client, rpc, abortSignal } = resolvedClient(validResponse());

    await expect(deleteWorkspaceBusinessRole(WORKSPACE_ID, ROLE, { client })).resolves.toEqual({
      ok: true,
      workspaceId: WORKSPACE_ID,
      businessRole: ROLE,
      changed: true,
      affectedMembershipCount: 4,
      deletedAllocationCount: 3,
      auditEventId: '22222222-2222-4222-8222-222222222222',
    });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('delete_workspace_business_role_v1', {
      p_workspace_id: WORKSPACE_ID,
      p_business_role: ROLE,
    });
    expect(abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it.each([
    ['missing key', {
      ok: true,
      workspace_id: WORKSPACE_ID,
      business_role: ROLE,
      deleted_allocation_count: 3,
    }],
    ['extra key', { ...validResponse(), extra: true }],
    ['wrong workspace', { ...validResponse(), workspace_id: '22222222-2222-4222-8222-222222222222' }],
    ['wrong role', { ...validResponse(), business_role: 'Other' }],
    ['fractional count', { ...validResponse(), deleted_allocation_count: 1.5 }],
    ['negative count', { ...validResponse(), affected_membership_count: -1 }],
    ['invalid changed flag', { ...validResponse(), changed: 1 }],
    ['invalid audit id', { ...validResponse(), audit_event_id: 'not-a-uuid' }],
    ['changed with zero affected members', {
      ...validResponse(), affected_membership_count: 0,
    }],
    ['changed without audit receipt', { ...validResponse(), audit_event_id: null }],
    ['unchanged with audit receipt', { ...validResponse(), changed: false, affected_membership_count: 0 }],
    ['unchanged with deleted allocations', {
      ...validResponse(),
      changed: false,
      affected_membership_count: 0,
      deleted_allocation_count: 1,
      audit_event_id: null,
    }],
    ['array envelope', [validResponse()]],
  ])('fails closed for a malformed response: %s', async (_label, data) => {
    const { client } = resolvedClient(data);
    await expect(deleteWorkspaceBusinessRole(WORKSPACE_ID, ROLE, { client }))
      .rejects.toMatchObject({ code: 'invalid-response' });
  });

  it('accepts an internally consistent no-op receipt', async () => {
    const { client } = resolvedClient({
      ...validResponse(),
      changed: false,
      affected_membership_count: 0,
      deleted_allocation_count: 0,
      audit_event_id: null,
    });
    await expect(deleteWorkspaceBusinessRole(WORKSPACE_ID, ROLE, { client }))
      .resolves.toMatchObject({ changed: false, auditEventId: null });
  });

  it.each([
    ['serialization conflict', { code: '40001' }, 'conflict'],
    ['deadlock conflict', { code: '40P01' }, 'conflict'],
    ['lock conflict', { code: '55P03' }, 'conflict'],
    ['authorization rejection', { code: '42501' }, 'request-failed'],
  ])('maps %s without exposing server details', async (_label, error, code) => {
    const { client } = resolvedClient(null, error);
    await expect(deleteWorkspaceBusinessRole(WORKSPACE_ID, ROLE, { client }))
      .rejects.toMatchObject({ code });
  });

  it('composes and reacts to an in-flight caller abort even if transport remains pending', async () => {
    let transportSignal: AbortSignal | undefined;
    const never = new Promise<never>(() => undefined);
    const client = {
      rpc: vi.fn(() => ({
        abortSignal: vi.fn((signal: AbortSignal) => {
          transportSignal = signal;
          return never;
        }),
        then: never.then.bind(never),
      })),
    } as WorkspaceBusinessRoleDeleteRpcClient;
    const controller = new AbortController();
    const request = deleteWorkspaceBusinessRole(WORKSPACE_ID, ROLE, {
      client,
      signal: controller.signal,
    });

    controller.abort();
    await expect(request).rejects.toMatchObject({ code: 'aborted' });
    expect(transportSignal?.aborted).toBe(true);
  });

  it('bounds a transport that ignores abort', async () => {
    let transportSignal: AbortSignal | undefined;
    const never = new Promise<never>(() => undefined);
    const client = {
      rpc: vi.fn(() => ({
        abortSignal: vi.fn((signal: AbortSignal) => {
          transportSignal = signal;
          return never;
        }),
        then: never.then.bind(never),
      })),
    } as WorkspaceBusinessRoleDeleteRpcClient;

    const request = deleteWorkspaceBusinessRole(WORKSPACE_ID, ROLE, {
      client,
      timeoutMs: 5,
    });
    await expect(request).rejects.toMatchObject({ code: 'timeout' });
    expect(transportSignal?.aborted).toBe(true);
  });

  it.each([
    ['bad workspace', 'not-a-uuid', ROLE, 1000],
    ['empty role', WORKSPACE_ID, '', 1000],
    ['non-canonical role', WORKSPACE_ID, ' Developer ', 1000],
    ['bad timeout', WORKSPACE_ID, ROLE, 0],
  ])('rejects %s before issuing an RPC', async (_label, workspaceId, role, timeoutMs) => {
    const { client, rpc } = resolvedClient(validResponse());
    await expect(deleteWorkspaceBusinessRole(workspaceId, role, { client, timeoutMs }))
      .rejects.toMatchObject({ code: 'invalid-input' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('uses the same Unicode code-point role limit as PostgreSQL char_length', async () => {
    const acceptedRole = '🧪'.repeat(200);
    const acceptedResponse = {
      ...validResponse(),
      business_role: acceptedRole,
    };
    const accepted = resolvedClient(acceptedResponse);
    await expect(deleteWorkspaceBusinessRole(WORKSPACE_ID, acceptedRole, {
      client: accepted.client,
    })).resolves.toMatchObject({ businessRole: acceptedRole });

    const rejected = resolvedClient(validResponse());
    await expect(deleteWorkspaceBusinessRole(WORKSPACE_ID, `${acceptedRole}🧪`, {
      client: rejected.client,
    })).rejects.toMatchObject({ code: 'invalid-input' });
    expect(rejected.rpc).not.toHaveBeenCalled();
  });
});
