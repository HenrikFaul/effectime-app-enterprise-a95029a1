-- v3.51.10 - forward-only ACL and search_path hardening for the recovered
-- clock-in and plugin-marketplace surfaces.
--
-- The recovered historical migrations are byte-attested and must not be
-- edited. This migration preserves routine OIDs, signatures, business
-- behavior, RLS policies, data and the effective service_role contract while
-- removing unused browser write privileges, PUBLIC/anon access and mutable
-- public search paths. Only clock_generate_qr is forward-replaced so its
-- existing pgcrypto call becomes explicitly schema-qualified.

DO $recovered_surface_preflight$
DECLARE
  v_anon_oid oid := pg_catalog.to_regrole('anon')::oid;
  v_authenticated_oid oid := pg_catalog.to_regrole('authenticated')::oid;
  v_service_role_oid oid := pg_catalog.to_regrole('service_role')::oid;
  v_expected_owner oid := CURRENT_USER::pg_catalog.regrole::oid;
  v_identity text;
  v_table_oid oid;
  v_function_oid oid;
  v_policy record;
  v_security_definer boolean;
  v_language text;
  v_volatility "char";
  v_return_type oid;
BEGIN
  IF v_anon_oid IS NULL
     OR v_authenticated_oid IS NULL
     OR v_service_role_oid IS NULL THEN
    RAISE EXCEPTION 'Recovered surface ACL roles are incomplete'
      USING ERRCODE = '55000';
  END IF;

  -- REVOKE can remove only PUBLIC/direct browser grants. Reject parent-role
  -- inheritance up front so an inherited table/column/function ACL cannot
  -- survive until a late postcondition (or a non-transactional runner).
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.unnest(
      ARRAY[v_anon_oid, v_authenticated_oid]
    ) AS browser_role(role_oid)
    CROSS JOIN pg_catalog.pg_roles AS parent_role
    WHERE parent_role.oid <> browser_role.role_oid
      AND pg_catalog.pg_has_role(
        browser_role.role_oid,
        parent_role.oid,
        'MEMBER'
      )
  ) THEN
    RAISE EXCEPTION 'Recovered surface browser roles must not inherit parent roles'
      USING ERRCODE = '55000';
  END IF;

  IF pg_catalog.pg_has_role(
       v_service_role_oid, v_anon_oid, 'MEMBER'
     ) OR pg_catalog.pg_has_role(
       v_service_role_oid, v_authenticated_oid, 'MEMBER'
     ) THEN
    RAISE EXCEPTION 'service_role must not inherit browser-role privileges'
      USING ERRCODE = '55000';
  END IF;

  FOREACH v_identity IN ARRAY ARRAY[
    'public.clock_events',
    'public.qr_clock_sessions',
    'public.marketplace_plugins',
    'public.workspace_installed_plugins',
    'public.plugin_webhook_events'
  ] LOOP
    v_table_oid := pg_catalog.to_regclass(v_identity)::oid;
    IF v_table_oid IS NULL OR NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_class AS relation
      JOIN pg_catalog.pg_namespace AS namespace
        ON namespace.oid = relation.relnamespace
      WHERE relation.oid = v_table_oid
        AND relation.relkind = 'r'
        AND relation.relowner = v_expected_owner
        AND relation.relrowsecurity
        AND namespace.nspname = 'public'
    ) THEN
      RAISE EXCEPTION 'Recovered surface table contract is incompatible: %',
        v_identity
        USING ERRCODE = '55000';
    END IF;
  END LOOP;

  FOR v_identity, v_security_definer, v_language, v_volatility, v_return_type IN
    SELECT *
    FROM (VALUES
      (
        'public.haversine_km(numeric,numeric,numeric,numeric)',
        false, 'sql', 'i'::"char", 'numeric'::pg_catalog.regtype::oid
      ),
      (
        'public.clock_generate_qr(uuid,integer)',
        true, 'plpgsql', 'v'::"char", 'jsonb'::pg_catalog.regtype::oid
      ),
      (
        'public.clock_event(uuid,text,text,numeric,numeric,text,text,uuid)',
        true, 'plpgsql', 'v'::"char", 'jsonb'::pg_catalog.regtype::oid
      ),
      (
        'public.marketplace_submit_plugin(text,text,text,text,jsonb,text,text)',
        true, 'plpgsql', 'v'::"char", 'uuid'::pg_catalog.regtype::oid
      ),
      (
        'public.marketplace_set_plugin_status(uuid,text)',
        true, 'plpgsql', 'v'::"char", 'jsonb'::pg_catalog.regtype::oid
      ),
      (
        'public.marketplace_install_plugin(uuid,uuid,jsonb)',
        true, 'plpgsql', 'v'::"char", 'uuid'::pg_catalog.regtype::oid
      ),
      (
        'public.marketplace_uninstall_plugin(uuid)',
        true, 'plpgsql', 'v'::"char", 'jsonb'::pg_catalog.regtype::oid
      )
    ) AS expected(
      identity,
      security_definer,
      language_name,
      volatility,
      return_type
    )
  LOOP
    v_function_oid := pg_catalog.to_regprocedure(v_identity)::oid;
    IF v_function_oid IS NULL OR NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_proc AS procedure
      JOIN pg_catalog.pg_namespace AS namespace
        ON namespace.oid = procedure.pronamespace
      JOIN pg_catalog.pg_language AS language
        ON language.oid = procedure.prolang
      WHERE procedure.oid = v_function_oid
        AND procedure.prokind = 'f'
        AND procedure.proowner = v_expected_owner
        AND procedure.prosecdef = v_security_definer
        AND procedure.provolatile = v_volatility
        AND procedure.prorettype = v_return_type
        AND procedure.proconfig IN (
          ARRAY['search_path=public']::text[],
          ARRAY['search_path=pg_catalog']::text[]
        )
        AND (
          v_identity <> 'public.clock_generate_qr(uuid,integer)'
          OR (
            NOT procedure.proisstrict
            AND NOT procedure.proleakproof
            AND procedure.proparallel = 'u'
            AND procedure.procost = 100
            AND procedure.prorows = 0
            AND procedure.prosupport = 0
            AND procedure.pronargs = 2
            AND procedure.pronargdefaults = 1
            AND procedure.proallargtypes IS NULL
            AND procedure.proargmodes IS NULL
            AND procedure.proargnames = ARRAY[
              '_office_id', '_ttl_seconds'
            ]::text[]
            AND pg_catalog.pg_get_expr(
              procedure.proargdefaults,
              0
            ) = '60'
          )
        )
        AND namespace.nspname = 'public'
        AND language.lanname = v_language
    ) THEN
      RAISE EXCEPTION 'Recovered surface routine contract is incompatible: %',
        v_identity
        USING ERRCODE = '55000';
    END IF;
  END LOOP;

  IF (
    SELECT pg_catalog.count(*)
    FROM pg_catalog.pg_policy AS policy
    JOIN pg_catalog.pg_class AS relation
      ON relation.oid = policy.polrelid
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname IN (
        'clock_events',
        'qr_clock_sessions',
        'marketplace_plugins',
        'workspace_installed_plugins',
        'plugin_webhook_events'
      )
  ) <> 10 THEN
    RAISE EXCEPTION 'Recovered surface RLS policy set is incompatible'
      USING ERRCODE = '55000';
  END IF;

  FOR v_policy IN
    SELECT *
    FROM (VALUES
      (
        'clock_events', 'clock_events_read', 'r'::"char",
        $policy$((membership_id IN ( SELECT enterprise_memberships.id FROM enterprise_memberships WHERE (enterprise_memberships.user_id = auth.uid()))) OR has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]) OR has_role(auth.uid(), 'admin'::app_role))$policy$,
        NULL::text
      ),
      (
        'clock_events', 'clock_events_no_direct_write', 'a'::"char",
        NULL::text, 'false'
      ),
      (
        'qr_clock_sessions', 'qr_sessions_read', 'r'::"char",
        $policy$(has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]) OR has_role(auth.uid(), 'admin'::app_role))$policy$,
        NULL::text
      ),
      (
        'qr_clock_sessions', 'qr_sessions_no_direct_write', 'a'::"char",
        NULL::text, 'false'
      ),
      (
        'marketplace_plugins', 'marketplace_plugins_read', 'r'::"char",
        $policy$((status = 'published'::text) OR (author_user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))$policy$,
        NULL::text
      ),
      (
        'marketplace_plugins', 'marketplace_plugins_no_direct_write', 'a'::"char",
        NULL::text, 'false'
      ),
      (
        'workspace_installed_plugins', 'workspace_installed_plugins_read', 'r'::"char",
        $policy$(is_enterprise_member(workspace_id, auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))$policy$,
        NULL::text
      ),
      (
        'workspace_installed_plugins', 'workspace_installed_plugins_no_direct_write', 'a'::"char",
        NULL::text, 'false'
      ),
      (
        'plugin_webhook_events', 'plugin_webhook_events_read', 'r'::"char",
        $policy$(has_enterprise_role(workspace_id, auth.uid(), ARRAY['owner'::enterprise_role, 'resourceAssistant'::enterprise_role]) OR has_role(auth.uid(), 'admin'::app_role))$policy$,
        NULL::text
      ),
      (
        'plugin_webhook_events', 'plugin_webhook_events_no_direct_write', 'a'::"char",
        NULL::text, 'false'
      )
    ) AS expected(
      table_name,
      policy_name,
      command,
      using_expression,
      check_expression
    )
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_policy AS policy
      JOIN pg_catalog.pg_class AS relation
        ON relation.oid = policy.polrelid
      JOIN pg_catalog.pg_namespace AS namespace
        ON namespace.oid = relation.relnamespace
      WHERE namespace.nspname = 'public'
        AND relation.relname = v_policy.table_name
        AND policy.polname = v_policy.policy_name
        AND policy.polcmd = v_policy.command
        AND policy.polpermissive
        AND policy.polroles = ARRAY[v_authenticated_oid]::oid[]
        AND pg_catalog.regexp_replace(
          pg_catalog.pg_get_expr(policy.polqual, policy.polrelid),
          '[[:space:]]+',
          ' ',
          'g'
        ) IS NOT DISTINCT FROM v_policy.using_expression
        AND pg_catalog.regexp_replace(
          pg_catalog.pg_get_expr(policy.polwithcheck, policy.polrelid),
          '[[:space:]]+',
          ' ',
          'g'
        ) IS NOT DISTINCT FROM v_policy.check_expression
    ) THEN
      RAISE EXCEPTION 'Recovered surface RLS policy contract is incompatible: %.%',
        v_policy.table_name,
        v_policy.policy_name
        USING ERRCODE = '55000';
    END IF;
  END LOOP;
