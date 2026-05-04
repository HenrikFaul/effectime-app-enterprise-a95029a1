import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Code, AlertTriangle } from 'lucide-react';

interface Props {
  value: string;
  onChange: (v: string) => void;
}

const ALLOWED_TABLES = [
  'enterprise_memberships',
  'enterprise_member_role_allocations',
  'enterprise_teams',
  'enterprise_team_roles',
  'enterprise_offices',
  'enterprise_holidays',
  'enterprise_company_leave_days',
  'enterprise_blocked_dates',
  'enterprise_daily_rules',
  'leave_requests',
  'approval_decisions',
  'enterprise_audit_events',
  'enterprise_role_definitions',
];

const EXAMPLE = `-- Csak SELECT lekérdezések. A workspace_id automatikusan szűrve van.
-- Engedélyezett táblák: ${ALLOWED_TABLES.slice(0, 4).join(', ')}, ...

SELECT
  business_role,
  COUNT(*) AS letszam,
  SUM(percentage) AS osszes_kapacitas
FROM enterprise_member_role_allocations
GROUP BY business_role
ORDER BY letszam DESC;`;

export function SqlMode({ value, onChange }: Props) {
  return (
    <div className="space-y-3">
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle className="text-sm">SQL haladó mód</AlertTitle>
        <AlertDescription className="text-xs space-y-1">
          <p>Csak <strong>SELECT</strong> parancsok engedélyezettek. A munkaterületre vonatkozó szűrés (workspace_id) automatikusan érvényesül.</p>
          <p>Engedélyezett táblák:</p>
          <div className="flex flex-wrap gap-1 mt-1">
            {ALLOWED_TABLES.map(t => (
              <code key={t} className="text-[10px] px-1.5 py-0.5 bg-muted rounded">{t}</code>
            ))}
          </div>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="py-3 pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Code className="h-4 w-4" /> SQL lekérdezés</CardTitle>
          <CardDescription className="text-xs">Írd meg a saját SELECT lekérdezésedet — futtatáskor a backend ellenőrzi és kiegészíti.</CardDescription>
        </CardHeader>
        <CardContent>
          <Label className="text-xs">SQL</Label>
          <Textarea
            value={value || EXAMPLE}
            onChange={e => onChange(e.target.value)}
            rows={14}
            className="font-mono text-xs mt-1"
            spellCheck={false}
          />
        </CardContent>
      </Card>
    </div>
  );
}
