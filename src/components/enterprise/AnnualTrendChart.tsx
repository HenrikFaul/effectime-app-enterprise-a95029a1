import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { eachDayOfInterval, parseISO } from 'date-fns';

interface Props {
  workspaceId: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Máj', 'Jún', 'Júl', 'Aug', 'Szep', 'Okt', 'Nov', 'Dec'];

export function AnnualTrendChart({ workspaceId }: Props) {
  const [year] = useState(new Date().getFullYear());
  const [daysPerMonth, setDaysPerMonth] = useState<number[]>(Array(12).fill(0));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from('leave_requests')
        .select('start_date,end_date,status')
        .eq('workspace_id', workspaceId)
        .in('status', ['approved', 'pending'])
        .gte('start_date', `${year}-01-01`)
        .lte('end_date', `${year}-12-31`);

      const months = Array(12).fill(0);
      (data || []).forEach((row: any) => {
        eachDayOfInterval({ start: parseISO(row.start_date), end: parseISO(row.end_date) }).forEach(day => {
          if (day.getFullYear() === year) months[day.getMonth()] += 1;
        });
      });
      setDaysPerMonth(months);
      setLoading(false);
    };

    load();
  }, [workspaceId, year]);

  const data = useMemo(() => MONTHS.map((m, idx) => ({ month: m, days: daysPerMonth[idx] })), [daysPerMonth]);
  const total = daysPerMonth.reduce((a, b) => a + b, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <span>Éves távolléti trend</span>
          <Badge variant="outline" className="text-[10px]">{year} · {total} nap</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-6"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data}>
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="days" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
