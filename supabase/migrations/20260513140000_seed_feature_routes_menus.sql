-- Migration: populate features.route_path and features.menu_path for all 135 features.
--
-- The v3.13 migration added these columns but never seeded them, so the
-- FeatureTiersTab routing audit shows "Hiányzó route_path 135" /
-- "Hiányzó menu_path 135" for every feature. This populates them with the
-- conceptual route + menu breadcrumb that matches the actual app shell.
--
-- Conventions:
--   route_path uses /app/<top-tab>[/<sub-tab>] for in-workspace features,
--                   /superadmin/* for platform admin features,
--                   /auth, /profile, /unsubscribe for pre-workspace features.
--   menu_path is a Hungarian breadcrumb array (workspace primary language).
--
-- Idempotent via the WHERE feature_key = clause; safe to re-run.

-- ── AUTH ─────────────────────────────────────────────────────────────────────
UPDATE public.features SET route_path = '/auth',         menu_path = ARRAY['Bejelentkezés','E-mail regisztráció']     WHERE feature_key = 'auth_email_signup';
UPDATE public.features SET route_path = '/auth',         menu_path = ARRAY['Bejelentkezés','E-mail bejelentkezés']    WHERE feature_key = 'auth_email_login';
UPDATE public.features SET route_path = '/auth',         menu_path = ARRAY['Bejelentkezés','Google OAuth']            WHERE feature_key = 'auth_google_oauth';
UPDATE public.features SET route_path = '/auth',         menu_path = ARRAY['Bejelentkezés','Magic link']              WHERE feature_key = 'auth_magic_link';
UPDATE public.features SET route_path = '/reset-password', menu_path = ARRAY['Bejelentkezés','Jelszó-visszaállítás']    WHERE feature_key = 'auth_password_reset';
UPDATE public.features SET route_path = '/profile',      menu_path = ARRAY['Profil','Szerkesztés']                    WHERE feature_key = 'profile_edit';
UPDATE public.features SET route_path = '/profile',      menu_path = ARRAY['Profil','Fiók törlése']                   WHERE feature_key = 'account_delete';
UPDATE public.features SET route_path = '/unsubscribe',  menu_path = ARRAY['Profil','Leiratkozás']                    WHERE feature_key = 'email_unsubscribe';

-- ── WORKSPACE ────────────────────────────────────────────────────────────────
UPDATE public.features SET route_path = '/app',                       menu_path = ARRAY['Munkaterületek','Új munkaterület']     WHERE feature_key = 'workspace_create';
UPDATE public.features SET route_path = '/app',                       menu_path = ARRAY['Munkaterületek','Váltás']              WHERE feature_key = 'workspace_select';
UPDATE public.features SET route_path = '/app',                       menu_path = ARRAY['Munkaterületek','Archiválás']          WHERE feature_key = 'workspace_archive';
UPDATE public.features SET route_path = '/app',                       menu_path = ARRAY['Munkaterületek','Törlés']              WHERE feature_key = 'workspace_delete';
UPDATE public.features SET route_path = '/app',                       menu_path = ARRAY['Munkaterületek','Demo workspace']      WHERE feature_key = 'demo_workspace_seed';
UPDATE public.features SET route_path = '/app/settings/general/regional', menu_path = ARRAY['Beállítások','Általános','Régió & időzóna'] WHERE feature_key = 'workspace_general_settings';
UPDATE public.features SET route_path = '/superadmin/workspaces',     menu_path = ARRAY['Superadmin','Munkaterületek','Helyreállítás'] WHERE feature_key = 'recovery_mode';

-- ── MEMBERS ──────────────────────────────────────────────────────────────────
UPDATE public.features SET route_path = '/app/members',               menu_path = ARRAY['Tagok','Listázás']           WHERE feature_key = 'members_list';
UPDATE public.features SET route_path = '/app/members',               menu_path = ARRAY['Tagok','Meghívás']           WHERE feature_key = 'members_invite';
UPDATE public.features SET route_path = '/app/members',               menu_path = ARRAY['Tagok','Meghívó elfogadása'] WHERE feature_key = 'invitation_accept';
UPDATE public.features SET route_path = '/app/members',               menu_path = ARRAY['Tagok','Szerkesztés']        WHERE feature_key = 'member_edit';
UPDATE public.features SET route_path = '/app/members',               menu_path = ARRAY['Tagok','Szerepkör']          WHERE feature_key = 'member_role_change';
UPDATE public.features SET route_path = '/app/members',               menu_path = ARRAY['Tagok','Deaktiválás']        WHERE feature_key = 'member_deactivate';
UPDATE public.features SET route_path = '/app/members',               menu_path = ARRAY['Tagok','Azonnali létrehozás'] WHERE feature_key = 'instant_member_create';
UPDATE public.features SET route_path = '/app/organization/offices',  menu_path = ARRAY['Szervezet','Telephelyek']    WHERE feature_key = 'offices';
UPDATE public.features SET route_path = '/app/organization/teams',    menu_path = ARRAY['Szervezet','Csapatok']       WHERE feature_key = 'teams';

-- ── ORG ──────────────────────────────────────────────────────────────────────
UPDATE public.features SET route_path = '/app/organization/structure',    menu_path = ARRAY['Szervezet','Struktúra']               WHERE feature_key = 'org_structure';
UPDATE public.features SET route_path = '/app/organization/chart',        menu_path = ARRAY['Szervezet','Org chart']               WHERE feature_key = 'org_chart';
UPDATE public.features SET route_path = '/app/organization/chart',        menu_path = ARRAY['Szervezet','Org chart','Pan/zoom']    WHERE feature_key = 'org_chart_panzoom';
UPDATE public.features SET route_path = '/app/organization/chart',        menu_path = ARRAY['Szervezet','Org chart','Fullscreen']  WHERE feature_key = 'org_chart_fullscreen';
UPDATE public.features SET route_path = '/app/organization/chart',        menu_path = ARRAY['Szervezet','Org chart','Snapshot']    WHERE feature_key = 'org_chart_snapshot';
UPDATE public.features SET route_path = '/app/organization/leadership',   menu_path = ARRAY['Szervezet','Vezetési szintek']        WHERE feature_key = 'leadership_levels';
UPDATE public.features SET route_path = '/app/organization/job-families', menu_path = ARRAY['Szervezet','Állásfamilák']            WHERE feature_key = 'job_families';
UPDATE public.features SET route_path = '/app/organization/contracts',    menu_path = ARRAY['Szervezet','Szerződéstípusok']        WHERE feature_key = 'contract_types';
UPDATE public.features SET route_path = '/app/organization/industries',   menu_path = ARRAY['Szervezet','Iparágak']                WHERE feature_key = 'industries';
UPDATE public.features SET route_path = '/app/organization/categories',   menu_path = ARRAY['Szervezet','Munkakategóriák']         WHERE feature_key = 'work_categories';

-- ── CALENDAR ─────────────────────────────────────────────────────────────────
UPDATE public.features SET route_path = '/app/calendar',                  menu_path = ARRAY['Naptár','Havi nézet']        WHERE feature_key = 'calendar_monthly';
UPDATE public.features SET route_path = '/app/calendar',                  menu_path = ARRAY['Naptár','Éves nézet']        WHERE feature_key = 'annual_view';
UPDATE public.features SET route_path = '/app/calendar',                  menu_path = ARRAY['Naptár','Éves trend']        WHERE feature_key = 'annual_trend';
UPDATE public.features SET route_path = '/app/calendar/timeline',         menu_path = ARRAY['Naptár','Idővonal']          WHERE feature_key = 'timeline_view';
UPDATE public.features SET route_path = '/app/calendar/coverage',         menu_path = ARRAY['Naptár','Kapacitástervező']  WHERE feature_key = 'coverage_planner';
UPDATE public.features SET route_path = '/app/calendar',                  menu_path = ARRAY['Naptár','Szülinapok']        WHERE feature_key = 'birthday_widget';
UPDATE public.features SET route_path = '/app/calendar',                  menu_path = ARRAY['Naptár','Szűrők']            WHERE feature_key = 'calendar_filters';
UPDATE public.features SET route_path = '/app/calendar/sync',             menu_path = ARRAY['Naptár','Szinkron','iCal feed']               WHERE feature_key = 'ical_feed';
UPDATE public.features SET route_path = '/app/calendar/sync',             menu_path = ARRAY['Naptár','Szinkron','Microsoft 365']           WHERE feature_key = 'ms365_calendar_sync';
UPDATE public.features SET route_path = '/app/calendar/sync',             menu_path = ARRAY['Naptár','Szinkron','Google Workspace']        WHERE feature_key = 'google_calendar_sync';
UPDATE public.features SET route_path = '/app/calendar/reports',          menu_path = ARRAY['Naptár','Készség-kapacitás']                   WHERE feature_key = 'skill_capacity_report';

-- ── LEAVE / REQUESTS ─────────────────────────────────────────────────────────
UPDATE public.features SET route_path = '/app/requests',           menu_path = ARRAY['Kérelmek','Saját kérelmek']           WHERE feature_key = 'leave_my_view';
UPDATE public.features SET route_path = '/app/requests/new',       menu_path = ARRAY['Kérelmek','Új szabadságkérelem']      WHERE feature_key = 'leave_submit';
UPDATE public.features SET route_path = '/app/requests/new',       menu_path = ARRAY['Kérelmek','Új','Félnapos']            WHERE feature_key = 'leave_half_day';
UPDATE public.features SET route_path = '/app/requests/new',       menu_path = ARRAY['Kérelmek','Új','Privát']              WHERE feature_key = 'leave_private';
UPDATE public.features SET route_path = '/app/requests/new',       menu_path = ARRAY['Kérelmek','Új','Ütközésellenőrzés']   WHERE feature_key = 'leave_conflict_check';
UPDATE public.features SET route_path = '/app/requests',           menu_path = ARRAY['Kérelmek','Visszavonás']              WHERE feature_key = 'leave_cancel';
UPDATE public.features SET route_path = '/app/requests/team',      menu_path = ARRAY['Kérelmek','Csapat kérelmek']          WHERE feature_key = 'leave_team_view';
UPDATE public.features SET route_path = '/app/requests/quota',     menu_path = ARRAY['Kérelmek','Kvóta egyenleg']           WHERE feature_key = 'leave_quota_balance';
UPDATE public.features SET route_path = '/app/settings/quota',     menu_path = ARRAY['Beállítások','Kvóta admin']           WHERE feature_key = 'leave_quotas';
UPDATE public.features SET route_path = '/app/requests/team',      menu_path = ARRAY['Kérelmek','Helyettesítés inbox']      WHERE feature_key = 'substitute_inbox';
UPDATE public.features SET route_path = '/app/settings/allowances', menu_path = ARRAY['Beállítások','Juttatások']           WHERE feature_key = 'allowances';

-- ── APPROVALS ────────────────────────────────────────────────────────────────
UPDATE public.features SET route_path = '/app/requests/approvals', menu_path = ARRAY['Kérelmek','Jóváhagyások','Inbox']         WHERE feature_key = 'approval_inbox';
UPDATE public.features SET route_path = '/app/requests/approvals', menu_path = ARRAY['Kérelmek','Jóváhagyások','Egyenkénti']    WHERE feature_key = 'approval_individual';
UPDATE public.features SET route_path = '/app/requests/approvals', menu_path = ARRAY['Kérelmek','Jóváhagyások','Tömeges']       WHERE feature_key = 'approval_bulk';
UPDATE public.features SET route_path = '/app/requests/approvals', menu_path = ARRAY['Kérelmek','Jóváhagyások','Admin felülbírálat'] WHERE feature_key = 'admin_override';
UPDATE public.features SET route_path = '/app/settings/approval-chains', menu_path = ARRAY['Beállítások','Jóváhagyási lánc']    WHERE feature_key = 'approval_chain';
UPDATE public.features SET route_path = '/app/settings/approval-chains', menu_path = ARRAY['Beállítások','Eszkaláció']          WHERE feature_key = 'escalation';
UPDATE public.features SET route_path = '/app/requests/approvals', menu_path = ARRAY['Kérelmek','Jóváhagyások','Döntésmemória'] WHERE feature_key = 'decision_memory';

-- ── ATTENDANCE ───────────────────────────────────────────────────────────────
UPDATE public.features SET route_path = '/app/time-attendance',         menu_path = ARRAY['Munkaóra','Napló']               WHERE feature_key = 'attendance_log';
UPDATE public.features SET route_path = '/app/time-attendance/periods', menu_path = ARRAY['Munkaóra','Időszakok']           WHERE feature_key = 'attendance_periods';
UPDATE public.features SET route_path = '/app/time-attendance',         menu_path = ARRAY['Munkaóra','Edit mode']           WHERE feature_key = 'attendance_edit_mode';
UPDATE public.features SET route_path = '/app/time-attendance/oncall',  menu_path = ARRAY['Munkaóra','On-call']             WHERE feature_key = 'attendance_oncall';
UPDATE public.features SET route_path = '/app/time-attendance/audit',   menu_path = ARRAY['Munkaóra','Audit']               WHERE feature_key = 'attendance_audit';
UPDATE public.features SET route_path = '/app/time-attendance/sites',   menu_path = ARRAY['Munkaóra','Telephely beosztás']  WHERE feature_key = 'site_assignment';
UPDATE public.features SET route_path = '/app/time-attendance/payroll', menu_path = ARRAY['Munkaóra','Bérszámfejtés export'] WHERE feature_key = 'payroll_export';

-- ── RULES ────────────────────────────────────────────────────────────────────
UPDATE public.features SET route_path = '/app/settings/leave-types',    menu_path = ARRAY['Beállítások','Szabadságtípusok']          WHERE feature_key = 'leave_types';
UPDATE public.features SET route_path = '/app/settings/holidays',       menu_path = ARRAY['Beállítások','Ünnepnapok']                WHERE feature_key = 'holidays';
UPDATE public.features SET route_path = '/app/settings/holidays',       menu_path = ARRAY['Beállítások','Ünnepnap szinkron']         WHERE feature_key = 'holiday_sync';
UPDATE public.features SET route_path = '/app/settings/holidays',       menu_path = ARRAY['Beállítások','Cég-szintű napok']          WHERE feature_key = 'company_days';
UPDATE public.features SET route_path = '/app/settings/rules',          menu_path = ARRAY['Beállítások','Szabályok','Tiltott napok']  WHERE feature_key = 'leave_blocked_dates';
UPDATE public.features SET route_path = '/app/settings/rules',          menu_path = ARRAY['Beállítások','Szabályok','Napi szabályok'] WHERE feature_key = 'leave_daily_rules';
UPDATE public.features SET route_path = '/app/settings/rules',          menu_path = ARRAY['Beállítások','Szabályok','Telephelyi lefedettség'] WHERE feature_key = 'office_coverage_rules';
UPDATE public.features SET route_path = '/app/settings/rules',          menu_path = ARRAY['Beállítások','Szabályok','Sablonok']      WHERE feature_key = 'rule_templates';

-- ── RESOURCES ────────────────────────────────────────────────────────────────
UPDATE public.features SET route_path = '/app/resources',                menu_path = ARRAY['Erőforrások','Áttekintő']             WHERE feature_key = 'resource_dashboard';
UPDATE public.features SET route_path = '/app/resources/utilization',    menu_path = ARRAY['Erőforrások','Kihasználtság']        WHERE feature_key = 'utilization_heatmap';
UPDATE public.features SET route_path = '/app/resources/projects',       menu_path = ARRAY['Erőforrások','Projektek']            WHERE feature_key = 'projects';
UPDATE public.features SET route_path = '/app/resources/projects',       menu_path = ARRAY['Erőforrások','Projektek','Szerkesztő'] WHERE feature_key = 'project_editor';
UPDATE public.features SET route_path = '/app/resources/projects/gantt', menu_path = ARRAY['Erőforrások','Projektek','Gantt']    WHERE feature_key = 'gantt_timeline';
UPDATE public.features SET route_path = '/app/resources/skills',         menu_path = ARRAY['Erőforrások','Készségek']            WHERE feature_key = 'skills_mgmt';
UPDATE public.features SET route_path = '/app/resources/capacity',       menu_path = ARRAY['Erőforrások','Kapacitás','Hiány-riport'] WHERE feature_key = 'capacity_gap';
UPDATE public.features SET route_path = '/app/resources/capacity',       menu_path = ARRAY['Erőforrások','Kapacitás','DNA']      WHERE feature_key = 'capacity_dna';
UPDATE public.features SET route_path = '/app/resources/scenarios',      menu_path = ARRAY['Erőforrások','Forgatókönyvek']       WHERE feature_key = 'scenario_planner';
UPDATE public.features SET route_path = '/app/resources/financials',     menu_path = ARRAY['Erőforrások','Pénzügy']              WHERE feature_key = 'financials';
UPDATE public.features SET route_path = '/app/resources/roles',          menu_path = ARRAY['Erőforrások','Munkakörök']           WHERE feature_key = 'business_roles';

-- ── AGILE ────────────────────────────────────────────────────────────────────
UPDATE public.features SET route_path = '/app/resources/agile',          menu_path = ARRAY['Erőforrások','Agile','Panel']        WHERE feature_key = 'agile_panel';
UPDATE public.features SET route_path = '/app/resources/agile/kanban',   menu_path = ARRAY['Erőforrások','Agile','Kanban']       WHERE feature_key = 'kanban';
UPDATE public.features SET route_path = '/app/resources/agile/scrum',    menu_path = ARRAY['Erőforrások','Agile','Scrum']        WHERE feature_key = 'scrum';
UPDATE public.features SET route_path = '/app/resources/agile/gantt',    menu_path = ARRAY['Erőforrások','Agile','Gantt']        WHERE feature_key = 'agile_gantt';
UPDATE public.features SET route_path = '/app/resources/agile/backlog',  menu_path = ARRAY['Erőforrások','Agile','Backlog']      WHERE feature_key = 'backlog_browser';
UPDATE public.features SET route_path = '/app/resources/agile/issues',   menu_path = ARRAY['Erőforrások','Agile','Issue szerkesztő'] WHERE feature_key = 'jira_issue_editor';
UPDATE public.features SET route_path = '/app/resources/agile',          menu_path = ARRAY['Erőforrások','Agile','Capacity fit'] WHERE feature_key = 'capacity_fit';
UPDATE public.features SET route_path = '/app/settings/integrations',    menu_path = ARRAY['Beállítások','Integrációk','Jira']   WHERE feature_key = 'jira_integration';
UPDATE public.features SET route_path = '/app/settings/integrations',    menu_path = ARRAY['Beállítások','Integrációk','Azure DevOps'] WHERE feature_key = 'azure_devops';
UPDATE public.features SET route_path = '/app/settings/integrations',    menu_path = ARRAY['Beállítások','Integrációk','Issue writeback'] WHERE feature_key = 'issue_writeback';

-- ── WORKFLOWS ────────────────────────────────────────────────────────────────
UPDATE public.features SET route_path = '/app/workflows/access',      menu_path = ARRAY['Workflow','Hozzáférés','Inbox']      WHERE feature_key = 'access_inbox';
UPDATE public.features SET route_path = '/app/workflows/access',      menu_path = ARRAY['Workflow','Hozzáférés','Rendszerek'] WHERE feature_key = 'access_systems';
UPDATE public.features SET route_path = '/app/workflows/access',      menu_path = ARRAY['Workflow','Hozzáférés','Sablonok']   WHERE feature_key = 'access_templates';
UPDATE public.features SET route_path = '/app/workflows/onboarding',  menu_path = ARRAY['Workflow','Onboarding','Inbox']      WHERE feature_key = 'onboarding_inbox';
UPDATE public.features SET route_path = '/app/workflows/onboarding',  menu_path = ARRAY['Workflow','Onboarding','Sablonok']   WHERE feature_key = 'onboarding_template';

-- ── REPORTS ──────────────────────────────────────────────────────────────────
UPDATE public.features SET route_path = '/app/reports',           menu_path = ARRAY['Riportok','Futtatás']         WHERE feature_key = 'run_report';
UPDATE public.features SET route_path = '/app/reports/export',    menu_path = ARRAY['Riportok','Export']           WHERE feature_key = 'export_center';
UPDATE public.features SET route_path = '/app/reports/scheduled', menu_path = ARRAY['Riportok','Ütemezett']        WHERE feature_key = 'scheduled_reports';
UPDATE public.features SET route_path = '/app/reports/audit',     menu_path = ARRAY['Riportok','Audit napló']      WHERE feature_key = 'audit_log';
UPDATE public.features SET route_path = '/app/analytics',         menu_path = ARRAY['Analitika','Executive']       WHERE feature_key = 'executive_dashboard';
UPDATE public.features SET route_path = '/app/reports/wellbeing', menu_path = ARRAY['Riportok','Wellbeing']        WHERE feature_key = 'burnout_engine';

-- ── AI ───────────────────────────────────────────────────────────────────────
UPDATE public.features SET route_path = '/app/resources/ai',  menu_path = ARRAY['Erőforrások','AI','Smart Schedule']  WHERE feature_key = 'ai_smart_schedule';
UPDATE public.features SET route_path = '/app/reports/ai',    menu_path = ARRAY['Riportok','AI','Burnout predikció']  WHERE feature_key = 'ai_burnout_predict';
UPDATE public.features SET route_path = '/app/help/ai',       menu_path = ARRAY['Súgó','AI Chat asszisztens']         WHERE feature_key = 'ai_chat_assist';

-- ── HELP ─────────────────────────────────────────────────────────────────────
UPDATE public.features SET route_path = '/app/help',         menu_path = ARRAY['Súgó','Kontextuális drawer']    WHERE feature_key = 'help_drawer';
UPDATE public.features SET route_path = '/app/help',         menu_path = ARRAY['Súgó','Anchor registry']        WHERE feature_key = 'help_registry';
UPDATE public.features SET route_path = '/superadmin/help',  menu_path = ARRAY['Superadmin','Help','Regenerálás'] WHERE feature_key = 'help_regenerator';

-- ── SETTINGS ─────────────────────────────────────────────────────────────────
UPDATE public.features SET route_path = '/app/settings/general',       menu_path = ARRAY['Beállítások','Általános']            WHERE feature_key = 'ws_general';
UPDATE public.features SET route_path = '/app/settings/permissions',   menu_path = ARRAY['Beállítások','Szerepkörök']          WHERE feature_key = 'role_permissions';
UPDATE public.features SET route_path = '/app/settings/localization',  menu_path = ARRAY['Beállítások','Lokalizáció']          WHERE feature_key = 'localization';
UPDATE public.features SET route_path = '/app/settings/branding',      menu_path = ARRAY['Beállítások','Branding']             WHERE feature_key = 'branding';
UPDATE public.features SET route_path = '/app/settings/import',        menu_path = ARRAY['Beállítások','CSV import']           WHERE feature_key = 'csv_import';
UPDATE public.features SET route_path = '/app/settings/notifications', menu_path = ARRAY['Beállítások','Értesítések']          WHERE feature_key = 'notifications';
UPDATE public.features SET route_path = '/app/settings/notifications', menu_path = ARRAY['Beállítások','Értesítések','Preferenciák'] WHERE feature_key = 'notification_prefs';
UPDATE public.features SET route_path = '/app/settings/integrations',  menu_path = ARRAY['Beállítások','Integrációk','Egészség'] WHERE feature_key = 'integration_health';
UPDATE public.features SET route_path = '/app/settings/help',          menu_path = ARRAY['Beállítások','Súgó']                 WHERE feature_key = 'help_settings';
UPDATE public.features SET route_path = '/app/settings/ui',            menu_path = ARRAY['Beállítások','UI állapot']           WHERE feature_key = 'ui_section_state';

-- ── PLATFORM (Superadmin only) ───────────────────────────────────────────────
UPDATE public.features SET route_path = '/superadmin',                menu_path = ARRAY['Superadmin','Control Plane']         WHERE feature_key = 'superadmin_control_plane';
UPDATE public.features SET route_path = '/superadmin/flags',          menu_path = ARRAY['Superadmin','Feature Flags']         WHERE feature_key = 'feature_flags';
UPDATE public.features SET route_path = '/superadmin/locales',        menu_path = ARRAY['Superadmin','Lokalizáció']           WHERE feature_key = 'multilingual';
UPDATE public.features SET route_path = '/superadmin/tiers',          menu_path = ARRAY['Superadmin','Feature & Tier','Open API'] WHERE feature_key = 'open_api';
UPDATE public.features SET route_path = '/superadmin/tiers',          menu_path = ARRAY['Superadmin','Feature & Tier','Payroll Engine'] WHERE feature_key = 'payroll_engine';
UPDATE public.features SET route_path = '/superadmin/tiers',          menu_path = ARRAY['Superadmin','Feature & Tier','SOC2 / ISO 27001'] WHERE feature_key = 'soc2_iso';

-- ── ADMIN ────────────────────────────────────────────────────────────────────
UPDATE public.features SET route_path = '/admin',              menu_path = ARRAY['Admin','Dashboard']        WHERE feature_key = 'admin_dashboard';
UPDATE public.features SET route_path = '/admin/api',          menu_path = ARRAY['Admin','API']              WHERE feature_key = 'admin_api';
UPDATE public.features SET route_path = '/superadmin/email',   menu_path = ARRAY['Superadmin','E-mail előnézet'] WHERE feature_key = 'email_preview';

-- Sanity guard: fail loudly if any feature is still missing a route after this
-- migration. (A future seed addition that doesn't update this file will be
-- caught here instead of silently regressing the audit banner.)
DO $$
DECLARE
  missing_count INT;
  missing_keys  TEXT;
BEGIN
  SELECT count(*), string_agg(feature_key, ', ')
    INTO missing_count, missing_keys
    FROM public.features
   WHERE route_path IS NULL OR route_path = '' OR menu_path IS NULL OR array_length(menu_path, 1) IS NULL;

  IF missing_count > 0 THEN
    RAISE WARNING 'features.route_path / menu_path still missing for % rows: %', missing_count, missing_keys;
  END IF;
END $$;
