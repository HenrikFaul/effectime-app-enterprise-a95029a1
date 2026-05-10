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
  // Alapadatok
  { key: 'email', label: 'Email', type: 'email', required: true, importable: true, exportable: true, group: 'Alapadatok', templateExample: 'kovacs.bela@ceg.hu', description: 'A felhasználó email címe — egyedi azonosító.', importAlias: ['Email', 'e-mail', 'mail'] },
  { key: 'display_name', label: 'Teljes név', type: 'string', required: true, importable: true, exportable: true, group: 'Alapadatok', templateExample: 'Kovács Béla', importAlias: ['Név', 'name', 'full_name'] },
  { key: 'role', label: 'Jogosultság', type: 'enum', enumValues: ['owner', 'resourceAssistant', 'member'], enumLabels: { owner: 'Tulajdonos', resourceAssistant: 'Erőforrás-asszisztens', member: 'Tag' }, required: true, importable: true, exportable: true, group: 'Alapadatok', templateExample: 'member', description: 'owner / resourceAssistant / member' },
  { key: 'status', label: 'Tagság státusza', type: 'enum', enumValues: ['active', 'inactive'], enumLabels: { active: 'Aktív', inactive: 'Inaktív' }, required: false, importable: true, exportable: true, group: 'Alapadatok', templateExample: 'active' },
  // Szervezeti adatok
  { key: 'team', label: 'Csapat', type: 'string', required: false, importable: true, exportable: true, group: 'Szervezeti adatok', templateExample: 'Backend' },
  { key: 'business_role', label: 'Munkakör (pozíció)', type: 'string', required: false, importable: true, exportable: true, group: 'Szervezeti adatok', templateExample: 'Senior Backend Developer' },
  { key: 'office_name', label: 'Telephely', type: 'string', required: false, importable: true, exportable: true, group: 'Szervezeti adatok', templateExample: 'Budapest Iroda', description: 'A telephely neve — automatikusan feloldjuk az ID-ra.' },
  { key: 'org_unit_name', label: 'Szervezeti egység', type: 'string', required: false, importable: false, exportable: true, computed: true, group: 'Szervezeti adatok', description: 'Az org-chart szervezeti egység neve.' },
  { key: 'city', label: 'Város', type: 'string', required: false, importable: true, exportable: true, group: 'Szervezeti adatok', templateExample: 'Budapest' },
  { key: 'location', label: 'Helyszín (szabad)', type: 'string', required: false, importable: true, exportable: true, group: 'Szervezeti adatok', templateExample: 'Budapest, Váci út 1.' },
  { key: 'base_working_hours', label: 'Napi munkaidő (óra)', type: 'number', required: false, importable: true, exportable: true, group: 'Szervezeti adatok', templateExample: '8' },
  { key: 'weekly_capacity_hours', label: 'Heti kapacitás (óra)', type: 'number', required: false, importable: true, exportable: true, group: 'Szervezeti adatok', templateExample: '40', importAlias: ['weekly_hours', 'heti_ora'] },
  { key: 'joined_at', label: 'Csatlakozás dátuma', type: 'date', required: false, importable: true, exportable: true, group: 'Szervezeti adatok', templateExample: '2024-01-15' },
  // Org-chart / hierarchia
  { key: 'manager_email', label: 'Felettes (email)', type: 'email', required: false, importable: true, exportable: true, group: 'Hierarchia', templateExample: 'vezeto@ceg.hu', description: 'A közvetlen vezető email címe — org-chart felépítéshez.', importAlias: ['manager', 'felettes', 'boss_email'] },
  { key: 'subordinate_emails', label: 'Beosztottak (email)', type: 'string', required: false, importable: false, exportable: true, computed: true, group: 'Hierarchia', description: 'Pontosvesszővel elválasztott beosztott email-ek (csak export).' },
  // Karrier / kompetencia
  { key: 'seniority', label: 'Szenioritás', type: 'enum', enumValues: ['junior', 'medior', 'senior', 'lead', 'principal'], enumLabels: { junior: 'Junior', medior: 'Medior', senior: 'Senior', lead: 'Lead', principal: 'Principal' }, required: false, importable: true, exportable: true, group: 'Karrier', templateExample: 'senior', importAlias: ['level', 'experience_level', 'tapasztalat'] },
  { key: 'leadership_level', label: 'Vezető szint', type: 'string', required: false, importable: false, exportable: true, computed: true, group: 'Karrier', description: 'A vezető szint megnevezése.' },
  { key: 'leadership_category', label: 'Vezetői kategória', type: 'string', required: false, importable: true, exportable: true, group: 'Karrier', templateExample: 'middle_management', importAlias: ['lead_category'] },
  { key: 'contract_type', label: 'Szerződés típusa', type: 'string', required: false, importable: false, exportable: true, computed: true, group: 'Karrier', description: 'A szerződés típusának megnevezése.' },
  { key: 'employer_rights', label: 'Munkáltatói jogkör', type: 'boolean', required: false, importable: true, exportable: true, group: 'Karrier', templateExample: 'false', importAlias: ['employer_right'] },
  { key: 'skills', label: 'Készségek', type: 'string', required: false, importable: false, exportable: true, computed: true, group: 'Karrier', description: 'Pontosvesszővel elválasztott készségek (csak export).' },
  // Rendszer
  { key: 'membership_id', label: 'Tagság ID (rendszer)', type: 'uuid', required: false, importable: false, exportable: true, computed: true, group: 'Rendszer', protected: true, description: 'Csak exportra. Soha nem importálható.' },
  { key: 'user_id', label: 'Felhasználó ID (rendszer)', type: 'uuid', required: false, importable: false, exportable: true, computed: true, group: 'Rendszer', protected: true },
];

