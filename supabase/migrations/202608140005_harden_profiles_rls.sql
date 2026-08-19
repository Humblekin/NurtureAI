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
      role = (SELECT role FROM public.profiles WHERE id = auth.uid())
      OR public.user_role() = 'admin'
    )
  );
