-- ============================================
-- NurtureAI — Reframing Migration 002
-- RLS: mothers keep read-own + registration writes,
-- but mother INSERT/UPDATE is forced to
-- data_source='mother_registered' AND verified=false
-- (pending verification) — workers confirm later.
-- Pure clinical tables (antenatal_visits,
-- vaccinations, growth_records, milestones) become
-- worker-write-only.
--
-- Additive and safe to re-run.
-- ============================================

-- ------------------------------------------------
-- 1. MOTHERS — mother writes forced pending
--    (INSERT enforced at DB; UPDATE keeps existing
--     permissive own-row policy so mothers can still
--     edit their registration info without breaking
--     worker-verified records)
-- ------------------------------------------------
DROP POLICY IF EXISTS "Mothers: mothers insert own" ON mothers;
CREATE POLICY "Mothers: mothers insert own" ON mothers
  FOR INSERT WITH CHECK (
    profile_id = auth.uid()
    AND data_source = 'mother_registered'
    AND verified = false
  );

-- ------------------------------------------------
-- 2. PREGNANCIES — mother writes forced pending
-- ------------------------------------------------
DROP POLICY IF EXISTS "Pregnancies: mothers insert own" ON pregnancies;
CREATE POLICY "Pregnancies: mothers insert own" ON pregnancies
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM mothers WHERE id = mother_id AND profile_id = auth.uid())
    AND data_source = 'mother_registered'
    AND verified = false
  );

-- ------------------------------------------------
-- 3. CHILDREN — mother writes forced pending
-- ------------------------------------------------
DROP POLICY IF EXISTS "Children: mothers insert own" ON children;
CREATE POLICY "Children: mothers insert own" ON children
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM mothers WHERE id = mother_id AND profile_id = auth.uid())
    AND data_source = 'mother_registered'
    AND verified = false
  );

-- ------------------------------------------------
-- 4. CLINICAL TABLES — REMOVE mother insert/update
--    (worker-write-only; mothers retain read-own)
-- ------------------------------------------------
DROP POLICY IF EXISTS "ANV: mothers insert own" ON antenatal_visits;
DROP POLICY IF EXISTS "ANV: mothers update own" ON antenatal_visits;
DROP POLICY IF EXISTS "Vax: mothers insert own" ON vaccinations;
DROP POLICY IF EXISTS "Vax: mothers update own" ON vaccinations;
DROP POLICY IF EXISTS "Growth: mothers insert own" ON growth_records;
DROP POLICY IF EXISTS "Growth: mothers update own" ON growth_records;
DROP POLICY IF EXISTS "Milestones: mothers insert own" ON milestones;
DROP POLICY IF EXISTS "Milestones: mothers update own" ON milestones;
