-- ============================================
-- NurtureAI — Full Supabase Schema
-- Run this in Supabase SQL Editor
-- Safe to re-run (drops old policies/triggers first)
--
-- Canonical schema. Includes the provenance reframe:
--   * data_source / verified / verified_by / verified_at on clinical tables
--   * mother_reports (mother-reported info awaiting worker confirmation)
--   * district_officer read-only access
--   * RLS restrictions: clinical tables are worker-write; mother INSERTs are
--     forced to data_source='mother_registered' AND verified=false; mother
--     UPDATE policies remain permissive so mothers can edit their own info
--     without downgrading worker-verified records.
-- Supabase migrations under supabase/migrations/ apply the same changes
-- additively to the live project (id egfdluvekjygfsnxczqi).
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Drop existing triggers first (safe re-run)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS update_mothers_updated_at ON mothers;
DROP TRIGGER IF EXISTS update_pregnancies_updated_at ON pregnancies;
DROP TRIGGER IF EXISTS update_antenatal_visits_updated_at ON antenatal_visits;
DROP TRIGGER IF EXISTS update_children_updated_at ON children;
DROP TRIGGER IF EXISTS update_vaccinations_updated_at ON vaccinations;
DROP TRIGGER IF EXISTS update_growth_records_updated_at ON growth_records;
DROP TRIGGER IF EXISTS update_visits_updated_at ON visits;
DROP TRIGGER IF EXISTS update_referrals_updated_at ON referrals;
DROP TRIGGER IF EXISTS update_facilities_updated_at ON facilities;
DROP TRIGGER IF EXISTS update_districts_updated_at ON districts;
DROP TRIGGER IF EXISTS update_milestones_updated_at ON milestones;
DROP TRIGGER IF EXISTS update_ai_conversations_updated_at ON ai_conversations;
DROP TRIGGER IF EXISTS update_notifications_updated_at ON notifications;
DROP TRIGGER IF EXISTS update_weekly_journals_updated_at ON weekly_journals;
DROP TRIGGER IF EXISTS update_mother_reports_updated_at ON mother_reports;

-- Drop existing functions
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.claim_mother(text, text) CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.user_role() CASCADE;

-- Drop existing tables (in reverse dependency order) — COMMENT OUT if you have data
-- DROP TABLE IF EXISTS mother_reports CASCADE;
-- DROP TABLE IF EXISTS weekly_journals CASCADE;
-- DROP TABLE IF EXISTS ai_conversations CASCADE;
-- DROP TABLE IF EXISTS referrals CASCADE;
-- DROP TABLE IF EXISTS visits CASCADE;
-- DROP TABLE IF EXISTS milestones CASCADE;
-- DROP TABLE IF EXISTS growth_records CASCADE;
-- DROP TABLE IF EXISTS vaccinations CASCADE;
-- DROP TABLE IF EXISTS children CASCADE;
-- DROP TABLE IF EXISTS antenatal_visits CASCADE;
-- DROP TABLE IF EXISTS pregnancies CASCADE;
-- DROP TABLE IF EXISTS mothers CASCADE;
-- DROP TABLE IF EXISTS profiles CASCADE;
-- DROP TABLE IF EXISTS notifications CASCADE;
-- DROP TABLE IF EXISTS facilities CASCADE;
-- DROP TABLE IF EXISTS districts CASCADE;

-- ============================================
-- 1. DISTRICTS
-- ============================================
CREATE TABLE IF NOT EXISTS districts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT,
  region TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- ============================================
-- 2. FACILITIES
-- ============================================
CREATE TABLE IF NOT EXISTS facilities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT,
  type TEXT CHECK (type IN ('hospital', 'clinic', 'chps', 'health_post')),
  district_id UUID NOT NULL REFERENCES districts(id),
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- ============================================
-- 3. PROFILES (extends Supabase auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT NOT NULL,
  role TEXT CHECK (role IN ('mother', 'chw', 'nurse', 'doctor', 'district_officer', 'admin')),
  facility_id UUID REFERENCES facilities(id),
  community TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  preferred_language TEXT NOT NULL
);

-- ============================================
-- 4. MOTHERS
-- ============================================
CREATE TABLE IF NOT EXISTS mothers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES profiles(id),
  full_name TEXT,
  phone TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  community TEXT NOT NULL,
  blood_group TEXT NOT NULL CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  medical_history TEXT NOT NULL,
  risk_level TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  assigned_worker_id UUID NOT NULL REFERENCES profiles(id),
  edd DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  facility_id UUID NOT NULL REFERENCES facilities(id),
  birth_facility_id UUID NOT NULL REFERENCES facilities(id),
  data_source TEXT NOT NULL DEFAULT 'healthcare_worker'
    CHECK (data_source IN ('healthcare_worker', 'mother_reported', 'mother_registered', 'system')),
  verified BOOLEAN NOT NULL DEFAULT false,
  verified_by UUID REFERENCES profiles(id),
  verified_at TIMESTAMPTZ
);

