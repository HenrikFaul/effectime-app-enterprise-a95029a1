/**
 * Time Attendance — entry point.
 *
 * Routes between two views:
 *  - Employee: their own monthly timesheet (week grid, day editor, on-call)
 *  - Admin: workspace-wide overview, approval/lock actions, payroll export
 *
 * Admins (owner / resourceAssistant) get a tab switcher so they can flip
 * between their personal sheet and the team overview.
 */

import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { User, Users } from 'lucide-react';
import { EmployeeMonthView } from './EmployeeMonthView';
import { AdminOverview } from './AdminOverview';

interface Props {
  workspaceId: string;
  isAdmin: boolean;
}

export function TimeAttendancePage({ workspaceId, isAdmin }: Props) {
  const [view, setView] = useState<'me' | 'team'>(isAdmin ? 'team' : 'me');

  if (!isAdmin) {
    return <EmployeeMonthView workspaceId={workspaceId} />;
  }

  return (
    <Tabs value={view} onValueChange={(v) => setView(v as 'me' | 'team')} className="space-y-4">
      <TabsList className="grid grid-cols-2 w-full max-w-md">
        <TabsTrigger value="team" className="gap-1.5"><Users className="h-3.5 w-3.5" /> Csapat áttekintés</TabsTrigger>
        <TabsTrigger value="me" className="gap-1.5"><User className="h-3.5 w-3.5" /> Saját idő</TabsTrigger>
      </TabsList>
      <TabsContent value="team"><AdminOverview workspaceId={workspaceId} /></TabsContent>
      <TabsContent value="me"><EmployeeMonthView workspaceId={workspaceId} /></TabsContent>
    </Tabs>
  );
}
