import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Trash2, Pencil, FolderKanban, Calendar, Users } from 'lucide-react';
import { toast } from 'sonner';
import { ProjectEditor } from './ProjectEditor';

interface Props {
  workspaceId: string;
  userId: string;
  isAdmin: boolean;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  is_open_ended: boolean;
  status: string;
  color: string;
}

export function ProjectList({ workspaceId, userId, isAdmin }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('enterprise_projects')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('start_date', { ascending: false });
    setProjects((data as Project[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [workspaceId]);

  const handleDelete = async (id: string) => {
    if (!confirm('Biztosan törlöd a projektet és minden allokációját?')) return;
    const { error } = await supabase.from('enterprise_projects').delete().eq('id', id);
    if (error) { toast.error('Hiba a törléskor'); return; }
    toast.success('Projekt törölve');
    load();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <FolderKanban className="h-4 w-4 text-primary" /> Projektek
        </h3>
        {isAdmin && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Új projekt
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
      ) : projects.length === 0 ? (
        <Card><CardContent className="text-center text-muted-foreground py-8 text-sm">Még nincs projekt létrehozva.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {projects.map(p => (
            <Card key={p.id} className="hover:bg-accent/30 transition-colors">
              <CardContent className="py-3 px-4 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="h-8 w-1.5 rounded-full" style={{ background: p.color }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{p.name}</span>
                      <Badge variant={p.status === 'active' ? 'default' : 'secondary'} className="text-[10px]">{p.status}</Badge>
                    </div>
                    {p.description && <p className="text-xs text-muted-foreground truncate">{p.description}</p>}
                    <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {p.start_date} → {p.is_open_ended ? 'határozatlan' : (p.end_date || '?')}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" onClick={() => setEditing(p)}>
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Szerkesztés
                  </Button>
                  {isAdmin && (
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDelete(p.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {createOpen && (
        <ProjectEditor
          mode="create"
          workspaceId={workspaceId}
          userId={userId}
          isAdmin={isAdmin}
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSaved={load}
        />
      )}
      {editing && (
        <ProjectEditor
          mode="edit"
          workspaceId={workspaceId}
          userId={userId}
          isAdmin={isAdmin}
          project={editing}
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}
