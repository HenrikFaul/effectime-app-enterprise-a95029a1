import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Code, AlertTriangle } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

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

const EXAMPLE = `-- Only SELECT queries. workspace_id is filtered automatically.
-- Allowed tables: ${ALLOWED_TABLES.slice(0, 4).join(', ')}, ...

SELECT
  business_role,
  COUNT(*) AS headcount,
  SUM(percentage) AS total_capacity
FROM enterprise_member_role_allocations
GROUP BY business_role
ORDER BY headcount DESC;`;

export function SqlMode({ value, onChange }: Props) {
  const { t } = useI18n();
  return (
    <div className="space-y-3">
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle className="text-sm">{t('sql_mode.title')}</AlertTitle>
        <AlertDescription className="text-xs space-y-1">
          <p>{t('sql_mode.desc_p1')}</p>
          <p>{t('sql_mode.allowed_tables_label')}</p>
          <div className="flex flex-wrap gap-1 mt-1">
            {ALLOWED_TABLES.map(table => (
              <code key={table} className="text-[10px] px-1.5 py-0.5 bg-muted rounded">{table}</code>
            ))}
          </div>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="py-3 pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Code className="h-4 w-4" /> {t('sql_mode.card_title')}</CardTitle>
          <CardDescription className="text-xs">{t('sql_mode.card_description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Label className="text-xs">{t('sql_mode.label_sql')}</Label>
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