-- ============================================
-- 5. PREGNANCIES
-- ============================================
CREATE TABLE IF NOT EXISTS pregnancies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mother_id UUID NOT NULL REFERENCES mothers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'miscarried', 'aborted')),
  risk_level TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  lmp DATE NOT NULL,
  edd DATE NOT NULL,
  gravida INTEGER NOT NULL DEFAULT 1,
  para INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  data_source TEXT NOT NULL DEFAULT 'healthcare_worker'
    CHECK (data_source IN ('healthcare_worker', 'mother_reported', 'mother_registered', 'system')),
  verified BOOLEAN NOT NULL DEFAULT false,
  verified_by UUID REFERENCES profiles(id),
  verified_at TIMESTAMPTZ
);

-- ============================================
-- 6. ANTENATAL VISITS
-- ============================================
CREATE TABLE IF NOT EXISTS antenatal_visits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pregnancy_id UUID NOT NULL REFERENCES pregnancies(id) ON DELETE CASCADE,
  visit_date DATE DEFAULT CURRENT_DATE,
  visit_number INTEGER NOT NULL,
  gestational_age INTEGER NOT NULL,
  weight NUMERIC(5,2) NOT NULL,
  blood_pressure TEXT NOT NULL,
  fundal_height NUMERIC(5,2) NOT NULL,
  fetal_heart_rate INTEGER NOT NULL,
  symptoms TEXT NOT NULL,
  notes TEXT NOT NULL,
  assessed_risk_level TEXT NOT NULL CHECK (assessed_risk_level IN ('low', 'medium', 'high', 'critical')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  data_source TEXT NOT NULL DEFAULT 'healthcare_worker'
    CHECK (data_source IN ('healthcare_worker', 'mother_reported', 'mother_registered', 'system')),
  verified BOOLEAN NOT NULL DEFAULT false,
  verified_by UUID REFERENCES profiles(id),
  verified_at TIMESTAMPTZ
);

-- ============================================
-- 7. CHILDREN
-- ============================================
CREATE TABLE IF NOT EXISTS children (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mother_id UUID NOT NULL REFERENCES mothers(id),
  full_name TEXT,
  date_of_birth DATE,
  gender TEXT CHECK (gender IN ('male', 'female')),
  birth_weight NUMERIC(4,2) NOT NULL,
  birth_facility TEXT NOT NULL,
  notes TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  data_source TEXT NOT NULL DEFAULT 'healthcare_worker'
    CHECK (data_source IN ('healthcare_worker', 'mother_reported', 'mother_registered', 'system')),
  verified BOOLEAN NOT NULL DEFAULT false,
  verified_by UUID REFERENCES profiles(id),
  verified_at TIMESTAMPTZ
);

-- ============================================
-- 8. VACCINATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS vaccinations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  vaccine_name TEXT,
  date_given DATE DEFAULT CURRENT_DATE,
  dose INTEGER NOT NULL DEFAULT 1,
  batch_number TEXT NOT NULL,
  administered_by UUID NOT NULL REFERENCES profiles(id),
  notes TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  data_source TEXT NOT NULL DEFAULT 'healthcare_worker'
    CHECK (data_source IN ('healthcare_worker', 'mother_reported', 'mother_registered', 'system')),
  verified BOOLEAN NOT NULL DEFAULT false,
  verified_by UUID REFERENCES profiles(id),
  verified_at TIMESTAMPTZ
);

-- ============================================
-- 9. GROWTH RECORDS
-- ============================================
CREATE TABLE IF NOT EXISTS growth_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  recorded_date DATE DEFAULT CURRENT_DATE,
  weight_kg NUMERIC(5,2) NOT NULL,
  height_cm NUMERIC(5,2) NOT NULL,
  head_circumference_cm NUMERIC(5,2) NOT NULL,
  muac_cm NUMERIC(4,2) NOT NULL,
  notes TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  data_source TEXT NOT NULL DEFAULT 'healthcare_worker'
    CHECK (data_source IN ('healthcare_worker', 'mother_reported', 'mother_registered', 'system')),
  verified BOOLEAN NOT NULL DEFAULT false,
  verified_by UUID REFERENCES profiles(id),
  verified_at TIMESTAMPTZ
);

-- ============================================
-- 10. MILESTONES
-- ============================================
CREATE TABLE IF NOT EXISTS milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  milestone_type TEXT,
  achieved_date DATE NOT NULL,
  notes TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  data_source TEXT NOT NULL DEFAULT 'healthcare_worker'
    CHECK (data_source IN ('healthcare_worker', 'mother_reported', 'mother_registered', 'system')),
  verified BOOLEAN NOT NULL DEFAULT false,
  verified_by UUID REFERENCES profiles(id),
  verified_at TIMESTAMPTZ
);

