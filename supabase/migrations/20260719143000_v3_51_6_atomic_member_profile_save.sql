-- v3.51.6 - atomic, tenant-bound member profile saves.
--
-- The browser previously updated the membership, global profile and role
-- allocations in separate requests.  This RPC validates the complete desired
-- state first, serializes concurrent saves, commits every write with one audit
-- event, and lets PostgreSQL roll the whole statement back on any failure.

-- A differently named legacy binding to the same auth bootstrap function would
-- survive `DROP TRIGGER on_auth_user_created` and execute the profile INSERT a
-- second time. Refuse to delete an unknown trigger automatically: stop before
-- this migration mutates schema and require an operator to review its origin.
DO $auth_profile_bootstrap_extra_trigger_inventory$
DECLARE
  v_extra_trigger_count integer;
BEGIN
  IF pg_catalog.to_regprocedure('public.handle_new_user()') IS NULL THEN
    RETURN;
  END IF;

  SELECT pg_catalog.count(*)::integer
  INTO v_extra_trigger_count
  FROM pg_catalog.pg_trigger AS trigger_record
  WHERE trigger_record.tgrelid = 'auth.users'::pg_catalog.regclass
    AND trigger_record.tgfoid =
      'public.handle_new_user()'::pg_catalog.regprocedure
    AND trigger_record.tgname <> 'on_auth_user_created'
    AND NOT trigger_record.tgisinternal;

  IF v_extra_trigger_count > 0 THEN
    RAISE EXCEPTION
      'unexpected additional auth profile bootstrap trigger binding: % trigger(s)',
      v_extra_trigger_count
      USING ERRCODE = '55000';
  END IF;
END;
$auth_profile_bootstrap_extra_trigger_inventory$;

-- `enterprise_member_role_allocations` historically carried independent
-- foreign keys for workspace and membership, which allowed a valid membership
-- UUID from one workspace to be paired with another valid workspace UUID. Do
-- not rewrite such rows silently: inventory and stop so an operator can review
-- the affected tenant data before this forward-only constraint is installed.
DO $allocation_tenant_inventory$
DECLARE
  v_mismatch_count bigint;
BEGIN
  SELECT pg_catalog.count(*)
  INTO v_mismatch_count
  FROM public.enterprise_member_role_allocations AS allocation
  LEFT JOIN public.enterprise_memberships AS membership
    ON membership.id = allocation.membership_id
  WHERE membership.id IS NULL
     OR membership.workspace_id <> allocation.workspace_id;

  IF v_mismatch_count > 0 THEN
    RAISE EXCEPTION
      'member role allocation tenant integrity inventory failed: % mismatched row(s)',
      v_mismatch_count
      USING ERRCODE = '23503';
  END IF;
END;
$allocation_tenant_inventory$;

-- Do not normalize historical allocation labels silently. Inventory every row
-- before installing the lexical contract used by both the RPC and legacy
-- direct writers.
DO $allocation_role_lexical_inventory$
DECLARE
  v_invalid_count bigint;
BEGIN
  SELECT pg_catalog.count(*)
  INTO v_invalid_count
  FROM public.enterprise_member_role_allocations AS allocation
  WHERE allocation.business_role <> pg_catalog.btrim(allocation.business_role)
     OR pg_catalog.btrim(allocation.business_role) = ''
     OR pg_catalog.char_length(allocation.business_role) > 200
     OR allocation.business_role ~ '[[:cntrl:]]'
     OR allocation.business_role <>
       pg_catalog.normalize(allocation.business_role, 'NFKC');

  IF v_invalid_count > 0 THEN
    RAISE EXCEPTION
      'member role allocation lexical inventory failed: % invalid row(s)',
      v_invalid_count
      USING ERRCODE = '23514';
  END IF;
END;
$allocation_role_lexical_inventory$;

DO $allocation_role_duplicate_inventory$
DECLARE
  v_duplicate_group_count bigint;
BEGIN
  SELECT pg_catalog.count(*)
  INTO v_duplicate_group_count
  FROM (
    SELECT allocation.membership_id
    FROM public.enterprise_member_role_allocations AS allocation
    GROUP BY
      allocation.membership_id,
      pg_catalog.lower(
        pg_catalog.normalize(allocation.business_role, 'NFKC')
      )
    HAVING pg_catalog.count(*) > 1
  ) AS duplicate_group;

  IF v_duplicate_group_count > 0 THEN
    RAISE EXCEPTION
      'member role allocation canonical duplicate inventory failed: % duplicate group(s)',
      v_duplicate_group_count
      USING ERRCODE = '23505';
  END IF;
END;
$allocation_role_duplicate_inventory$;

DO $allocation_cardinality_inventory$
DECLARE
  v_oversized_membership_count bigint;
BEGIN
  SELECT pg_catalog.count(*)
  INTO v_oversized_membership_count
  FROM (
    SELECT allocation.membership_id
    FROM public.enterprise_member_role_allocations AS allocation
    GROUP BY allocation.membership_id
    HAVING pg_catalog.count(*) > 20
  ) AS oversized_membership;

  IF v_oversized_membership_count > 0 THEN
    RAISE EXCEPTION
      'member role allocation cardinality inventory failed: % membership(s) above 20',
      v_oversized_membership_count
      USING ERRCODE = '54000';
  END IF;
END;
$allocation_cardinality_inventory$;

