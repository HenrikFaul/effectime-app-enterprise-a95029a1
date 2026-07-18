import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronRight, ListChecks, Search } from 'lucide-react';
import { useT } from '@/i18n/I18nProvider';

type Seniority = 'junior' | 'medior' | 'senior' | 'lead' | 'principal';

interface Category {
  id: string;
  name: string;
  is_active: boolean;
  source: 'workspace' | 'catalog';
}
interface Role {
  id: string;
  category_id: string;
  name: string;
  is_active: boolean;
  catalog_role_id?: string | null;
  source: 'workspace' | 'catalog';
}
interface RoleSkill {
  id: string;
  workspace_skill_id: string;
  required: boolean;
  min_experience_level: Seniority | null;
  workspace_skill?: { id: string; name: string } | null;
}

export interface PositionPickerResult {
  positionRoleId: string;
  source: 'workspace' | 'catalog';
  positionLabel: string;
  /**
   * Mirror of `positionLabel` for consumers that persist the picked position
   * as a member's business_role string (e.g. InviteMemberDialog payload).
   * Kept as an explicit field so the dependency is greppable and the picker
   * is the single source of truth for the value.
   */
  business_role: string;
  seniority: Seniority;
  skillIds: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  onPick: (result: PositionPickerResult) => void;
}