-- ============================================
-- 11. VISITS (Health Worker)
-- ============================================
CREATE TABLE IF NOT EXISTS visits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_id UUID NOT NULL REFERENCES profiles(id),
  patient_id UUID,
  patient_type TEXT CHECK (patient_type IN ('mother', 'child')),
  visit_type TEXT CHECK (visit_type IN ('home', 'facility', 'follow_up', 'emergency')),
  visit_date DATE DEFAULT CURRENT_DATE,
  notes TEXT NOT NULL,
  findings TEXT NOT NULL,
  actions_taken TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- ============================================
-- 12. REFERRALS
-- ============================================
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID,
  patient_type TEXT CHECK (patient_type IN ('mother', 'child')),
  from_facility_id UUID NOT NULL REFERENCES facilities(id),
  to_facility_id UUID NOT NULL REFERENCES facilities(id),
  from_worker_id UUID NOT NULL REFERENCES profiles(id),
  urgency TEXT NOT NULL DEFAULT 'routine' CHECK (urgency IN ('routine', 'soon', 'urgent', 'emergency')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'completed', 'rejected')),
  reason TEXT NOT NULL,
  notes TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  data_source TEXT NOT NULL DEFAULT 'healthcare_worker'
    CHECK (data_source IN ('healthcare_worker', 'mother_reported', 'mother_registered', 'system')),
  verified BOOLEAN NOT NULL DEFAULT false,
  verified_by UUID REFERENCES profiles(id),
  verified_at TIMESTAMPTZ
);

-- ============================================
-- 13. AI CONVERSATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  messages JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  summary TEXT NOT NULL,
  topics TEXT[] NOT NULL,
  message_count INTEGER NOT NULL,
  last_message TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL
);

-- ============================================
-- 14. WEEKLY JOURNALS (mother check-ins)
-- ============================================
CREATE TABLE IF NOT EXISTS weekly_journals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  pregnancy_id UUID NOT NULL REFERENCES pregnancies(id) ON DELETE CASCADE,
  week_number INTEGER,
  entry_date DATE DEFAULT CURRENT_DATE,
  mother_feeling TEXT NOT NULL,
  baby_movement TEXT NOT NULL,
  symptoms TEXT NOT NULL,
  mood TEXT NOT NULL,
  sleep_quality TEXT NOT NULL,
  nutrition_notes TEXT NOT NULL,
  water_intake TEXT NOT NULL,
  exercise_notes TEXT NOT NULL,
  medication_notes TEXT NOT NULL,
  weight NUMERIC(5,2) NOT NULL,
  blood_pressure TEXT NOT NULL,
  additional_notes TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- ============================================
-- 15. NOTIFICATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT,
  priority TEXT NOT NULL DEFAULT 'low' CHECK (priority IN ('low', 'medium', 'high', 'urgent', 'critical')),
  title TEXT,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  patient_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  user_id UUID NOT NULL REFERENCES profiles(id),
  child_name TEXT,
  voice_message TEXT,
  referral_id UUID,
  assign_to_worker UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 16. MOTHER REPORTS (mother-reported info awaiting
--     worker confirmation; Amina-collected data lands here)
-- ============================================
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

