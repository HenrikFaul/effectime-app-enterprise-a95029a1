-- Read-only release inventory for the recovered clock and marketplace ACL
-- surface. Run only with `supabase db query --linked --file ...` and archive
-- the raw result as deployment evidence before changing service_role grants.

WITH target_tables(object_identity, object_oid) AS (
  SELECT identity, pg_catalog.to_regclass(identity)::oid
  FROM (VALUES
    ('public.clock_events'),
    ('public.qr_clock_sessions'),
    ('public.marketplace_plugins'),
    ('public.workspace_installed_plugins'),
    ('public.plugin_webhook_events')
  ) AS expected(identity)
), target_functions(object_identity, object_oid) AS (
  SELECT identity, pg_catalog.to_regprocedure(identity)::oid
  FROM (VALUES
    ('public.haversine_km(numeric,numeric,numeric,numeric)'),
    ('public.clock_generate_qr(uuid,integer)'),
    ('public.clock_event(uuid,text,text,numeric,numeric,text,text,uuid)'),
    ('public.marketplace_submit_plugin(text,text,text,text,jsonb,text,text)'),
    ('public.marketplace_set_plugin_status(uuid,text)'),
    ('public.marketplace_install_plugin(uuid,uuid,jsonb)'),
    ('public.marketplace_uninstall_plugin(uuid)')
  ) AS expected(identity)
), target_roles(role_name) AS (
  VALUES ('anon'), ('authenticated'), ('service_role')
), table_privileges(privilege_name) AS (
  VALUES
    ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'),
    ('REFERENCES'), ('TRIGGER'), ('MAINTAIN')
), table_effective AS (
  SELECT
    'table_effective'::text AS surface,
    target.object_identity,
    role.role_name::text,
    privilege.privilege_name::text,
    pg_catalog.has_table_privilege(
      role.role_name,
      target.object_oid,
      privilege.privilege_name
    ) AS allowed,
    NULL::text AS owner_name,
    NULL::boolean AS security_definer,
    NULL::text[] AS function_config,
    NULL::text AS source_sha256
  FROM target_tables AS target
  CROSS JOIN target_roles AS role
  CROSS JOIN table_privileges AS privilege
), function_effective AS (
  SELECT
    'function_effective'::text AS surface,
    target.object_identity,
    role.role_name::text,
    'EXECUTE'::text AS privilege_name,
    pg_catalog.has_function_privilege(
      role.role_name,
      target.object_oid,
      'EXECUTE'
    ) AS allowed,
    pg_catalog.pg_get_userbyid(procedure.proowner) AS owner_name,
    procedure.prosecdef AS security_definer,
    procedure.proconfig AS function_config,
    pg_catalog.encode(
      extensions.digest(
        pg_catalog.convert_to(procedure.prosrc, 'UTF8'),
        'sha256'
      ),
      'hex'
    ) AS source_sha256
  FROM target_functions AS target
  CROSS JOIN target_roles AS role
  LEFT JOIN pg_catalog.pg_proc AS procedure
    ON procedure.oid = target.object_oid
), direct_column_acl AS (
  SELECT
    'column_direct'::text AS surface,
    target.object_identity || '.' || attribute.attname AS object_identity,
    CASE acl.grantee
      WHEN 0 THEN 'PUBLIC'
      ELSE pg_catalog.pg_get_userbyid(acl.grantee)
    END AS role_name,
    acl.privilege_type AS privilege_name,
    true AS allowed,
    NULL::text AS owner_name,
    NULL::boolean AS security_definer,
    NULL::text[] AS function_config,
    NULL::text AS source_sha256
  FROM target_tables AS target
  JOIN pg_catalog.pg_attribute AS attribute
    ON attribute.attrelid = target.object_oid
   AND attribute.attnum > 0
   AND NOT attribute.attisdropped
  CROSS JOIN LATERAL pg_catalog.unnest(attribute.attacl) AS acl_item(value)
  CROSS JOIN LATERAL pg_catalog.aclexplode(ARRAY[acl_item.value]) AS acl
), role_membership AS (
  SELECT
    'role_membership'::text AS surface,
    'service_role -> ' || browser_role.role_name AS object_identity,
    'service_role'::text AS role_name,
    'MEMBER'::text AS privilege_name,
    pg_catalog.pg_has_role(
      pg_catalog.to_regrole('service_role'),
      pg_catalog.to_regrole(browser_role.role_name),
      'MEMBER'
    ) AS allowed,
    NULL::text AS owner_name,
    NULL::boolean AS security_definer,
    NULL::text[] AS function_config,
    NULL::text AS source_sha256
  FROM (VALUES ('anon'), ('authenticated')) AS browser_role(role_name)
), browser_parent_membership AS (
  SELECT
    'browser_parent_membership'::text AS surface,
    browser_role.role_name || ' -> ' || parent_role.rolname AS object_identity,
    browser_role.role_name::text,
    'MEMBER'::text AS privilege_name,
    true AS allowed,
    NULL::text AS owner_name,
    NULL::boolean AS security_definer,
    NULL::text[] AS function_config,
    NULL::text AS source_sha256
  FROM (VALUES ('anon'), ('authenticated')) AS browser_role(role_name)
  CROSS JOIN pg_catalog.pg_roles AS parent_role
  WHERE parent_role.oid <> pg_catalog.to_regrole(browser_role.role_name)::oid
    AND pg_catalog.pg_has_role(
      pg_catalog.to_regrole(browser_role.role_name),
      parent_role.oid,
      'MEMBER'
    )
)
SELECT * FROM table_effective
UNION ALL
SELECT * FROM function_effective
UNION ALL
SELECT * FROM direct_column_acl
UNION ALL
SELECT * FROM role_membership
UNION ALL
SELECT * FROM browser_parent_membership
ORDER BY surface, object_identity, role_name, privilege_name;
