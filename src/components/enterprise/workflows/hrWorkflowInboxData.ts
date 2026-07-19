export interface WorkflowQueryResult {
  data: unknown[] | null;
  error: { message?: string; code?: string } | null;
}
export interface WorkflowQueryBuilder {
  select(columns: string): WorkflowQueryBuilder;
  eq(column: string, value: string): WorkflowQueryBuilder;
  order(
    column: string,
    options?: { ascending?: boolean; nullsFirst?: boolean },
  ): PromiseLike<WorkflowQueryResult>;
}

export interface WorkflowDataClient {
  rpc(
    functionName: string,
    args: Record<string, string | null>,
  ): PromiseLike<WorkflowQueryResult>;
  from(table: string): WorkflowQueryBuilder;
}

export async function fetchHRWorkflowInstances(
  client: WorkflowDataClient,
  workspaceId: string,
  isAdmin: boolean,
  statusFilter: string,
): Promise<WorkflowQueryResult> {
  if (isAdmin) {
    return client.rpc('hr_workflow_list_instances', {
      p_workspace_id: workspaceId,
      p_status: statusFilter === 'all' ? null : statusFilter,
    });
  }

  let query = client
    .from('enterprise_hr_workflow_instances')
    .select('*')
    .eq('workspace_id', workspaceId);
  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }
  return query.order('due_date', { ascending: true, nullsFirst: false });
}

export async function fetchHRWorkflowTasks(
  client: WorkflowDataClient,
  instanceId: string,
): Promise<WorkflowQueryResult> {
  return client
    .from('enterprise_hr_workflow_tasks')
    .select('*')
    .eq('instance_id', instanceId)
    .order('sort_order');
}
