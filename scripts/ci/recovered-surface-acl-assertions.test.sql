\set ON_ERROR_STOP on

SELECT contract.assert_core_unchanged(true);

DO $catalog_contract$
DECLARE
  v_table_identity text;
  v_function record;
  v_table_oid oid;
  v_anon_oid oid := pg_catalog.to_regrole('anon')::oid;
  v_authenticated_oid oid := pg_catalog.to_regrole('authenticated')::oid;
BEGIN
  IF contract.service_role_state() IS DISTINCT FROM (
    SELECT state_value
    FROM contract.state_baseline
    WHERE state_name = 'service_role'
  ) THEN
    RAISE EXCEPTION 'Recovered surface service_role effective privileges changed';
  END IF;

  IF contract.pgcrypto_trust_state() IS DISTINCT FROM (
    SELECT state_value
    FROM contract.state_baseline
    WHERE state_name = 'pgcrypto_trust'
  ) THEN
    RAISE EXCEPTION 'Recovered surface pgcrypto trust metadata changed';
  END IF;

  IF contract.mutable_surface_state() IS DISTINCT FROM (
    SELECT state_value
    FROM contract.state_baseline
    WHERE state_name = 'hardened_mutable'
  ) THEN
    RAISE EXCEPTION 'Recovered surface idempotent hardened state drifted';
  END IF;

  FOREACH v_table_identity IN ARRAY ARRAY[
    'public.clock_events',
    'public.qr_clock_sessions',
    'public.marketplace_plugins',
    'public.workspace_installed_plugins',
    'public.plugin_webhook_events'
  ] LOOP
    v_table_oid := v_table_identity::pg_catalog.regclass::oid;
    IF NOT pg_catalog.has_table_privilege(
      'authenticated', v_table_oid, 'SELECT'
    ) OR EXISTS (
      SELECT 1
      FROM pg_catalog.unnest(
        ARRAY['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN']
      ) AS privilege(name)
      WHERE pg_catalog.has_table_privilege(
        'authenticated', v_table_oid, privilege.name
      )
    ) OR EXISTS (
      SELECT 1
      FROM pg_catalog.unnest(
        ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN']
      ) AS privilege(name)
      WHERE pg_catalog.has_table_privilege('anon', v_table_oid, privilege.name)
    ) OR EXISTS (
      SELECT 1
      FROM pg_catalog.pg_class AS relation
      CROSS JOIN LATERAL pg_catalog.aclexplode(
        COALESCE(relation.relacl, pg_catalog.acldefault('r', relation.relowner))
      ) AS acl
      WHERE relation.oid = v_table_oid
        AND acl.grantee = 0
    ) OR EXISTS (
      SELECT 1
      FROM pg_catalog.pg_attribute AS attribute
      CROSS JOIN LATERAL pg_catalog.unnest(attribute.attacl) AS acl_item(value)
      CROSS JOIN LATERAL pg_catalog.aclexplode(ARRAY[acl_item.value]) AS acl
      WHERE attribute.attrelid = v_table_oid
        AND attribute.attnum > 0
        AND NOT attribute.attisdropped
        AND acl.grantee IN (0, v_anon_oid, v_authenticated_oid)
    ) OR EXISTS (
      SELECT 1
      FROM pg_catalog.pg_attribute AS attribute
      CROSS JOIN LATERAL pg_catalog.unnest(
        ARRAY['INSERT', 'UPDATE', 'REFERENCES']
      ) AS privilege(name)
      WHERE attribute.attrelid = v_table_oid
        AND attribute.attnum > 0
        AND NOT attribute.attisdropped
        AND pg_catalog.has_column_privilege(
          'authenticated', v_table_oid, attribute.attnum, privilege.name
        )
    ) OR EXISTS (
      SELECT 1
      FROM pg_catalog.pg_attribute AS attribute
      CROSS JOIN LATERAL pg_catalog.unnest(
        ARRAY['SELECT', 'INSERT', 'UPDATE', 'REFERENCES']
      ) AS privilege(name)
      WHERE attribute.attrelid = v_table_oid
        AND attribute.attnum > 0
        AND NOT attribute.attisdropped
        AND pg_catalog.has_column_privilege(
          'anon', v_table_oid, attribute.attnum, privilege.name
        )
    ) THEN
      RAISE EXCEPTION 'Recovered table browser ACL is not exact: %', v_table_identity;
    END IF;
  END LOOP;

  FOR v_function IN
    SELECT *
    FROM (VALUES
      (
        'public.haversine_km(numeric,numeric,numeric,numeric)',
        false,
        ARRAY['search_path=pg_catalog']::text[]
      ),
      (
        'public.clock_generate_qr(uuid,integer)',
        true,
        ARRAY['search_path=pg_catalog']::text[]
      ),
      (
        'public.clock_event(uuid,text,text,numeric,numeric,text,text,uuid)',
        true,
        ARRAY['search_path=pg_catalog']::text[]
      ),
      (
        'public.marketplace_submit_plugin(text,text,text,text,jsonb,text,text)',
        true,
        ARRAY['search_path=pg_catalog']::text[]
      ),
      (
        'public.marketplace_set_plugin_status(uuid,text)',
        true,
        ARRAY['search_path=pg_catalog']::text[]
      ),
      (
        'public.marketplace_install_plugin(uuid,uuid,jsonb)',
        true,
        ARRAY['search_path=pg_catalog']::text[]
      ),
      (
        'public.marketplace_uninstall_plugin(uuid)',
        true,
        ARRAY['search_path=pg_catalog']::text[]
      )
    ) AS expected(identity, authenticated_execute, function_config)
  LOOP
    IF pg_catalog.has_function_privilege(
      'anon', v_function.identity::pg_catalog.regprocedure, 'EXECUTE'
    ) OR pg_catalog.has_function_privilege(
      'authenticated', v_function.identity::pg_catalog.regprocedure, 'EXECUTE'
    ) IS DISTINCT FROM v_function.authenticated_execute OR EXISTS (
      SELECT 1
      FROM pg_catalog.pg_proc AS procedure
      CROSS JOIN LATERAL pg_catalog.aclexplode(
        COALESCE(procedure.proacl, pg_catalog.acldefault('f', procedure.proowner))
      ) AS acl
      WHERE procedure.oid = v_function.identity::pg_catalog.regprocedure::oid
        AND acl.grantee = 0
        AND acl.privilege_type = 'EXECUTE'
    ) OR NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_proc AS procedure
      WHERE procedure.oid = v_function.identity::pg_catalog.regprocedure::oid
        AND procedure.proowner = 'postgres'::pg_catalog.regrole::oid
        AND procedure.proconfig = v_function.function_config
    ) THEN
      RAISE EXCEPTION 'Recovered function ACL/search_path is not exact: %',
        v_function.identity;
    END IF;
  END LOOP;
