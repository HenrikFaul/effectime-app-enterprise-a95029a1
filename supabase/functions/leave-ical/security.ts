export type IcalScope = 'own' | 'team';
export type WorkspaceRole = 'owner' | 'resourceAssistant' | 'member';

export function parseIcalScope(value: unknown): IcalScope | null {
  return value === 'own' || value === 'team' ? value : null;
}

export function canUseIcalScope(scope: IcalScope, role: WorkspaceRole): boolean {
  return scope === 'own' || role === 'owner' || role === 'resourceAssistant';
}
