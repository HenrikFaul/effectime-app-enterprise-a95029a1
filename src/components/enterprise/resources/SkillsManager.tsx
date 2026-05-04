import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Tag, Users } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  workspaceId: string;
  isAdmin: boolean;
}

interface Skill { id: string; name: string; category: string | null; color: string }
interface Membership { id: string; user_id: string; display_name: string }
interface MemberSkill { id: string; membership_id: string; skill_id: string; level: number }

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16', '#8b5cf6'];

export function SkillsManager({ workspaceId, isAdmin }: Props) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [members, setMembers] = useState<Membership[]>([]);
  const [memberSkills, setMemberSkills] = useState<MemberSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newColor, setNewColor] = useState(COLORS[0]);

  const load = async () => {
    setLoading(true);
    const [skRes, memRes, msRes] = await Promise.all([
      (supabase as any).from('enterprise_skills').select('*').eq('workspace_id', workspaceId).order('name'),
      (supabase as any).from('enterprise_memberships').select('id, user_id').eq('workspace_id', workspaceId).eq('status', 'active'),
      (supabase as any).from('enterprise_member_skills').select('*').eq('workspace_id', workspaceId),
    ]);
    const mems = (memRes.data as any[]) || [];
    const userIds = mems.map((m: any) => m.user_id);
    const { data: profs } = userIds.length ? await supabase.from('profiles').select('user_id, display_name').in('user_id', userIds) : { data: [] };
    const nameMap = new Map((profs as any[] || []).map(p => [p.user_id, p.display_name || 'Ismeretlen']));
    setSkills((skRes.data as Skill[]) || []);
    setMembers(mems.map((m: any) => ({ id: m.id, user_id: m.user_id, display_name: nameMap.get(m.user_id) || 'Ismeretlen' })));
    setMemberSkills((msRes.data as MemberSkill[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [workspaceId]);

  const addSkill = async () => {
    if (!newName.trim()) return;
    const { error } = await (supabase as any).from('enterprise_skills').insert({
      workspace_id: workspaceId, name: newName.trim(), category: newCategory.trim() || null, color: newColor,
    });
    if (error) { toast.error('Mentés sikertelen: ' + error.message); return; }
    setNewName(''); setNewCategory('');
    toast.success('Készség hozzáadva');
    load();
  };

  const deleteSkill = async (id: string) => {
    if (!confirm('Biztosan törlöd? Minden hozzá tartozó tag-szintű hozzárendelés is törlődik.')) return;
    const { error } = await (supabase as any).from('enterprise_skills').delete().eq('id', id);
    if (error) { toast.error('Törlés sikertelen'); return; }
    toast.success('Készség törölve'); load();
  };

  const setLevel = async (membershipId: string, skillId: string, level: number) => {
    const existing = memberSkills.find(ms => ms.membership_id === membershipId && ms.skill_id === skillId);
    if (level === 0) {
      if (existing) {
        await (supabase as any).from('enterprise_member_skills').delete().eq('id', existing.id);
        setMemberSkills(memberSkills.filter(x => x.id !== existing.id));
      }
      return;
    }
    if (existing) {
      await (supabase as any).from('enterprise_member_skills').update({ level }).eq('id', existing.id);
      setMemberSkills(memberSkills.map(x => x.id === existing.id ? { ...x, level } : x));
    } else {
      const { data, error } = await (supabase as any).from('enterprise_member_skills').insert({
        workspace_id: workspaceId, membership_id: membershipId, skill_id: skillId, level,
      }).select('*').single();
      if (!error && data) setMemberSkills([...memberSkills, data as MemberSkill]);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2"><Tag className="h-4 w-4 text-primary" /> Készségek katalógusa</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          {isAdmin && (
            <div className="flex items-end gap-2 flex-wrap bg-muted/30 p-2 rounded">
              <div className="flex-1 min-w-[150px]">
                <Label className="text-[11px]">Név *</Label>
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="React, Figma, Senior..." className="h-8 text-sm" />
              </div>
              <div className="min-w-[120px]">
                <Label className="text-[11px]">Kategória</Label>
                <Input value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="frontend / design / soft" className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-[11px]">Szín</Label>
                <div className="flex gap-1 mt-1">
                  {COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setNewColor(c)} className={`h-6 w-6 rounded-full border-2 ${newColor === c ? 'border-foreground' : 'border-transparent'}`} style={{ background: c }} />
                  ))}
                </div>
              </div>
              <Button size="sm" onClick={addSkill} disabled={!newName.trim()}><Plus className="h-3.5 w-3.5 mr-1" /> Hozzáad</Button>
            </div>
          )}
          {loading ? (
            <div className="flex justify-center py-4"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
          ) : skills.length === 0 ? (
            <p className="text-xs text-muted-foreground italic text-center py-3">Még nincs készség. Adj hozzá pár tag-et a fenti űrlapon.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {skills.map(s => (
                <div key={s.id} className="inline-flex items-center gap-1.5 border rounded-full pl-2 pr-1 py-0.5 text-xs">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                  <span className="font-medium">{s.name}</span>
                  {s.category && <span className="text-[10px] text-muted-foreground">· {s.category}</span>}
                  {isAdmin && (
                    <button onClick={() => deleteSkill(s.id)} className="ml-1 h-5 w-5 inline-flex items-center justify-center rounded-full hover:bg-destructive/10 text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Tagok készségmátrixa</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {loading ? (
            <div className="flex justify-center py-4"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
          ) : skills.length === 0 || members.length === 0 ? (
            <p className="text-xs text-muted-foreground italic text-center py-3">Adj hozzá készségeket és tagokat a mátrix kitöltéséhez.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-separate border-spacing-0">
                <thead>
                  <tr>
                    <th className="text-left px-2 py-1 bg-muted/30 sticky left-0 z-10 min-w-[160px]">Tag</th>
                    {skills.map(s => (
                      <th key={s.id} className="text-center px-1 py-1 bg-muted/30 min-w-[80px]">
                        <div className="flex items-center justify-center gap-1">
                          <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                          <span>{s.name}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {members.map(m => (
                    <tr key={m.id}>
                      <td className="px-2 py-1 border-t sticky left-0 bg-background z-10 truncate">{m.display_name}</td>
                      {skills.map(s => {
                        const existing = memberSkills.find(ms => ms.membership_id === m.id && ms.skill_id === s.id);
                        const level = existing?.level || 0;
                        return (
                          <td key={s.id} className="px-1 py-1 border-t text-center">
                            {isAdmin ? (
                              <Select value={String(level)} onValueChange={v => setLevel(m.id, s.id, parseInt(v))}>
                                <SelectTrigger className="h-7 w-16 text-xs mx-auto"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="0">–</SelectItem>
                                  <SelectItem value="1">★</SelectItem>
                                  <SelectItem value="2">★★</SelectItem>
                                  <SelectItem value="3">★★★</SelectItem>
                                  <SelectItem value="4">★★★★</SelectItem>
                                  <SelectItem value="5">★★★★★</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : level > 0 ? (
                              <Badge variant="secondary" className="text-[10px]">{'★'.repeat(level)}</Badge>
                            ) : <span className="text-muted-foreground">–</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
