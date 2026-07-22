import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Lock, Unlock, Plus, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n/I18nProvider';
import {
  addRoleAllocation,
  canonicalizeRoleName,
  removeRoleAllocation,
  setRoleAllocationPercentage,
  setRoleAllocationPriority,
  toggleRoleAllocationLock,
  type RoleAllocationDraft,
} from '@/lib/roleAllocationDraft';

export type Allocation = RoleAllocationDraft;

interface Props {
  allocations: Allocation[];
  onChange: (next: Allocation[]) => void;
  availableRoles: string[];
}

/**
 * Role allocation editor with:
 * - Dropdown + "Add" button to attach business roles (no free text)
 * - Per-row percentage input that auto-distributes to other UNLOCKED rows
 * - Lock toggle per row: locked rows are immutable; remaining % is split among the unlocked
 * - Priority (star) toggle: marks the primary position; only ONE allocation can be priority
 */
export function RoleAllocationEditor({ allocations, onChange, availableRoles }: Props) {
  const { t } = useI18n();
  const [pendingRole, setPendingRole] = useState<string>('');

  const allocatedRoleKeys = new Set(
    allocations.flatMap(allocation => {
      const canonical = canonicalizeRoleName(allocation.business_role);
      return canonical.ok ? [canonical.key] : [];
    }),
  );
  const remainingRoles = availableRoles.filter(role => {
    const canonical = canonicalizeRoleName(role);
    return canonical.ok && !allocatedRoleKeys.has(canonical.key);
  });

  const apply = (result: ReturnType<typeof addRoleAllocation>) => {
    if (result.ok) onChange(result.allocations);
    return result.ok;
  };

  const addRole = () => {
    if (!pendingRole) return;
    if (apply(addRoleAllocation(allocations, pendingRole))) setPendingRole('');
  };

  const removeRole = (role: string) => {
    apply(removeRoleAllocation(allocations, role));
  };

  const toggleLock = (role: string) => {
    apply(toggleRoleAllocationLock(allocations, role));
  };

  const setPriority = (role: string) => {
    apply(setRoleAllocationPriority(allocations, role));
  };

  const setPercentage = (role: string, rawValue: number) => {
    apply(setRoleAllocationPercentage(allocations, role, rawValue));
  };

  const total = allocations.reduce((s, a) => s + a.percentage, 0);
  const isValid = Math.round(total * 100) === 10_000 || allocations.length === 0;

  return (
    <div className="space-y-3">
      {allocations.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Nincs munkakör hozzárendelve.</p>
      ) : (
        <div className="space-y-2">
          {allocations.map(a => (
            <div
              key={a.business_role}
              className={cn(
                "flex items-center gap-2 p-1.5 rounded-md transition-colors",
                a.is_priority && "bg-primary/5 ring-1 ring-primary/20"
              )}
            >
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 flex-shrink-0"
                onClick={() => setPriority(a.business_role)}
                title={a.is_priority ? t('role_alloc.title_primary') : t('role_alloc.make_primary')}
              >
                <Star className={cn("h-4 w-4", a.is_priority ? "fill-primary text-primary" : "text-muted-foreground")} />
              </Button>
              <Badge variant={a.is_priority ? 'default' : 'secondary'} className="text-xs flex-shrink-0 min-w-[120px] justify-center">
                {a.business_role}
              </Badge>
              <Input
                type="number"
                min="0"
                max="100"
                step="1"
                value={a.percentage}
                disabled={a.locked}
                onChange={e => setPercentage(a.business_role, parseFloat(e.target.value) || 0)}
                className="h-8 w-20 text-sm"
              />
              <span className="text-xs text-muted-foreground">%</span>
              <Button
                size="icon"
                variant={a.locked ? 'default' : 'ghost'}
                className="h-7 w-7 ml-auto"
                onClick={() => toggleLock(a.business_role)}
                title={a.locked ? t('role_alloc.unlock') : t('role_alloc.lock')}
              >
                {a.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => removeRole(a.business_role)}
                title={t('role_alloc.remove')}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))}
          <p className={`text-xs ${isValid ? 'text-muted-foreground' : 'text-destructive'}`}>
            {t('role_alloc.total_pct', { pct: total.toFixed(1) })} &middot; <span className="text-primary">{t('role_alloc.primary_legend')}</span>
          </p>
        </div>
      )}

      {remainingRoles.length > 0 && (
        <div className="flex items-center gap-2 pt-1 border-t">
          <Select value={pendingRole} onValueChange={setPendingRole}>
            <SelectTrigger className="h-8 text-xs flex-1">
              <SelectValue placeholder={t('role_alloc.role_placeholder')} />
            </SelectTrigger>
            <SelectContent>
              {remainingRoles.map(r => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={addRole}
            disabled={!pendingRole}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> {t('role_alloc.btn_add')}
          </Button>
        </div>
      )}
    </div>
  );
}