-- ============================================
-- INDEXES (safe to re-run)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_facility ON profiles(facility_id);
CREATE INDEX IF NOT EXISTS idx_mothers_community ON mothers(community);
CREATE INDEX IF NOT EXISTS idx_mothers_worker ON mothers(assigned_worker_id);
CREATE INDEX IF NOT EXISTS idx_pregnancies_mother ON pregnancies(mother_id);
CREATE INDEX IF NOT EXISTS idx_pregnancies_status ON pregnancies(status);
CREATE INDEX IF NOT EXISTS idx_antenatal_visits_pregnancy ON antenatal_visits(pregnancy_id);
CREATE INDEX IF NOT EXISTS idx_children_mother ON children(mother_id);
CREATE INDEX IF NOT EXISTS idx_vaccinations_child ON vaccinations(child_id);
CREATE INDEX IF NOT EXISTS idx_growth_records_child ON growth_records(child_id);
CREATE INDEX IF NOT EXISTS idx_visits_worker ON visits(worker_id);
CREATE INDEX IF NOT EXISTS idx_visits_patient ON visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);
CREATE INDEX IF NOT EXISTS idx_notifications_patient ON notifications(patient_id);
CREATE INDEX IF NOT EXISTS idx_weekly_journals_pregnancy ON weekly_journals(pregnancy_id);
CREATE INDEX IF NOT EXISTS idx_weekly_journals_user ON weekly_journals(user_id);
CREATE INDEX IF NOT EXISTS idx_mother_reports_mother ON mother_reports(mother_id);
CREATE INDEX IF NOT EXISTS idx_mother_reports_status ON mother_reports(status);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Helper: check role via JWT (avoids self-referencing profiles table)
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS TEXT AS $$
  SELECT COALESCE(
    (SELECT role FROM public.profiles WHERE id = auth.uid()),
    ''
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE mothers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pregnancies ENABLE ROW LEVEL SECURITY;
ALTER TABLE antenatal_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE children ENABLE ROW LEVEL SECURITY;
ALTER TABLE vaccinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE mother_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE districts ENABLE ROW LEVEL SECURITY;

-- Drop old policies if re-running
DO $$
BEGIN
  -- Profiles
  DROP POLICY IF EXISTS "Profiles: public read" ON profiles;
  DROP POLICY IF EXISTS "Profiles: insert own" ON profiles;
  DROP POLICY IF EXISTS "Profiles: update own" ON profiles;
  DROP POLICY IF EXISTS "Profiles: admin manage" ON profiles;
  -- Mothers
  DROP POLICY IF EXISTS "Mothers: health workers read all" ON mothers;
  DROP POLICY IF EXISTS "Mothers: mothers read own" ON mothers;
  DROP POLICY IF EXISTS "Mothers: insert for health workers" ON mothers;
  DROP POLICY IF EXISTS "Mothers: mothers insert own" ON mothers;
  DROP POLICY IF EXISTS "Mothers: update for health workers" ON mothers;
  DROP POLICY IF EXISTS "Mothers: mothers update own" ON mothers;
  DROP POLICY IF EXISTS "Mothers: delete for admin" ON mothers;
  -- Pregnancies
  DROP POLICY IF EXISTS "Pregnancies: read access" ON pregnancies;
  DROP POLICY IF EXISTS "Pregnancies: insert for health workers" ON pregnancies;
  DROP POLICY IF EXISTS "Pregnancies: mothers insert own" ON pregnancies;
  DROP POLICY IF EXISTS "Pregnancies: update for health workers" ON pregnancies;
  DROP POLICY IF EXISTS "Pregnancies: mothers update own" ON pregnancies;
  DROP POLICY IF EXISTS "Pregnancies: delete for admin" ON pregnancies;
  -- Antenatal Visits
  DROP POLICY IF EXISTS "ANV: read access" ON antenatal_visits;
  DROP POLICY IF EXISTS "ANV: insert for health workers" ON antenatal_visits;
  DROP POLICY IF EXISTS "ANV: mothers insert own" ON antenatal_visits;
  DROP POLICY IF EXISTS "ANV: update for health workers" ON antenatal_visits;
  DROP POLICY IF EXISTS "ANV: mothers update own" ON antenatal_visits;
  DROP POLICY IF EXISTS "ANV: delete for health workers" ON antenatal_visits;
  -- Children
  DROP POLICY IF EXISTS "Children: health workers read all" ON children;
  DROP POLICY IF EXISTS "Children: mothers read own" ON children;
  DROP POLICY IF EXISTS "Children: insert for health workers" ON children;
  DROP POLICY IF EXISTS "Children: mothers insert own" ON children;
  DROP POLICY IF EXISTS "Children: update for health workers" ON children;
  DROP POLICY IF EXISTS "Children: mothers update own" ON children;
  DROP POLICY IF EXISTS "Children: delete for health workers" ON children;
  -- Vaccinations
  DROP POLICY IF EXISTS "Vax: read access" ON vaccinations;
  DROP POLICY IF EXISTS "Vax: insert for health workers" ON vaccinations;
  DROP POLICY IF EXISTS "Vax: mothers insert own" ON vaccinations;
  DROP POLICY IF EXISTS "Vax: update for health workers" ON vaccinations;
  DROP POLICY IF EXISTS "Vax: mothers update own" ON vaccinations;
  DROP POLICY IF EXISTS "Vax: delete for health workers" ON vaccinations;
  -- Growth Records
  DROP POLICY IF EXISTS "Growth: read access" ON growth_records;
  DROP POLICY IF EXISTS "Growth: insert for health workers" ON growth_records;
  DROP POLICY IF EXISTS "Growth: mothers insert own" ON growth_records;
  DROP POLICY IF EXISTS "Growth: update for health workers" ON growth_records;
  DROP POLICY IF EXISTS "Growth: mothers update own" ON growth_records;
  DROP POLICY IF EXISTS "Growth: delete for health workers" ON growth_records;
  -- Milestones
  DROP POLICY IF EXISTS "Milestones: read access" ON milestones;
  DROP POLICY IF EXISTS "Milestones: insert for health workers" ON milestones;
  DROP POLICY IF EXISTS "Milestones: mothers insert own" ON milestones;
  DROP POLICY IF EXISTS "Milestones: update for health workers" ON milestones;
  DROP POLICY IF EXISTS "Milestones: mothers update own" ON milestones;
  DROP POLICY IF EXISTS "Milestones: delete for admin" ON milestones;
  -- Visits
  DROP POLICY IF EXISTS "Visits: read own" ON visits;
  DROP POLICY IF EXISTS "Visits: admin read all" ON visits;
  DROP POLICY IF EXISTS "Visits: insert own" ON visits;
  DROP POLICY IF EXISTS "Visits: update own" ON visits;
  DROP POLICY IF EXISTS "Visits: admin update all" ON visits;
  DROP POLICY IF EXISTS "Visits: mothers read own" ON visits;
  -- Referrals
  DROP POLICY IF EXISTS "Referrals: read access" ON referrals;
  DROP POLICY IF EXISTS "Referrals: insert for health workers" ON referrals;
  DROP POLICY IF EXISTS "Referrals: update for health workers" ON referrals;
  DROP POLICY IF EXISTS "Referrals: delete for admin" ON referrals;
  DROP POLICY IF EXISTS "Referrals: mothers read own" ON referrals;
  -- Notifications
  DROP POLICY IF EXISTS "Notifications: read own" ON notifications;
  DROP POLICY IF EXISTS "Notifications: insert own" ON notifications;
  DROP POLICY IF EXISTS "Notifications: update own" ON notifications;
  -- AI
  DROP POLICY IF EXISTS "AI: read own" ON ai_conversations;
  DROP POLICY IF EXISTS "AI: insert own" ON ai_conversations;
  DROP POLICY IF EXISTS "AI: update own" ON ai_conversations;
  DROP POLICY IF EXISTS "AI: delete own" ON ai_conversations;
  -- Weekly Journals
  DROP POLICY IF EXISTS "WJ: read own" ON weekly_journals;
  DROP POLICY IF EXISTS "WJ: insert own" ON weekly_journals;
  DROP POLICY IF EXISTS "WJ: update own" ON weekly_journals;
  DROP POLICY IF EXISTS "WJ: health workers read all" ON weekly_journals;
  -- Facilities & Districts
  DROP POLICY IF EXISTS "Facilities: public read" ON facilities;
  DROP POLICY IF EXISTS "Facilities: admin manage" ON facilities;
  DROP POLICY IF EXISTS "Districts: public read" ON districts;
  DROP POLICY IF EXISTS "Districts: admin manage" ON districts;
  -- Mother Reports
  DROP POLICY IF EXISTS "MotherReports: mothers insert own" ON mother_reports;
  DROP POLICY IF EXISTS "MotherReports: mothers read own" ON mother_reports;
  DROP POLICY IF EXISTS "MotherReports: mothers update own" ON mother_reports;
  DROP POLICY IF EXISTS "MotherReports: health workers read assigned" ON mother_reports;
  DROP POLICY IF EXISTS "MotherReports: health workers update assigned" ON mother_reports;
  -- District Officer reads
  DROP POLICY IF EXISTS "Mothers: district read" ON mothers;
  DROP POLICY IF EXISTS "Children: district read" ON children;
  DROP POLICY IF EXISTS "Pregnancies: district read" ON pregnancies;
  DROP POLICY IF EXISTS "ANV: district read" ON antenatal_visits;
  DROP POLICY IF EXISTS "Vax: district read" ON vaccinations;
  DROP POLICY IF EXISTS "Growth: district read" ON growth_records;
  DROP POLICY IF EXISTS "Milestones: district read" ON milestones;
  DROP POLICY IF EXISTS "Referrals: district read" ON referrals;
END $$;

-- Profiles
-- Phase 5 hardening: mothers can only read their own row plus health-worker
-- rows; health workers/admins keep read-all. Role can only change when the
-- caller is already an admin (no self-service role escalation).
CREATE POLICY "Profiles: public read" ON profiles FOR SELECT USING (
  auth.uid() = id
  OR public.user_role() IN ('chw', 'nurse', 'doctor', 'district_officer', 'admin')
  OR role IN ('chw', 'nurse', 'doctor', 'district_officer', 'admin')
);
CREATE POLICY "Profiles: insert own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Profiles: update own" ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND (
      role = (SELECT role FROM public.profiles WHERE id = auth.uid())
      OR public.user_role() = 'admin'
    )
  );

