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
    generated_label: 'Generated',
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
        commonTasks: [
          'Review and approve a pending leave request',
          'Bulk-approve multiple requests at once',
          'Reject a request with a reason',
          'View the decision history',
        ],
      },
      'workspace.requests': {
        title: 'Requests',
        summary:
          'Submit and track your own leave requests. View the status of pending, approved, and rejected requests, add substitutes, and attach supporting documents.',
        commonTasks: [
          'Submit a new leave request',
          'Add a substitute to cover your absence',
          'Cancel a pending request',
          'Download an iCal feed of approved leave',
        ],
      },
      'capacity-dna': {
        title: 'Capacity DNA',
        summary:
          'Capacity DNA gives a daily snapshot of how many people are truly available versus committed or on leave. Use it to spot overload and shortage trends before they affect delivery.',
        commonTasks: [
          'Generate a snapshot for today',
          'View the 30-day shortage and overload trend',
          'Compare baseline vs. effective capacity',
        ],
      },
      'command-center': {
        title: 'Command Center',
        summary:
          'The Command Center widget at the top of the workspace shows live counters for pending approvals, in-progress onboarding, open access requests, and members with missing org metadata.',
        commonTasks: [
          'Click a counter to navigate to the relevant section',
          'Activate or deactivate Recovery Mode',
          'Monitor workspace health at a glance',
        ],
      },
      'decision-memory': {
        title: 'Decision Memory',
        summary:
          'Decision Memory lets you attach rationale and expected outcomes to any approval or policy decision. After a defined window you can capture observed outcomes — closing the learning loop.',
        commonTasks: [
          'Attach a rationale to a decision',
          'Record the observed outcome after the fact',
          'Review stale memos in the Decision Memory inbox',
        ],
      },
      'coverage-planner': {
        title: 'Coverage Planner',
        summary:
          'The Coverage Planner shows whether each site meets its daily staffing rules. It compares required headcount (from coverage rules) against actual presence and flags shortfalls in red.',
        commonTasks: [
          'Switch between weekly and monthly view',
          'Identify dates where coverage falls below the rule',
          'Navigate to the site rule configuration',
        ],
      },
      'org-chart': {
        title: 'Org Chart',
        summary:
          'The Org Chart visualises the manager hierarchy across your workspace. It is auto-generated from the manager relationships on each member profile. Admins can regenerate a snapshot at any time.',
        commonTasks: [
          'View the reporting hierarchy',
          'Search for a specific person',
          'Regenerate the snapshot to reflect recent changes',
        ],
      },
      'audit-log': {
        title: 'Audit Log',
        summary:
          'The immutable audit log records every significant action in the workspace — approvals, role changes, invitations, and config updates. It cannot be edited or deleted.',
        commonTasks: [
          'Filter events by actor or event type',
          'Export the audit log to CSV',
          'Verify when a specific decision was made',
        ],
      },
      'quota-manager': {
        title: 'Quota Manager',
        summary:
          'Quota Manager lets admins define and adjust annual leave allowances per member. It tracks used, remaining, and carried-over days for each leave type.',
        commonTasks: [
          'Set or adjust a member\'s annual allowance',
          'View used vs. remaining days',
          'Carry over unused days to the next year',
        ],
      },
      'holiday-manager': {
        title: 'Holiday Manager',
        summary:
          'Holiday Manager defines public holidays and blocked dates for the workspace. Leave requests that overlap a public holiday are flagged during submission.',
        commonTasks: [
          'Add a public holiday',
          'Block a date for the whole workspace',
          'Import holidays from an external source',
        ],
      },
      'localization-settings': {
        title: 'Localization Settings',
        summary:
          'Admins can export the full translation CSV, edit entries offline, and re-import to apply custom wording without code changes. Live key counters show any gaps.',
        commonTasks: [
          'Export the bilingual translation CSV',
          'Import a corrected translation file',
          'Review missing-key counts per locale',
          'Set the workspace default language',
        ],
      },
      'integration-health': {
        title: 'Integration Health Center',
        summary:
          'Integration Health shows the status of each connected external system (Jira, Azure DevOps, etc.). It summarises recent sync logs and surfaces error excerpts inline.',
        commonTasks: [
          'Check the health badge of a connected integration',
          'View the last three error excerpts',
          'Trigger a manual sync',
        ],
      },
      'role-permissions': {
        title: 'Role Permissions',
        summary:
          'Role Permissions let admins control which features each role (Owner, Resource Assistant, Member) can view or edit. The permission tree mirrors the application navigation hierarchy.',
        commonTasks: [
          'Grant or restrict view access to a feature',
          'Grant or restrict edit access to a feature',
          'Reset permissions to workspace defaults',
        ],
      },
      'access-request': {
        title: 'Access Requests',
        summary:
          'Access Requests manage who gets provisioned to external systems (Jira, Confluence, ERP, etc.) as part of onboarding or role changes. Requests flow through the existing approval chain.',
        commonTasks: [
          'Submit an access request for a member',
          'Approve or reject a pending access request',
          'Mark an approved request as granted',
        ],
      },
      'workspace.workflows': {
        title: 'Workflows',
        summary:
          'Onboarding playbooks and external access requests live here. Templates are versioned; instances track per-member progress; access requests flow through the existing approval engine.',
        commonTasks: [
          'Create or publish an onboarding template',
          'Start onboarding for a new member',
          'Add external access systems',
          'Approve or reject pending access requests',
        ],
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
      'workspace.resources': {
        title: 'Resources',
        summary:
          'The Resources tab gives you a full picture of team capacity, project timelines, agile integration, and skill availability. Use it to plan workload and identify gaps before they become problems.',
        commonTasks: [
          'View capacity heatmap across the team',
          'Add or edit projects and milestones',
          'Connect Jira or Azure DevOps for agile syncing',
          'Generate a capacity DNA snapshot',
          'Review skill coverage and shortfalls',
        ],
      },
      'workspace.reports': {
        title: 'Reports & Audit',
        summary:
          'The Reports tab provides KPI dashboards, leave trend charts, and an immutable audit log. Use it to track team health, export data for payroll or compliance, and investigate activity history.',
        commonTasks: [
          'View KPI summary cards',
          'Filter the audit log by actor or event type',
          'Export leave data to CSV',
          'Schedule a recurring report delivery',
          'Pin a report widget to the dashboard',
        ],
      },
      'workspace.settings': {
        title: 'Settings',
        summary:
          'Workspace settings let you configure branding, localization, iCal feeds, calendar filter order, role permissions, and integration connections. Only owners and resource assistants can change most settings.',
        commonTasks: [
          'Update workspace name and branding',
          'Configure leave types, holidays, and blocked dates',
          'Manage daily coverage rules',
          'Set up Jira or Azure DevOps integration',
          'Export or import translation overrides',
          'Configure role permissions',
          'Activate or deactivate recovery mode',
        ],
      },
      'workspace.agile': {
        title: 'Agile (Jira / Azure DevOps)',
        summary:
          'The Agile panel connects your Jira or Azure DevOps projects to Effectime. Browse the backlog, check sprint capacity against leave, create or update issues, and run what-if simulations.',
        commonTasks: [
          'Search issues using JQL or WIQL',
          'View sprint capacity vs. leave overlap',
          'Create or update a Jira or ADO issue',
          'Run a what-if simulation for leave impact',
          'Switch between Kanban, Scrum, and Gantt views',
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
      view_premium: 'Premium',
      view_tree: 'Diagram',
      view_list: 'List',
      drawer: {
        org_unit: 'Org unit',
        team: 'Team',
        role: 'Role',
        manager: 'Manager',
        direct_reports: 'Direct reports',
        location: 'Location',
        skills: 'Skills',
        joined: 'Joined',
        direct_reports_list: 'Direct reports list',
        more: 'more',
        none: 'None',
        skill_count: '{{count}} registered skills',
        reports_summary: '{{direct}} members ({{total}} total)',
      },
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
      export_csv: 'Export CSV',
      import_csv: 'Import CSV',
      import_help:
        'Upload a CSV with columns: key, en, hu. Existing keys are updated only inside this session — the file format is the canonical exchange unit for translators.',
      import_summary: '{{added}} new · {{updated}} updated · {{skipped}} skipped',
      persisted: 'Translation overrides persisted to the workspace.',
    },
    recovery: {
      title: 'Recovery Mode',
      description:
        'Activate when operational thresholds are breached. Recovery mode surfaces guided actions and prioritizes the workforce command center.',
      activate: 'Activate Recovery Mode',
      deactivate: 'Deactivate Recovery Mode',
      reason: 'Activation reason',
      active_since: 'Active since',
      reason_placeholder: 'e.g. critical coverage gap in Engineering for next week',
    },
  },
  workflows: {
    title: 'Workflows',
    subtitle: 'Onboarding playbooks and external access requests.',
    tabs: {
      onboarding_templates: 'Onboarding templates',
      onboarding_inbox: 'Onboarding inbox',
      access_systems: 'Access systems',
      access_templates: 'Access templates',
      access_inbox: 'Access inbox',
    },
  },
  onboarding: {
    template_name: 'Template name',
    add_template: 'Add template',
    publish: 'Publish',
    draft: 'Draft',
    published: 'Published',
    archived: 'Archived',
    add_step: 'Add step',
    step_title: 'Step title',
    step_type: 'Type',
    owner_role: 'Owner role',
    due_offset: 'Due offset (days)',
    mandatory: 'Mandatory',
    escalate_after: 'Escalate after (days)',
    instances_title: 'Onboarding instances',
    no_instances: 'No active onboarding instances.',
    start_for_member: 'Start onboarding for a member',
    member: 'Member',
    template: 'Template',
    progress: 'Progress',
    types: {
      task: 'Task',
      read: 'Read',
      acknowledge: 'Acknowledge',
      training: 'Training',
      exam: 'Exam',
      approval: 'Approval',
      internal_permission: 'Internal permission',
      external_access: 'External access',
    },
  },
  access: {
    systems_title: 'Access systems',
    systems_description:
      'External and internal systems whose access is governed by Effectime templates and approvals.',
    add_system: 'Add system',
    seed_systems: 'Seed defaults (Jira / Confluence / Outlook / etc.)',
    kind_internal: 'Internal',
    kind_external: 'External',
    templates_title: 'Access templates',
    templates_description:
      'Per-position bundles of systems whose access is required or optional. Used during onboarding and ad-hoc requests.',
    add_template: 'Add template',
    requests_title: 'Access request inbox',
    requests_description:
      'Pending and historical access requests across the workspace. Decisions create immutable records in `enterprise_access_decisions`.',
    request: 'Request access',
    submit_for_member: 'Submit on behalf of a member',
    member: 'Member',
    system: 'System',
    reason: 'Reason',
    statuses: {
      pending: 'Pending',
      approved: 'Approved',
      provisioning: 'Provisioning',
      granted: 'Granted',
      rejected: 'Rejected',
      revoked: 'Revoked',
      cancelled: 'Cancelled',
    },
    actions: {
      approve: 'Approve',
      reject: 'Reject',
      revoke: 'Revoke',
      cancel: 'Cancel',
      mark_granted: 'Mark granted',
    },
    no_requests: 'No access requests yet.',
  },
  command: {
    title: 'Command Center',
    subtitle: 'Action queue across the workspace.',
    pending_approvals: 'Pending approvals',
    pending_onboarding: 'Pending onboarding',
    pending_access: 'Pending access',
    organization_completion: 'Members with incomplete org metadata',
    recovery_active: 'Recovery Mode is ACTIVE',
    recovery_inactive: 'Operations nominal',
    open: 'Open',
  },
  decision: {
    memory_title: 'Decision memory',
    rationale: 'Rationale',
    expected: 'Expected outcome',
    observed: 'Observed outcome',
    save: 'Save memo',
    saved: 'Memo saved',
    placeholder_rationale: 'Why is this decision being made?',
    placeholder_expected: 'What outcome do we expect?',
    placeholder_observed: 'What actually happened? (fill in later)',
    stale_inbox_title: 'Observed outcome — pending capture',
    stale_inbox_description:
      'Decisions whose observation window has elapsed. Capture the observed outcome to close the learning loop.',
    no_stale: 'No decisions waiting for observation.',
    days_overdue: '{{count}} days overdue',
    capture_observed: 'Capture observed outcome',
  },
  pulse: {
    title: 'Org Pulse',
    subtitle: 'Privacy-safe operational signals (k ≥ 5).',
    suppressed: 'Hidden — fewer than 5 records',
    active_members: 'Active members',
    employer_rights: 'Employer-rights holders',
    missing_org_unit: 'Missing org unit',
    missing_manager: 'Missing manager',
    missing_contract: 'Missing contract',
    missing_leadership: 'Missing leadership level',
    open_approvals_long: 'Approvals open > 48h',
    weekly_leave: 'Approved leave (last 7 days)',
  },
  capacity: {
    title: 'Capacity DNA',
    subtitle:
      'Daily snapshots of baseline / available / shortage / overload signals. Foundation for the predictive forecaster.',
    generate: 'Generate snapshot for today',
    generated: 'Snapshot saved',
    snapshot_date: 'Date',
    baseline_fte: 'Baseline FTE',
    effective_fte: 'Effective FTE',
    available_fte: 'Available FTE',
    shortage_score: 'Shortage',
    overload_score: 'Overload',
    no_snapshots: 'No snapshots yet. Run generation to seed one.',
    note:
      'Rule-based v1: baseline = active members; effective = baseline minus approved leave overlapping the date; shortage_score = max(0, committed − effective) / baseline.',
  },
  integration_health: {
    title: 'Integration Health Center',
    subtitle:
      'Last sync status per integration with error excerpts from the agile sync log.',
    healthy: 'Healthy',
    degraded: 'Degraded',
    failed: 'Failed',
    no_integrations: 'No integrations configured.',
    no_sync_log: 'No sync activity recorded for this integration.',
    last_sync: 'Last sync',
    success: 'Success',
    error: 'Error',
  },
  attendance: {
    display_config: 'Displayed data',
    show_work_hours: 'Work hours',
    show_overtime: 'Overtime',
    show_site: 'Site',
    site_picker_label: 'Site (this day)',
    no_site: 'No site assigned',
    site_saved: 'Site saved',
    site_removed: 'Site removed',
    select_site_placeholder: 'Select site…',
  },
  help_settings: {
    title: 'AI Help Content',
    ai_toggle_label: 'AI content regeneration',
    ai_toggle_description:
      'When enabled, the help system can regenerate articles automatically on new releases.',
    regenerate_now: 'Regenerate now',
    regenerating: 'Regenerating…',
    regenerate_description:
      'Triggers an immediate AI regeneration of all help articles from the latest codebase.',
    last_regenerated: 'Last regenerated:',
    regen_success: 'Done — {{count}} articles updated.',
    regen_error: 'Regeneration failed',
  },
} as const;

export default en;
export type EnglishBundle = typeof en;
