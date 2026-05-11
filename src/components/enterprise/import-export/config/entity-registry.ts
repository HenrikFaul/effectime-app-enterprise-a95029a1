import { Users, CalendarDays, Building2, FolderTree, Briefcase, Tag, Target, type LucideIcon } from 'lucide-react';

export type FieldType = 'string' | 'email' | 'date' | 'boolean' | 'enum' | 'uuid' | 'number';

export interface FieldDefinition {
  key: string;
  label: string;
  type: FieldType;
  enumValues?: string[];
  enumLabels?: Record<string, string>;
  required: boolean;
  importable: boolean;
  exportable: boolean;
  computed?: boolean;
  group?: string;
  description?: string;
  templateExample?: string;
  importAlias?: string[];
  protected?: boolean;
}

export interface EntityConfig {
  key: string;
  label: string;
  icon: LucideIcon;
  description: string;
  exportEnabled: boolean;
  importEnabled: boolean;
  uniqueKeyFields: string[];
  supportsUpsert: boolean;
  fields: FieldDefinition[];
}

const MEMBER_FIELDS: FieldDefinition[] = [
  // Basic data
  { key: 'email', label: 'Email', type: 'email', required: true, importable: true, exportable: true, group: 'Basic data', templateExample: 'john.doe@company.com', description: 'User email address — unique identifier.', importAlias: ['Email', 'e-mail', 'mail'] },
  { key: 'display_name', label: 'Full name', type: 'string', required: true, importable: true, exportable: true, group: 'Basic data', templateExample: 'John Doe', importAlias: ['Name', 'name', 'full_name'] },
  { key: 'role', label: 'Permission', type: 'enum', enumValues: ['owner', 'resourceAssistant', 'member'], enumLabels: { owner: 'Owner', resourceAssistant: 'Resource assistant', member: 'Member' }, required: true, importable: true, exportable: true, group: 'Basic data', templateExample: 'member', description: 'owner / resourceAssistant / member' },
  { key: 'status', label: 'Membership status', type: 'enum', enumValues: ['active', 'inactive'], enumLabels: { active: 'Active', inactive: 'Inactive' }, required: false, importable: true, exportable: true, group: 'Basic data', templateExample: 'active' },
  // Organizational data
  { key: 'team', label: 'Team', type: 'string', required: false, importable: true, exportable: true, group: 'Organizational data', templateExample: 'Backend' },
  { key: 'business_role', label: 'Job title (position)', type: 'string', required: false, importable: true, exportable: true, group: 'Organizational data', templateExample: 'Senior Backend Developer' },
  { key: 'office_name', label: 'Office', type: 'string', required: false, importable: true, exportable: true, group: 'Organizational data', templateExample: 'Budapest Office', description: 'Office name — automatically resolved to ID.' },
  { key: 'org_unit_name', label: 'Org unit', type: 'string', required: false, importable: false, exportable: true, computed: true, group: 'Organizational data', description: 'Organizational unit name from the org chart.' },
  { key: 'city', label: 'City', type: 'string', required: false, importable: true, exportable: true, group: 'Organizational data', templateExample: 'Budapest' },
  { key: 'location', label: 'Location (free text)', type: 'string', required: false, importable: true, exportable: true, group: 'Organizational data', templateExample: 'New York, 5th Ave 1' },
  { key: 'base_working_hours', label: 'Daily working hours', type: 'number', required: false, importable: true, exportable: true, group: 'Organizational data', templateExample: '8' },
  { key: 'weekly_capacity_hours', label: 'Weekly capacity (hours)', type: 'number', required: false, importable: true, exportable: true, group: 'Organizational data', templateExample: '40', importAlias: ['weekly_hours', 'heti_ora'] },
  { key: 'joined_at', label: 'Joined date', type: 'date', required: false, importable: true, exportable: true, group: 'Organizational data', templateExample: '2024-01-15' },
  // Org chart / hierarchy
  { key: 'manager_email', label: 'Manager (email)', type: 'email', required: false, importable: true, exportable: true, group: 'Hierarchy', templateExample: 'manager@company.com', description: 'Direct manager email address — used for org chart.', importAlias: ['manager', 'felettes', 'boss_email'] },
  { key: 'subordinate_emails', label: 'Subordinates (email)', type: 'string', required: false, importable: false, exportable: true, computed: true, group: 'Hierarchy', description: 'Semicolon-separated subordinate emails (export only).' },
  // Career / competence
  { key: 'seniority', label: 'Seniority', type: 'enum', enumValues: ['junior', 'medior', 'senior', 'lead', 'principal'], enumLabels: { junior: 'Junior', medior: 'Medior', senior: 'Senior', lead: 'Lead', principal: 'Principal' }, required: false, importable: true, exportable: true, group: 'Career', templateExample: 'senior', importAlias: ['level', 'experience_level', 'tapasztalat'] },
  { key: 'leadership_level', label: 'Leadership level', type: 'string', required: false, importable: false, exportable: true, computed: true, group: 'Career', description: 'Leadership level name.' },
  { key: 'leadership_category', label: 'Leadership category', type: 'string', required: false, importable: true, exportable: true, group: 'Career', templateExample: 'middle_management', importAlias: ['lead_category'] },
  { key: 'contract_type', label: 'Contract type', type: 'string', required: false, importable: false, exportable: true, computed: true, group: 'Career', description: 'Contract type name.' },
  { key: 'employer_rights', label: 'Employer rights', type: 'boolean', required: false, importable: true, exportable: true, group: 'Career', templateExample: 'false', importAlias: ['employer_right'] },
  { key: 'skills', label: 'Skills', type: 'string', required: false, importable: false, exportable: true, computed: true, group: 'Career', description: 'Semicolon-separated skills (export only).' },
  // System
  { key: 'membership_id', label: 'Membership ID (system)', type: 'uuid', required: false, importable: false, exportable: true, computed: true, group: 'System', protected: true, description: 'Export only. Never importable.' },
  { key: 'user_id', label: 'User ID (system)', type: 'uuid', required: false, importable: false, exportable: true, computed: true, group: 'System', protected: true },
];