-- Mothers
CREATE POLICY "Mothers: health workers read all" ON mothers
  FOR SELECT USING (public.user_role() IN ('chw', 'nurse', 'doctor', 'admin'));
CREATE POLICY "Mothers: mothers read own" ON mothers
  FOR SELECT USING (profile_id = auth.uid());
CREATE POLICY "Mothers: insert for health workers" ON mothers
  FOR INSERT WITH CHECK (public.user_role() IN ('chw', 'nurse', 'doctor', 'admin'));
CREATE POLICY "Mothers: mothers insert own" ON mothers
  FOR INSERT WITH CHECK (
    profile_id = auth.uid()
    AND data_source = 'mother_registered'
    AND verified = false
  );
CREATE POLICY "Mothers: update for health workers" ON mothers
  FOR UPDATE USING (public.user_role() IN ('chw', 'nurse', 'doctor', 'admin'));
CREATE POLICY "Mothers: mothers update own" ON mothers
  FOR UPDATE USING (profile_id = auth.uid());
CREATE POLICY "Mothers: delete for admin" ON mothers
  FOR DELETE USING (public.user_role() = 'admin');

-- Pregnancies
CREATE POLICY "Pregnancies: read access" ON pregnancies
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM mothers WHERE id = mother_id AND (
      profile_id = auth.uid() OR public.user_role() IN ('chw', 'nurse', 'doctor', 'admin')
    ))
  );
