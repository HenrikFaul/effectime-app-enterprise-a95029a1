import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Calendar, Vote, UserMinus, TrendingUp, UserCheck, Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

type OverviewStats = {
  total_users: number;
  registered_users: number;
  temporary_users: number;
  total_events: number;
  active_events: number;
  total_votes: number;
  total_deletions: number;
};

type ChartData = {
  registrations_by_day: Record<string, number>;
  events_by_month: Record<string, number>;
  votes_by_day: Record<string, number>;
};

type TopEvent = {
  id: string;
  title: string;
  participants: number;
  votes: number;
  is_active: boolean;
};

const StatCard = ({ title, value, icon: Icon, description, color }: {
  title: string; value: number | string; icon: any; description?: string; color: string;
}) => (
  <Card className="rounded-2xl shadow-soft hover:shadow-elevated transition-shadow">
    <CardContent className="flex items-center gap-4 p-5">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${color}`}>
        <Icon className="h-6 w-6 text-primary-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold font-display">{value}</p>
        <p className="text-sm text-muted-foreground truncate">{title}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
    </CardContent>
  </Card>
);

const MiniBarChart = ({ data, label }: { data: Record<string, number>; label: string }) => {
  const entries = Object.entries(data).sort(([a], [b]) => a.localeCompare(b));
  const max = Math.max(...entries.map(([, v]) => v), 1);

  if (entries.length === 0) {
    return (
      <Card className="rounded-2xl shadow-soft">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{label}</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">Nincs adat</p></CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl shadow-soft">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-[2px] h-24">
          {entries.map(([key, val]) => (
            <div key={key} className="flex-1 flex flex-col items-center gap-1 group relative">
              <div
                className="w-full rounded-t bg-primary/80 hover:bg-primary transition-colors min-h-[2px]"
                style={{ height: `${(val / max) * 100}%` }}
              />
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 hidden group-hover:block bg-foreground text-background text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap z-10">
                {key}: {val}
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-muted-foreground">{entries[0]?.[0]}</span>
          <span className="text-[10px] text-muted-foreground">{entries[entries.length - 1]?.[0]}</span>
        </div>
      </CardContent>
    </Card>
  );
};

const AdminDashboard = () => {
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [charts, setCharts] = useState<ChartData | null>(null);
  const [topEvents, setTopEvents] = useState<TopEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const { data, error } = await supabase.functions.invoke('admin', {
        body: { action: 'get-stats' },
      });
      if (!error && data) {
        setOverview(data.overview);
        setCharts(data.charts);
        setTopEvents(data.top_events || []);
      }
      setLoading(false);
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {overview && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Összes felhasználó" value={overview.total_users} icon={Users} color="gradient-primary" />
          <StatCard title="Regisztrált" value={overview.registered_users} icon={UserCheck} color="bg-accent" />
          <StatCard title="Vendég" value={overview.temporary_users} icon={Clock} color="bg-warning" />
          <StatCard title="Törölt fiókok" value={overview.total_deletions} icon={UserMinus} color="bg-destructive" />
          <StatCard title="Összes esemény" value={overview.total_events} icon={Calendar} color="gradient-primary" />
          <StatCard title="Aktív esemény" value={overview.active_events} icon={TrendingUp} color="bg-success" />
          <StatCard title="Összes szavazat" value={overview.total_votes} icon={Vote} color="bg-accent" />
        </div>
      )}

      {charts && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MiniBarChart data={charts.registrations_by_day} label="Regisztrációk (utolsó 30 nap)" />
          <MiniBarChart data={charts.votes_by_day} label="Szavazatok (utolsó 30 nap)" />
          <MiniBarChart data={charts.events_by_month} label="Események (utolsó 6 hónap)" />
        </div>
      )}

      {topEvents.length > 0 && (
        <Card className="rounded-2xl shadow-soft">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Top események (résztvevők száma szerint)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topEvents.map((event, idx) => (
                <div key={event.id} className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-2.5 text-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-muted-foreground font-mono text-xs w-5 shrink-0">{idx + 1}.</span>
                    <span className="font-medium truncate">{event.title}</span>
                    {!event.is_active && (
                      <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-full shrink-0">Inaktív</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 shrink-0 text-xs text-muted-foreground">
                    <span>{event.participants} résztvevő</span>
                    <span>{event.votes} szavazat</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminDashboard;
