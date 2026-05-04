import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Lock, Unlock, Plus, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Allocation {
  business_role: string;
  percentage: number;
  locked?: boolean;
  is_priority?: boolean;
}

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
  const [pendingRole, setPendingRole] = useState<string>('');

  const remainingRoles = availableRoles.filter(r => !allocations.some(a => a.business_role === r));
  const round2 = (n: number) => +n.toFixed(2);

  const ensureSinglePriority = (arr: Allocation[]): Allocation[] => {
    if (arr.length === 0) return arr;
    const hasPriority = arr.some(a => a.is_priority);
    if (!hasPriority) {
      // Promote the first row to priority
      return arr.map((a, i) => ({ ...a, is_priority: i === 0 }));
    }
    // Make sure only one is priority
    let seen = false;
    return arr.map(a => {
      if (a.is_priority && !seen) { seen = true; return a; }
      if (a.is_priority && seen) return { ...a, is_priority: false };
      return a;
    });
  };

  const addRole = () => {
    if (!pendingRole) return;
    const lockedSum = allocations.filter(a => a.locked).reduce((s, a) => s + a.percentage, 0);
    const remainingPool = Math.max(0, 100 - lockedSum);
    const unlockedExisting = allocations.filter(a => !a.locked);
    const newCount = unlockedExisting.length + 1;
    const equal = round2(remainingPool / newCount);

    const next: Allocation[] = allocations.map(a =>
      a.locked ? a : { ...a, percentage: equal }
    );
    next.push({ business_role: pendingRole, percentage: equal, locked: false, is_priority: allocations.length === 0 });
    fixRounding(next);
    onChange(ensureSinglePriority(next));
    setPendingRole('');
  };

  const removeRole = (role: string) => {
    const removedWasPriority = allocations.find(a => a.business_role === role)?.is_priority;
    const next = allocations.filter(a => a.business_role !== role);
    if (next.length > 0) {
      const lockedSum = next.filter(a => a.locked).reduce((s, a) => s + a.percentage, 0);
      const unlocked = next.filter(a => !a.locked);
      const remainingPool = Math.max(0, 100 - lockedSum);
      if (unlocked.length > 0) {
        const equal = round2(remainingPool / unlocked.length);
        next.forEach(a => { if (!a.locked) a.percentage = equal; });
        fixRounding(next);
      }
      if (removedWasPriority) {
        // Promote first remaining to priority
        next.forEach((a, i) => { a.is_priority = i === 0; });
      }
    }
    onChange(ensureSinglePriority(next));
  };

  const toggleLock = (role: string) => {
    const next = allocations.map(a =>
      a.business_role === role ? { ...a, locked: !a.locked } : a
    );
    onChange(next);
  };

  const setPriority = (role: string) => {
    const next = allocations.map(a => ({ ...a, is_priority: a.business_role === role }));
    onChange(next);
  };

  const setPercentage = (role: string, rawValue: number) => {
    const target = allocations.find(a => a.business_role === role);
    if (!target || target.locked) return;

    const lockedSum = allocations.filter(a => a.locked).reduce((s, a) => s + a.percentage, 0);
    const remainingPool = Math.max(0, 100 - lockedSum);
    const newValue = Math.max(0, Math.min(remainingPool, rawValue));

    const otherUnlocked = allocations.filter(a => !a.locked && a.business_role !== role);
    const remainForOthers = Math.max(0, remainingPool - newValue);
    const otherSum = otherUnlocked.reduce((s, a) => s + a.percentage, 0);

    const next: Allocation[] = allocations.map(a => {
      if (a.business_role === role) return { ...a, percentage: round2(newValue) };
      if (a.locked) return a;
      if (otherUnlocked.length === 0) return a;
      const ratio = otherSum > 0 ? a.percentage / otherSum : 1 / otherUnlocked.length;
      return { ...a, percentage: round2(remainForOthers * ratio) };
    });
    fixRounding(next);
    onChange(next);
  };

  const fixRounding = (arr: Allocation[]) => {
    const sum = arr.reduce((s, a) => s + a.percentage, 0);
    const diff = round2(100 - sum);
    if (Math.abs(diff) < 0.01) return;
    for (let i = arr.length - 1; i >= 0; i--) {
      if (!arr[i].locked) {
        arr[i].percentage = round2(arr[i].percentage + diff);
        return;
      }
    }
  };

  const total = allocations.reduce((s, a) => s + a.percentage, 0);
  const isValid = Math.abs(total - 100) < 0.5 || allocations.length === 0;

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
                title={a.is_priority ? 'Elsődleges pozíció' : 'Tedd elsődlegessé'}
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
                title={a.locked ? 'Feloldás' : 'Fixálás'}
              >
                {a.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => removeRole(a.business_role)}
                title="Eltávolítás"
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))}
          <p className={`text-xs ${isValid ? 'text-muted-foreground' : 'text-destructive'}`}>
            Összesen: {total.toFixed(1)}% &middot; <span className="text-primary">★ = elsődleges pozíció</span>
          </p>
        </div>
      )}

      {remainingRoles.length > 0 && (
        <div className="flex items-center gap-2 pt-1 border-t">
          <Select value={pendingRole} onValueChange={setPendingRole}>
            <SelectTrigger className="h-8 text-xs flex-1">
              <SelectValue placeholder="Válassz munkakört..." />
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
            <Plus className="h-3.5 w-3.5 mr-1" /> Hozzáadás
          </Button>
        </div>
      )}
    </div>
  );
}
