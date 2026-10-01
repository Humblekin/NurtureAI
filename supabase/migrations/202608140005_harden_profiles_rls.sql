-- Phase 5 — Harden profiles RLS
-- Closes two privilege/privacy gaps:
--   1. "Profiles: update own" had no WITH CHECK, so any user could escalate
--      their own role (e.g. mother -> admin). Now role can only change if the
--      caller is already an admin.
--   2. "Profiles: public read" allowed every authenticated user to read every
--      profile row (including other mothers' phones/communities). Now a mother
--      can only read her own row plus health-worker rows (needed for the
--      assigned-worker lookup); health workers and admins keep read-all access
--      for dashboards and user management. Mothers can no longer enumerate
--      other mothers' private profile data.
--
-- A policy on a table cannot subquery that same table: evaluating the subquery
-- re-enters RLS and Postgres raises "infinite recursion detected in policy for
-- relation profiles". That failure happens at query time, not when the policy
-- is created, so it would surface as every profile update failing. The
-- SECURITY DEFINER helper below reads the role with RLS switched off, which is
-- the standard way to compare a column against its own previous value.

CREATE OR REPLACE FUNCTION public.profile_role(p_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = p_id;
$$;

REVOKE ALL ON FUNCTION public.profile_role(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.profile_role(uuid) TO authenticated;

DROP POLICY IF EXISTS "Profiles: public read" ON public.profiles;
CREATE POLICY "Profiles: public read" ON public.profiles FOR SELECT
  USING (
    auth.uid() = id
    OR public.user_role() IN ('chw', 'nurse', 'doctor', 'district_officer', 'admin')
    OR role IN ('chw', 'nurse', 'doctor', 'district_officer', 'admin')
  );

DROP POLICY IF EXISTS "Profiles: update own" ON public.profiles;
CREATE POLICY "Profiles: update own" ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND (
      role = public.profile_role(auth.uid())
      OR public.user_role() = 'admin'
    )
  );