CREATE POLICY "Pregnancies: insert for health workers" ON pregnancies
  FOR INSERT WITH CHECK (public.user_role() IN ('chw', 'nurse', 'doctor', 'admin'));
CREATE POLICY "Pregnancies: mothers insert own" ON pregnancies
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM mothers WHERE id = mother_id AND profile_id = auth.uid())
    AND data_source = 'mother_registered'
    AND verified = false
  );
CREATE POLICY "Pregnancies: update for health workers" ON pregnancies
  FOR UPDATE USING (public.user_role() IN ('chw', 'nurse', 'doctor', 'admin'));
CREATE POLICY "Pregnancies: mothers update own" ON pregnancies
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM mothers WHERE id = mother_id AND profile_id = auth.uid())
  );
CREATE POLICY "Pregnancies: delete for admin" ON pregnancies
  FOR DELETE USING (public.user_role() = 'admin');

-- Antenatal Visits
CREATE POLICY "ANV: read access" ON antenatal_visits
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM pregnancies p
      JOIN mothers m ON m.id = p.mother_id
      WHERE p.id = pregnancy_id AND (
        m.profile_id = auth.uid() OR public.user_role() IN ('chw', 'nurse', 'doctor', 'admin')
      ))
  );
CREATE POLICY "ANV: insert for health workers" ON antenatal_visits
  FOR INSERT WITH CHECK (public.user_role() IN ('chw', 'nurse', 'doctor', 'admin'));
CREATE POLICY "ANV: update for health workers" ON antenatal_visits
  FOR UPDATE USING (public.user_role() IN ('chw', 'nurse', 'doctor', 'admin'));
CREATE POLICY "ANV: delete for health workers" ON antenatal_visits
  FOR DELETE USING (public.user_role() IN ('nurse', 'doctor', 'admin'));

-- Children
CREATE POLICY "Children: health workers read all" ON children
  FOR SELECT USING (public.user_role() IN ('chw', 'nurse', 'doctor', 'admin'));
CREATE POLICY "Children: mothers read own" ON children
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM mothers WHERE id = mother_id AND profile_id = auth.uid())
  );
CREATE POLICY "Children: insert for health workers" ON children
  FOR INSERT WITH CHECK (public.user_role() IN ('chw', 'nurse', 'doctor', 'admin'));
CREATE POLICY "Children: mothers insert own" ON children
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM mothers WHERE id = mother_id AND profile_id = auth.uid())
    AND data_source = 'mother_registered'
    AND verified = false
  );
CREATE POLICY "Children: update for health workers" ON children
  FOR UPDATE USING (public.user_role() IN ('chw', 'nurse', 'doctor', 'admin'));
CREATE POLICY "Children: mothers update own" ON children
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM mothers WHERE id = mother_id AND profile_id = auth.uid())
  );
CREATE POLICY "Children: delete for health workers" ON children
  FOR DELETE USING (public.user_role() IN ('nurse', 'doctor', 'admin'));

-- Vaccinations
CREATE POLICY "Vax: read access" ON vaccinations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM children c
      JOIN mothers m ON m.id = c.mother_id
      WHERE c.id = child_id AND (
        m.profile_id = auth.uid() OR public.user_role() IN ('chw', 'nurse', 'doctor', 'admin')
      ))
  );
CREATE POLICY "Vax: insert for health workers" ON vaccinations
  FOR INSERT WITH CHECK (public.user_role() IN ('chw', 'nurse', 'doctor', 'admin'));
CREATE POLICY "Vax: update for health workers" ON vaccinations
  FOR UPDATE USING (public.user_role() IN ('chw', 'nurse', 'doctor', 'admin'));
CREATE POLICY "Vax: delete for health workers" ON vaccinations
  FOR DELETE USING (public.user_role() IN ('nurse', 'doctor', 'admin'));

-- Growth Records
CREATE POLICY "Growth: read access" ON growth_records
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM children c
      JOIN mothers m ON m.id = c.mother_id
      WHERE c.id = child_id AND (
        m.profile_id = auth.uid() OR public.user_role() IN ('chw', 'nurse', 'doctor', 'admin')
      ))
  );
CREATE POLICY "Growth: insert for health workers" ON growth_records
  FOR INSERT WITH CHECK (public.user_role() IN ('chw', 'nurse', 'doctor', 'admin'));
CREATE POLICY "Growth: update for health workers" ON growth_records
  FOR UPDATE USING (public.user_role() IN ('chw', 'nurse', 'doctor', 'admin'));
CREATE POLICY "Growth: delete for health workers" ON growth_records
  FOR DELETE USING (public.user_role() IN ('nurse', 'doctor', 'admin'));

-- Milestones
CREATE POLICY "Milestones: read access" ON milestones
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM children c
      JOIN mothers m ON m.id = c.mother_id
      WHERE c.id = child_id AND (
        m.profile_id = auth.uid() OR public.user_role() IN ('chw', 'nurse', 'doctor', 'admin')
      ))
  );
