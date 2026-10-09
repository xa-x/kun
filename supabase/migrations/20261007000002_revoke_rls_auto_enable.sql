-- Supabase ships `rls_auto_enable()` as a SECURITY DEFINER event-trigger
-- helper. It is not meant to be called over the Data API, so take EXECUTE
-- away from the PostgREST roles (a no-op where the function doesn't exist).
DO $$
BEGIN
  IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
  END IF;
END
$$;
