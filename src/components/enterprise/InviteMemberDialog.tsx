import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logAuditEvent } from '@/lib/auditLog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { FileUser, UserPlus, Building2, ListChecks, Mail, KeyRound, Check, X, Eye, EyeOff } from 'lucide-react';
import { RoleAllocationEditor, Allocation } from './RoleAllocationEditor';
import { PositionPickerDialog, type PositionPickerResult } from './positions/PositionPickerDialog';
import { useT, useI18n } from '@/i18n/I18nProvider';
import { validatePasswordPolicy, PASSWORD_POLICY_RULES, type PasswordPolicyFailure } from '@/lib/security/passwordPolicy';

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
  const tt = useT();
  const { t } = useI18n();
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

  // v3.0.0 organization metadata (additive, soft-required)
  const [orgUnits, setOrgUnits] = useState<{ id: string; name: string }[]>([]);
  const [contractTypes, setContractTypes] = useState<{ id: string; label: string; code: string }[]>([]);
  const [leadershipLevels, setLeadershipLevels] = useState<{ id: string; label: string; code: string }[]>([]);
  const [managers, setManagers] = useState<{ id: string; user_id: string; display_name: string }[]>([]);
  const [orgUnitId, setOrgUnitId] = useState<string>('');
  const [managerId, setManagerId] = useState<string>('');
  const [contractTypeId, setContractTypeId] = useState<string>('');
  const [leadershipLevelId, setLeadershipLevelId] = useState<string>('');
  const [leadershipCategory, setLeadershipCategory] = useState<string>('');
  const [employerRights, setEmployerRights] = useState<boolean>(false);

  // v3.0.0 position picker (predefined catalog)
  const [showPositionPicker, setShowPositionPicker] = useState(false);
  const [pickedPosition, setPickedPosition] = useState<PositionPickerResult | null>(null);

  // New template form
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');

  // v3.33.0 — direct-create-with-password mode (no email sent; admin sets pw)
  const [mode, setMode] = useState<'invite' | 'create'>('invite');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const policy = validatePasswordPolicy(password);
  const passwordMatches = password.length > 0 && password === passwordConfirm;

  useEffect(() => {
    if (!open) return;
    Promise.all([
      supabase.from('enterprise_offices').select('id, name, city').eq('workspace_id', workspaceId).order('name'),
      supabase.from('enterprise_member_templates').select('*').eq('workspace_id', workspaceId).order('template_name'),
      supabase.from('enterprise_memberships').select('business_role').eq('workspace_id', workspaceId).not('business_role', 'is', null),
      (supabase as any).from('enterprise_member_role_allocations').select('business_role').eq('workspace_id', workspaceId),
      (supabase as any).from('enterprise_org_units').select('id, name').eq('workspace_id', workspaceId).is('archived_at', null).order('name'),
      (supabase as any).from('enterprise_contract_types').select('id, label, code').eq('workspace_id', workspaceId).is('archived_at', null).order('label'),
      (supabase as any).from('enterprise_leadership_levels').select('id, label, code').eq('workspace_id', workspaceId).is('archived_at', null).order('sort_order'),
      (supabase as any).from('enterprise_memberships').select('id, user_id').eq('workspace_id', workspaceId).eq('status', 'active'),
    ]).then(async ([officeRes, templateRes, memberRes, allocRes, ouRes, ctRes, llRes, msRes]) => {
      setOffices((officeRes.data as Office[]) || []);
      setTemplates((templateRes.data as MemberTemplate[]) || []);
      const roleSet = new Set<string>();
      ((memberRes.data as any[]) || []).forEach((m: any) => { if (m.business_role) roleSet.add(m.business_role); });
      ((allocRes.data as any[]) || []).forEach((a: any) => { if (a.business_role) roleSet.add(a.business_role); });
      setBusinessRoles(Array.from(roleSet).sort());
      setOrgUnits(((ouRes?.data as any[]) || []) as any);
      setContractTypes(((ctRes?.data as any[]) || []) as any);
      setLeadershipLevels(((llRes?.data as any[]) || []) as any);

      // Manager candidates: enrich active memberships with display_name
      const ms = (msRes?.data as any[]) || [];
      if (ms.length > 0) {
        const userIds = ms.map((m: any) => m.user_id);
        const { data: profs } = await supabase
          .from('profiles')
          .select('user_id, display_name')
          .in('user_id', userIds);
        const nameMap = new Map((profs || []).map((p: any) => [p.user_id, p.display_name || 'Unknown']));
        setManagers(ms.map((m: any) => ({ id: m.id, user_id: m.user_id, display_name: nameMap.get(m.user_id) || 'Unknown' })));
      } else {
        setManagers([]);
      }
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
    setOrgUnitId('');
    setManagerId('');
    setContractTypeId('');
    setLeadershipLevelId('');
    setLeadershipCategory('');
    setEmployerRights(false);
    setPickedPosition(null);
    setMode('invite');
    setPassword('');
    setPasswordConfirm('');
    setShowPassword(false);
  };

  // v3.33.0 — direct-create handler (no email; admin-set password).
  // Validates client-side first; the edge fn re-validates server-side
  // using validate_password_policy() for defense in depth.
  const handleCreateUser = async () => {
    const normEmail = email.trim().toLowerCase();
    if (!normEmail || !normEmail.includes('@')) {
      toast.error(tt('members.invite_email_invalid'));
      return;
    }
    if (!displayName.trim()) {
      toast.error(tt('members.invite_name_required'));
      return;
    }
    if (!policy.ok) {
      toast.error(tt('members.create_password_policy_failed'));
      return;
    }
    if (!passwordMatches) {
      toast.error(tt('members.create_password_mismatch'));
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-workspace-user', {
        body: {
          workspace_id: workspaceId,
          email: normEmail,
          display_name: displayName.trim(),
          password,
          role,
          business_role: pickedPosition?.business_role ?? null,
          team: null,
          location: location.trim() || null,
        },
      });
      if (error) throw error;
      const payload = data as { ok?: boolean; error?: string; failures?: string[] };
      if (payload?.error) throw new Error(payload.error);

      toast.success(tt('members.create_success', { name: displayName.trim() }));
      try {
        await logAuditEvent({
          workspace_id: workspaceId,
          actor_id: invitedBy,
          action: 'enterprise.member.create_direct',
          metadata: { email: normEmail, role },
        });
      } catch { /* audit failure is non-blocking */ }
      resetForm();
      onOpenChange(false);
      onInvited();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(tt('members.create_error') + ': ' + msg);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!email.trim() || !email.includes('@')) {
      toast.error(tt('members.invite_email_invalid'));
      return;
    }
    if (!displayName.trim()) {
      toast.error(tt('members.invite_name_required'));
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
          toast.error(tt('members.invite_already_member'));
        } else {
          throw invError;
        }
        return;
      }

      const prefillData: Record<string, any> = {};
      const primaryRole = pickedPosition?.positionLabel || allocations[0]?.business_role || null;
      if (displayName.trim()) prefillData.display_name = displayName.trim();
      if (primaryRole) prefillData.business_role = primaryRole;
      if (allocations.length > 0) prefillData.role_allocations = allocations;
      if (officeId) prefillData.office_id = officeId;
      if (city) prefillData.city = city;
      if (location) prefillData.location = location;
      if (orgUnitId) prefillData.org_unit_id = orgUnitId;
      if (managerId) prefillData.manager_id = managerId;
      if (contractTypeId) prefillData.contract_type_id = contractTypeId;
      if (leadershipLevelId) prefillData.leadership_level_id = leadershipLevelId;
      if (leadershipCategory) prefillData.leadership_category = leadershipCategory;
      if (employerRights) prefillData.employer_rights = true;
      if (pickedPosition) {
        prefillData.position_catalog_id = pickedPosition.positionRoleId;
        prefillData.seniority = pickedPosition.seniority;
        prefillData.position_skills = pickedPosition.skillIds;
      }

      let workspaceName = t('invitations.workspace_name_fallback');

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
      const signInUrl = new URL('/', window.location.origin);
      signInUrl.hash = `/auth?redirect=${encodeURIComponent(inviteRedirectPath)}`;
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
        toast.error(tt('members.invite_email_failed'));
      } else {
        toast.success(tt('members.invite_success', { email: normalizedEmail }));
      }

      resetForm();
      onOpenChange(false);
      onInvited();
    } catch (err: unknown) {
      console.error(err);
      toast.error(tt('members.invite_failed'));
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
      toast.error(tt('members.template_save_failed'));
    } else {
      toast.success(tt('members.template_saved'));
      setShowNewTemplate(false);
      setNewTemplateName('');
      const { data } = await supabase.from('enterprise_member_templates').select('*').eq('workspace_id', workspaceId).order('template_name');
      setTemplates((data as MemberTemplate[]) || []);
    }
  };

  const getRoleLabel = (r: string) => {
    switch (r) {
      case 'owner': return tt('members.roles.owner');
      case 'resourceAssistant': return tt('members.roles.resource_assistant');
      default: return tt('members.roles.member');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            {mode === 'invite' ? tt('members.invite_title') : tt('members.create_title')}
          </DialogTitle>
        </DialogHeader>

        {/* v3.33.0 — Mode toggle: invite-by-email vs direct-create-with-password.
            Same form, same fields, only the submit path differs. */}
        <div className="inline-flex rounded-md border bg-background overflow-hidden self-start text-xs w-full">
          <button
            type="button"
            onClick={() => setMode('invite')}
            className={`flex-1 px-3 py-1.5 inline-flex items-center justify-center gap-1.5 ${
              mode === 'invite' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
            }`}
          >
            <Mail className="h-3.5 w-3.5" /> {tt('members.mode_invite')}
          </button>
          <button
            type="button"
            onClick={() => setMode('create')}
            className={`flex-1 px-3 py-1.5 inline-flex items-center justify-center gap-1.5 ${
              mode === 'create' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
            }`}
          >
            <KeyRound className="h-3.5 w-3.5" /> {tt('members.mode_create')}
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground -mt-1">
          {mode === 'invite' ? tt('members.mode_invite_hint') : tt('members.mode_create_hint')}
        </p>

        {/* Templates */}
        {templates.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">{tt('members.invite_template_label')}</Label>
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
              <Label htmlFor="inv-name">{tt('members.invite_name')} *</Label>
              <Input id="inv-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Kovács János" />
            </div>
            <div>
              <Label htmlFor="inv-email">{tt('members.invite_email')} *</Label>
              <Input id="inv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="kolléga@cég.hu" />
            </div>
          </div>

          <div>
            <Label>{tt('members.invite_role')}</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="member">{tt('members.roles.member')}</SelectItem>
                <SelectItem value="resourceAssistant">{tt('members.roles.resource_assistant')}</SelectItem>
                <SelectItem value="owner">{tt('members.roles.owner')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Business roles with allocation */}
          <div>
            <Label>{tt('members.invite_business_roles')}</Label>
            {businessRoles.length === 0 ? (
              <p className="text-xs text-muted-foreground italic mt-1">
                {tt('members.invite_no_positions')}
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
              <Label>{tt('members.invite_office')}</Label>
              <Select value={officeId || '__none__'} onValueChange={(v) => setOfficeId(v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{tt('members.invite_office_none')}</SelectItem>
                  {offices.map(o => (
                    <SelectItem key={o.id} value={o.id}>{o.name}{o.city ? ` (${o.city})` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{tt('members.invite_city')}</Label>
              <Input value={city} onChange={e => setCity(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>{tt('members.invite_location_note')}</Label>
            <Input value={location} onChange={e => setLocation(e.target.value)} />
          </div>

          <Separator />

          {/* v3.0.0 — Organization metadata (soft-required during transition) */}
          <div className="space-y-3" data-help-region="workspace.organization">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Building2 className="h-4 w-4 text-primary" />
              {tt('organization.title')}
              <Badge variant="outline" className="text-[10px] font-normal">{tt('common.optional')}</Badge>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{tt('member.org_unit')}</Label>
                <Select value={orgUnitId || '__none__'} onValueChange={(v) => setOrgUnitId(v === '__none__' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {orgUnits.map(o => (<SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{tt('member.manager')}</Label>
                <Select value={managerId || '__none__'} onValueChange={(v) => setManagerId(v === '__none__' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {managers.map(m => (<SelectItem key={m.id} value={m.id}>{m.display_name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{tt('member.contract_type')}</Label>
                <Select value={contractTypeId || '__none__'} onValueChange={(v) => setContractTypeId(v === '__none__' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {contractTypes.map(c => (<SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{tt('member.leadership_level')}</Label>
                <Select value={leadershipLevelId || '__none__'} onValueChange={(v) => setLeadershipLevelId(v === '__none__' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {leadershipLevels.map(l => (<SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{tt('member.leadership_category')}</Label>
                <Select value={leadershipCategory || '__none__'} onValueChange={(v) => setLeadershipCategory(v === '__none__' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    <SelectItem value="strategic">{tt('member.leadership_categories.strategic')}</SelectItem>
                    <SelectItem value="operational">{tt('member.leadership_categories.operational')}</SelectItem>
                    <SelectItem value="technical">{tt('member.leadership_categories.technical')}</SelectItem>
                    <SelectItem value="execution">{tt('member.leadership_categories.execution')}</SelectItem>
                    <SelectItem value="none">{tt('member.leadership_categories.none')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-input"
                    checked={employerRights}
                    onChange={(e) => setEmployerRights(e.target.checked)}
                  />
                  {tt('member.employer_rights')}
                </label>
              </div>
            </div>

            {/* Predefined position picker */}
            <div className="rounded-md border bg-muted/30 px-3 py-2 flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">{tt('positions.catalog_title')}</div>
                {pickedPosition ? (
                  <div className="text-sm truncate">
                    <strong>{pickedPosition.positionLabel}</strong>
                    {' · '}
                    <span className="text-muted-foreground">{pickedPosition.seniority}</span>
                    {' · '}
                    <span className="text-muted-foreground">{pickedPosition.skillIds.length} skills</span>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">{tt('positions.custom_path')}</div>
                )}
              </div>
              <div className="flex gap-1">
                {pickedPosition ? (
                  <Button size="sm" variant="ghost" onClick={() => setPickedPosition(null)}>
                    {tt('common.cancel')}
                  </Button>
                ) : null}
                <Button size="sm" variant="outline" onClick={() => setShowPositionPicker(true)}>
                  <ListChecks className="h-3.5 w-3.5 mr-1" />
                  {tt('positions.catalog_path')}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <PositionPickerDialog
          open={showPositionPicker}
          onOpenChange={setShowPositionPicker}
          workspaceId={workspaceId}
          onPick={(r) => setPickedPosition(r)}
        />

        {/* Save as template */}
        <div className="border-t pt-3 mt-2">
          {!showNewTemplate ? (
            <Button size="sm" variant="ghost" className="text-xs" onClick={() => setShowNewTemplate(true)}>
              {tt('members.invite_save_template')}
            </Button>
          ) : (
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Label className="text-xs">{tt('members.invite_template_name')}</Label>
                <Input value={newTemplateName} onChange={e => setNewTemplateName(e.target.value)} className="h-8 text-sm" />
              </div>
              <Button size="sm" onClick={handleSaveTemplate} disabled={!newTemplateName.trim()}>{tt('common.save')}</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowNewTemplate(false)}>{tt('common.cancel')}</Button>
            </div>
          )}
        </div>

        {/* v3.33.0 — Password section, shown only in create mode. */}
        {mode === 'create' && (
          <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <KeyRound className="h-4 w-4 text-primary" />
              {tt('members.create_password_section_title')}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {tt('members.create_password_hint')}
            </p>

            <div className="space-y-1">
              <Label htmlFor="create-pw" className="text-xs">{tt('members.create_password_label')}</Label>
              <div className="relative">
                <Input
                  id="create-pw"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-9 font-mono"
                  autoComplete="new-password"
                  spellCheck={false}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={tt(showPassword ? 'members.create_password_hide' : 'members.create_password_show')}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="create-pw-confirm" className="text-xs">{tt('members.create_password_confirm_label')}</Label>
              <Input
                id="create-pw-confirm"
                type={showPassword ? 'text' : 'password'}
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                className="font-mono"
                autoComplete="new-password"
                spellCheck={false}
              />
              {passwordConfirm.length > 0 && !passwordMatches && (
                <p className="text-[11px] text-red-600 dark:text-red-400">
                  {tt('members.create_password_mismatch')}
                </p>
              )}
            </div>

            {/* Live policy checklist */}
            <ul className="space-y-0.5 mt-1">
              {PASSWORD_POLICY_RULES.map((rule: PasswordPolicyFailure) => {
                const pass = !policy.failures.includes(rule);
                return (
                  <li key={rule} className={`flex items-center gap-1.5 text-[11px] ${
                    pass ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
                  }`}>
                    {pass ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    {tt(`members.password_rule_${rule}` as 'members.password_rule_min_length_10')}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>{tt('common.cancel')}</Button>
          {mode === 'invite' ? (
            <Button onClick={handleInvite} disabled={loading || !email.trim() || !displayName.trim()}>
              {loading ? tt('members.invite_sending') : tt('members.invite_submit')}
            </Button>
          ) : (
            <Button
              onClick={handleCreateUser}
              disabled={loading || !email.trim() || !displayName.trim() || !policy.ok || !passwordMatches}
            >
              {loading ? tt('members.create_submitting') : tt('members.create_submit')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
