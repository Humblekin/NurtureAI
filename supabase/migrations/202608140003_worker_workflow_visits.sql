-- ============================================
-- NurtureAI — Phase 1 Migration 003
-- Healthcare-worker-first workflow support.
--
-- 1. `visits` gains provenance columns so worker-recorded
--    health encounters are stamped exactly like the other
--    clinical tables (data_source / verified / verified_by /
--    verified_at). Without these, `VisitForm` cannot persist
--    a visit (the app spreads provenance on every write).
--
-- 2. Worker roles may SELECT visits — mirrors the existing
--    "health workers read all" policy on mothers/children so
--    a worker opening a patient's record sees that patient's
--    previous encounters. Existing policies are preserved.
--
-- Additive and safe to re-run.
-- ============================================

ALTER TABLE visits
  ADD COLUMN IF NOT EXISTS data_source text NOT NULL DEFAULT 'healthcare_worker',
  ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_by uuid,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'visits_data_source_check' AND conrelid = 'public.visits'::regclass
  ) THEN
    ALTER TABLE visits ADD CONSTRAINT visits_data_source_check
      CHECK (data_source IN ('healthcare_worker', 'mother_reported', 'mother_registered', 'system'));
  END IF;
END $$;

DROP POLICY IF EXISTS "Visits: health workers read all" ON visits;
CREATE POLICY "Visits: health workers read all" ON visits
  FOR SELECT
  USING (user_role() = ANY (ARRAY['chw'::text, 'nurse'::text, 'doctor'::text, 'admin'::text]));
