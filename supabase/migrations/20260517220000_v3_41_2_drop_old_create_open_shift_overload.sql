-- v3.41.2: Drop the ambiguous old 6-param overload of create_open_shift_request.
--
-- Root cause of 409 Conflict: two overloads of create_open_shift_request exist
-- in the database (6-param from v3.39.0, 10-param from v3.40.0). Because ALL
-- params have DEFAULT values in BOTH functions, PostgreSQL / PostgREST cannot
-- determine which overload to call when invoked via REST RPC → 409 Conflict.
--
-- The 10-param version (v3.40.0) is the authoritative implementation.
DROP FUNCTION IF EXISTS public.create_open_shift_request(uuid, uuid, date, text, uuid, text);
