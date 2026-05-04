import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Props {
  workspaceId: string;
}

interface Project {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  is_open_ended: boolean;
  status: string;
  color: string;
}

const DAY_MS = 86_400_000;

function parseISO(d: string): Date {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}
function fmtISO(d: Date) { return d.toISOString().slice(0, 10); }
function addMonths(iso: string, n: number) {
  const d = parseISO(iso);
  d.setUTCMonth(d.getUTCMonth() + n);
  return fmtISO(d);
}
function startOfMonth(iso: string) {
  const d = parseISO(iso);
  d.setUTCDate(1);
  return fmtISO(d);
}

export function GanttTimeline({ workspaceId }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewStart, setViewStart] = useState<string>(startOfMonth(new Date().toISOString().slice(0, 10)));
  const [monthsVisible] = useState(6);

  const viewEnd = useMemo(() => {
    const d = parseISO(addMonths(viewStart, monthsVisible));
    d.setUTCDate(d.getUTCDate() - 1);
    return fmtISO(d);
  }, [viewStart, monthsVisible]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('enterprise_projects')
        .select('id, name, start_date, end_date, is_open_ended, status, color')
        .eq('workspace_id', workspaceId)
        .order('start_date');
      setProjects((data as Project[]) || []);
      setLoading(false);
    };
    load();
  }, [workspaceId]);

  const totalDays = useMemo(() => Math.round((parseISO(viewEnd).getTime() - parseISO(viewStart).getTime()) / DAY_MS) + 1, [viewStart, viewEnd]);

  const months = useMemo(() => {
    const out: { label: string; widthPct: number }[] = [];
    for (let i = 0; i < monthsVisible; i++) {
      const ms = addMonths(viewStart, i);
      const me = addMonths(viewStart, i + 1);
      const days = Math.round((parseISO(me).getTime() - parseISO(ms).getTime()) / DAY_MS);
      out.push({
        label: parseISO(ms).toLocaleDateString('hu-HU', { year: 'numeric', month: 'short', timeZone: 'UTC' }),
        widthPct: (days / totalDays) * 100,
      });
    }
    return out;
  }, [viewStart, monthsVisible, totalDays]);

  const renderBar = (p: Project) => {
    const ps = p.start_date;
    const pe = p.is_open_ended || !p.end_date ? viewEnd : p.end_date;
    const start = ps > viewStart ? ps : viewStart;
    const end = pe < viewEnd ? pe : viewEnd;
    if (start > end) return null;
    const offsetDays = Math.round((parseISO(start).getTime() - parseISO(viewStart).getTime()) / DAY_MS);
    const lengthDays = Math.round((parseISO(end).getTime() - parseISO(start).getTime()) / DAY_MS) + 1;
    const left = (offsetDays / totalDays) * 100;
    const width = (lengthDays / totalDays) * 100;
    const cutLeft = ps < viewStart;
    const cutRight = (p.end_date && p.end_date > viewEnd) || (p.is_open_ended && pe >= viewEnd);
    return (
      <div
        className="absolute top-1 bottom-1 rounded text-[10px] text-white px-1 flex items-center overflow-hidden shadow-sm"
        style={{
          left: `${left}%`,
          width: `${width}%`,
          background: p.color,
          opacity: p.status === 'active' ? 1 : 0.55,
          borderTopLeftRadius: cutLeft ? 0 : undefined,
          borderBottomLeftRadius: cutLeft ? 0 : undefined,
          borderTopRightRadius: cutRight ? 0 : undefined,
          borderBottomRightRadius: cutRight ? 0 : undefined,
        }}
        title={`${p.name} — ${p.start_date} → ${p.is_open_ended ? 'határozatlan' : (p.end_date || '?')}`}
      >
        <span className="truncate">{p.name}</span>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm flex items-center gap-2 justify-between flex-wrap">
          <span className="flex items-center gap-2"><Calendar className="h-4 w-4" /> Projekt-idővonal</span>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setViewStart(addMonths(viewStart, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Badge variant="outline" className="text-[10px]">{viewStart} → {viewEnd}</Badge>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setViewStart(addMonths(viewStart, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs ml-1" onClick={() => setViewStart(startOfMonth(new Date().toISOString().slice(0, 10)))}>
              Ma
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {loading ? (
          <div className="flex justify-center py-6"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
        ) : projects.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">Még nincs projekt felvéve.</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              {/* Month header */}
              <div className="flex border-b text-[10px] text-muted-foreground">
                <div className="w-40 shrink-0 px-1 py-1 font-medium">Projekt</div>
                <div className="flex-1 flex">
                  {months.map((m, i) => (
                    <div key={i} className="border-l first:border-l-0 px-1 py-1 truncate" style={{ width: `${m.widthPct}%` }}>
                      {m.label}
                    </div>
                  ))}
                </div>
              </div>
              {/* Rows */}
              {projects.map((p) => (
                <div key={p.id} className="flex border-b last:border-b-0 hover:bg-accent/30">
                  <div className="w-40 shrink-0 px-1 py-2 text-xs flex items-center gap-1 truncate">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.color }} />
                    <span className="truncate">{p.name}</span>
                  </div>
                  <div className="flex-1 relative h-8">{renderBar(p)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