const LEAVE_FIELDS: FieldDefinition[] = [
  { key: 'email', label: 'Member email', type: 'email', required: true, importable: true, exportable: true, group: 'Basic data', templateExample: 'john.doe@company.com' },
  { key: 'start_date', label: 'Start date', type: 'date', required: true, importable: true, exportable: true, group: 'Basic data', templateExample: '2026-06-01' },
  { key: 'end_date', label: 'End date', type: 'date', required: true, importable: true, exportable: true, group: 'Basic data', templateExample: '2026-06-05' },
  { key: 'leave_type', label: 'Type', type: 'enum', enumValues: ['vacation', 'sick_leave', 'unpaid_leave', 'other'], enumLabels: { vacation: 'Vacation', sick_leave: 'Sick leave', unpaid_leave: 'Unpaid leave', other: 'Other' }, required: true, importable: true, exportable: true, group: 'Basic data', templateExample: 'vacation' },
  { key: 'status', label: 'Status', type: 'enum', enumValues: ['pending', 'approved', 'rejected', 'cancelled'], enumLabels: { pending: 'Pending', approved: 'Approved', rejected: 'Rejected', cancelled: 'Cancelled' }, required: false, importable: true, exportable: true, group: 'Basic data', templateExample: 'approved' },
  { key: 'is_half_day', label: 'Half day', type: 'boolean', required: false, importable: true, exportable: true, group: 'Details', templateExample: 'false' },
  { key: 'half_day_period', label: 'Half day period', type: 'enum', enumValues: ['morning', 'afternoon'], enumLabels: { morning: 'Morning', afternoon: 'Afternoon' }, required: false, importable: true, exportable: true, group: 'Details', templateExample: '' },
  { key: 'comment', label: 'Comment', type: 'string', required: false, importable: true, exportable: true, group: 'Details', templateExample: 'Summer vacation' },
  { key: 'display_name', label: 'Member name', type: 'string', required: false, importable: false, exportable: true, computed: true, group: 'Derived' },
  { key: 'team', label: 'Team', type: 'string', required: false, importable: false, exportable: true, computed: true, group: 'Derived' },
];

const OFFICE_FIELDS: FieldDefinition[] = [
  { key: 'name', label: 'Office name', type: 'string', required: true, importable: true, exportable: true, group: 'Basic data', templateExample: 'Budapest Office' },
  { key: 'city', label: 'City', type: 'string', required: false, importable: true, exportable: true, group: 'Basic data', templateExample: 'Budapest' },
  { key: 'address', label: 'Address', type: 'string', required: false, importable: true, exportable: true, group: 'Basic data', templateExample: '5th Ave 1, 10001' },
  { key: 'office_id', label: 'Office ID', type: 'uuid', required: false, importable: false, exportable: true, computed: true, group: 'System', protected: true },
];

const SKILL_FIELDS: FieldDefinition[] = [
  { key: 'name', label: 'Skill name', type: 'string', required: true, importable: true, exportable: true, group: 'Basic data', templateExample: 'TypeScript' },
  { key: 'category', label: 'Category', type: 'string', required: false, importable: true, exportable: true, group: 'Basic data', templateExample: 'Programming language' },
  { key: 'color', label: 'Color (hex)', type: 'string', required: false, importable: true, exportable: true, group: 'Basic data', templateExample: '#6366f1' },
  { key: 'skill_id', label: 'Skill ID', type: 'uuid', required: false, importable: false, exportable: true, computed: true, group: 'System', protected: true },
];