DO $allocation_role_lexical_contract$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_record
    WHERE constraint_record.conrelid = 'public.enterprise_member_role_allocations'::pg_catalog.regclass
      AND constraint_record.conname = 'enterprise_member_role_allocations_business_role_lexical_check'
  ) THEN
    ALTER TABLE public.enterprise_member_role_allocations
      ADD CONSTRAINT enterprise_member_role_allocations_business_role_lexical_check
      CHECK (
        business_role = pg_catalog.btrim(business_role)
        AND pg_catalog.btrim(business_role) <> ''
        AND pg_catalog.char_length(business_role) <= 200
        AND business_role !~ '[[:cntrl:]]'
        AND business_role = pg_catalog.normalize(business_role, 'NFKC')
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_record
    WHERE constraint_record.conrelid = 'public.enterprise_member_role_allocations'::pg_catalog.regclass
      AND constraint_record.conname = 'enterprise_member_role_allocations_business_role_lexical_check'
      AND constraint_record.contype = 'c'
      AND pg_catalog.replace(
        pg_catalog.pg_get_expr(
          constraint_record.conbin,
          constraint_record.conrelid,
          true
        ),
        '"normalize"',
        'normalize'
      ) = 'business_role = btrim(business_role) AND btrim(business_role) <> ''''::text AND char_length(business_role) <= 200 AND business_role !~ ''[[:cntrl:]]''::text AND business_role = normalize(business_role, ''NFKC''::text)'
  ) THEN
    RAISE EXCEPTION 'member role allocation lexical constraint contract is incompatible'
      USING ERRCODE = '55000';
  END IF;

  ALTER TABLE public.enterprise_member_role_allocations
    VALIDATE CONSTRAINT enterprise_member_role_allocations_business_role_lexical_check;
END;
$allocation_role_lexical_contract$;

CREATE UNIQUE INDEX IF NOT EXISTS
  enterprise_member_role_allocations_canonical_role_unique
ON public.enterprise_member_role_allocations (
  membership_id,
  pg_catalog.lower(pg_catalog.normalize(business_role, 'NFKC'))
);

DO $allocation_role_unique_contract$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_index AS index_record
    WHERE index_record.indexrelid =
      'public.enterprise_member_role_allocations_canonical_role_unique'::pg_catalog.regclass
      AND index_record.indrelid =
        'public.enterprise_member_role_allocations'::pg_catalog.regclass
      AND index_record.indisunique
      AND index_record.indisvalid
      AND index_record.indisready
      AND index_record.indpred IS NULL
      AND index_record.indnkeyatts = 2
      AND index_record.indnatts = 2
      AND pg_catalog.pg_get_indexdef(index_record.indexrelid, 1, true) = 'membership_id'
      AND pg_catalog.replace(
        pg_catalog.pg_get_expr(index_record.indexprs, index_record.indrelid, true),
        '"normalize"',
        'normalize'
      ) = 'lower(normalize(business_role, ''NFKC''::text))'
  ) THEN
    RAISE EXCEPTION 'member role allocation canonical unique index contract is incompatible'
      USING ERRCODE = '55000';
  END IF;
END;
$allocation_role_unique_contract$;

-- The revision is an opaque optimistic-concurrency token. Existing memberships
-- start at zero; every protected committed mutation advances it monotonically.
ALTER TABLE public.enterprise_memberships
  ADD COLUMN IF NOT EXISTS profile_revision integer NOT NULL DEFAULT 0;

DO $member_profile_revision_contract$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute AS attribute
    JOIN pg_catalog.pg_attrdef AS default_record
      ON default_record.adrelid = attribute.attrelid
     AND default_record.adnum = attribute.attnum
    WHERE attribute.attrelid = 'public.enterprise_memberships'::pg_catalog.regclass
      AND attribute.attname = 'profile_revision'
      AND attribute.atttypid = 'pg_catalog.int4'::pg_catalog.regtype
      AND attribute.attnotnull
      AND NOT attribute.attisdropped
      AND pg_catalog.pg_get_expr(
        default_record.adbin,
        default_record.adrelid
      ) IN ('0', '0::integer')
  ) THEN
    RAISE EXCEPTION 'enterprise membership profile revision column contract is incompatible'
      USING ERRCODE = '55000';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.enterprise_memberships AS membership
    WHERE membership.profile_revision < 0
  ) THEN
    RAISE EXCEPTION 'enterprise membership profile revision inventory failed'
      USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_record
    WHERE constraint_record.conrelid = 'public.enterprise_memberships'::pg_catalog.regclass
      AND constraint_record.conname = 'enterprise_memberships_profile_revision_nonnegative_check'
  ) THEN
    ALTER TABLE public.enterprise_memberships
      ADD CONSTRAINT enterprise_memberships_profile_revision_nonnegative_check
      CHECK (profile_revision >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_record
    WHERE constraint_record.conrelid = 'public.enterprise_memberships'::pg_catalog.regclass
      AND constraint_record.conname = 'enterprise_memberships_profile_revision_nonnegative_check'
      AND constraint_record.contype = 'c'
      AND constraint_record.convalidated
      AND pg_catalog.pg_get_constraintdef(constraint_record.oid) =
        'CHECK ((profile_revision >= 0))'
  ) THEN
    ALTER TABLE public.enterprise_memberships
      VALIDATE CONSTRAINT enterprise_memberships_profile_revision_nonnegative_check;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_record
    WHERE constraint_record.conrelid = 'public.enterprise_memberships'::pg_catalog.regclass
      AND constraint_record.conname = 'enterprise_memberships_profile_revision_nonnegative_check'
      AND constraint_record.contype = 'c'
      AND constraint_record.convalidated
      AND pg_catalog.pg_get_constraintdef(constraint_record.oid) =
        'CHECK ((profile_revision >= 0))'
  ) THEN
    RAISE EXCEPTION 'enterprise membership profile revision check contract is incompatible'
      USING ERRCODE = '55000';
  END IF;
END;
$member_profile_revision_contract$;

-- The atomic editor already stores trimmed nullable member metadata. Preserve
-- historical values byte-for-byte during rollout: incompatible rows stop the
-- migration for operator review instead of being silently rewritten.
DO $membership_metadata_lexical_inventory$
DECLARE
  v_invalid_count bigint;
BEGIN
  SELECT pg_catalog.count(*)
  INTO v_invalid_count
  FROM public.enterprise_memberships AS membership
  WHERE (
      membership.business_role IS NOT NULL
      AND (
        membership.business_role <> pg_catalog.btrim(membership.business_role)
        OR pg_catalog.btrim(membership.business_role) = ''
        OR pg_catalog.char_length(membership.business_role) > 200
        OR membership.business_role ~ '[[:cntrl:]]'
        OR membership.business_role <>
          pg_catalog.normalize(membership.business_role, 'NFKC')
      )
    )
    OR (
      membership.location IS NOT NULL
      AND (
        membership.location <> pg_catalog.btrim(membership.location)
        OR pg_catalog.btrim(membership.location) = ''
        OR pg_catalog.char_length(membership.location) > 200
        OR membership.location ~ '[[:cntrl:]]'
      )
    )
    OR (
      membership.city IS NOT NULL
      AND (
        membership.city <> pg_catalog.btrim(membership.city)
        OR pg_catalog.btrim(membership.city) = ''
        OR pg_catalog.char_length(membership.city) > 200
        OR membership.city ~ '[[:cntrl:]]'
      )
    );

  IF v_invalid_count > 0 THEN
    RAISE EXCEPTION
      'member profile metadata lexical inventory failed: % invalid membership(s)',
      v_invalid_count
      USING ERRCODE = '23514';
  END IF;
END;
$membership_metadata_lexical_inventory$;

DO $membership_metadata_lexical_contract$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_record
    WHERE constraint_record.conrelid = 'public.enterprise_memberships'::pg_catalog.regclass
      AND constraint_record.conname = 'enterprise_memberships_profile_metadata_lexical_check'
  ) THEN
    ALTER TABLE public.enterprise_memberships
      ADD CONSTRAINT enterprise_memberships_profile_metadata_lexical_check
      CHECK (
        (
          business_role IS NULL
          OR (
            business_role = pg_catalog.btrim(business_role)
            AND pg_catalog.btrim(business_role) <> ''
            AND pg_catalog.char_length(business_role) <= 200
            AND business_role !~ '[[:cntrl:]]'
            AND business_role = pg_catalog.normalize(business_role, 'NFKC')
          )
        )
        AND (
          location IS NULL
          OR (
            location = pg_catalog.btrim(location)
            AND pg_catalog.btrim(location) <> ''
            AND pg_catalog.char_length(location) <= 200
            AND location !~ '[[:cntrl:]]'
          )
        )
        AND (
          city IS NULL
          OR (
            city = pg_catalog.btrim(city)
            AND pg_catalog.btrim(city) <> ''
            AND pg_catalog.char_length(city) <= 200
            AND city !~ '[[:cntrl:]]'
          )
        )
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_record
    WHERE constraint_record.conrelid = 'public.enterprise_memberships'::pg_catalog.regclass
      AND constraint_record.conname = 'enterprise_memberships_profile_metadata_lexical_check'
      AND constraint_record.contype = 'c'
      AND pg_catalog.replace(
        pg_catalog.pg_get_expr(
          constraint_record.conbin,
          constraint_record.conrelid,
          true
        ),
        '"normalize"',
        'normalize'
      ) = '(business_role IS NULL OR business_role = btrim(business_role) AND btrim(business_role) <> ''''::text AND char_length(business_role) <= 200 AND business_role !~ ''[[:cntrl:]]''::text AND business_role = normalize(business_role, ''NFKC''::text)) AND (location IS NULL OR location = btrim(location) AND btrim(location) <> ''''::text AND char_length(location) <= 200 AND location !~ ''[[:cntrl:]]''::text) AND (city IS NULL OR city = btrim(city) AND btrim(city) <> ''''::text AND char_length(city) <= 200 AND city !~ ''[[:cntrl:]]''::text)'
  ) THEN
    RAISE EXCEPTION 'member profile metadata lexical constraint contract is incompatible'
      USING ERRCODE = '55000';
  END IF;

  ALTER TABLE public.enterprise_memberships
    VALIDATE CONSTRAINT enterprise_memberships_profile_metadata_lexical_check;
END;
$membership_metadata_lexical_contract$;

-- A membership office is tenant-owned metadata. The historical single-column
-- FK guaranteed that the UUID existed but did not correlate it to the member's
-- workspace. Inventory first, then add a composite relationship while keeping
-- the existing ON DELETE SET NULL behavior limited to office_id.
DO $membership_office_tenant_inventory$
DECLARE
  v_mismatch_count bigint;
BEGIN
  SELECT pg_catalog.count(*)
  INTO v_mismatch_count
  FROM public.enterprise_memberships AS membership
  LEFT JOIN public.enterprise_offices AS office
    ON office.id = membership.office_id
   AND office.workspace_id = membership.workspace_id
  WHERE membership.office_id IS NOT NULL
    AND office.id IS NULL;

  IF v_mismatch_count > 0 THEN
    RAISE EXCEPTION
      'member office tenant integrity inventory failed: % mismatched membership(s)',
      v_mismatch_count
      USING ERRCODE = '23503';
  END IF;
END;
$membership_office_tenant_inventory$;

DO $office_workspace_key$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_record
    WHERE constraint_record.conrelid = 'public.enterprise_offices'::pg_catalog.regclass
      AND constraint_record.conname = 'enterprise_offices_id_workspace_key'
  ) THEN
    ALTER TABLE public.enterprise_offices
      ADD CONSTRAINT enterprise_offices_id_workspace_key
      UNIQUE (id, workspace_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_record
    WHERE constraint_record.conrelid = 'public.enterprise_offices'::pg_catalog.regclass
      AND constraint_record.conname = 'enterprise_offices_id_workspace_key'
      AND constraint_record.contype = 'u'
      AND constraint_record.convalidated
      AND ARRAY(
        SELECT attribute.attname::text
        FROM pg_catalog.unnest(constraint_record.conkey) WITH ORDINALITY AS key_column(attnum, ordinal)
        JOIN pg_catalog.pg_attribute AS attribute
          ON attribute.attrelid = constraint_record.conrelid
         AND attribute.attnum = key_column.attnum
        ORDER BY key_column.ordinal
      ) = ARRAY['id', 'workspace_id']::text[]
  ) THEN
    RAISE EXCEPTION 'enterprise office workspace key contract is incompatible'
      USING ERRCODE = '55000';
  END IF;
END;
$office_workspace_key$;

