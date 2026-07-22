-- Read-only source inventory for the recovered clock/marketplace routines.
-- The output contains function source, never table data or credentials.

SELECT
  expected.identity AS object_identity,
  pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        pg_catalog.replace(
          pg_catalog.replace(procedure.prosrc, E'\r\n', E'\n'),
          E'\r',
          E'\n'
        ),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  ) AS source_sha256,
  procedure.proisstrict,
  procedure.proleakproof,
  procedure.proparallel,
  procedure.procost,
  procedure.prorows,
  procedure.prosupport,
  procedure.pronargs,
  procedure.pronargdefaults,
  procedure.proargtypes::text AS argument_type_oids,
  procedure.proallargtypes::text AS all_argument_type_oids,
  procedure.proargmodes,
  procedure.proargnames,
  pg_catalog.pg_get_expr(procedure.proargdefaults, 0) AS argument_defaults,
  pg_catalog.pg_get_function_arguments(procedure.oid) AS function_arguments,
  pg_catalog.pg_get_function_result(procedure.oid) AS function_result,
  procedure.prosrc
FROM (VALUES
  ('public.haversine_km(numeric,numeric,numeric,numeric)'),
  ('public.clock_generate_qr(uuid,integer)'),
  ('public.clock_event(uuid,text,text,numeric,numeric,text,text,uuid)'),
  ('public.marketplace_submit_plugin(text,text,text,text,jsonb,text,text)'),
  ('public.marketplace_set_plugin_status(uuid,text)'),
  ('public.marketplace_install_plugin(uuid,uuid,jsonb)'),
  ('public.marketplace_uninstall_plugin(uuid)')
) AS expected(identity)
LEFT JOIN pg_catalog.pg_proc AS procedure
  ON procedure.oid = pg_catalog.to_regprocedure(expected.identity)::oid
ORDER BY expected.identity;