END;
$catalog_contract$;

BEGIN;

-- Direct negative access is executed as the real browser roles. The helper is
-- SECURITY INVOKER and only converts the exact insufficient_privilege error
-- into a passing assertion.
SET LOCAL ROLE anon;
SELECT contract.expect_insufficient_privilege(
  'SELECT count(*) FROM public.clock_events'
);
SELECT contract.expect_insufficient_privilege(
  'SELECT count(*) FROM public.qr_clock_sessions'
);
SELECT contract.expect_insufficient_privilege(
  'SELECT count(*) FROM public.marketplace_plugins'
);
SELECT contract.expect_insufficient_privilege(
  'SELECT count(*) FROM public.workspace_installed_plugins'
);
SELECT contract.expect_insufficient_privilege(
  'SELECT count(*) FROM public.plugin_webhook_events'
);
SELECT contract.expect_insufficient_privilege(
  'SELECT public.haversine_km(0::numeric,0::numeric,0::numeric,0::numeric)'
);
SELECT contract.expect_insufficient_privilege(
  'SELECT public.clock_generate_qr(''40000000-0000-4000-8000-000000000001''::uuid,60)'
);
SELECT contract.expect_insufficient_privilege(
  'SELECT public.clock_event(''20000000-0000-4000-8000-000000000001''::uuid,''clock_in''::text,''manual''::text,NULL::numeric,NULL::numeric,NULL::text,NULL::text,NULL::uuid)'
);
SELECT contract.expect_insufficient_privilege(
  'SELECT public.marketplace_submit_plugin(''abc''::text,''A''::text,''D''::text,''other''::text,''{}''::jsonb,NULL::text,''free''::text)'
);
SELECT contract.expect_insufficient_privilege(
  'SELECT public.marketplace_set_plugin_status(NULL::uuid,''published''::text)'
);
SELECT contract.expect_insufficient_privilege(
  'SELECT public.marketplace_install_plugin(NULL::uuid,NULL::uuid,''{}''::jsonb)'
);
SELECT contract.expect_insufficient_privilege(
  'SELECT public.marketplace_uninstall_plugin(NULL::uuid)'
);
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT contract.expect_insufficient_privilege(
  'SELECT public.haversine_km(0::numeric,0::numeric,0::numeric,0::numeric)'
);
SELECT contract.expect_insufficient_privilege(
  'UPDATE public.clock_events SET verified = true'
);
SELECT contract.expect_insufficient_privilege(
  'TRUNCATE TABLE public.clock_events'
);
RESET ROLE;