DO $membership_office_workspace_fk$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_record
    WHERE constraint_record.conrelid = 'public.enterprise_memberships'::pg_catalog.regclass
      AND constraint_record.conname = 'enterprise_memberships_office_workspace_fkey'
  ) THEN
    ALTER TABLE public.enterprise_memberships
      ADD CONSTRAINT enterprise_memberships_office_workspace_fkey
      FOREIGN KEY (office_id, workspace_id)
      REFERENCES public.enterprise_offices(id, workspace_id)
      ON DELETE SET NULL (office_id)
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_record
    WHERE constraint_record.conrelid = 'public.enterprise_memberships'::pg_catalog.regclass
      AND constraint_record.confrelid = 'public.enterprise_offices'::pg_catalog.regclass
      AND constraint_record.conname = 'enterprise_memberships_office_workspace_fkey'
      AND constraint_record.contype = 'f'
      AND constraint_record.convalidated IN (true, false)
      AND constraint_record.confdeltype = 'n'
      AND ARRAY(
        SELECT attribute.attname::text
        FROM pg_catalog.unnest(constraint_record.conkey) WITH ORDINALITY AS key_column(attnum, ordinal)
        JOIN pg_catalog.pg_attribute AS attribute
          ON attribute.attrelid = constraint_record.conrelid
         AND attribute.attnum = key_column.attnum
        ORDER BY key_column.ordinal
      ) = ARRAY['office_id', 'workspace_id']::text[]
      AND ARRAY(
        SELECT attribute.attname::text
        FROM pg_catalog.unnest(constraint_record.confkey) WITH ORDINALITY AS key_column(attnum, ordinal)
        JOIN pg_catalog.pg_attribute AS attribute
          ON attribute.attrelid = constraint_record.confrelid
         AND attribute.attnum = key_column.attnum
        ORDER BY key_column.ordinal
      ) = ARRAY['id', 'workspace_id']::text[]
      AND ARRAY(
        SELECT attribute.attname::text
        FROM pg_catalog.unnest(constraint_record.confdelsetcols) WITH ORDINALITY AS set_column(attnum, ordinal)
        JOIN pg_catalog.pg_attribute AS attribute
          ON attribute.attrelid = constraint_record.conrelid
         AND attribute.attnum = set_column.attnum
        ORDER BY set_column.ordinal
      ) = ARRAY['office_id']::text[]
  ) THEN
    RAISE EXCEPTION 'member office tenant foreign key contract is incompatible'
      USING ERRCODE = '55000';
  END IF;

  ALTER TABLE public.enterprise_memberships
    VALIDATE CONSTRAINT enterprise_memberships_office_workspace_fkey;
END;
$membership_office_workspace_fk$;

CREATE SCHEMA IF NOT EXISTS effectime_private;
REVOKE ALL ON SCHEMA effectime_private FROM PUBLIC, anon, authenticated;