CREATE POLICY "Milestones: insert for health workers" ON milestones
  FOR INSERT WITH CHECK (public.user_role() IN ('chw', 'nurse', 'doctor', 'admin'));
CREATE POLICY "Milestones: update for health workers" ON milestones
  FOR UPDATE USING (public.user_role() IN ('chw', 'nurse', 'doctor', 'admin'));
CREATE POLICY "Milestones: delete for admin" ON milestones
  FOR DELETE USING (public.user_role() = 'admin');

-- Visits
CREATE POLICY "Visits: read own" ON visits FOR SELECT
  USING (worker_id = auth.uid() OR patient_id = auth.uid());
CREATE POLICY "Visits: admin read all" ON visits FOR SELECT
  USING (public.user_role() IN ('admin', 'district_officer'));
CREATE POLICY "Visits: insert own" ON visits FOR INSERT
  WITH CHECK (worker_id = auth.uid() OR public.user_role() IN ('chw', 'nurse', 'doctor', 'admin'));
CREATE POLICY "Visits: update own" ON visits FOR UPDATE
  USING (worker_id = auth.uid());
CREATE POLICY "Visits: admin update all" ON visits FOR UPDATE
  USING (public.user_role() IN ('admin', 'district_officer'));
CREATE POLICY "Visits: mothers read own" ON visits FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM mothers m WHERE m.id = visits.patient_id AND m.profile_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM children c JOIN mothers m ON m.id = c.mother_id
      WHERE c.id = visits.patient_id AND m.profile_id = auth.uid()
    )
  );

-- Referrals
CREATE POLICY "Referrals: read access" ON referrals
  FOR SELECT USING (
    from_worker_id = auth.uid() OR public.user_role() IN ('admin', 'nurse', 'doctor')
  );
CREATE POLICY "Referrals: insert for health workers" ON referrals
  FOR INSERT WITH CHECK (from_worker_id = auth.uid() OR public.user_role() IN ('chw', 'nurse', 'doctor', 'admin'));
CREATE POLICY "Referrals: update for health workers" ON referrals
  FOR UPDATE USING (public.user_role() IN ('nurse', 'doctor', 'admin'));
CREATE POLICY "Referrals: delete for admin" ON referrals
  FOR DELETE USING (public.user_role() = 'admin');
CREATE POLICY "Referrals: mothers read own" ON referrals FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM mothers m WHERE m.id = referrals.patient_id AND m.profile_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM children c JOIN mothers m ON m.id = c.mother_id
      WHERE c.id = referrals.patient_id AND m.profile_id = auth.uid()
    )
  );

-- Notifications
CREATE POLICY "Notifications: read own" ON notifications
  FOR SELECT USING (user_id = auth.uid() OR patient_id = auth.uid());
CREATE POLICY "Notifications: insert own" ON notifications
  FOR INSERT WITH CHECK (user_id = auth.uid() OR patient_id = auth.uid());
CREATE POLICY "Notifications: update own" ON notifications
  FOR UPDATE USING (user_id = auth.uid() OR patient_id = auth.uid());

-- AI Conversations
CREATE POLICY "AI: read own" ON ai_conversations
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "AI: insert own" ON ai_conversations
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "AI: update own" ON ai_conversations
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "AI: delete own" ON ai_conversations
  FOR DELETE USING (user_id = auth.uid());

-- Weekly Journals
CREATE POLICY "WJ: read own" ON weekly_journals
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM pregnancies p
      JOIN mothers m ON m.id = p.mother_id
      WHERE p.id = pregnancy_id AND (
        m.profile_id = auth.uid() OR public.user_role() IN ('chw', 'nurse', 'doctor', 'admin')
      ))
  );
CREATE POLICY "WJ: insert own" ON weekly_journals
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "WJ: update own" ON weekly_journals
  FOR UPDATE USING (user_id = auth.uid());

-- Facilities & Districts
CREATE POLICY "Facilities: public read" ON facilities FOR SELECT USING (true);
CREATE POLICY "Facilities: admin manage" ON facilities FOR ALL
  USING (public.user_role() = 'admin');
CREATE POLICY "Districts: public read" ON districts FOR SELECT USING (true);
CREATE POLICY "Districts: admin manage" ON districts FOR ALL
  USING (public.user_role() = 'admin');

-- District Officer — read-only aggregated access (no writes)
CREATE POLICY "Mothers: district read" ON mothers
  FOR SELECT USING (public.user_role() = 'district_officer');
CREATE POLICY "Children: district read" ON children
  FOR SELECT USING (public.user_role() = 'district_officer');
CREATE POLICY "Pregnancies: district read" ON pregnancies
  FOR SELECT USING (public.user_role() = 'district_officer');
CREATE POLICY "ANV: district read" ON antenatal_visits
  FOR SELECT USING (public.user_role() = 'district_officer');