-- QR generation succeeds despite the hostile public.gen_random_bytes shadow.
-- The clock-in uses the generated code, and the v3.39.1 clock-out behavior is
-- also exercised with an invalid code.
SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  true
);
SELECT public.clock_generate_qr(
  '40000000-0000-4000-8000-000000000001'::uuid,
  120
) AS generated_qr \gset
\if :{?generated_qr}
\else
  \warn 'clock_generate_qr returned no result'
  \quit 1
\endif
SELECT (:'generated_qr'::jsonb->>'ok' = 'true')
   AND (:'generated_qr'::jsonb->>'code' ~ '^[0-9a-f]{32}$') AS qr_is_valid \gset
\if :qr_is_valid
\else
  \warn 'trusted QR generation contract failed'
  \quit 1
\endif

SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000002',
  true
);
SELECT public.clock_event(
  '20000000-0000-4000-8000-000000000001'::uuid,
  'clock_in',
  'qr',
  NULL,
  NULL,
  :'generated_qr'::jsonb->>'code',
  NULL,
  NULL
) AS clock_in_result \gset
SELECT (:'clock_in_result'::jsonb->>'ok' = 'true')
   AND (:'clock_in_result'::jsonb->>'verified' = 'true') AS clock_in_is_valid \gset
\if :clock_in_is_valid
\else
  \warn 'authenticated QR clock-in contract failed'
  \quit 1
\endif

SELECT public.clock_event(
  '20000000-0000-4000-8000-000000000001'::uuid,
  'clock_out',
  'qr',
  NULL,
  NULL,
  'expired-or-invalid',
  NULL,
  NULL
) AS clock_out_result \gset
SELECT (:'clock_out_result'::jsonb->>'ok' = 'true')
   AND (:'clock_out_result'::jsonb->>'verified' = 'false') AS clock_out_is_valid \gset
\if :clock_out_is_valid
\else
  \warn 'v3.39.1 unverified clock-out contract failed'
  \quit 1
\endif
RESET ROLE;

-- Marketplace developer -> platform admin -> workspace owner lifecycle.
SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000003',
  true
);
SELECT public.marketplace_submit_plugin(
  'contract-plugin',
  'Contract Plugin',
  'Runtime ACL contract',
  'integration',
  '{"version":"1.0.0"}'::jsonb,
  NULL,
  'free'
) AS submitted_plugin_id \gset
SELECT public.marketplace_set_plugin_status(
  :'submitted_plugin_id'::uuid,
  'published'
) AS publish_result \gset
SELECT (:'publish_result'::jsonb->>'ok' = 'true') AS publish_is_valid \gset
\if :publish_is_valid
\else
  \warn 'marketplace publish contract failed'
  \quit 1
\endif

SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  true
);
SELECT public.marketplace_install_plugin(
  '20000000-0000-4000-8000-000000000001'::uuid,
  :'submitted_plugin_id'::uuid,
  '{"channel":"contract"}'::jsonb
) AS installation_id \gset
SELECT (count(*) = 1) AS owner_can_read_installation
FROM public.workspace_installed_plugins
WHERE id = :'installation_id'::uuid \gset
\if :owner_can_read_installation
\else
  \warn 'workspace-owner installation read contract failed'
  \quit 1
\endif
SELECT public.marketplace_uninstall_plugin(
  :'installation_id'::uuid
) AS uninstall_result \gset
SELECT (:'uninstall_result'::jsonb->>'ok' = 'true') AS uninstall_is_valid \gset
\if :uninstall_is_valid
\else
  \warn 'marketplace uninstall contract failed'
  \quit 1
\endif
RESET ROLE;

-- RLS remains tenant-scoped after granting authenticated SELECT.
SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000005',
  true
);
SELECT (count(*) = 0) AS tenant_isolated
FROM public.clock_events
WHERE workspace_id = '20000000-0000-4000-8000-000000000001'::uuid \gset
\if :tenant_isolated
\else
  \warn 'clock-event tenant isolation contract failed'
  \quit 1
\endif
RESET ROLE;

ROLLBACK;

SELECT contract.assert_core_unchanged(true);

\echo 'Recovered surface ACL PostgreSQL contract passed.'
