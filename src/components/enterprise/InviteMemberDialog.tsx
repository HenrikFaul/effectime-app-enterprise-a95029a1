import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logAuditEvent } from '@/lib/auditLog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { FileUser, UserPlus } from 'lucide-react';
import { RoleAllocationEditor, Allocation } from './RoleAllocationEditor';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  invitedBy: string;
  onInvited: () => void;
}

interface Office {
  id: string;
  name: string;
  city: string | null;
}

interface MemberTemplate {
  id: string;
  template_name: string;
  default_role: string;
  default_business_role: string | null;
  default_office_id: string | null;
  default_city: string | null;
  default_location: string | null;
}

export function InviteMemberDialog({ open, onOpenChange, workspaceId, invitedBy, onInvited }: Props) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<string>('member');
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [officeId, setOfficeId] = useState<string>('');
  const [city, setCity] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [offices, setOffices] = useState<Office[]>([]);
  const [businessRoles, setBusinessRoles] = useState<string[]>([]);
  const [templates, setTemplates] = useState<MemberTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  // New template form
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');

  useEffect(() => {
    if (!open) return;
    Promise.all([
      supabase.from('enterprise_offices').select('id, name, city').eq('workspace_id', workspaceId).order('name'),
      supabase.from('enterprise_member_templates').select('*').eq('workspace_id', workspaceId).order('template_name'),
      supabase.from('enterprise_memberships').select('business_role').eq('workspace_id', workspaceId).not('business_role', 'is', null),
    ]).then(([officeRes, templateRes, memberRes]) => {
      setOffices((officeRes.data as Office[]) || []);
      setTemplates((templateRes.data as MemberTemplate[]) || []);
      const roleSet = new Set<string>();
      ((memberRes.data as any[]) || []).forEach((m: any) => { if (m.business_role) roleSet.add(m.business_role); });
      setBusinessRoles(Array.from(roleSet).sort());
    });
  }, [open, workspaceId]);

  const applyTemplate = (templateId: string) => {
    const tmpl = templates.find(t => t.id === templateId);
    if (!tmpl) return;
    setSelectedTemplate(templateId);
    setRole(tmpl.default_role || 'member');
    setAllocations(tmpl.default_business_role ? [{ business_role: tmpl.default_business_role, percentage: 100 }] : []);
    setOfficeId(tmpl.default_office_id || '');
    setCity(tmpl.default_city || '');
    setLocation(tmpl.default_location || '');
  };

  const resetForm = () => {
    setEmail('');
    setDisplayName('');
    setRole('member');
    setAllocations([]);
    setOfficeId('');
    setCity('');
    setLocation('');
    setSelectedTemplate('');
  };

  const handleInvite = async () => {
    if (!email.trim() || !email.includes('@')) {
      toast.error('Érvényes email címet adj meg');
      return;
    }
    if (!displayName.trim()) {
      toast.error('Add meg a tag nevét');
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    setLoading(true);
    try {
      const { data: invData, error: invError } = await supabase
        .from('enterprise_invitations')
        .insert({
          workspace_id: workspaceId,
          email: normalizedEmail,
          role: role as any,
          invited_by: invitedBy,
          expires_at: inviteExpiresAt.toISOString(),
        })
        .select('id, token')
        .single();

      if (invError) {
        if (invError.code === '23505') {
          toast.error('Ez az email cím már meg van hívva');
        } else {
          throw invError;
        }
        return;
      }

      const prefillData: Record<string, any> = {};
      const primaryRole = allocations[0]?.business_role || null;
      if (displayName.trim()) prefillData.display_name = displayName.trim();
      if (primaryRole) prefillData.business_role = primaryRole;
      if (allocations.length > 0) prefillData.role_allocations = allocations;
      if (officeId) prefillData.office_id = officeId;
      if (city) prefillData.city = city;
      if (location) prefillData.location = location;

      let workspaceName = 'Enterprise munkaterület';

      if (invData) {
        try {
          const { data: ws } = await supabase
            .from('enterprise_workspaces')
            .select('name, settings')
            .eq('id', workspaceId)
            .single();

          workspaceName = ws?.name || workspaceName;

          if (Object.keys(prefillData).length > 0) {
            const settings = (ws?.settings as Record<string, any>) || {};
            if (!settings.invitation_prefills) settings.invitation_prefills = {};
            settings.invitation_prefills[invData.id] = prefillData;

            await supabase
              .from('enterprise_workspaces')
              .update({ settings: settings as any })
              .eq('id', workspaceId);
          }
        } catch (prefillErr) {
          console.warn('Could not save prefill data:', prefillErr);
        }
      }

      const inviteRedirectPath = invData?.token ? `/app?invite=${invData.token}` : '/app';
      const signInUrl = new URL('/auth', window.location.origin);
      signInUrl.searchParams.set('redirect', inviteRedirectPath);
      const roleLabel = getRoleLabel(role);

      const { error: emailError } = await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'enterprise-invite',
          recipientEmail: normalizedEmail,
          idempotencyKey: `enterprise-invite-${invData?.id}`,
          templateData: {
            workspaceName,
            inviteeEmail: normalizedEmail,
            inviteeName: displayName.trim(),
            roleLabel,
            signInUrl: signInUrl.toString(),
            expiresAt: inviteExpiresAt.toLocaleDateString('hu-HU'),
          },
        },
      });

      await logAuditEvent({
        workspace_id: workspaceId,
        actor_id: invitedBy,
        action: 'membership.invited',
        metadata: {
          email: normalizedEmail,
          role,
          email_delivery: emailError ? 'failed' : 'queued',
          ...prefillData,
        },
      });

      if (emailError) {
        console.error('Invitation email failed:', emailError);
        toast.error('A meghívó létrejött, de az email küldése nem sikerült');
      } else {
        toast.success(`Meghívó elküldve: ${normalizedEmail}`);
      }

      resetForm();
      onOpenChange(false);
      onInvited();
    } catch (err: unknown) {
      console.error(err);
      toast.error('Hiba a meghívó küldésekor');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!newTemplateName.trim()) return;
    const { error } = await supabase.from('enterprise_member_templates').insert({
      workspace_id: workspaceId,
      template_name: newTemplateName.trim(),
      default_role: role,
      default_business_role: allocations[0]?.business_role || null,
      default_office_id: officeId || null,
      default_city: city || null,
      default_location: location || null,
      created_by: invitedBy,
    } as any);
    if (error) {
      toast.error('Hiba a sablon mentésekor');
    } else {
      toast.success('Sablon mentve');
      setShowNewTemplate(false);
      setNewTemplateName('');
      const { data } = await supabase.from('enterprise_member_templates').select('*').eq('workspace_id', workspaceId).order('template_name');
      setTemplates((data as MemberTemplate[]) || []);
    }
  };

  const getRoleLabel = (r: string) => {
    switch (r) {
      case 'owner': return 'Tulajdonos';
      case 'resourceAssistant': return 'Erőforrás asszisztens';
      default: return 'Tag';
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" /> Tag meghívása
          </DialogTitle>
        </DialogHeader>

        {/* Templates */}
        {templates.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">Gyors kitöltés sablonból</Label>
            <div className="flex flex-wrap gap-1.5">
              {templates.map(t => (
                <Button
                  key={t.id}
                  size="sm"
                  variant={selectedTemplate === t.id ? 'default' : 'outline'}
                  className="text-xs h-7"
                  onClick={() => applyTemplate(t.id)}
                >
                  <FileUser className="h-3 w-3 mr-1" />
                  {t.template_name}
                </Button>
              ))}
            </div>
            <Separator />
          </div>
        )}

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="inv-name">Név *</Label>
              <Input id="inv-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Kovács János" />
            </div>
            <div>
              <Label htmlFor="inv-email">Email cím *</Label>
              <Input id="inv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="kolléga@cég.hu" />
            </div>
          </div>

          <div>
            <Label>Szerepkör (jogosultság)</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Tag</SelectItem>
                <SelectItem value="resourceAssistant">Erőforrás asszisztens</SelectItem>
                <SelectItem value="owner">Tulajdonos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Business roles with allocation */}
          <div>
            <Label>Munkakör(ök) és megosztás</Label>
            {businessRoles.length === 0 ? (
              <p className="text-xs text-muted-foreground italic mt-1">
                Nincsenek munkakörök. Hozz létre munkaköröket a Beállítások / Munkakörök részben.
              </p>
            ) : (
              <div className="mt-2">
                <RoleAllocationEditor
                  allocations={allocations}
                  onChange={setAllocations}
                  availableRoles={businessRoles}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Iroda / Telephely</Label>
              <Select value={officeId || '__none__'} onValueChange={(v) => setOfficeId(v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Válassz..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nincs megadva</SelectItem>
                  {offices.map(o => (
                    <SelectItem key={o.id} value={o.id}>{o.name}{o.city ? ` (${o.city})` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Város (lakóhely)</Label>
              <Input value={city} onChange={e => setCity(e.target.value)} placeholder="pl. Budapest" />
            </div>
          </div>

          <div>
            <Label>Helyszín megjegyzés</Label>
            <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="pl. Remote / Hybrid" />
          </div>
        </div>

        {/* Save as template */}
        <div className="border-t pt-3 mt-2">
          {!showNewTemplate ? (
            <Button size="sm" variant="ghost" className="text-xs" onClick={() => setShowNewTemplate(true)}>
              + Mentés sablonként
            </Button>
          ) : (
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Label className="text-xs">Sablon neve</Label>
                <Input value={newTemplateName} onChange={e => setNewTemplateName(e.target.value)} placeholder="pl. Backend fejlesztő" className="h-8 text-sm" />
              </div>
              <Button size="sm" onClick={handleSaveTemplate} disabled={!newTemplateName.trim()}>Mentés</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowNewTemplate(false)}>Mégse</Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>Mégse</Button>
          <Button onClick={handleInvite} disabled={loading || !email.trim() || !displayName.trim()}>
            {loading ? 'Küldés...' : 'Meghívás'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
