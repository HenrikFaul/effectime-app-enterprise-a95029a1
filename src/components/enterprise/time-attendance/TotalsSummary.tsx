import { Card, CardContent } from '@/components/ui/card';
import { Briefcase, Clock, Phone, Moon, CalendarDays, TrendingUp } from 'lucide-react';
import type { AttendancePeriodTotals } from './types';

export function TotalsSummary({ totals }: { totals: AttendancePeriodTotals }) {
  const items: { label: string; value: string; hint?: string; icon: React.ReactNode; tone?: 'default' | 'primary' | 'warning' | 'muted' }[] = [
    { label: 'Ledolgozott', value: `${totals.worked_hours}h`, hint: `Elvárt: ${totals.expected_after_leave}h`, icon: <Briefcase className="h-3.5 w-3.5" />, tone: 'primary' },
    { label: 'Túlóra', value: `${totals.overtime_hours}h`, icon: <Clock className="h-3.5 w-3.5" /> },
    { label: 'Hétvégi túlóra', value: `${totals.weekend_overtime_hours}h`, icon: <CalendarDays className="h-3.5 w-3.5" /> },
    { label: 'Éjszakai', value: `${totals.night_hours}h`, icon: <Moon className="h-3.5 w-3.5" /> },
    { label: 'Készenlét (raw)', value: `${totals.oncall_standby_hours}h`, hint: `× 0.20 = ${totals.oncall_standby_compensated_hours}h`, icon: <Phone className="h-3.5 w-3.5" />, tone: 'warning' },
    { label: 'Behívás', value: `${totals.oncall_intervention_hours}h`, icon: <Phone className="h-3.5 w-3.5" />, tone: 'warning' },
    { label: 'Szabadság', value: `${totals.leave_days} nap`, hint: `${totals.leave_hours}h`, icon: <CalendarDays className="h-3.5 w-3.5" /> },
    { label: 'Bér-össz', value: `${totals.payroll_total_hours}h`, hint: 'Készenlét × 0.20', icon: <TrendingUp className="h-3.5 w-3.5" />, tone: 'primary' },
  ];

  return (
    <Card>
      <CardContent className="p-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {items.map((it, i) => (
            <div key={i} className={`p-2 rounded-md border ${
              it.tone === 'primary' ? 'bg-primary/5 border-primary/20' :
              it.tone === 'warning' ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' :
              'bg-muted/30'
            }`}>
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                {it.icon}
                <span>{it.label}</span>
              </div>
              <div className="text-base font-semibold tabular-nums mt-0.5">{it.value}</div>
              {it.hint && <div className="text-[10px] text-muted-foreground tabular-nums">{it.hint}</div>}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
