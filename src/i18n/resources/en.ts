// English translation bundle. Keys are dotted; namespaces are top-level keys.
// Adding a new key: add it here AND in hu.ts (Hungarian fallback to English is allowed).

const en = {
  common: {
    save: 'Save',
    saving: 'Saving…',
    cancel: 'Cancel',
    edit: 'Edit',
    delete: 'Delete',
    archive: 'Archive',
    create: 'Create',
    add: 'Add',
    search: 'Search',
    loading: 'Loading…',
    empty: 'No records',
    yes: 'Yes',
    no: 'No',
    back: 'Back',
    close: 'Close',
    open: 'Open',
    confirm: 'Confirm',
    name: 'Name',
    description: 'Description',
    actions: 'Actions',
    status: 'Status',
    created: 'Created',
    updated: 'Updated',
    optional: 'optional',
    required: 'required',
  },
  header: {
    help: 'Help',
    open_help: 'Open help',
    language: 'Language',
    select_language: 'Select language',
    notifications: 'Notifications',
    profile: 'Profile',
    sign_out: 'Sign out',
    new_workspace: 'New workspace',
  },
  help: {
    drawer_title: 'Help',
    drawer_subtitle: 'Context-aware guidance for the current page.',
    no_anchor_title: 'Help',
    no_anchor_summary:
      'Open any page and reopen this drawer for context-specific guidance, common tasks, and keyboard shortcuts.',
    common_tasks: 'Common tasks',
    keyboard_shortcuts: 'Keyboard shortcuts',
    related: 'Related',
    open_manual: 'Open full manual',
    section_label: 'Section',
    anchors: {
      'home.overview': {
        title: 'Workspaces',
        summary:
          'This is your workspace selector. Each workspace is an isolated organization with its own members, leave policies, and reports. Click a workspace card to enter it.',
        commonTasks: [
          'Create a new workspace',
          'Open an existing workspace',
          'Sign out',
          'Switch language',
        ],
      },
      'workspace.members': {
        title: 'Members',
        summary:
          'Manage the people in your workspace. From here you can invite new members, edit roles and positions, view leave allowances, and open profile sheets.',
        commonTasks: [
          'Invite a new member',
          'Open a member profile',
          'Edit role assignments',
          'Filter by team or office',
        ],
      },
      'workspace.organization': {
        title: 'Organization',
        summary:
          'The Organization module is the canonical source of truth for hierarchy, leadership levels, contractual relationships, industry classification, work categories, and job families. The org chart is generated from these relationships.',
        commonTasks: [
          'Define org units and hierarchy',
          'Manage contractual relationship types',
          'Configure leadership levels',
          'View the auto-generated org chart',
        ],
      },
      'workspace.calendar': {
        title: 'Calendar',
        summary:
          'View leave, coverage, and capacity across the team. Switch between leave calendar, annual grid, timeline, and coverage planner.',
        commonTasks: [
          'Submit a leave request',
          'Approve or decline pending requests',
          'Switch view (leave / annual / timeline / coverage)',
          'Apply filters',
        ],
      },
      'workspace.approvals': {
        title: 'Approvals',
        summary:
          'The approval inbox lists every leave, onboarding, and access request awaiting your decision. Decisions are logged in the immutable audit trail.',
      },
      'settings.localization': {
        title: 'Localization',
        summary:
          'Effectime supports English and Hungarian. The user-selected language is persisted on the profile and used by the interface and outgoing emails. Future languages can be added without code changes.',
        commonTasks: [
          'Switch the active language from the header flag',
          'Set the workspace default language (admins)',
          'Review missing-key counts',
        ],
      },
    } as Record<
      string,
      {
        title: string;
        summary: string;
        commonTasks?: string[];
        keyboardShortcuts?: { combo: string; description: string }[];
      }
    >,
  },
  organization: {
    title: 'Organization',
    subtitle: 'Hierarchy, leadership, contracts, and the auto-generated org chart.',
    tabs: {
      structure: 'Structure',
      leadership: 'Leadership',
      contracts: 'Contracts',
      industry: 'Industry',
      categories: 'Work categories',
      job_families: 'Job families',
      chart: 'Org chart',
    },
    structure: {
      title: 'Organizational structure',
      description:
        'Define the hierarchy of organizational units (divisions, departments, teams). The org chart is generated from manager relationships and these units.',
      add_unit: 'Add unit',
      unit_name: 'Unit name',
      parent_unit: 'Parent unit',
      no_parent: '(top-level)',
      empty: 'No units yet. Add your first organizational unit.',
    },
    leadership: {
      title: 'Leadership levels',
      description:
        'Define the leadership categories used in your organization (strategic, operational, technical, execution). Members are assigned a level on their profile.',
      add_level: 'Add level',
      level_label: 'Label',
      level_code: 'Code',
      sort_order: 'Order',
    },
    contracts: {
      title: 'Contractual relationships',
      description:
        'Define contract types used at member onboarding (employee, contractor, subcontractor, leased, consultant, temporary, custom).',
      add_type: 'Add contract type',
      seeded: 'Seeded defaults',
    },
    industry: {
      title: 'Industry classification',
      description: 'Choose the industry / activity area that best describes this workspace.',
      add: 'Add industry entry',
    },
    categories: {
      title: 'Work categories',
      description: 'Controlled vocabulary used to classify positions, projects, and onboarding templates.',
      add: 'Add category',
    },
    job_families: {
      title: 'Job families',
      description: 'Group related positions for analytics and onboarding template inheritance.',
      add: 'Add family',
    },
    chart: {
      title: 'Org chart',
      description:
        'Auto-generated from manager relationships within this workspace. Use the search to focus on a sub-tree.',
      regenerate: 'Regenerate snapshot',
      no_manager: 'No manager',
      members: 'members',
      no_data: 'No member data yet. Invite members to see the chart.',
    },
  },
  positions: {
    catalog_title: 'Predefined position catalog',
    catalog_description:
      'Pick from the predefined catalog or keep typing a custom label. Selecting a catalog position attaches recommended skill expectations.',
    custom_path: 'Use custom label',
    catalog_path: 'Pick from catalog',
    pick_category: 'Choose a category',
    pick_role: 'Choose a position',
    review_skills: 'Review recommended skills',
    seniority: 'Seniority',
    seniority_levels: {
      junior: 'Junior',
      medior: 'Medior',
      senior: 'Senior',
      lead: 'Lead',
      principal: 'Principal',
    },
    apply: 'Apply selection',
    inherited: 'Inherited',
    manual: 'Manual',
  },
  member: {
    org_unit: 'Organizational unit',
    manager: 'Direct manager',
    leadership_level: 'Leadership level',
    leadership_category: 'Leadership category',
    contract_type: 'Contract type',
    employer_rights: 'Employer rights',
    completion_banner_title: 'Organization metadata incomplete',
    completion_banner_body:
      'This member is missing one or more of the new required fields (manager, organizational unit, contract type, leadership level). Existing data is preserved; please complete the profile when you have time.',
    leadership_categories: {
      strategic: 'Strategic',
      operational: 'Operational',
      technical: 'Technical',
      execution: 'Execution',
      none: 'Not applicable',
    },
  },
  settings: {
    localization: {
      title: 'Localization',
      description:
        'Effectime currently supports English and Hungarian. Each user can override the workspace default from the header flag.',
      languages: 'Languages',
      enabled: 'Enabled',
      default: 'Default',
      missing_keys: 'Missing keys',
      none_missing: 'No missing keys.',
      missing_count: '{{count}} missing keys',
      workspace_default: 'Workspace default',
      configure_default: 'Workspace default is configurable in a future release.',
    },
  },
} as const;

export default en;
export type EnglishBundle = typeof en;
