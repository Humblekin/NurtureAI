-- ============================================
-- NurtureAI — Reframing Migration 001
-- Provenance on clinical records, mother_reports,
-- district_officer read access, profiles trigger fix.
--
-- Additive and safe to re-run on existing data.
-- ============================================

-- --------------------------------------------------
-- 1. Data provenance on clinical / registration tables
--    data_source: who entered the data
--    verified:    worker-confirmed official clinical record
-- --------------------------------------------------
DO $$
BEGIN
  -- mothers
  ALTER TABLE mothers ADD COLUMN IF NOT EXISTS data_source TEXT NOT NULL DEFAULT 'healthcare_worker'
    CHECK (data_source IN ('healthcare_worker', 'mother_reported', 'mother_registered', 'system'));
  ALTER TABLE mothers ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT false;
  ALTER TABLE mothers ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES profiles(id);
  ALTER TABLE mothers ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

  -- children
  ALTER TABLE children ADD COLUMN IF NOT EXISTS data_source TEXT NOT NULL DEFAULT 'healthcare_worker'
    CHECK (data_source IN ('healthcare_worker', 'mother_reported', 'mother_registered', 'system'));
  ALTER TABLE children ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT false;
  ALTER TABLE children ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES profiles(id);
  ALTER TABLE children ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

  -- pregnancies
  ALTER TABLE pregnancies ADD COLUMN IF NOT EXISTS data_source TEXT NOT NULL DEFAULT 'healthcare_worker'
    CHECK (data_source IN ('healthcare_worker', 'mother_reported', 'mother_registered', 'system'));
  ALTER TABLE pregnancies ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT false;
  ALTER TABLE pregnancies ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES profiles(id);
  ALTER TABLE pregnancies ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

  -- antenatal_visits
  ALTER TABLE antenatal_visits ADD COLUMN IF NOT EXISTS data_source TEXT NOT NULL DEFAULT 'healthcare_worker'
    CHECK (data_source IN ('healthcare_worker', 'mother_reported', 'mother_registered', 'system'));
  ALTER TABLE antenatal_visits ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT false;
  ALTER TABLE antenatal_visits ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES profiles(id);
  ALTER TABLE antenatal_visits ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

  -- vaccinations
  ALTER TABLE vaccinations ADD COLUMN IF NOT EXISTS data_source TEXT NOT NULL DEFAULT 'healthcare_worker'
    CHECK (data_source IN ('healthcare_worker', 'mother_reported', 'mother_registered', 'system'));
  ALTER TABLE vaccinations ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT false;
  ALTER TABLE vaccinations ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES profiles(id);
  ALTER TABLE vaccinations ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

  -- growth_records
  ALTER TABLE growth_records ADD COLUMN IF NOT EXISTS data_source TEXT NOT NULL DEFAULT 'healthcare_worker'
    CHECK (data_source IN ('healthcare_worker', 'mother_reported', 'mother_registered', 'system'));
  ALTER TABLE growth_records ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT false;
  ALTER TABLE growth_records ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES profiles(id);
  ALTER TABLE growth_records ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

  -- milestones
  ALTER TABLE milestones ADD COLUMN IF NOT EXISTS data_source TEXT NOT NULL DEFAULT 'healthcare_worker'
    CHECK (data_source IN ('healthcare_worker', 'mother_reported', 'mother_registered', 'system'));
  ALTER TABLE milestones ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT false;
  ALTER TABLE milestones ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES profiles(id);
  ALTER TABLE milestones ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

  -- referrals
  ALTER TABLE referrals ADD COLUMN IF NOT EXISTS data_source TEXT NOT NULL DEFAULT 'healthcare_worker'
    CHECK (data_source IN ('healthcare_worker', 'mother_reported', 'mother_registered', 'system'));
  ALTER TABLE referrals ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT false;
  ALTER TABLE referrals ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES profiles(id);
  ALTER TABLE referrals ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
END $$;

-- --------------------------------------------------
-- 2. mother_reports — mother-reported info awaiting
--    worker confirmation. Amina-collected data lands
--    here; workers confirm it into official records.
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS mother_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mother_id UUID NOT NULL REFERENCES mothers(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES profiles(id),
  report_type TEXT NOT NULL DEFAULT 'note'
    CHECK (report_type IN ('note', 'symptom', 'measurement', 'concern', 'request')),
  detail TEXT NOT NULL,
  value NUMERIC,
  unit TEXT,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'acknowledged', 'verified', 'dismissed')),
  verified_by UUID REFERENCES profiles(id),
  verified_at TIMESTAMPTZ,
  resolved_record_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mother_reports_mother ON mother_reports(mother_id);
