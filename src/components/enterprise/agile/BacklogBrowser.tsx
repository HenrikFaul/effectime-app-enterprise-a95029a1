import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface IntegrationMini {
  id: string;
  provider: 'jira' | 'azure_devops';
  base_url: string;
  project_key: string | null;
}

interface Issue {
  external_key: string;
  summary: string | null;
  status: string | null;
  assignee_name: string | null;
  issue_type: string | null;
  priority: string | null;
  story_points: number | null;
  url: string | null;
}

export function BacklogBrowser({ integration }: { integration: IntegrationMini }) {
  const [query, setQuery] = useState('');
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(false);

  const placeholder =
    integration.provider === 'jira'
      ? `JQL — pl. project = ${integration.project_key ?? 'PROJ'} AND status != Done`
      : `WIQL — pl. SELECT [System.Id] FROM WorkItems WHERE [System.State] <> 'Closed'`;

  const presets = integration.provider === 'jira'
    ? [
      { label: 'Aktív sprint', q: `project = ${integration.project_key ?? 'PROJ'} AND sprint in openSprints() ORDER BY priority DESC, updated DESC` },
      { label: 'Saját ticketek', q: `project = ${integration.project_key ?? 'PROJ'} AND assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC` },
      { label: 'Határidőn túli', q: `project = ${integration.project_key ?? 'PROJ'} AND due <= now() AND statusCategory != Done ORDER BY due ASC` },
    ]
    : [
      { label: 'Aktív iteration', q: `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${integration.project_key ?? 'Project'}' AND [System.State] <> 'Closed' ORDER BY [System.ChangedDate] DESC` },
      { label: 'Saját ticketek', q: `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${integration.project_key ?? 'Project'}' AND [System.AssignedTo] = @Me AND [System.State] <> 'Closed'` },
      { label: 'Határidőn túli', q: `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '${integration.project_key ?? 'Project'}' AND [Microsoft.VSTS.Scheduling.DueDate] < @Today AND [System.State] <> 'Closed'` },
    ];

  const loadFromCache = async () => {
    const { data } = await (supabase as any)
      .from('enterprise_agile_issues')
      .select('external_key,summary,status,assignee_name,issue_type,priority,story_points,url')
      .eq('integration_id', integration.id)
      .order('last_synced_at', { ascending: false })
      .limit(200);
    setIssues((data ?? []) as Issue[]);
  };


  useEffect(() => {
    loadFromCache();
  }, [integration.id]);
  const search = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('jira-devops-proxy', {
        body: { action: 'search_issues', integration_id: integration.id, params: { query, max: 100 } },
      });
      if (error) throw error;
      if (!(data as any)?.ok) throw new Error((data as any)?.error ?? 'Hibás válasz');
      const remote = (data as any).issues ?? [];
      if (remote.length > 0) {
        setIssues(remote);
        toast.success(`${(data as any).count} ticket betöltve`);
      } else {
        await loadFromCache();
        toast.message('Nincs friss találat, cache-ből töltöttük a legutóbbi adatokat.');
      }
    } catch (e: any) {
      toast.error('Lekérdezés sikertelen: ' + (e?.message ?? String(e)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Backlog böngésző</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="h-8 text-xs font-mono"
          />
          <Button size="sm" onClick={search} disabled={loading} className="gap-1">
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Keresés
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {presets.map((preset) => (
            <Button
              key={preset.label}
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-[10px]"
              onClick={() => setQuery(preset.q)}
            >
              {preset.label}
            </Button>
          ))}
          <Button type="button" variant="ghost" size="sm" className="h-7 text-[10px]" onClick={loadFromCache}>
            Cache betöltése
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Üres lekérdezés = utoljára frissített ticketek a {integration.project_key ?? 'projekt'} kontextusában.
          A találatok elmentődnek a helyi cache-be (enterprise_agile_issues).
        </p>

        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-2">Kulcs</th>
                <th className="text-left p-2">Cím</th>
                <th className="text-left p-2">Típus</th>
                <th className="text-left p-2">Státusz</th>
                <th className="text-left p-2">Felelős</th>
                <th className="text-left p-2">SP</th>
                <th className="text-left p-2"></th>
              </tr>
            </thead>
            <tbody>
              {issues.length === 0 && (
                <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">Nincs adat</td></tr>
              )}
              {issues.map((i) => (
                <tr key={i.external_key} className="border-t hover:bg-accent/30">
                  <td className="p-2 font-mono">{i.external_key}</td>
                  <td className="p-2">{i.summary}</td>
                  <td className="p-2"><Badge variant="outline" className="text-[10px]">{i.issue_type}</Badge></td>
                  <td className="p-2">{i.status}</td>
                  <td className="p-2">{i.assignee_name ?? '—'}</td>
                  <td className="p-2">{i.story_points ?? '—'}</td>
                  <td className="p-2">
                    {i.url && (
                      <a href={i.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                        <ExternalLink className="h-3 w-3 inline" />
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
