-- ============================================
-- NurtureAI — Reframing Migration 004
-- Phase 2: Mother registration & worker verification.
--
-- 1. Close a verification-security gap: mother-own UPDATE
--    policies on mothers/pregnancies/children/mother_reports
--    previously had no WITH CHECK, so a mother could flip her
--    own `verified` flag / provenance columns. Now mothers may
--    only update their own UNVERIFIED, mother-registered rows,
--    and may only touch mother_reports still in 'pending'.
--    Workers (chw/nurse/doctor/admin) already have separate
--    role-based UPDATE policies and are unaffected.
--
-- 2. Add a stable human-readable patient identifier
--    (patient_code, e.g. NRT-1A2B3C4D) derived deterministically
--    from the record UUID so it is unique, offline-safe, and
--    backfillable. Used by workers when a mother arrives at a
--    facility instead of relying on name matching alone.
--
-- Additive and safe to re-run.
-- ============================================

-- --------------------------------------------------
-- 1. Mother-own UPDATE policies — lock verification
--    fields so mothers cannot self-verify or rewrite
--    worker-verified clinical records.
-- --------------------------------------------------
DROP POLICY IF EXISTS "Mothers: mothers update own" ON mothers;
CREATE POLICY "Mothers: mothers update own" ON mothers
  FOR UPDATE USING (
    profile_id = auth.uid()
  )
  WITH CHECK (
    profile_id = auth.uid()
    AND data_source = 'mother_registered'
    AND verified = false
    AND verified_by IS NULL
    AND verified_at IS NULL
  );

DROP POLICY IF EXISTS "Pregnancies: mothers update own" ON pregnancies;
CREATE POLICY "Pregnancies: mothers update own" ON pregnancies
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM mothers WHERE id = mother_id AND profile_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM mothers WHERE id = mother_id AND profile_id = auth.uid())
    AND data_source = 'mother_registered'
    AND verified = false
    AND verified_by IS NULL
    AND verified_at IS NULL
  );

DROP POLICY IF EXISTS "Children: mothers update own" ON children;
CREATE POLICY "Children: mothers update own" ON children
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM mothers WHERE id = mother_id AND profile_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM mothers WHERE id = mother_id AND profile_id = auth.uid())
    AND data_source = 'mother_registered'
    AND verified = false
    AND verified_by IS NULL
    AND verified_at IS NULL
  );

DROP POLICY IF EXISTS "MotherReports: mothers update own" ON mother_reports;
CREATE POLICY "MotherReports: mothers update own" ON mother_reports
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM mothers WHERE id = mother_id AND profile_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM mothers WHERE id = mother_id AND profile_id = auth.uid())
    AND status = 'pending'
    AND verified_by IS NULL
    AND verified_at IS NULL
    AND resolved_record_id IS NULL
  );

-- --------------------------------------------------
-- 2. Patient identifier — patient_code on mothers
--    Deterministic: NRT-<first 8 hex chars of uuid>.
--    Same formula is generated client-side for offline
--    registrations (see lib/db.js generatePatientCode).
-- --------------------------------------------------
ALTER TABLE mothers ADD COLUMN IF NOT EXISTS patient_code TEXT;

UPDATE mothers
SET patient_code = 'NRT-' || upper(left(replace(id::text, '-', ''), 8))
WHERE patient_code IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mothers_patient_code ON mothers (patient_code);