CREATE INDEX IF NOT EXISTS idx_mother_reports_status ON mother_reports(status);

ALTER TABLE mother_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "MotherReports: mothers insert own" ON mother_reports;
CREATE POLICY "MotherReports: mothers insert own" ON mother_reports
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM mothers WHERE id = mother_id AND profile_id = auth.uid())
  );

DROP POLICY IF EXISTS "MotherReports: mothers read own" ON mother_reports;
CREATE POLICY "MotherReports: mothers read own" ON mother_reports
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM mothers WHERE id = mother_id AND profile_id = auth.uid())
  );

DROP POLICY IF EXISTS "MotherReports: mothers update own" ON mother_reports;
CREATE POLICY "MotherReports: mothers update own" ON mother_reports
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM mothers WHERE id = mother_id AND profile_id = auth.uid())
  );

DROP POLICY IF EXISTS "MotherReports: health workers read assigned" ON mother_reports;
CREATE POLICY "MotherReports: health workers read assigned" ON mother_reports
  FOR SELECT USING (
    public.user_role() IN ('chw', 'nurse', 'doctor', 'admin')
    AND EXISTS (
      SELECT 1 FROM mothers m WHERE m.id = mother_id
      AND (m.assigned_worker_id = auth.uid() OR public.user_role() IN ('nurse', 'doctor', 'admin'))
    )
  );

DROP POLICY IF EXISTS "MotherReports: health workers update assigned" ON mother_reports;
CREATE POLICY "MotherReports: health workers update assigned" ON mother_reports
  FOR UPDATE USING (
    public.user_role() IN ('chw', 'nurse', 'doctor', 'admin')
    AND EXISTS (
      SELECT 1 FROM mothers m WHERE m.id = mother_id
      AND (m.assigned_worker_id = auth.uid() OR public.user_role() IN ('nurse', 'doctor', 'admin'))
    )
  );

-- --------------------------------------------------
-- 3. district_officer read access on clinical tables
--    (aggregated/authorized information only — no writes)
-- --------------------------------------------------
DROP POLICY IF EXISTS "Mothers: district read" ON mothers;
CREATE POLICY "Mothers: district read" ON mothers
  FOR SELECT USING (public.user_role() = 'district_officer');

DROP POLICY IF EXISTS "Children: district read" ON children;
CREATE POLICY "Children: district read" ON children
  FOR SELECT USING (public.user_role() = 'district_officer');

DROP POLICY IF EXISTS "Pregnancies: district read" ON pregnancies;
CREATE POLICY "Pregnancies: district read" ON pregnancies
  FOR SELECT USING (public.user_role() = 'district_officer');

DROP POLICY IF EXISTS "ANV: district read" ON antenatal_visits;
CREATE POLICY "ANV: district read" ON antenatal_visits
  FOR SELECT USING (public.user_role() = 'district_officer');

DROP POLICY IF EXISTS "Vax: district read" ON vaccinations;
CREATE POLICY "Vax: district read" ON vaccinations
  FOR SELECT USING (public.user_role() = 'district_officer');

DROP POLICY IF EXISTS "Growth: district read" ON growth_records;
CREATE POLICY "Growth: district read" ON growth_records
  FOR SELECT USING (public.user_role() = 'district_officer');

DROP POLICY IF EXISTS "Milestones: district read" ON milestones;
CREATE POLICY "Milestones: district read" ON milestones
  FOR SELECT USING (public.user_role() = 'district_officer');

DROP POLICY IF EXISTS "Referrals: district read" ON referrals;
CREATE POLICY "Referrals: district read" ON referrals
  FOR SELECT USING (public.user_role() = 'district_officer');

-- --------------------------------------------------
-- 4. profiles trigger fix — public signups must not
--    fail NOT NULL on facility_id / avatar_url. Make
--    them nullable (facility is assigned later by
--    an admin when the profile becomes a worker).
-- --------------------------------------------------
ALTER TABLE profiles ALTER COLUMN facility_id DROP NOT NULL;
ALTER TABLE profiles ALTER COLUMN avatar_url DROP NOT NULL;