CREATE POLICY "Vax: district read" ON vaccinations
  FOR SELECT USING (public.user_role() = 'district_officer');
CREATE POLICY "Growth: district read" ON growth_records
  FOR SELECT USING (public.user_role() = 'district_officer');
CREATE POLICY "Milestones: district read" ON milestones
  FOR SELECT USING (public.user_role() = 'district_officer');
CREATE POLICY "Referrals: district read" ON referrals
  FOR SELECT USING (public.user_role() = 'district_officer');

-- Mother Reports — mother-reported info awaiting worker confirmation
CREATE POLICY "MotherReports: mothers insert own" ON mother_reports
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM mothers WHERE id = mother_id AND profile_id = auth.uid())
  );
CREATE POLICY "MotherReports: mothers read own" ON mother_reports
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM mothers WHERE id = mother_id AND profile_id = auth.uid())
  );
CREATE POLICY "MotherReports: mothers update own" ON mother_reports
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM mothers WHERE id = mother_id AND profile_id = auth.uid())
  );
CREATE POLICY "MotherReports: health workers read assigned" ON mother_reports
  FOR SELECT USING (
    public.user_role() IN ('chw', 'nurse', 'doctor', 'admin')
    AND EXISTS (
      SELECT 1 FROM mothers m WHERE m.id = mother_id
      AND (m.assigned_worker_id = auth.uid() OR public.user_role() IN ('nurse', 'doctor', 'admin'))
    )
  );
CREATE POLICY "MotherReports: health workers update assigned" ON mother_reports
  FOR UPDATE USING (
    public.user_role() IN ('chw', 'nurse', 'doctor', 'admin')
    AND EXISTS (
      SELECT 1 FROM mothers m WHERE m.id = mother_id
      AND (m.assigned_worker_id = auth.uid() OR public.user_role() IN ('nurse', 'doctor', 'admin'))
    )
  );

-- ============================================
-- TRIGGER: Auto-create profile on signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Public self-registration always creates a mother profile.
  -- Worker/admin roles are assigned exclusively by an authorized admin flow
  -- (e.g. an admin-updated profile.role), never from client-supplied metadata.
  INSERT INTO public.profiles (id, full_name, phone, role, community, preferred_language)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    'mother',
    COALESCE(NEW.raw_user_meta_data->>'community', ''),
    COALESCE(NEW.raw_user_meta_data->>'preferred_language', 'en')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- CLAIM MOTHER RECORD
-- Links an unclaimed mother record (created by a healthcare worker before
-- the mother had an account; profile_id IS NULL) to the mother's auth account.
-- Called by the mother during onboarding so a second (duplicate) record is
-- NOT created. Matching is strict: exact phone + full name (case-insensitive),
-- the record must be unclaimed and not deleted, and the caller must not
-- already own a mother record.
-- ============================================
CREATE OR REPLACE FUNCTION public.claim_mother(p_phone TEXT, p_full_name TEXT)
RETURNS SETOF mothers
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  matched uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Caller already has a linked mother record: never claim a second one.
  IF EXISTS (SELECT 1 FROM mothers WHERE profile_id = uid AND deleted_at IS NULL) THEN
    RETURN;
  END IF;

  SELECT m.id INTO matched
  FROM mothers m
  WHERE m.deleted_at IS NULL
    AND m.profile_id IS NULL
    AND lower(btrim(COALESCE(m.phone, ''))) = lower(btrim(COALESCE(p_phone, '')))
    AND lower(btrim(COALESCE(m.full_name, ''))) = lower(btrim(COALESCE(p_full_name, '')))
  ORDER BY m.created_at ASC
  LIMIT 1;

  IF matched IS NULL THEN
    RETURN;
  END IF;

  UPDATE mothers SET profile_id = uid, updated_at = now() WHERE id = matched;

  RETURN QUERY SELECT m.* FROM mothers m WHERE m.id = matched;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_mother(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_mother(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.claim_mother(text, text) TO authenticated;

-- ============================================
-- TRIGGER: Auto-update updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_mothers_updated_at BEFORE UPDATE ON mothers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_pregnancies_updated_at BEFORE UPDATE ON pregnancies FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_antenatal_visits_updated_at BEFORE UPDATE ON antenatal_visits FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_children_updated_at BEFORE UPDATE ON children FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_vaccinations_updated_at BEFORE UPDATE ON vaccinations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_growth_records_updated_at BEFORE UPDATE ON growth_records FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_visits_updated_at BEFORE UPDATE ON visits FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_referrals_updated_at BEFORE UPDATE ON referrals FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_facilities_updated_at BEFORE UPDATE ON facilities FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_districts_updated_at BEFORE UPDATE ON districts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_milestones_updated_at BEFORE UPDATE ON milestones FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_ai_conversations_updated_at BEFORE UPDATE ON ai_conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_weekly_journals_updated_at BEFORE UPDATE ON weekly_journals FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_mother_reports_updated_at BEFORE UPDATE ON mother_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at();
