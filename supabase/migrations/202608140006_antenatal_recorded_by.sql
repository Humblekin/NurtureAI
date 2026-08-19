-- ============================================
-- NurtureAI — Phase 1 Migration 006
-- ANC auditability: attribute antenatal_visits
-- to the health worker who recorded them.
--
-- `visits` already stores `worker_id`, but the
-- pure clinical `antenatal_visits` table only
-- carries generic provenance (verified_by /
-- verified_at) with no worker attribution.
-- This adds an additive `recorded_by` column so
-- every ANC entry is attributable, matching the
-- health-worker-first record model.
--
-- Additive and safe to re-run.
-- ============================================

ALTER TABLE antenatal_visits
  ADD COLUMN IF NOT EXISTS recorded_by UUID REFERENCES profiles(id);

CREATE INDEX IF NOT EXISTS idx_antenatal_visits_recorded_by
  ON antenatal_visits(recorded_by);