export function PositionPickerDialog({ open, onOpenChange, workspaceId, onPick }: Props) {
  const t = useT();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [categories, setCategories] = useState<Category[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [skills, setSkills] = useState<RoleSkill[]>([]);
  const [includedSkillIds, setIncludedSkillIds] = useState<Set<string>>(new Set());
  const [seniority, setSeniority] = useState<Seniority>('medior');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    // Workspace customizations and the remaining global inventory are shown
    // together. A first materialized role must not make every other global role
    // disappear from subsequent picker sessions.
    const [catRes, rolesRes, globalCatRes, globalRolesRes] = await Promise.all([
      (supabase as any)
        .from('enterprise_workspace_role_categories')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('is_active', true)
        .order('name'),
      (supabase as any)
        .from('enterprise_workspace_roles')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('is_active', true)
        .order('name'),
      (supabase as any)
        .from('enterprise_catalog_categories')
        .select('id, name, is_active')
        .eq('is_active', true)
        .order('name'),
      (supabase as any)
        .from('enterprise_catalog_roles')
        .select('id, category_id, name, is_active')
        .eq('is_active', true)
        .order('name'),
    ]);
    const workspaceCategories = ((catRes.data as Omit<Category, 'source'>[]) || [])
      .map((category) => ({ ...category, source: 'workspace' as const }));
    const workspaceRoles = ((rolesRes.data as Omit<Role, 'source'>[]) || [])
      .map((role) => ({ ...role, source: 'workspace' as const }));
    const materializedCatalogRoleIds = new Set(
      workspaceRoles.map((role) => role.catalog_role_id).filter(Boolean),
    );
    const catalogRoles = ((globalRolesRes.data as Omit<Role, 'source'>[]) || [])
      .filter((role) => !materializedCatalogRoleIds.has(role.id))
      .map((role) => ({ ...role, source: 'catalog' as const }));
    const visibleCatalogCategoryIds = new Set(catalogRoles.map((role) => role.category_id));
    const catalogCategories = ((globalCatRes.data as Omit<Category, 'source'>[]) || [])
      .filter((category) => visibleCatalogCategoryIds.has(category.id))
      .map((category) => ({ ...category, source: 'catalog' as const }));

    setCategories([...workspaceCategories, ...catalogCategories]);
    setRoles([...workspaceRoles, ...catalogRoles]);
    setLoading(false);
  }, [workspaceId]);

  const loadRoleSkills = useCallback(async (roleId: string, fromGlobal: boolean) => {
    setLoading(true);
    if (fromGlobal) {
      // Read from the global enterprise_catalog_role_skills + enterprise_catalog_skills
      const { data } = await (supabase as any)
        .from('enterprise_catalog_role_skills')
        .select('id, skill_id, required, min_experience_level, skill:enterprise_catalog_skills(id, name)')
        .eq('role_id', roleId);
      const list = ((data as any[]) || []).map((r: any) => ({
        id: r.id,
        workspace_skill_id: r.skill_id,
        required: r.required,
        min_experience_level: r.min_experience_level,
        workspace_skill: r.skill ? { id: r.skill.id, name: r.skill.name } : null,
      })) as RoleSkill[];
      setSkills(list);
      setIncludedSkillIds(new Set(list.filter((s) => s.required).map((s) => s.workspace_skill_id)));
    } else {
      const { data } = await (supabase as any)
        .from('enterprise_workspace_role_skills')
        .select('id, workspace_skill_id, required, min_experience_level, workspace_skill:enterprise_workspace_skills(id, name)')
        .eq('workspace_id', workspaceId)
        .eq('role_id', roleId)
        .eq('approved', true);
      const list = ((data as any[]) || []) as RoleSkill[];
      setSkills(list);
      setIncludedSkillIds(new Set(list.filter((s) => s.required).map((s) => s.workspace_skill_id)));
    }
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    if (open) {
      setStep(1);
      setSelectedCategory(null);
      setSelectedRole(null);
      setSkills([]);
      setIncludedSkillIds(new Set());
      setSeniority('medior');
      setSearchQuery('');
      loadCatalog();
    }
  }, [open, loadCatalog]);

  // Flat search results: all roles whose name matches the query
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    return roles.filter((r) => r.name.toLowerCase().includes(q));
  }, [searchQuery, roles]);

  const handleSelectCategory = (id: string) => {
    setSelectedCategory(id);
    setStep(2);
  };

  const handleSelectRole = async (r: Role) => {
    setSelectedRole(r);
    await loadRoleSkills(r.id, r.source === 'catalog');
    setStep(3);
  };

  const handleApply = () => {
    if (!selectedRole) return;
    onPick({
      positionRoleId: selectedRole.id,
      source: selectedRole.source,
      positionLabel: selectedRole.name,
      business_role: selectedRole.name,
      seniority,
      skillIds: Array.from(includedSkillIds),
    });
    onOpenChange(false);
  };

  const rolesInCategory = selectedCategory
    ? roles.filter((r) => r.category_id === selectedCategory)
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-primary" />
            {t('positions.catalog_title')}
          </DialogTitle>
          <DialogDescription>{t('positions.catalog_description')}</DialogDescription>
        </DialogHeader>

        {/* Free-text search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-8 h-8 text-sm"
            placeholder={t('positions.search_placeholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Step indicators — hidden during search */}
        {!searchResults && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground" aria-hidden>
            <span className={step === 1 ? 'font-semibold text-foreground' : ''}>
              {t('positions.pick_category')}
            </span>
            <ChevronRight className="h-3 w-3" />
            <span className={step === 2 ? 'font-semibold text-foreground' : ''}>
              {t('positions.pick_role')}
            </span>
            <ChevronRight className="h-3 w-3" />
            <span className={step === 3 ? 'font-semibold text-foreground' : ''}>
              {t('positions.review_skills')}
            </span>
          </div>
        )}

        {roles.some((role) => role.source === 'catalog') && !loading ? (
          <div className="rounded-md border border-primary/20 bg-primary/5 px-2 py-1.5 text-[11px] text-muted-foreground">
            {t('positions.global_catalog_note')}
          </div>
        ) : null}

        {loading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">{t('common.loading')}</div>
        ) : null}

        {/* Search results — flat list of matching positions */}
        {!loading && searchResults !== null ? (
          <div className="space-y-2">
            {searchResults.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground italic">
                {t('positions.search_no_results')}
              </div>
            ) : (
              searchResults.map((r) => {
                const cat = categories.find((c) => c.id === r.category_id);
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      setSelectedCategory(r.category_id);
                      setSearchQuery('');
                      handleSelectRole(r);
                    }}
                    className="w-full text-left rounded-md border bg-card hover:bg-accent transition px-3 py-2 flex items-center justify-between gap-2"
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium truncate">{r.name}</span>
                      {cat && (
                        <span className="text-[11px] text-muted-foreground truncate">{cat.name}</span>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                );
              })
            )}
          </div>
        ) : null}

        {/* Step 1: category */}
        {!loading && searchResults === null && step === 1 ? (
          <div className="space-y-2">
            {categories.length === 0 ? (
              <div className="text-sm text-muted-foreground italic">{t('common.empty')}</div>
            ) : (
              categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelectCategory(c.id)}
                  className="w-full text-left rounded-md border bg-card hover:bg-accent transition px-3 py-2 flex items-center justify-between"
                >
                  <span className="text-sm">{c.name}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))
            )}
          </div>
        ) : null}

        {/* Step 2: role */}
        {!loading && searchResults === null && step === 2 ? (
          <div className="space-y-2">
            {rolesInCategory.length === 0 ? (
              <div className="text-sm text-muted-foreground italic">{t('common.empty')}</div>
            ) : (
              rolesInCategory.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => handleSelectRole(r)}
                  className="w-full text-left rounded-md border bg-card hover:bg-accent transition px-3 py-2 flex items-center justify-between"
                >
                  <span className="text-sm">{r.name}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))
            )}
            <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
              ← {t('common.back')}
            </Button>
          </div>
        ) : null}

        {/* Step 3: skills review */}
        {!loading && step === 3 && selectedRole && searchResults === null ? (
          <div className="space-y-3">
            <Card>
              <CardContent className="p-3 space-y-3">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t('positions.pick_role')}
                  </div>
                  <div className="text-sm font-semibold">{selectedRole.name}</div>
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {t('positions.seniority')}
                  </label>
                  <Select value={seniority} onValueChange={(v) => setSeniority(v as Seniority)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="junior">{t('positions.seniority_levels.junior')}</SelectItem>
                      <SelectItem value="medior">{t('positions.seniority_levels.medior')}</SelectItem>
                      <SelectItem value="senior">{t('positions.seniority_levels.senior')}</SelectItem>
                      <SelectItem value="lead">{t('positions.seniority_levels.lead')}</SelectItem>
                      <SelectItem value="principal">{t('positions.seniority_levels.principal')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                {t('positions.review_skills')}
              </div>
              {skills.length === 0 ? (
                <div className="text-sm text-muted-foreground italic">{t('common.empty')}</div>
              ) : (
                <div className="space-y-1">
                  {skills.map((s) => {
                    const checked = includedSkillIds.has(s.workspace_skill_id);
                    return (
                      <label
                        key={s.id}
                        className="flex items-center gap-2 rounded-md border bg-card px-2 py-1.5 cursor-pointer"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            const next = new Set(includedSkillIds);
                            if (v) next.add(s.workspace_skill_id);
                            else next.delete(s.workspace_skill_id);
                            setIncludedSkillIds(next);
                          }}
                        />
                        <span className="text-sm flex-1">
                          {s.workspace_skill?.name ?? '—'}
                        </span>
                        {s.required ? <Badge className="text-[10px]">required</Badge> : null}
                        {s.min_experience_level ? (
                          <Badge variant="outline" className="text-[10px]">
                            {s.min_experience_level}+
                          </Badge>
                        ) : null}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-between">
              <Button variant="ghost" size="sm" onClick={() => setStep(2)}>
                ← {t('common.back')}
              </Button>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleApply} disabled={step !== 3 || !selectedRole}>
            {t('positions.apply')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