const WORK_CATEGORY_FIELDS: FieldDefinition[] = [
  { key: 'name', label: 'Category name', type: 'string', required: true, importable: true, exportable: true, group: 'Basic data', templateExample: 'Engineering' },
  { key: 'is_active', label: 'Active', type: 'boolean', required: false, importable: true, exportable: true, group: 'Basic data', templateExample: 'true' },
  { key: 'category_id', label: 'Category ID', type: 'uuid', required: false, importable: false, exportable: true, computed: true, group: 'System', protected: true },
];

const JOB_ROLE_FIELDS: FieldDefinition[] = [
  { key: 'name', label: 'Job role name', type: 'string', required: true, importable: true, exportable: true, group: 'Basic data', templateExample: 'Senior Backend Developer' },
  { key: 'category_name', label: 'Category', type: 'string', required: true, importable: true, exportable: true, group: 'Basic data', templateExample: 'Engineering', description: 'Category name — automatically resolved to ID.' },
  { key: 'is_active', label: 'Active', type: 'boolean', required: false, importable: true, exportable: true, group: 'Basic data', templateExample: 'true' },
  { key: 'role_id', label: 'Job role ID', type: 'uuid', required: false, importable: false, exportable: true, computed: true, group: 'System', protected: true },
];

const POSITION_FIELDS: FieldDefinition[] = [
  { key: 'name', label: 'Position name', type: 'string', required: true, importable: true, exportable: true, group: 'Basic data', templateExample: 'Senior Backend Developer', description: 'Unique values of the `business_role` field across members.' },
  { key: 'member_count', label: 'Member count', type: 'number', required: false, importable: false, exportable: true, computed: true, group: 'Derived', description: 'How many members hold this position.' },
];

export const ENTITY_REGISTRY: EntityConfig[] = [
  {
    key: 'members',
    label: 'Members',
    icon: Users,
    description: 'Employee profiles and organizational data',
    exportEnabled: true,
    importEnabled: true,
    uniqueKeyFields: ['email'],
    supportsUpsert: true,
    fields: MEMBER_FIELDS,
  },
  {
    key: 'leave',
    label: 'Leave',
    icon: CalendarDays,
    description: 'Leave requests and approvals',
    exportEnabled: true,
    importEnabled: true,
    uniqueKeyFields: ['email', 'start_date', 'end_date', 'leave_type'],
    supportsUpsert: false,
    fields: LEAVE_FIELDS,
  },
  {
    key: 'offices',
    label: 'Offices',
    icon: Building2,
    description: 'Offices and physical locations',
    exportEnabled: true,
    importEnabled: true,
    uniqueKeyFields: ['name'],
    supportsUpsert: true,
    fields: OFFICE_FIELDS,
  },
  {
    key: 'work_categories',
    label: 'Work categories',
    icon: FolderTree,
    description: 'Role groups (e.g. Engineering, Sales)',
    exportEnabled: true,
    importEnabled: true,
    uniqueKeyFields: ['name'],
    supportsUpsert: true,
    fields: WORK_CATEGORY_FIELDS,
  },
  {
    key: 'job_roles',
    label: 'Job roles',
    icon: Briefcase,
    description: 'Specific job roles per category',
    exportEnabled: true,
    importEnabled: true,
    uniqueKeyFields: ['name', 'category_name'],
    supportsUpsert: true,
    fields: JOB_ROLE_FIELDS,
  },
  {
    key: 'positions',
    label: 'Positions',
    icon: Briefcase,
    description: 'business_role values assigned to members',
    exportEnabled: true,
    importEnabled: false,
    uniqueKeyFields: ['name'],
    supportsUpsert: false,
    fields: POSITION_FIELDS,
  },
  {
    key: 'skills',
    label: 'Skills',
    icon: Tag,
    description: 'Competencies and technologies',
    exportEnabled: true,
    importEnabled: true,
    uniqueKeyFields: ['name'],
    supportsUpsert: true,
    fields: SKILL_FIELDS,
  },
];

export function getEntityConfig(key: string): EntityConfig | undefined {
  return ENTITY_REGISTRY.find(e => e.key === key);
}

export function getRequiredFields(entity: EntityConfig): FieldDefinition[] {
  return entity.fields.filter(f => f.required && f.importable);
}

export function getImportableFields(entity: EntityConfig): FieldDefinition[] {
  return entity.fields.filter(f => f.importable);
}

export function getExportableFields(entity: EntityConfig): FieldDefinition[] {
  return entity.fields.filter(f => f.exportable);
}

export function getFieldGroups(entity: EntityConfig): string[] {
  const groups = new Set<string>();
  entity.fields.forEach(f => { if (f.exportable && f.group) groups.add(f.group); });
  return Array.from(groups);
}