-- Mirrors ECMAScript String.prototype.trim exactly for the whitespace code
-- points accepted by JSON/UTF-8. Keeping this in one immutable function avoids
-- browser, Edge and trigger paths silently disagreeing on canonical values.
CREATE OR REPLACE FUNCTION effectime_private.canonicalize_profile_display_name_v1(
  p_value text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
RETURNS NULL ON NULL INPUT
SET search_path = pg_catalog
AS $canonicalize_profile_display_name$
  SELECT pg_catalog.btrim(
    p_value,
    pg_catalog.chr(9)
      || pg_catalog.chr(10)
      || pg_catalog.chr(11)
      || pg_catalog.chr(12)
      || pg_catalog.chr(13)
      || pg_catalog.chr(32)
      || pg_catalog.chr(160)
      || pg_catalog.chr(5760)
      || pg_catalog.chr(8192)
      || pg_catalog.chr(8193)
      || pg_catalog.chr(8194)
      || pg_catalog.chr(8195)
      || pg_catalog.chr(8196)
      || pg_catalog.chr(8197)
      || pg_catalog.chr(8198)
      || pg_catalog.chr(8199)
      || pg_catalog.chr(8200)
      || pg_catalog.chr(8201)
      || pg_catalog.chr(8202)
      || pg_catalog.chr(8232)
      || pg_catalog.chr(8233)
      || pg_catalog.chr(8239)
      || pg_catalog.chr(8287)
      || pg_catalog.chr(12288)
      || pg_catalog.chr(65279)
  );
$canonicalize_profile_display_name$;

ALTER FUNCTION effectime_private.canonicalize_profile_display_name_v1(text)
  OWNER TO postgres;
REVOKE ALL ON FUNCTION effectime_private.canonicalize_profile_display_name_v1(text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION effectime_private.canonicalize_profile_display_name_v1(text)
  TO authenticated, service_role;

-- Display names are nullable for profile bootstrap, but every populated value
-- exposed to the member editor must obey the same v1 rename contract. Existing
-- incompatible values stop rollout; INSERT/UPDATE never receive silent trim.
DO $profile_display_name_lexical_inventory$
DECLARE
  v_invalid_count bigint;
BEGIN
  SELECT pg_catalog.count(*)
  INTO v_invalid_count
  FROM public.profiles AS profile
  WHERE profile.display_name IS NOT NULL
    AND (
      profile.display_name <>
        effectime_private.canonicalize_profile_display_name_v1(profile.display_name)
      OR effectime_private.canonicalize_profile_display_name_v1(profile.display_name) = ''
      OR pg_catalog.char_length(profile.display_name) > 200
      OR profile.display_name ~ '[[:cntrl:]]'
    );

  IF v_invalid_count > 0 THEN
    RAISE EXCEPTION
      'profile display name lexical inventory failed: % invalid profile(s)',
      v_invalid_count
      USING ERRCODE = '23514';
  END IF;
END;
$profile_display_name_lexical_inventory$;

DO $profile_display_name_lexical_contract$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_record
    WHERE constraint_record.conrelid = 'public.profiles'::pg_catalog.regclass
      AND constraint_record.conname = 'profiles_display_name_lexical_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_display_name_lexical_check
      CHECK (
        display_name IS NULL
        OR (
          display_name =
            effectime_private.canonicalize_profile_display_name_v1(display_name)
          AND effectime_private.canonicalize_profile_display_name_v1(display_name) <> ''
          AND pg_catalog.char_length(display_name) <= 200
          AND display_name !~ '[[:cntrl:]]'
        )
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_record
    WHERE constraint_record.conrelid = 'public.profiles'::pg_catalog.regclass
      AND constraint_record.conname = 'profiles_display_name_lexical_check'
      AND constraint_record.contype = 'c'
      AND pg_catalog.pg_get_expr(
        constraint_record.conbin,
        constraint_record.conrelid,
        true
      ) = 'display_name IS NULL OR display_name = effectime_private.canonicalize_profile_display_name_v1(display_name) AND effectime_private.canonicalize_profile_display_name_v1(display_name) <> ''''::text AND char_length(display_name) <= 200 AND display_name !~ ''[[:cntrl:]]''::text'
  ) THEN
    RAISE EXCEPTION 'profile display name lexical constraint contract is incompatible'
      USING ERRCODE = '55000';
  END IF;

  ALTER TABLE public.profiles
    VALIDATE CONSTRAINT profiles_display_name_lexical_check;
END;
$profile_display_name_lexical_contract$;

-- Keep the auth bootstrap path inside the same global display-name contract.
-- Explicitly supplied malformed metadata fails closed; absent/null metadata may
-- use a canonical email candidate, or NULL when the email itself is outside the
-- bounded profile-display contract. This preserves OAuth bootstrap without
-- allowing the SECURITY DEFINER trigger to bypass the profiles CHECK.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $handle_new_user$
DECLARE
  v_display_name_json jsonb;
  v_display_name text;
BEGIN
  v_display_name_json := NEW.raw_user_meta_data -> 'display_name';

  IF v_display_name_json IS NOT NULL
     AND pg_catalog.jsonb_typeof(v_display_name_json) <> 'null' THEN
    IF pg_catalog.jsonb_typeof(v_display_name_json) <> 'string' THEN
      RAISE EXCEPTION 'invalid display name metadata'
        USING ERRCODE = '22023';
    END IF;

    v_display_name := effectime_private.canonicalize_profile_display_name_v1(
      NEW.raw_user_meta_data ->> 'display_name'
    );
    IF v_display_name = ''
       OR pg_catalog.char_length(v_display_name) > 200
       OR v_display_name ~ '[[:cntrl:]]' THEN
      RAISE EXCEPTION 'invalid display name metadata'
        USING ERRCODE = '22023';
    END IF;
  ELSE
    v_display_name := effectime_private.canonicalize_profile_display_name_v1(NEW.email);
    IF v_display_name IS NULL
       OR v_display_name = ''
       OR pg_catalog.char_length(v_display_name) > 200
       OR v_display_name ~ '[[:cntrl:]]' THEN
      v_display_name := NULL;
    END IF;
  END IF;

  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, v_display_name);
  RETURN NEW;
END;
$handle_new_user$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.handle_new_user()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DO $auth_profile_bootstrap_trigger_contract$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger AS trigger_record
    WHERE trigger_record.tgrelid = 'auth.users'::pg_catalog.regclass
      AND trigger_record.tgname = 'on_auth_user_created'
      AND trigger_record.tgfoid =
        'public.handle_new_user()'::pg_catalog.regprocedure
      AND trigger_record.tgtype = 5
      AND trigger_record.tgenabled = 'O'
      AND NOT trigger_record.tgisinternal
      AND (
        SELECT pg_catalog.count(*)
        FROM pg_catalog.pg_trigger AS bootstrap_trigger
        WHERE bootstrap_trigger.tgrelid = 'auth.users'::pg_catalog.regclass
          AND bootstrap_trigger.tgfoid =
            'public.handle_new_user()'::pg_catalog.regprocedure
          AND NOT bootstrap_trigger.tgisinternal
      ) = 1
  ) THEN
    RAISE EXCEPTION 'auth profile bootstrap trigger contract is incompatible'
      USING ERRCODE = '55000';
  END IF;
END;
$auth_profile_bootstrap_trigger_contract$;

DO $membership_workspace_key$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_record
    WHERE constraint_record.conrelid = 'public.enterprise_memberships'::pg_catalog.regclass
      AND constraint_record.conname = 'enterprise_memberships_id_workspace_key'
  ) THEN
    ALTER TABLE public.enterprise_memberships
      ADD CONSTRAINT enterprise_memberships_id_workspace_key
      UNIQUE (id, workspace_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_record
    WHERE constraint_record.conrelid = 'public.enterprise_memberships'::pg_catalog.regclass
      AND constraint_record.conname = 'enterprise_memberships_id_workspace_key'
      AND constraint_record.contype = 'u'
      AND ARRAY(
        SELECT attribute.attname::text
        FROM pg_catalog.unnest(constraint_record.conkey) WITH ORDINALITY AS key_column(attnum, ordinal)
        JOIN pg_catalog.pg_attribute AS attribute
          ON attribute.attrelid = constraint_record.conrelid
         AND attribute.attnum = key_column.attnum
        ORDER BY key_column.ordinal
      ) = ARRAY['id', 'workspace_id']::text[]
  ) THEN
    RAISE EXCEPTION 'enterprise membership workspace key contract is incompatible'
      USING ERRCODE = '55000';
  END IF;
END;
$membership_workspace_key$;

DO $allocation_membership_workspace_fk$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_record
    WHERE constraint_record.conrelid = 'public.enterprise_member_role_allocations'::pg_catalog.regclass
      AND constraint_record.conname = 'enterprise_member_role_allocations_membership_workspace_fkey'
  ) THEN
    ALTER TABLE public.enterprise_member_role_allocations
      ADD CONSTRAINT enterprise_member_role_allocations_membership_workspace_fkey
      FOREIGN KEY (membership_id, workspace_id)
      REFERENCES public.enterprise_memberships(id, workspace_id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_record
    WHERE constraint_record.conrelid = 'public.enterprise_member_role_allocations'::pg_catalog.regclass
      AND constraint_record.confrelid = 'public.enterprise_memberships'::pg_catalog.regclass
      AND constraint_record.conname = 'enterprise_member_role_allocations_membership_workspace_fkey'
      AND constraint_record.contype = 'f'
      AND constraint_record.confdeltype = 'c'
      AND ARRAY(
        SELECT attribute.attname::text
        FROM pg_catalog.unnest(constraint_record.conkey) WITH ORDINALITY AS key_column(attnum, ordinal)
        JOIN pg_catalog.pg_attribute AS attribute
          ON attribute.attrelid = constraint_record.conrelid
         AND attribute.attnum = key_column.attnum
        ORDER BY key_column.ordinal
      ) = ARRAY['membership_id', 'workspace_id']::text[]
      AND ARRAY(
        SELECT attribute.attname::text
        FROM pg_catalog.unnest(constraint_record.confkey) WITH ORDINALITY AS key_column(attnum, ordinal)
        JOIN pg_catalog.pg_attribute AS attribute
          ON attribute.attrelid = constraint_record.confrelid
         AND attribute.attnum = key_column.attnum
        ORDER BY key_column.ordinal
      ) = ARRAY['id', 'workspace_id']::text[]
  ) THEN
    RAISE EXCEPTION 'member role allocation tenant foreign key contract is incompatible'
      USING ERRCODE = '55000';
  END IF;

  ALTER TABLE public.enterprise_member_role_allocations
    VALIDATE CONSTRAINT enterprise_member_role_allocations_membership_workspace_fkey;
END;
$allocation_membership_workspace_fk$;

-- Keep legacy authorized direct writers compatible while intersecting every
-- authenticated allocation mutation with the same permission and entitlement
-- contract as the atomic RPC. Restrictive policies cannot be bypassed by the
-- older permissive owner/resource-assistant policies.
ALTER TABLE public.enterprise_member_role_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Role allocations members edit insert guard"
  ON public.enterprise_member_role_allocations;
CREATE POLICY "Role allocations members edit insert guard"
  ON public.enterprise_member_role_allocations
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    COALESCE(
      public.has_workspace_permission(
        workspace_id,
        auth.uid(),
        'members',
        'edit'
      ),
      false
    )
    AND COALESCE(
      public.workspace_has_any_feature(
        workspace_id,
        ARRAY['members_list']::text[]
      ),
      false
    )
  );

DROP POLICY IF EXISTS "Role allocations members edit update guard"
  ON public.enterprise_member_role_allocations;
CREATE POLICY "Role allocations members edit update guard"
  ON public.enterprise_member_role_allocations
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (
    COALESCE(
      public.has_workspace_permission(
        workspace_id,
        auth.uid(),
        'members',
        'edit'
      ),
      false
    )
    AND COALESCE(
      public.workspace_has_any_feature(
        workspace_id,
        ARRAY['members_list']::text[]
      ),
      false
    )
  )
  WITH CHECK (
    COALESCE(
      public.has_workspace_permission(
        workspace_id,
        auth.uid(),
        'members',
        'edit'
      ),
      false
    )
    AND COALESCE(
      public.workspace_has_any_feature(
        workspace_id,
        ARRAY['members_list']::text[]
      ),
      false
    )
  );

DROP POLICY IF EXISTS "Role allocations members edit delete guard"
  ON public.enterprise_member_role_allocations;
CREATE POLICY "Role allocations members edit delete guard"
  ON public.enterprise_member_role_allocations
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (
    COALESCE(
      public.has_workspace_permission(
        workspace_id,
        auth.uid(),
        'members',
        'edit'
      ),
      false
    )
    AND COALESCE(
      public.workspace_has_any_feature(
        workspace_id,
        ARRAY['members_list']::text[]
      ),
      false
    )
  );

-- The historical membership UPDATE policy is role-based and can be broader
-- than a custom permission matrix. Guard only the fields owned by the member
-- profile editor; unrelated membership workflows keep their existing behavior.
CREATE OR REPLACE FUNCTION public.guard_workspace_member_profile_metadata_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_protected_metadata_changed boolean :=
    NEW.business_role IS DISTINCT FROM OLD.business_role
    OR NEW.location IS DISTINCT FROM OLD.location
    OR NEW.city IS DISTINCT FROM OLD.city
    OR NEW.office_id IS DISTINCT FROM OLD.office_id
    OR NEW.base_working_hours IS DISTINCT FROM OLD.base_working_hours;
BEGIN
  -- Runtime callers cannot forge or rewind the optimistic-concurrency token.
  -- Trusted migration-owned routines may advance it by exactly one.
  IF NEW.profile_revision IS DISTINCT FROM OLD.profile_revision THEN
    IF current_user IN ('anon', 'authenticated', 'service_role') THEN
      RAISE EXCEPTION 'Profile revision is server managed' USING ERRCODE = '42501';
    END IF;

    IF OLD.profile_revision = 2147483647
       OR NEW.profile_revision <> OLD.profile_revision + 1 THEN
      RAISE EXCEPTION 'Invalid profile revision transition' USING ERRCODE = '22003';
    END IF;
  END IF;

  IF current_user = 'authenticated'
     AND v_protected_metadata_changed
     AND (
       NOT COALESCE(
         public.has_workspace_permission(
           NEW.workspace_id,
           auth.uid(),
           'members',
           'edit'
         ),
         false
       )
       OR NOT COALESCE(
         public.workspace_has_any_feature(
           NEW.workspace_id,
           ARRAY['members_list']::text[]
         ),
         false
       )
     ) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  IF v_protected_metadata_changed
     AND NEW.profile_revision IS NOT DISTINCT FROM OLD.profile_revision THEN
    IF OLD.profile_revision = 2147483647 THEN
      RAISE EXCEPTION 'Profile revision exhausted' USING ERRCODE = '22003';
    END IF;
    NEW.profile_revision := OLD.profile_revision + 1;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS guard_workspace_member_profile_metadata_update
  ON public.enterprise_memberships;
CREATE TRIGGER guard_workspace_member_profile_metadata_update
  BEFORE UPDATE OF business_role, location, city, office_id, base_working_hours,
    profile_revision
  ON public.enterprise_memberships
  FOR EACH ROW EXECUTE FUNCTION public.guard_workspace_member_profile_metadata_update();

-- Legacy allocation writers remain supported. The BEFORE trigger advances the
-- parent revision before the row/index mutation itself; PostgreSQL can already
-- hold the candidate allocation tuple for UPDATE/DELETE at trigger entry. A
-- mixed legacy writer and parent-first atomic RPC may therefore be resolved by
-- PostgreSQL's deadlock detector (40P01); both paths are transactional and the
-- client treats that bounded abort as a reload/retry conflict. Identity moves
-- remain unsupported; callers must delete and insert in one transaction.
CREATE OR REPLACE FUNCTION public.bump_workspace_member_profile_revision_from_allocation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_membership_id uuid;
  v_workspace_id uuid;
  v_profile_revision integer;
  v_existing_allocation_count integer;
BEGIN
  IF TG_OP = 'UPDATE'
     AND (
       NEW.membership_id IS DISTINCT FROM OLD.membership_id
       OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
     ) THEN
    RAISE EXCEPTION 'Allocation identity moves are not supported'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.business_role IS NOT DISTINCT FROM OLD.business_role
     AND NEW.percentage IS NOT DISTINCT FROM OLD.percentage
     AND NEW.is_priority IS NOT DISTINCT FROM OLD.is_priority THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_membership_id := OLD.membership_id;
    v_workspace_id := OLD.workspace_id;
  ELSE
    v_membership_id := NEW.membership_id;
    v_workspace_id := NEW.workspace_id;
  END IF;

  UPDATE public.enterprise_memberships AS membership
  SET profile_revision = membership.profile_revision + 1
  WHERE membership.id = v_membership_id
    AND membership.workspace_id = v_workspace_id
    AND membership.profile_revision < 2147483647
  RETURNING membership.profile_revision INTO v_profile_revision;

  IF NOT FOUND AND EXISTS (
    SELECT 1
    FROM public.enterprise_memberships AS membership
    WHERE membership.id = v_membership_id
      AND membership.workspace_id = v_workspace_id
  ) THEN
    RAISE EXCEPTION 'Profile revision exhausted' USING ERRCODE = '22003';
  ELSIF NOT FOUND AND TG_OP <> 'DELETE' THEN
    RAISE EXCEPTION 'Allocation parent membership is missing'
      USING ERRCODE = '23503';
  END IF;

  -- The parent UPDATE above is also the per-membership cardinality lock. Two
  -- concurrent legacy INSERTs therefore cannot both observe the twentieth
  -- slot as available. The exception rolls the revision advance back with the
  -- rejected statement.
  IF TG_OP = 'INSERT' AND v_profile_revision IS NOT NULL THEN
    SELECT pg_catalog.count(*)::integer
    INTO v_existing_allocation_count
    FROM public.enterprise_member_role_allocations AS allocation
    WHERE allocation.membership_id = v_membership_id
      AND allocation.workspace_id = v_workspace_id;

    IF v_existing_allocation_count >= 20 THEN
      RAISE EXCEPTION 'Member role allocation limit exceeded'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS bump_workspace_member_profile_revision_from_allocation
  ON public.enterprise_member_role_allocations;
CREATE TRIGGER bump_workspace_member_profile_revision_from_allocation
  BEFORE INSERT OR UPDATE OR DELETE ON public.enterprise_member_role_allocations
  FOR EACH ROW EXECUTE FUNCTION public.bump_workspace_member_profile_revision_from_allocation();

REVOKE TRUNCATE ON TABLE public.enterprise_member_role_allocations
  FROM PUBLIC, anon, authenticated, service_role;

-- Ordinary members can insert arbitrary audit action strings through the
-- historical browser policy. Reserve this action for the definer-owned atomic
-- transition, including UPDATE/DELETE attempts and service-role RLS bypass.
CREATE OR REPLACE FUNCTION public.workspace_parent_exists_for_cascade_guard(
  p_workspace_id uuid
)
RETURNS boolean
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.enterprise_workspaces AS workspace
    WHERE workspace.id = p_workspace_id
  );
$function$;

CREATE OR REPLACE FUNCTION public.guard_member_profile_save_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_reserved_action constant text := 'membership.profile_updated';
BEGIN
  IF current_user IN ('anon', 'authenticated', 'service_role') THEN
    IF (TG_OP = 'INSERT' AND NEW.action = v_reserved_action)
       OR (TG_OP = 'UPDATE' AND (
         OLD.action = v_reserved_action OR NEW.action = v_reserved_action
       )) THEN
      RAISE EXCEPTION 'Member profile save audit events require the atomic RPC'
        USING ERRCODE = '42501';
    END IF;

    -- A real ON DELETE CASCADE reaches this child trigger after the parent
    -- workspace is no longer visible to the deleting statement. A direct child
    -- DELETE still has its referenced parent and remains forbidden for both
    -- authenticated and service-role callers.
    IF TG_OP = 'DELETE'
       AND OLD.action = v_reserved_action
       AND public.workspace_parent_exists_for_cascade_guard(OLD.workspace_id) THEN
      RAISE EXCEPTION 'Member profile save audit events require the atomic RPC'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS guard_member_profile_save_audit_mutation
  ON public.enterprise_audit_events;
CREATE TRIGGER guard_member_profile_save_audit_mutation
  BEFORE INSERT OR UPDATE OR DELETE ON public.enterprise_audit_events
  FOR EACH ROW EXECUTE FUNCTION public.guard_member_profile_save_audit_mutation();

-- Repair the same lifecycle interaction for the two reserved-action guards
-- installed by earlier releases. INSERT/UPDATE and direct child DELETE remain
-- denied; only an actual parent workspace cascade observes a missing parent.
CREATE OR REPLACE FUNCTION public.guard_admin_leave_override_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_reserved_action constant text := 'leave_request.admin_override';
BEGIN
  IF current_user IN ('anon', 'authenticated', 'service_role') THEN
    IF (TG_OP = 'INSERT' AND NEW.action = v_reserved_action)
       OR (TG_OP = 'UPDATE' AND (
         OLD.action = v_reserved_action OR NEW.action = v_reserved_action
       ))
       OR (
         TG_OP = 'DELETE'
         AND OLD.action = v_reserved_action
         AND public.workspace_parent_exists_for_cascade_guard(OLD.workspace_id)
       ) THEN
      RAISE EXCEPTION 'Admin leave override audit events can only be written by the atomic override workflow'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS guard_admin_leave_override_audit_mutation
  ON public.enterprise_audit_events;
CREATE TRIGGER guard_admin_leave_override_audit_mutation
  BEFORE INSERT OR UPDATE OR DELETE ON public.enterprise_audit_events
  FOR EACH ROW EXECUTE FUNCTION public.guard_admin_leave_override_audit_mutation();

CREATE OR REPLACE FUNCTION public.guard_payroll_transition_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_reserved_actions constant text[] := ARRAY[
    'payroll.period_locked',
    'payroll.period_exported',
    'payroll.period_reopened_break_glass'
  ];
BEGIN
  IF current_user IN ('anon', 'authenticated', 'service_role') THEN
    IF (TG_OP = 'INSERT' AND NEW.action = ANY (v_reserved_actions))
       OR (TG_OP = 'UPDATE' AND (
         OLD.action = ANY (v_reserved_actions)
         OR NEW.action = ANY (v_reserved_actions)
       ))
       OR (
         TG_OP = 'DELETE'
         AND OLD.action = ANY (v_reserved_actions)
         AND public.workspace_parent_exists_for_cascade_guard(OLD.workspace_id)
       ) THEN
      RAISE EXCEPTION 'Payroll transition audit events can only be written by an atomic transition'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS guard_payroll_transition_audit_mutation
  ON public.enterprise_audit_events;
CREATE TRIGGER guard_payroll_transition_audit_mutation
  BEFORE INSERT OR UPDATE OR DELETE ON public.enterprise_audit_events
  FOR EACH ROW EXECUTE FUNCTION public.guard_payroll_transition_audit_mutation();

-- Locked/exported payroll rows are immutable to direct runtime callers, but a
-- parent workspace deletion must still be able to execute the declared FK
-- cascade. Preserve every existing insert/update invariant and narrow only the
-- DELETE exception to the RLS-independent missing-parent proof above.
CREATE OR REPLACE FUNCTION public.guard_payroll_period_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_is_direct_role boolean := current_user IN ('anon', 'authenticated', 'service_role');
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'open'
       OR NEW.calculation_snapshot IS NOT NULL
       OR NEW.calculation_hash IS NOT NULL
       OR NEW.calculation_version IS NOT NULL
       OR NEW.locked_by IS NOT NULL
       OR NEW.locked_at IS NOT NULL
       OR NEW.exported_at IS NOT NULL
       OR NEW.exported_to IS NOT NULL THEN
      RAISE EXCEPTION 'New payroll periods must be created in open state without protected metadata'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF v_is_direct_role
       AND OLD.status IN ('locked', 'exported')
       AND public.workspace_parent_exists_for_cascade_guard(OLD.workspace_id) THEN
      RAISE EXCEPTION 'Locked payroll periods are immutable' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  IF current_user = 'service_role' THEN
    RAISE EXCEPTION 'service_role payroll updates require an audited transition RPC'
      USING ERRCODE = '42501';
  END IF;

  IF v_is_direct_role AND OLD.status IN ('locked', 'exported') THEN
    RAISE EXCEPTION 'Locked payroll periods are immutable' USING ERRCODE = '42501';
  END IF;

  IF v_is_direct_role AND (
    NEW.status IS DISTINCT FROM OLD.status
    OR NEW.calculation_snapshot IS DISTINCT FROM OLD.calculation_snapshot
    OR NEW.calculation_hash IS DISTINCT FROM OLD.calculation_hash
    OR NEW.calculation_version IS DISTINCT FROM OLD.calculation_version
    OR NEW.locked_by IS DISTINCT FROM OLD.locked_by
    OR NEW.locked_at IS DISTINCT FROM OLD.locked_at
    OR NEW.exported_at IS DISTINCT FROM OLD.exported_at
    OR NEW.exported_to IS DISTINCT FROM OLD.exported_to
  ) THEN
    RAISE EXCEPTION 'Payroll protected state can only be changed by an atomic transition'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.status = 'open' AND (
    NEW.calculation_snapshot IS NOT NULL
    OR NEW.calculation_hash IS NOT NULL
    OR NEW.calculation_version IS NOT NULL
    OR NEW.locked_by IS NOT NULL
    OR NEW.locked_at IS NOT NULL
    OR NEW.exported_at IS NOT NULL
    OR NEW.exported_to IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Open payroll periods cannot contain protected state'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.calculation_snapshot IS NULL
     OR NEW.calculation_hash IS NULL
     OR NEW.calculation_version IS NULL THEN
    IF NEW.status IN ('locked', 'exported') THEN
      RAISE EXCEPTION 'New payroll locks require a complete calculation snapshot'
        USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.status NOT IN ('locked', 'exported')
        OR NEW.calculation_hash !~ '^[0-9a-f]{64}$'
        OR NEW.calculation_version <> 1 THEN
    RAISE EXCEPTION 'Payroll calculation snapshot metadata is invalid'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS guard_payroll_period_mutation ON public.payroll_periods;
CREATE TRIGGER guard_payroll_period_mutation
  BEFORE INSERT OR UPDATE OR DELETE ON public.payroll_periods
  FOR EACH ROW EXECUTE FUNCTION public.guard_payroll_period_mutation();

REVOKE TRUNCATE ON TABLE public.enterprise_audit_events
  FROM PUBLIC, anon, authenticated, service_role;

-- Preserve the v3.51.5 self-only rename signature while bringing legacy callers
-- into the same revision/advisory-lock domain as the atomic editor. A true
-- no-op keeps the revision stable; a committed name change advances it once.
CREATE OR REPLACE FUNCTION public.update_my_workspace_profile_display_name_v1(
  p_workspace_id uuid,
  p_membership_id uuid,
  p_display_name text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
SET lock_timeout = '5s'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_target_user_id uuid;
  v_display_name text :=
    effectime_private.canonicalize_profile_display_name_v1(p_display_name);
  v_current_display_name text;
  v_profile_revision integer;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  IF p_workspace_id IS NULL OR p_membership_id IS NULL THEN
    RAISE EXCEPTION 'Workspace and membership are required' USING ERRCODE = '22023';
  END IF;
  IF v_display_name IS NULL
     OR v_display_name = ''
     OR pg_catalog.char_length(v_display_name) > 200
     OR v_display_name ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'Invalid display name' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_workspace_id::text || ':' || p_membership_id::text,
      734554
    )
  );

  SELECT membership.user_id
  INTO v_target_user_id
  FROM public.enterprise_memberships AS membership
  WHERE membership.id = p_membership_id
    AND membership.workspace_id = p_workspace_id
    AND membership.status = 'active'::public.enterprise_membership_status
  FOR UPDATE;

  IF v_target_user_id IS NULL OR v_target_user_id <> v_actor THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT profile.display_name
  INTO v_current_display_name
  FROM public.profiles AS profile
  WHERE profile.user_id = v_target_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile missing' USING ERRCODE = 'P0002';
  END IF;

  IF v_current_display_name IS DISTINCT FROM v_display_name THEN
    UPDATE public.profiles AS profile
    SET display_name = v_display_name
    WHERE profile.user_id = v_target_user_id;

    UPDATE public.enterprise_memberships AS membership
    SET profile_revision = membership.profile_revision + 1
    WHERE membership.id = p_membership_id
      AND membership.workspace_id = p_workspace_id
      AND membership.profile_revision < 2147483647
    RETURNING membership.profile_revision INTO v_profile_revision;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Profile revision exhausted' USING ERRCODE = '22003';
    END IF;
  END IF;

  RETURN v_display_name;
END;
$function$;

-- Read the editable membership metadata, optimistic revision and complete role
-- allocation snapshot in one SQL statement. Active members can always open
-- their own profile; reading another member additionally requires members
-- readonly plus members_list. This prevents a client from combining an old
-- allocation set with a newer revision across REST requests.
CREATE OR REPLACE FUNCTION public.get_workspace_member_profile_edit_snapshot_v1(
  p_workspace_id uuid,
  p_membership_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_result jsonb;
  v_allocation_count integer;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  IF p_workspace_id IS NULL OR p_membership_id IS NULL THEN
    RAISE EXCEPTION 'Workspace and membership are required' USING ERRCODE = '22023';
  END IF;

  -- This is deliberately one SELECT: target metadata/revision and allocation
  -- rows are therefore observed under the same PostgreSQL statement snapshot.
  SELECT
    pg_catalog.jsonb_build_object(
      'ok', true,
      'workspace_id', target.workspace_id,
      'membership_id', target.id,
      'status', target.status::text,
      'business_role', target.business_role,
      'location', target.location,
      'city', target.city,
      'office_id', target.office_id,
      'base_working_hours', COALESCE(target.base_working_hours, 8::numeric),
      'profile_revision', target.profile_revision,
      'display_name', CASE
        WHEN target.user_id = v_actor THEN (
          SELECT profile.display_name
          FROM public.profiles AS profile
          WHERE profile.user_id = target.user_id
        )
        ELSE NULL
      END,
      'role_allocations', allocation_snapshot.value
    ),
    allocation_snapshot.row_count
  INTO v_result, v_allocation_count
  FROM public.enterprise_memberships AS target
  CROSS JOIN LATERAL (
    SELECT
      pg_catalog.count(*)::integer AS row_count,
      COALESCE(
        pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'business_role', bounded_allocation.business_role,
            'percentage', bounded_allocation.percentage,
            'is_priority', bounded_allocation.is_priority
          )
          ORDER BY bounded_allocation.business_role, bounded_allocation.id
        ),
        '[]'::jsonb
      ) AS value
    FROM (
      SELECT
        allocation.id,
        allocation.business_role,
        allocation.percentage,
        allocation.is_priority
      FROM public.enterprise_member_role_allocations AS allocation
      WHERE allocation.workspace_id = p_workspace_id
        AND allocation.membership_id = p_membership_id
      ORDER BY allocation.business_role, allocation.id
      LIMIT 21
    ) AS bounded_allocation
  ) AS allocation_snapshot
  WHERE target.id = p_membership_id
    AND target.workspace_id = p_workspace_id
    AND target.status <> 'removed'::public.enterprise_membership_status
    AND EXISTS (
      SELECT 1
      FROM public.enterprise_memberships AS viewer
      WHERE viewer.workspace_id = p_workspace_id
        AND viewer.user_id = v_actor
        AND viewer.status = 'active'::public.enterprise_membership_status
    )
    AND (
      target.user_id = v_actor
      OR (
        COALESCE(
          public.has_workspace_permission(
            p_workspace_id,
            v_actor,
            'members',
            'readonly'
          ),
          false
        )
        AND COALESCE(
          public.workspace_has_any_feature(
            p_workspace_id,
            ARRAY['members_list']::text[]
          ),
          false
        )
      )
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  IF v_allocation_count > 20 THEN
    RAISE EXCEPTION 'Member role allocation snapshot exceeds the supported bound'
      USING ERRCODE = '54000';
  END IF;

  RETURN v_result;
END;
$function$;

-- Remove the superseded pre-revision overload so PostgREST cannot keep routing
-- stale clients to a last-write-wins endpoint after an idempotent retry.
DROP FUNCTION IF EXISTS public.save_workspace_member_profile_v1(
  uuid, uuid, text, text, uuid, numeric, jsonb, text
);
DROP FUNCTION IF EXISTS public.save_workspace_member_profile_v1(
  uuid, uuid, integer, text, text, uuid, numeric, jsonb, text
);

CREATE OR REPLACE FUNCTION public.save_workspace_member_profile_v1(
  p_workspace_id uuid,
  p_membership_id uuid,
  p_expected_profile_revision integer,
  p_location text,
  p_city text,
  p_office_id uuid,
  p_base_working_hours numeric,
  p_role_allocations jsonb,
  p_display_name text,
  p_expected_display_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
SET lock_timeout = '5s'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_membership_id uuid;
  v_actor_role public.enterprise_role;
  v_target public.enterprise_memberships%ROWTYPE;
  v_location text := NULLIF(pg_catalog.btrim(p_location), '');
  v_city text := NULLIF(pg_catalog.btrim(p_city), '');
  v_display_name text := CASE
    WHEN p_display_name IS NULL THEN NULL
    ELSE effectime_private.canonicalize_profile_display_name_v1(p_display_name)
  END;
  v_current_display_name text;
  v_primary_role text;
  v_allocation_count integer;
  v_existing_allocations jsonb := '[]'::jsonb;
  v_new_allocations jsonb := '[]'::jsonb;
  v_previous_state jsonb;
  v_new_state jsonb;
  v_changed_fields text[] := ARRAY[]::text[];
  v_membership_changed boolean;
  v_allocations_changed boolean;
  v_display_name_updated boolean := false;
  v_changed boolean;
  v_audit_event_id uuid;
  v_final_profile_revision integer;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  IF p_workspace_id IS NULL OR p_membership_id IS NULL THEN
    RAISE EXCEPTION 'Workspace and membership are required' USING ERRCODE = '22023';
  END IF;

  IF p_expected_profile_revision IS NULL OR p_expected_profile_revision < 0 THEN
    RAISE EXCEPTION 'Invalid expected profile revision' USING ERRCODE = '22023';
  END IF;

  IF (v_location IS NOT NULL AND (
        pg_catalog.char_length(v_location) > 200
        OR v_location ~ '[[:cntrl:]]'
      ))
     OR (v_city IS NOT NULL AND (
        pg_catalog.char_length(v_city) > 200
        OR v_city ~ '[[:cntrl:]]'
      )) THEN
    RAISE EXCEPTION 'Invalid member location data' USING ERRCODE = '22023';
  END IF;

  IF p_base_working_hours IS NULL
     OR p_base_working_hours::text IN ('NaN', 'Infinity', '-Infinity')
     OR p_base_working_hours < 0
     OR p_base_working_hours > 24
     OR p_base_working_hours <> pg_catalog.round(p_base_working_hours, 2) THEN
    RAISE EXCEPTION 'Invalid base working hours' USING ERRCODE = '22023';
  END IF;

  IF p_role_allocations IS NULL
     OR pg_catalog.jsonb_typeof(p_role_allocations) IS DISTINCT FROM 'array'
     OR pg_catalog.jsonb_array_length(p_role_allocations) > 20 THEN
    RAISE EXCEPTION 'Invalid role allocation snapshot' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(p_role_allocations) AS allocation(value)
    WHERE pg_catalog.jsonb_typeof(allocation.value) IS DISTINCT FROM 'object'
       OR NOT (allocation.value ?& ARRAY['business_role', 'percentage', 'is_priority']::text[])
       OR allocation.value - ARRAY['business_role', 'percentage', 'is_priority']::text[] <> '{}'::jsonb
       OR pg_catalog.jsonb_typeof(allocation.value -> 'business_role') IS DISTINCT FROM 'string'
       OR pg_catalog.btrim(allocation.value ->> 'business_role') = ''
       OR pg_catalog.char_length(pg_catalog.btrim(allocation.value ->> 'business_role')) > 200
       OR pg_catalog.btrim(allocation.value ->> 'business_role') ~ '[[:cntrl:]]'
       OR pg_catalog.jsonb_typeof(allocation.value -> 'percentage') IS DISTINCT FROM 'number'
       OR (allocation.value ->> 'percentage')::numeric < 0
       OR (allocation.value ->> 'percentage')::numeric > 100
       OR (allocation.value ->> 'percentage')::numeric
            <> pg_catalog.round((allocation.value ->> 'percentage')::numeric, 2)
       OR pg_catalog.jsonb_typeof(allocation.value -> 'is_priority') IS DISTINCT FROM 'boolean'
  ) THEN
    RAISE EXCEPTION 'Invalid role allocation entry' USING ERRCODE = '22023';
  END IF;

  SELECT
    pg_catalog.count(*)::integer,
    COALESCE(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'business_role', pg_catalog.btrim(allocation.value ->> 'business_role'),
          'percentage', (allocation.value ->> 'percentage')::numeric,
          'is_priority', (allocation.value ->> 'is_priority')::boolean
        )
        ORDER BY pg_catalog.btrim(allocation.value ->> 'business_role')
      ),
      '[]'::jsonb
    )
  INTO v_allocation_count, v_new_allocations
  FROM pg_catalog.jsonb_array_elements(p_role_allocations) AS allocation(value);

  IF (
    SELECT pg_catalog.count(DISTINCT pg_catalog.lower(
      pg_catalog.normalize(
        pg_catalog.btrim(allocation.value ->> 'business_role'),
        'NFKC'
      )
    ))
    FROM pg_catalog.jsonb_array_elements(p_role_allocations) AS allocation(value)
  ) <> v_allocation_count THEN
    RAISE EXCEPTION 'Duplicate role allocation' USING ERRCODE = '22023';
  END IF;

  IF (v_allocation_count = 0 AND EXISTS (
        SELECT 1
        FROM pg_catalog.jsonb_array_elements(p_role_allocations) AS allocation(value)
        WHERE (allocation.value ->> 'is_priority')::boolean
      ))
     OR (v_allocation_count > 0 AND (
        SELECT pg_catalog.count(*)
        FROM pg_catalog.jsonb_array_elements(p_role_allocations) AS allocation(value)
        WHERE (allocation.value ->> 'is_priority')::boolean
      ) <> 1) THEN
    RAISE EXCEPTION 'Role allocations require exactly one priority entry'
      USING ERRCODE = '22023';
  END IF;

  IF v_allocation_count > 0 AND (
    SELECT COALESCE(
      pg_catalog.sum((allocation.value ->> 'percentage')::numeric),
      0::numeric
    )
    FROM pg_catalog.jsonb_array_elements(p_role_allocations) AS allocation(value)
  ) <> 100::numeric THEN
    RAISE EXCEPTION 'Role allocation percentages must total 100'
      USING ERRCODE = '22023';
  END IF;

  SELECT allocation.value ->> 'business_role'
  INTO v_primary_role
  FROM pg_catalog.jsonb_array_elements(v_new_allocations) AS allocation(value)
  WHERE (allocation.value ->> 'is_priority')::boolean;

  IF p_display_name IS NOT NULL AND (
    v_display_name = ''
    OR pg_catalog.char_length(v_display_name) > 200
    OR v_display_name ~ '[[:cntrl:]]'
  ) THEN
    RAISE EXCEPTION 'Invalid display name' USING ERRCODE = '22023';
  END IF;

  -- Resolve the actor without trusting a caller-supplied actor UUID, then take
  -- one deterministic advisory lock for this tenant/member save key.
  SELECT membership.id
  INTO v_actor_membership_id
  FROM public.enterprise_memberships AS membership
  WHERE membership.workspace_id = p_workspace_id
    AND membership.user_id = v_actor
    AND membership.status = 'active'::public.enterprise_membership_status;

  IF v_actor_membership_id IS NULL THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_workspace_id::text || ':' || p_membership_id::text,
      734554
    )
  );

  -- Lock actor and target membership rows in UUID order. The post-lock checks
  -- below ensure a concurrent suspension or tenant move cannot pass on stale
  -- authorization state.
  PERFORM membership.id
  FROM public.enterprise_memberships AS membership
  WHERE membership.workspace_id = p_workspace_id
    AND membership.id IN (v_actor_membership_id, p_membership_id)
  ORDER BY membership.id
  FOR UPDATE;

  SELECT membership.*
  INTO v_target
  FROM public.enterprise_memberships AS membership
  WHERE membership.id = p_membership_id
    AND membership.workspace_id = p_workspace_id
    AND membership.status <> 'removed'::public.enterprise_membership_status;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT membership.role
  INTO v_actor_role
  FROM public.enterprise_memberships AS membership
  WHERE membership.id = v_actor_membership_id
    AND membership.workspace_id = p_workspace_id
    AND membership.user_id = v_actor
    AND membership.status = 'active'::public.enterprise_membership_status;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  -- Owners are authorized by the centralized helper without a permission row.
  -- For delegated roles, lock the exact permission row against an UPDATE or
  -- DELETE until this save commits, then still require the canonical helper.
  IF v_actor_role <> 'owner'::public.enterprise_role THEN
    PERFORM permission.workspace_id
    FROM public.enterprise_role_permissions AS permission
    WHERE permission.workspace_id = p_workspace_id
      AND permission.role_key = v_actor_role::text
      AND permission.feature_key = 'members'
      AND permission.access_level = 'edit'
    FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NOT COALESCE(
       public.has_workspace_permission(
         p_workspace_id,
         v_actor,
         'members',
         'edit'
       ),
       false
     ) OR NOT COALESCE(
       public.workspace_has_any_feature(
         p_workspace_id,
         ARRAY['members_list']::text[]
       ),
       false
     ) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  -- Compare only after the locked authorization recheck, so unauthorized
  -- callers cannot use 40001/42501 differences as a revision oracle.
  IF v_target.profile_revision <> p_expected_profile_revision THEN
    RAISE EXCEPTION 'Member profile revision conflict' USING ERRCODE = '40001';
  END IF;

  IF p_office_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.enterprise_offices AS office
    WHERE office.id = p_office_id
      AND office.workspace_id = p_workspace_id
    FOR UPDATE
  ) THEN
    RAISE EXCEPTION 'Invalid office' USING ERRCODE = '22023';
  END IF;

  IF p_display_name IS NOT NULL THEN
    IF v_target.user_id <> v_actor
       OR v_target.status <> 'active'::public.enterprise_membership_status THEN
      RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;

    SELECT profile.display_name
    INTO v_current_display_name
    FROM public.profiles AS profile
    WHERE profile.user_id = v_target.user_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Profile missing' USING ERRCODE = 'P0002';
    END IF;

    IF v_current_display_name IS DISTINCT FROM p_expected_display_name THEN
      RAISE EXCEPTION 'Display name changed concurrently' USING ERRCODE = '40001';
    END IF;
  END IF;

  -- Lock the full prior allocation snapshot before comparison/replacement.
  PERFORM allocation.id
  FROM public.enterprise_member_role_allocations AS allocation
  WHERE allocation.membership_id = p_membership_id
    AND allocation.workspace_id = p_workspace_id
  ORDER BY allocation.id
  FOR UPDATE;

  SELECT COALESCE(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'business_role', allocation.business_role,
        'percentage', allocation.percentage,
        'is_priority', allocation.is_priority
      )
      ORDER BY allocation.business_role
    ),
    '[]'::jsonb
  )
  INTO v_existing_allocations
  FROM public.enterprise_member_role_allocations AS allocation
  WHERE allocation.membership_id = p_membership_id
    AND allocation.workspace_id = p_workspace_id;

  v_membership_changed :=
    v_target.business_role IS DISTINCT FROM v_primary_role
    OR v_target.location IS DISTINCT FROM v_location
    OR v_target.city IS DISTINCT FROM v_city
    OR v_target.office_id IS DISTINCT FROM p_office_id
    OR v_target.base_working_hours IS DISTINCT FROM p_base_working_hours;
  v_allocations_changed := v_existing_allocations IS DISTINCT FROM v_new_allocations;
  v_display_name_updated := p_display_name IS NOT NULL
    AND v_current_display_name IS DISTINCT FROM v_display_name;
  v_changed := v_membership_changed OR v_allocations_changed OR v_display_name_updated;

  IF v_target.business_role IS DISTINCT FROM v_primary_role THEN
    v_changed_fields := pg_catalog.array_append(v_changed_fields, 'business_role');
  END IF;
  IF v_target.location IS DISTINCT FROM v_location THEN
    v_changed_fields := pg_catalog.array_append(v_changed_fields, 'location');
  END IF;
  IF v_target.city IS DISTINCT FROM v_city THEN
    v_changed_fields := pg_catalog.array_append(v_changed_fields, 'city');
  END IF;
  IF v_target.office_id IS DISTINCT FROM p_office_id THEN
    v_changed_fields := pg_catalog.array_append(v_changed_fields, 'office_id');
  END IF;
  IF v_target.base_working_hours IS DISTINCT FROM p_base_working_hours THEN
    v_changed_fields := pg_catalog.array_append(v_changed_fields, 'base_working_hours');
  END IF;
  IF v_allocations_changed THEN
    v_changed_fields := pg_catalog.array_append(v_changed_fields, 'role_allocations');
  END IF;
  IF v_display_name_updated THEN
    v_changed_fields := pg_catalog.array_append(v_changed_fields, 'display_name');
  END IF;

  -- Audit state deliberately excludes names, roles, locations and other profile
  -- values. The event records which fields changed and allocation cardinality;
  -- the canonical business data remains in its tenant-owned source tables.
  v_previous_state := pg_catalog.jsonb_build_object(
    'allocation_count', pg_catalog.jsonb_array_length(v_existing_allocations)
  );
  v_new_state := pg_catalog.jsonb_build_object(
    'allocation_count', v_allocation_count
  );

  IF v_membership_changed THEN
    UPDATE public.enterprise_memberships AS membership
    SET business_role = v_primary_role,
        location = v_location,
        city = v_city,
        office_id = p_office_id,
        base_working_hours = p_base_working_hours
    WHERE membership.id = p_membership_id
      AND membership.workspace_id = p_workspace_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Member profile changed concurrently' USING ERRCODE = '40001';
    END IF;
  END IF;

  IF v_allocations_changed THEN
    DELETE FROM public.enterprise_member_role_allocations AS allocation
    WHERE allocation.membership_id = p_membership_id
      AND allocation.workspace_id = p_workspace_id;

    INSERT INTO public.enterprise_member_role_allocations (
      workspace_id,
      membership_id,
      business_role,
      percentage,
      is_priority
    )
    SELECT
      p_workspace_id,
      p_membership_id,
      allocation.value ->> 'business_role',
      (allocation.value ->> 'percentage')::numeric,
      (allocation.value ->> 'is_priority')::boolean
    FROM pg_catalog.jsonb_array_elements(v_new_allocations) AS allocation(value);
  END IF;

  IF v_display_name_updated THEN
    PERFORM public.update_my_workspace_profile_display_name_v1(
      p_workspace_id,
      p_membership_id,
      v_display_name
    );
  END IF;

  SELECT membership.profile_revision
  INTO v_final_profile_revision
  FROM public.enterprise_memberships AS membership
  WHERE membership.id = p_membership_id
    AND membership.workspace_id = p_workspace_id;

  -- Membership/allocation triggers already advance revisions for their writes.
  -- Display-only saves have no such table mutation, so advance once here.
  IF v_changed AND v_final_profile_revision = p_expected_profile_revision THEN
    UPDATE public.enterprise_memberships AS membership
    SET profile_revision = membership.profile_revision + 1
    WHERE membership.id = p_membership_id
      AND membership.workspace_id = p_workspace_id
      AND membership.profile_revision = p_expected_profile_revision
      AND membership.profile_revision < 2147483647
    RETURNING membership.profile_revision INTO v_final_profile_revision;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Member profile changed concurrently' USING ERRCODE = '40001';
    END IF;
  ELSIF v_changed AND v_final_profile_revision <= p_expected_profile_revision THEN
    RAISE EXCEPTION 'Invalid profile revision transition' USING ERRCODE = '55000';
  END IF;

  IF v_changed THEN
    INSERT INTO public.enterprise_audit_events (
      workspace_id,
      actor_id,
      action,
      target_type,
      target_id,
      affected_user_id,
      prev_state,
      new_state,
      metadata
    ) VALUES (
      p_workspace_id,
      v_actor,
      'membership.profile_updated',
      'enterprise_membership',
      p_membership_id,
      v_target.user_id,
      v_previous_state,
      v_new_state,
      pg_catalog.jsonb_build_object(
        'changed_fields', pg_catalog.to_jsonb(v_changed_fields),
        'previous_allocation_count', pg_catalog.jsonb_array_length(v_existing_allocations),
        'allocation_count', v_allocation_count
      )
    )
    RETURNING id INTO v_audit_event_id;
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'ok', true,
    'workspace_id', p_workspace_id,
    'membership_id', p_membership_id,
    'changed', v_changed,
    'profile_revision', v_final_profile_revision,
    'allocation_count', v_allocation_count,
    'display_name_updated', v_display_name_updated,
    'audit_event_id', v_audit_event_id
  );
END;
$function$;

ALTER FUNCTION public.guard_member_profile_save_audit_mutation()
  OWNER TO postgres;
ALTER FUNCTION public.workspace_parent_exists_for_cascade_guard(uuid)
  OWNER TO postgres;
ALTER FUNCTION public.guard_admin_leave_override_audit_mutation()
  OWNER TO postgres;
ALTER FUNCTION public.guard_payroll_transition_audit_mutation()
  OWNER TO postgres;
ALTER FUNCTION public.guard_payroll_period_mutation()
  OWNER TO postgres;
ALTER FUNCTION public.guard_workspace_member_profile_metadata_update()
  OWNER TO postgres;
ALTER FUNCTION public.bump_workspace_member_profile_revision_from_allocation()
  OWNER TO postgres;
ALTER FUNCTION public.update_my_workspace_profile_display_name_v1(uuid, uuid, text)
  OWNER TO postgres;
ALTER FUNCTION public.get_workspace_member_profile_edit_snapshot_v1(uuid, uuid)
  OWNER TO postgres;
ALTER FUNCTION public.save_workspace_member_profile_v1(
  uuid, uuid, integer, text, text, uuid, numeric, jsonb, text, text
) OWNER TO postgres;

-- CREATE OR REPLACE preserves a pre-existing owner. Fail instead of exposing a
-- definer endpoint or its audit guard under an unexpected principal.
DO $member_profile_routine_owner_contract$
DECLARE
  v_expected_owner oid := pg_catalog.to_regrole('postgres')::oid;
  v_guard_oid oid := pg_catalog.to_regprocedure(
    'public.guard_member_profile_save_audit_mutation()'
  )::oid;
  v_workspace_parent_guard_oid oid := pg_catalog.to_regprocedure(
    'public.workspace_parent_exists_for_cascade_guard(uuid)'
  )::oid;
  v_admin_audit_guard_oid oid := pg_catalog.to_regprocedure(
    'public.guard_admin_leave_override_audit_mutation()'
  )::oid;
  v_payroll_audit_guard_oid oid := pg_catalog.to_regprocedure(
    'public.guard_payroll_transition_audit_mutation()'
  )::oid;
  v_payroll_period_guard_oid oid := pg_catalog.to_regprocedure(
    'public.guard_payroll_period_mutation()'
  )::oid;
  v_metadata_guard_oid oid := pg_catalog.to_regprocedure(
    'public.guard_workspace_member_profile_metadata_update()'
  )::oid;
  v_allocation_revision_oid oid := pg_catalog.to_regprocedure(
    'public.bump_workspace_member_profile_revision_from_allocation()'
  )::oid;
  v_legacy_rename_oid oid := pg_catalog.to_regprocedure(
    'public.update_my_workspace_profile_display_name_v1(uuid,uuid,text)'
  )::oid;
  v_read_oid oid := pg_catalog.to_regprocedure(
    'public.get_workspace_member_profile_edit_snapshot_v1(uuid,uuid)'
  )::oid;
  v_save_oid oid := pg_catalog.to_regprocedure(
    'public.save_workspace_member_profile_v1(uuid,uuid,integer,text,text,uuid,numeric,jsonb,text,text)'
  )::oid;
BEGIN
  IF v_guard_oid IS NULL
     OR v_workspace_parent_guard_oid IS NULL
     OR v_admin_audit_guard_oid IS NULL
     OR v_payroll_audit_guard_oid IS NULL
     OR v_payroll_period_guard_oid IS NULL
     OR v_metadata_guard_oid IS NULL
     OR v_allocation_revision_oid IS NULL
     OR v_legacy_rename_oid IS NULL
     OR v_read_oid IS NULL
     OR v_save_oid IS NULL THEN
    RAISE EXCEPTION 'Member profile save routine contract is incomplete';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure
    WHERE procedure.oid IN (
      v_guard_oid,
      v_workspace_parent_guard_oid,
      v_admin_audit_guard_oid,
      v_payroll_audit_guard_oid,
      v_payroll_period_guard_oid,
      v_metadata_guard_oid,
      v_allocation_revision_oid,
      v_legacy_rename_oid,
      v_read_oid,
      v_save_oid
    )
      AND procedure.proowner <> v_expected_owner
  ) THEN
    RAISE EXCEPTION 'Member profile save routines require the migration owner'
      USING ERRCODE = '55000';
  END IF;
END;
$member_profile_routine_owner_contract$;

REVOKE ALL ON FUNCTION public.guard_member_profile_save_audit_mutation()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.workspace_parent_exists_for_cascade_guard(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.guard_admin_leave_override_audit_mutation()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.guard_payroll_transition_audit_mutation()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.guard_payroll_period_mutation()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.guard_workspace_member_profile_metadata_update()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.bump_workspace_member_profile_revision_from_allocation()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.update_my_workspace_profile_display_name_v1(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_workspace_member_profile_edit_snapshot_v1(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.save_workspace_member_profile_v1(
  uuid, uuid, integer, text, text, uuid, numeric, jsonb, text, text
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_workspace_member_profile_edit_snapshot_v1(uuid, uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_my_workspace_profile_display_name_v1(uuid, uuid, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_workspace_member_profile_v1(
  uuid, uuid, integer, text, text, uuid, numeric, jsonb, text, text
) TO authenticated;

NOTIFY pgrst, 'reload schema';