const LEAVE_FIELDS: FieldDefinition[] = [
  { key: 'email', label: 'Tag email', type: 'email', required: true, importable: true, exportable: true, group: 'Alapadatok', templateExample: 'kovacs.bela@ceg.hu' },
  { key: 'start_date', label: 'Kezdő dátum', type: 'date', required: true, importable: true, exportable: true, group: 'Alapadatok', templateExample: '2026-06-01' },
  { key: 'end_date', label: 'Záró dátum', type: 'date', required: true, importable: true, exportable: true, group: 'Alapadatok', templateExample: '2026-06-05' },
  { key: 'leave_type', label: 'Típus', type: 'enum', enumValues: ['vacation', 'sick_leave', 'unpaid_leave', 'other'], enumLabels: { vacation: 'Szabadság', sick_leave: 'Betegszabadság', unpaid_leave: 'Fizetés nélküli', other: 'Egyéb' }, required: true, importable: true, exportable: true, group: 'Alapadatok', templateExample: 'vacation' },
  { key: 'status', label: 'Státusz', type: 'enum', enumValues: ['pending', 'approved', 'rejected', 'cancelled'], enumLabels: { pending: 'Függőben', approved: 'Jóváhagyva', rejected: 'Elutasítva', cancelled: 'Visszavonva' }, required: false, importable: true, exportable: true, group: 'Alapadatok', templateExample: 'approved' },
  { key: 'is_half_day', label: 'Félnap', type: 'boolean', required: false, importable: true, exportable: true, group: 'Részletek', templateExample: 'false' },
  { key: 'half_day_period', label: 'Félnap időszak', type: 'enum', enumValues: ['morning', 'afternoon'], enumLabels: { morning: 'Délelőtt', afternoon: 'Délután' }, required: false, importable: true, exportable: true, group: 'Részletek', templateExample: '' },
  { key: 'comment', label: 'Megjegyzés', type: 'string', required: false, importable: true, exportable: true, group: 'Részletek', templateExample: 'Nyári vakáció' },
  { key: 'display_name', label: 'Tag neve', type: 'string', required: false, importable: false, exportable: true, computed: true, group: 'Származtatott' },
  { key: 'team', label: 'Csapat', type: 'string', required: false, importable: false, exportable: true, computed: true, group: 'Származtatott' },
];

const OFFICE_FIELDS: FieldDefinition[] = [
  { key: 'name', label: 'Telephely neve', type: 'string', required: true, importable: true, exportable: true, group: 'Alapadatok', templateExample: 'Budapest Iroda' },
  { key: 'city', label: 'Város', type: 'string', required: false, importable: true, exportable: true, group: 'Alapadatok', templateExample: 'Budapest' },
  { key: 'address', label: 'Cím', type: 'string', required: false, importable: true, exportable: true, group: 'Alapadatok', templateExample: 'Váci út 1, 1133' },
  { key: 'office_id', label: 'Telephely ID', type: 'uuid', required: false, importable: false, exportable: true, computed: true, group: 'Rendszer', protected: true },
];