END;
$recovered_surface_preflight$;

-- The QR generator binds an exact, schema-qualified pgcrypto function below.
-- Prove that this existing signature is an extension member; the extensions
-- schema is deliberately not added to a SECURITY DEFINER search_path because
-- managed Supabase roles may legitimately hold CREATE there.
DO $recovered_surface_pgcrypto_contract$
DECLARE
  v_schema_oid oid;
  v_schema_owner_oid oid;
  v_extension_oid oid;
  v_extension_owner_oid oid;
  v_random_function_oid oid := pg_catalog.to_regprocedure(
    'extensions.gen_random_bytes(integer)'
  )::oid;
  v_random_owner_oid oid;
  v_digest_function_oid oid := pg_catalog.to_regprocedure(
    'extensions.digest(bytea,text)'
  )::oid;
  v_digest_owner_oid oid;
  v_executor_oid oid := CURRENT_USER::pg_catalog.regrole::oid;
  v_owner record;
  v_source record;
  v_source_hash text;
BEGIN
  SELECT namespace.oid, namespace.nspowner
  INTO v_schema_oid, v_schema_owner_oid
  FROM pg_catalog.pg_namespace AS namespace
  WHERE namespace.nspname = 'extensions';

  SELECT extension.oid, extension.extowner
  INTO v_extension_oid, v_extension_owner_oid
  FROM pg_catalog.pg_extension AS extension
  WHERE extension.extname = 'pgcrypto'
    AND extension.extnamespace = v_schema_oid;

  SELECT procedure.proowner
  INTO v_random_owner_oid
  FROM pg_catalog.pg_proc AS procedure
  WHERE procedure.oid = v_random_function_oid;

  SELECT procedure.proowner
  INTO v_digest_owner_oid
  FROM pg_catalog.pg_proc AS procedure
  WHERE procedure.oid = v_digest_function_oid;

  IF v_schema_oid IS NULL
     OR v_extension_oid IS NULL
     OR v_random_function_oid IS NULL
     OR v_digest_function_oid IS NULL
     OR EXISTS (
       SELECT 1
       FROM pg_catalog.unnest(
         ARRAY[v_random_function_oid, v_digest_function_oid]
       ) AS required_function(function_oid)
       WHERE NOT EXISTS (
         SELECT 1
         FROM pg_catalog.pg_depend AS dependency
         WHERE dependency.classid = 'pg_catalog.pg_proc'::pg_catalog.regclass
           AND dependency.objid = required_function.function_oid
           AND dependency.objsubid = 0
           AND dependency.refclassid = 'pg_catalog.pg_extension'::pg_catalog.regclass
           AND dependency.refobjid = v_extension_oid
           AND dependency.deptype = 'e'
       )
     ) THEN
    RAISE EXCEPTION 'Trusted pgcrypto function contract is required'
      USING ERRCODE = '55000';
  END IF;

  FOR v_owner IN
    SELECT *
    FROM (VALUES
      ('extensions schema', v_schema_owner_oid),
      ('pgcrypto extension', v_extension_owner_oid),
      ('extensions.gen_random_bytes(integer)', v_random_owner_oid),
      ('extensions.digest(bytea,text)', v_digest_owner_oid)
    ) AS expected(owner_label, owner_oid)
  LOOP
    IF v_owner.owner_oid IS NULL OR NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_roles AS owner_role
      WHERE owner_role.oid = v_owner.owner_oid
        AND (owner_role.oid = v_executor_oid OR owner_role.rolsuper)
    ) THEN
      RAISE EXCEPTION '% owner is not trusted by the migration executor',
        v_owner.owner_label
        USING ERRCODE = '55000';
    END IF;
  END LOOP;

  IF NOT pg_catalog.has_schema_privilege(v_executor_oid, v_schema_oid, 'USAGE')
     OR NOT pg_catalog.has_function_privilege(
       v_executor_oid,
       v_random_function_oid,
       'EXECUTE'
     )
     OR NOT pg_catalog.has_function_privilege(
       v_executor_oid,
       v_digest_function_oid,
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'Migration executor cannot execute trusted pgcrypto functions'
      USING ERRCODE = '55000';
  END IF;

  -- Refuse to rewrite ACL/configuration over an undocumented routine hotfix.
  -- The QR routine admits either the recovered source or this migration's
  -- exact hardened source so the migration remains safely idempotent.
  FOR v_source IN
    SELECT *
    FROM (VALUES
      (
        'public.clock_generate_qr(uuid,integer)',
        ARRAY[
          'a1949f85e34e95ed3585b0cb6d97f36fdba91eaf1a285e95a17930b48287c8d2',
          '3094de600d25c253d3b24cf33db439390c541de98b084bbce4ded295ee99f821'
        ]::text[]
      ),
      (
        'public.clock_event(uuid,text,text,numeric,numeric,text,text,uuid)',
        ARRAY['c83fda46c23d69997d457b28737bc2dd94ab55f1ca3d4b282ce63f6acb608c4f']::text[]
      ),
      (
        'public.haversine_km(numeric,numeric,numeric,numeric)',
        ARRAY['8172081c6deab4ebcf1d9a85edc685341e57dfb125d9f81978f7398e3e65b713']::text[]
      ),
      (
        'public.marketplace_submit_plugin(text,text,text,text,jsonb,text,text)',
        ARRAY['3c14a647272aa18045b6c08b79b31c4994e8e31da646b128c10d0302914202a2']::text[]
      ),
      (
        'public.marketplace_set_plugin_status(uuid,text)',
        ARRAY['5f41a3987681da3e56101d6c634c084cd204dea2b0c17bc59f5a3b83780713e2']::text[]
      ),
      (
        'public.marketplace_install_plugin(uuid,uuid,jsonb)',
        ARRAY['85d5db26dfa971df025af7a92a824c2aadcfd230ef7674d5c9ab9f2afdd31dc3']::text[]
      ),
      (
        'public.marketplace_uninstall_plugin(uuid)',
        ARRAY['413149bad9e87560a846ebbf8b3ec77ee4abe481462593de7972c1bc63e262c5']::text[]
      )
    ) AS expected(identity, accepted_hashes)
  LOOP
    SELECT pg_catalog.encode(
      extensions.digest(
        pg_catalog.convert_to(
          pg_catalog.replace(
            pg_catalog.replace(
              procedure.prosrc,
              E'\r\n',
              E'\n'
            ),
            E'\r',
            E'\n'
          ),
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    )
    INTO v_source_hash
    FROM pg_catalog.pg_proc AS procedure
    WHERE procedure.oid = pg_catalog.to_regprocedure(v_source.identity)::oid;

    IF v_source_hash IS NULL
       OR NOT (v_source_hash = ANY(v_source.accepted_hashes)) THEN
      RAISE EXCEPTION 'Recovered surface routine source attestation failed: %',
        v_source.identity
        USING ERRCODE = '55000';
    END IF;
  END LOOP;
END;
$recovered_surface_pgcrypto_contract$;

ALTER FUNCTION public.haversine_km(numeric, numeric, numeric, numeric)
  SET search_path = pg_catalog;

-- Forward-replace only the QR routine whose recovered body used an unqualified
-- pgcrypto call. The signature, owner, OID, ACL and business behavior remain;
-- the only body change is the exact extension qualification.
CREATE OR REPLACE FUNCTION public.clock_generate_qr(
  _office_id uuid,
  _ttl_seconds integer DEFAULT 60
) RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
CALLED ON NULL INPUT
SECURITY DEFINER
PARALLEL UNSAFE
COST 100
SET search_path = pg_catalog
AS $function$
DECLARE
  v_caller uuid;
  v_workspace uuid;
  v_code text;
  v_session_id uuid;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT workspace_id
  INTO v_workspace
  FROM public.enterprise_offices
  WHERE id = _office_id;
  IF v_workspace IS NULL THEN RAISE EXCEPTION 'Office not found'; END IF;

  IF NOT public.has_enterprise_role(
    v_workspace,
    v_caller,
    ARRAY[
      'owner'::public.enterprise_role,
      'resourceAssistant'::public.enterprise_role
    ]
  ) THEN
    RAISE EXCEPTION 'Forbidden: manager role required';
  END IF;

  v_code := pg_catalog.encode(extensions.gen_random_bytes(16), 'hex');

  INSERT INTO public.qr_clock_sessions (
    office_id,
    workspace_id,
    code,
    created_by,
    expires_at
  ) VALUES (
    _office_id,
    v_workspace,
    v_code,
    v_caller,
    pg_catalog.now() + (
      COALESCE(_ttl_seconds, 60) || ' seconds'
    )::pg_catalog.interval
  )
  RETURNING id INTO v_session_id;

  RETURN pg_catalog.jsonb_build_object(
    'ok', true,
    'session_id', v_session_id,
    'code', v_code,
    'expires_at', pg_catalog.now() + (
      COALESCE(_ttl_seconds, 60) || ' seconds'
    )::pg_catalog.interval
  );
END;
$function$;

ALTER FUNCTION public.clock_event(uuid, text, text, numeric, numeric, text, text, uuid)
  SET search_path = pg_catalog;
ALTER FUNCTION public.marketplace_submit_plugin(text, text, text, text, jsonb, text, text)
  SET search_path = pg_catalog;
ALTER FUNCTION public.marketplace_set_plugin_status(uuid, text)
  SET search_path = pg_catalog;
ALTER FUNCTION public.marketplace_install_plugin(uuid, uuid, jsonb)
  SET search_path = pg_catalog;
ALTER FUNCTION public.marketplace_uninstall_plugin(uuid)
  SET search_path = pg_catalog;

-- Remove all browser-role table and column grants. Capture and preserve the
-- effective service_role contract around each individual revoke so privileges
-- inherited through PUBLIC are converted to an equivalent direct grant rather
-- than silently disappearing.
DO $recovered_surface_table_acl$
DECLARE
  v_table_identity text;
  v_table_oid oid;
  v_column record;
  v_privilege text;
  v_service_had_privilege boolean;
BEGIN
  FOREACH v_table_identity IN ARRAY ARRAY[
    'public.clock_events',
    'public.qr_clock_sessions',
    'public.marketplace_plugins',
    'public.workspace_installed_plugins',
    'public.plugin_webhook_events'
  ] LOOP
    v_table_oid := v_table_identity::pg_catalog.regclass::oid;

    FOREACH v_privilege IN ARRAY ARRAY[
      'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER',
      'MAINTAIN'
    ] LOOP
      v_service_had_privilege := pg_catalog.has_table_privilege(
        'service_role',
        v_table_oid,
        v_privilege
      );
      EXECUTE pg_catalog.format(
        'REVOKE %s ON TABLE %s FROM PUBLIC, anon, authenticated',
        v_privilege,
        v_table_identity
      );
      IF v_service_had_privilege AND NOT pg_catalog.has_table_privilege(
        'service_role',
        v_table_oid,
        v_privilege
      ) THEN
        EXECUTE pg_catalog.format(
          'GRANT %s ON TABLE %s TO service_role',
          v_privilege,
          v_table_identity
        );
      ELSIF NOT v_service_had_privilege AND pg_catalog.has_table_privilege(
        'service_role',
        v_table_oid,
        v_privilege
      ) THEN
        RAISE EXCEPTION 'service_role table privilege broadened unexpectedly: % %',
          v_table_identity,
          v_privilege
          USING ERRCODE = '55000';
      END IF;
    END LOOP;

    FOR v_column IN
      SELECT attribute.attname
      FROM pg_catalog.pg_attribute AS attribute
      WHERE attribute.attrelid = v_table_oid
        AND attribute.attnum > 0
        AND NOT attribute.attisdropped
      ORDER BY attribute.attnum
    LOOP
      FOREACH v_privilege IN ARRAY ARRAY[
        'SELECT', 'INSERT', 'UPDATE', 'REFERENCES'
      ] LOOP
        v_service_had_privilege := pg_catalog.has_column_privilege(
          'service_role',
          v_table_oid,
          v_column.attname,
          v_privilege
        );
        EXECUTE pg_catalog.format(
          'REVOKE %s (%I) ON TABLE %s FROM PUBLIC, anon, authenticated',
          v_privilege,
          v_column.attname,
          v_table_identity
        );
        IF v_service_had_privilege AND NOT pg_catalog.has_column_privilege(
          'service_role',
          v_table_oid,
          v_column.attname,
          v_privilege
        ) THEN
          EXECUTE pg_catalog.format(
            'GRANT %s (%I) ON TABLE %s TO service_role',
            v_privilege,
            v_column.attname,
            v_table_identity
          );
        ELSIF NOT v_service_had_privilege AND pg_catalog.has_column_privilege(
          'service_role',
          v_table_oid,
          v_column.attname,
          v_privilege
        ) THEN
          RAISE EXCEPTION 'service_role column privilege broadened unexpectedly: %.% %',
            v_table_identity,
            v_column.attname,
            v_privilege
            USING ERRCODE = '55000';
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
END;
$recovered_surface_table_acl$;

GRANT SELECT ON TABLE
  public.clock_events,
  public.qr_clock_sessions,
  public.marketplace_plugins,
  public.workspace_installed_plugins,
  public.plugin_webhook_events
TO authenticated;

DO $recovered_surface_function_acl$
DECLARE
  v_identity text;
  v_function_oid oid;
  v_service_had_execute boolean;
BEGIN
  FOREACH v_identity IN ARRAY ARRAY[
    'public.haversine_km(numeric,numeric,numeric,numeric)',
    'public.clock_generate_qr(uuid,integer)',
    'public.clock_event(uuid,text,text,numeric,numeric,text,text,uuid)',
    'public.marketplace_submit_plugin(text,text,text,text,jsonb,text,text)',
    'public.marketplace_set_plugin_status(uuid,text)',
    'public.marketplace_install_plugin(uuid,uuid,jsonb)',
    'public.marketplace_uninstall_plugin(uuid)'
  ] LOOP
    v_function_oid := v_identity::pg_catalog.regprocedure::oid;
    v_service_had_execute := pg_catalog.has_function_privilege(
      'service_role',
      v_function_oid,
      'EXECUTE'
    );
    EXECUTE pg_catalog.format(
      'REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',
      v_identity
    );
    IF v_service_had_execute AND NOT pg_catalog.has_function_privilege(
      'service_role',
      v_function_oid,
      'EXECUTE'
    ) THEN
      EXECUTE pg_catalog.format(
        'GRANT EXECUTE ON FUNCTION %s TO service_role',
        v_identity
      );
    ELSIF NOT v_service_had_execute AND pg_catalog.has_function_privilege(
      'service_role',
      v_function_oid,
      'EXECUTE'
    ) THEN
      RAISE EXCEPTION 'service_role function privilege broadened unexpectedly: %',
        v_identity
        USING ERRCODE = '55000';
    END IF;
  END LOOP;
END;
$recovered_surface_function_acl$;

GRANT EXECUTE ON FUNCTION public.clock_generate_qr(uuid, integer)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.clock_event(
  uuid, text, text, numeric, numeric, text, text, uuid
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_submit_plugin(
  text, text, text, text, jsonb, text, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_set_plugin_status(uuid, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_install_plugin(uuid, uuid, jsonb)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_uninstall_plugin(uuid)
  TO authenticated;

DO $recovered_surface_postcondition$
DECLARE
  v_table_identity text;
  v_table_oid oid;
  v_function record;
  v_function_oid oid;
  v_anon_oid oid := pg_catalog.to_regrole('anon')::oid;
  v_authenticated_oid oid := pg_catalog.to_regrole('authenticated')::oid;
BEGIN
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
        ARRAY[
          'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER',
          'MAINTAIN'
        ]
      ) AS privilege(name)
      WHERE pg_catalog.has_table_privilege(
        'authenticated', v_table_oid, privilege.name
      )
    ) OR EXISTS (
      SELECT 1
      FROM pg_catalog.unnest(
        ARRAY[
          'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES',
          'TRIGGER', 'MAINTAIN'
        ]
      ) AS privilege(name)
      WHERE pg_catalog.has_table_privilege('anon', v_table_oid, privilege.name)
    ) OR EXISTS (
      SELECT 1
      FROM pg_catalog.pg_class AS relation
      CROSS JOIN LATERAL pg_catalog.aclexplode(
        COALESCE(
          relation.relacl,
          pg_catalog.acldefault('r', relation.relowner)
        )
      ) AS acl
      WHERE relation.oid = v_table_oid
        AND acl.grantee = 0
    ) OR EXISTS (
      SELECT 1
      FROM pg_catalog.pg_attribute AS attribute
      CROSS JOIN pg_catalog.unnest(
        ARRAY['SELECT', 'INSERT', 'UPDATE', 'REFERENCES']
      ) AS privilege(name)
      WHERE attribute.attrelid = v_table_oid
        AND attribute.attnum > 0
        AND NOT attribute.attisdropped
        AND pg_catalog.has_column_privilege(
          'anon',
          v_table_oid,
          attribute.attname,
          privilege.name
        )
    ) OR EXISTS (
      SELECT 1
      FROM pg_catalog.pg_attribute AS attribute
      CROSS JOIN pg_catalog.unnest(
        ARRAY['INSERT', 'UPDATE', 'REFERENCES']
      ) AS privilege(name)
      WHERE attribute.attrelid = v_table_oid
        AND attribute.attnum > 0
        AND NOT attribute.attisdropped
        AND pg_catalog.has_column_privilege(
          'authenticated',
          v_table_oid,
          attribute.attname,
          privilege.name
        )
    ) OR EXISTS (
      SELECT 1
      FROM pg_catalog.pg_attribute AS attribute
      CROSS JOIN LATERAL pg_catalog.unnest(attribute.attacl) AS acl_item(value)
      CROSS JOIN LATERAL pg_catalog.aclexplode(ARRAY[acl_item.value]) AS acl
      WHERE attribute.attrelid = v_table_oid
        AND attribute.attnum > 0
        AND NOT attribute.attisdropped
        AND acl.grantee IN (0, v_anon_oid, v_authenticated_oid)
    ) THEN
      RAISE EXCEPTION 'Recovered surface table ACL postcondition failed: %',
        v_table_identity
        USING ERRCODE = '55000';
    END IF;
  END LOOP;

  FOR v_function IN
    SELECT *
    FROM (VALUES
      (
        'public.haversine_km(numeric,numeric,numeric,numeric)',
        false,
        ARRAY['search_path=pg_catalog']::text[],
        '8172081c6deab4ebcf1d9a85edc685341e57dfb125d9f81978f7398e3e65b713'
      ),
      (
        'public.clock_generate_qr(uuid,integer)',
        true,
        ARRAY['search_path=pg_catalog']::text[],
        '3094de600d25c253d3b24cf33db439390c541de98b084bbce4ded295ee99f821'
      ),
      (
        'public.clock_event(uuid,text,text,numeric,numeric,text,text,uuid)',
        true,
        ARRAY['search_path=pg_catalog']::text[],
        'c83fda46c23d69997d457b28737bc2dd94ab55f1ca3d4b282ce63f6acb608c4f'
      ),
      (
        'public.marketplace_submit_plugin(text,text,text,text,jsonb,text,text)',
        true,
        ARRAY['search_path=pg_catalog']::text[],
        '3c14a647272aa18045b6c08b79b31c4994e8e31da646b128c10d0302914202a2'
      ),
      (
        'public.marketplace_set_plugin_status(uuid,text)',
        true,
        ARRAY['search_path=pg_catalog']::text[],
        '5f41a3987681da3e56101d6c634c084cd204dea2b0c17bc59f5a3b83780713e2'
      ),
      (
        'public.marketplace_install_plugin(uuid,uuid,jsonb)',
        true,
        ARRAY['search_path=pg_catalog']::text[],
        '85d5db26dfa971df025af7a92a824c2aadcfd230ef7674d5c9ab9f2afdd31dc3'
      ),
      (
        'public.marketplace_uninstall_plugin(uuid)',
        true,
        ARRAY['search_path=pg_catalog']::text[],
        '413149bad9e87560a846ebbf8b3ec77ee4abe481462593de7972c1bc63e262c5'
      )
    ) AS expected(
      identity,
      authenticated_execute,
      function_config,
      source_hash
    )
  LOOP
    v_function_oid := v_function.identity::pg_catalog.regprocedure::oid;
    IF pg_catalog.has_function_privilege(
      'anon', v_function_oid, 'EXECUTE'
    ) OR pg_catalog.has_function_privilege(
      'authenticated', v_function_oid, 'EXECUTE'
    ) IS DISTINCT FROM v_function.authenticated_execute OR EXISTS (
      SELECT 1
      FROM pg_catalog.pg_proc AS procedure
      CROSS JOIN LATERAL pg_catalog.aclexplode(
        COALESCE(
          procedure.proacl,
          pg_catalog.acldefault('f', procedure.proowner)
        )
      ) AS acl
      WHERE procedure.oid = v_function_oid
        AND acl.grantee = 0
        AND acl.privilege_type = 'EXECUTE'
    ) OR NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_proc AS procedure
      WHERE procedure.oid = v_function_oid
        AND procedure.proconfig = v_function.function_config
        AND pg_catalog.encode(
          extensions.digest(
            pg_catalog.convert_to(
              pg_catalog.replace(
                pg_catalog.replace(
                  procedure.prosrc,
                  E'\r\n',
                  E'\n'
                ),
                E'\r',
                E'\n'
              ),
              'UTF8'
            ),
            'sha256'
          ),
          'hex'
        ) = v_function.source_hash
        AND (
          v_function.identity <> 'public.clock_generate_qr(uuid,integer)'
          OR (
            NOT procedure.proisstrict
            AND NOT procedure.proleakproof
            AND procedure.proparallel = 'u'
            AND procedure.procost = 100
            AND procedure.prorows = 0
            AND procedure.prosupport = 0
            AND procedure.pronargs = 2
            AND procedure.pronargdefaults = 1
            AND procedure.proallargtypes IS NULL
            AND procedure.proargmodes IS NULL
            AND procedure.proargnames = ARRAY[
              '_office_id', '_ttl_seconds'
            ]::text[]
            AND pg_catalog.pg_get_expr(
              procedure.proargdefaults,
              0
            ) = '60'
          )
        )
    ) THEN
      RAISE EXCEPTION 'Recovered surface routine ACL/search_path postcondition failed: %',
        v_function.identity
        USING ERRCODE = '55000';
    END IF;
  END LOOP;
END;
$recovered_surface_postcondition$;