const SKILL_FIELDS: FieldDefinition[] = [
  { key: 'name', label: 'Készség neve', type: 'string', required: true, importable: true, exportable: true, group: 'Alapadatok', templateExample: 'TypeScript' },
  { key: 'category', label: 'Kategória', type: 'string', required: false, importable: true, exportable: true, group: 'Alapadatok', templateExample: 'Programozási nyelv' },
  { key: 'color', label: 'Szín (hex)', type: 'string', required: false, importable: true, exportable: true, group: 'Alapadatok', templateExample: '#6366f1' },
  { key: 'skill_id', label: 'Készség ID', type: 'uuid', required: false, importable: false, exportable: true, computed: true, group: 'Rendszer', protected: true },
];

const WORK_CATEGORY_FIELDS: FieldDefinition[] = [
  { key: 'name', label: 'Kategória neve', type: 'string', required: true, importable: true, exportable: true, group: 'Alapadatok', templateExample: 'Engineering' },
  { key: 'is_active', label: 'Aktív', type: 'boolean', required: false, importable: true, exportable: true, group: 'Alapadatok', templateExample: 'true' },
  { key: 'category_id', label: 'Kategória ID', type: 'uuid', required: false, importable: false, exportable: true, computed: true, group: 'Rendszer', protected: true },
];

const JOB_ROLE_FIELDS: FieldDefinition[] = [
  { key: 'name', label: 'Munkakör neve', type: 'string', required: true, importable: true, exportable: true, group: 'Alapadatok', templateExample: 'Senior Backend Developer' },
  { key: 'category_name', label: 'Kategória', type: 'string', required: true, importable: true, exportable: true, group: 'Alapadatok', templateExample: 'Engineering', description: 'A kategória neve — automatikusan feloldjuk az ID-ra.' },
  { key: 'is_active', label: 'Aktív', type: 'boolean', required: false, importable: true, exportable: true, group: 'Alapadatok', templateExample: 'true' },
  { key: 'role_id', label: 'Munkakör ID', type: 'uuid', required: false, importable: false, exportable: true, computed: true, group: 'Rendszer', protected: true },
];

const POSITION_FIELDS: FieldDefinition[] = [
  { key: 'name', label: 'Pozíció neve', type: 'string', required: true, importable: true, exportable: true, group: 'Alapadatok', templateExample: 'Senior Backend Developer', description: 'A `business_role` mező egyedi értékei a tagok között.' },
  { key: 'member_count', label: 'Tagok száma', type: 'number', required: false, importable: false, exportable: true, computed: true, group: 'Származtatott', description: 'Hány tagnak van ez a pozíciója.' },
];

export const ENTITY_REGISTRY: EntityConfig[] = [
  {
    key: 'members',
    label: 'Tagok',
    icon: Users,
    description: 'Munkavállalók profiljai és szervezeti adatai',
    exportEnabled: true,
    importEnabled: true,
    uniqueKeyFields: ['email'],
    supportsUpsert: true,
    fields: MEMBER_FIELDS,
  },
  {
    key: 'leave',
    label: 'Szabadságok',
    icon: CalendarDays,
    description: 'Szabadság-kérelmek és jóváhagyások',
    exportEnabled: true,
    importEnabled: true,
    uniqueKeyFields: ['email', 'start_date', 'end_date', 'leave_type'],
    supportsUpsert: false,
    fields: LEAVE_FIELDS,
  },
  {
    key: 'offices',
    label: 'Telephelyek',
    icon: Building2,
    description: 'Irodák és fizikai helyszínek',
    exportEnabled: true,
    importEnabled: true,
    uniqueKeyFields: ['name'],
    supportsUpsert: true,
    fields: OFFICE_FIELDS,
  },
  {
    key: 'work_categories',
    label: 'Munkakategóriák',
    icon: FolderTree,
    description: 'Szerepkör-csoportok (pl. Engineering, Sales)',
    exportEnabled: true,
    importEnabled: true,
    uniqueKeyFields: ['name'],
    supportsUpsert: true,
    fields: WORK_CATEGORY_FIELDS,
  },
  {
    key: 'job_roles',
    label: 'Munkakörök',
    icon: Briefcase,
    description: 'Konkrét munkakörök kategóriánként',
    exportEnabled: true,
    importEnabled: true,
    uniqueKeyFields: ['name', 'category_name'],
    supportsUpsert: true,
    fields: JOB_ROLE_FIELDS,
  },
  {
    key: 'positions',
    label: 'Pozíciók',
    icon: Briefcase,
    description: 'Tagokra rendelhető business_role értékek',
    exportEnabled: true,
    importEnabled: false,
    uniqueKeyFields: ['name'],
    supportsUpsert: false,
    fields: POSITION_FIELDS,
  },
  {
    key: 'skills',
    label: 'Készségek',
    icon: Tag,
    description: 'Kompetenciák és technológiák',
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
