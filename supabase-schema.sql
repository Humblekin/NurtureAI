-- ============================================
-- NurtureAI — Full Supabase Schema
-- Run this in Supabase SQL Editor
-- Safe to re-run (drops old policies/triggers first)
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
DROP TRIGGER IF EXISTS update_weekly_journals_updated_at ON weekly_journals;

-- Drop existing functions
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.user_role() CASCADE;

-- Drop existing tables (in reverse dependency order) — COMMENT OUT if you have data
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
-- DROP TABLE IF EXISTS facilities CASCADE;
-- DROP TABLE IF EXISTS districts CASCADE;

-- ============================================
-- 1. DISTRICTS
-- ============================================
CREATE TABLE IF NOT EXISTS districts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  region TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 2. FACILITIES
-- ============================================
CREATE TABLE IF NOT EXISTS facilities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('hospital', 'clinic', 'chps', 'health_post')),
  district_id UUID REFERENCES districts(id),
  phone TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 3. PROFILES (extends Supabase auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('mother', 'chw', 'nurse', 'doctor', 'district_officer', 'admin')),
  facility_id UUID REFERENCES facilities(id),
  community TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 4. MOTHERS
-- ============================================
CREATE TABLE IF NOT EXISTS mothers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES profiles(id),
  full_name TEXT NOT NULL,
  phone TEXT,
  date_of_birth DATE,
  community TEXT,
  blood_group TEXT CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  medical_history TEXT,
  risk_level TEXT DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  assigned_worker_id UUID REFERENCES profiles(id),
  edd DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 5. PREGNANCIES
-- ============================================
CREATE TABLE IF NOT EXISTS pregnancies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mother_id UUID REFERENCES mothers(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'miscarried', 'aborted')),
  risk_level TEXT DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  lmp DATE,
  edd DATE,
  gravida INTEGER DEFAULT 1,
  para INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 6. ANTENATAL VISITS
-- ============================================
CREATE TABLE IF NOT EXISTS antenatal_visits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pregnancy_id UUID REFERENCES pregnancies(id) ON DELETE CASCADE,
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  visit_number INTEGER,
  gestational_age INTEGER,
  weight NUMERIC(5,2),
  blood_pressure TEXT,
  fundal_height NUMERIC(5,2),
  fetal_heart_rate INTEGER,
  symptoms TEXT,
  notes TEXT,
  assessed_risk_level TEXT CHECK (assessed_risk_level IN ('low', 'medium', 'high', 'critical')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 7. CHILDREN
-- ============================================
CREATE TABLE IF NOT EXISTS children (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mother_id UUID REFERENCES mothers(id),
  full_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
  birth_weight NUMERIC(4,2),
  birth_facility TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 8. VACCINATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS vaccinations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  child_id UUID REFERENCES children(id) ON DELETE CASCADE,
  vaccine_name TEXT NOT NULL,
  date_given DATE NOT NULL DEFAULT CURRENT_DATE,
  dose INTEGER DEFAULT 1,
  batch_number TEXT,
  administered_by UUID REFERENCES profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 9. GROWTH RECORDS
-- ============================================
CREATE TABLE IF NOT EXISTS growth_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  child_id UUID REFERENCES children(id) ON DELETE CASCADE,
  recorded_date DATE NOT NULL DEFAULT CURRENT_DATE,
  weight_kg NUMERIC(5,2),
  height_cm NUMERIC(5,2),
  head_circumference_cm NUMERIC(5,2),
  muac_cm NUMERIC(4,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 10. MILESTONES
-- ============================================
CREATE TABLE IF NOT EXISTS milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  child_id UUID REFERENCES children(id) ON DELETE CASCADE,
  milestone_type TEXT NOT NULL,
  achieved_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 11. VISITS (Health Worker)
-- ============================================
CREATE TABLE IF NOT EXISTS visits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_id UUID REFERENCES profiles(id),
  patient_id UUID NOT NULL,
  patient_type TEXT NOT NULL CHECK (patient_type IN ('mother', 'child')),
  visit_type TEXT NOT NULL CHECK (visit_type IN ('home', 'facility', 'follow_up', 'emergency')),
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  findings TEXT,
  actions_taken TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 12. REFERRALS
-- ============================================
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL,
  patient_type TEXT NOT NULL CHECK (patient_type IN ('mother', 'child')),
  from_facility_id UUID REFERENCES facilities(id),
  to_facility_id UUID REFERENCES facilities(id),
  from_worker_id UUID REFERENCES profiles(id),
  urgency TEXT DEFAULT 'routine' CHECK (urgency IN ('routine', 'soon', 'urgent', 'emergency')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'completed', 'rejected')),
  reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 13. AI CONVERSATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  messages JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 14. WEEKLY JOURNALS (mother check-ins)
-- ============================================
CREATE TABLE IF NOT EXISTS weekly_journals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  pregnancy_id UUID REFERENCES pregnancies(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  mother_feeling TEXT,
  baby_movement TEXT,
  symptoms TEXT,
  mood TEXT,
  sleep_quality TEXT,
  nutrition_notes TEXT,
  water_intake TEXT,
  exercise_notes TEXT,
  medication_notes TEXT,
  weight NUMERIC(5,2),
  blood_pressure TEXT,
  additional_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 15. NOTIFICATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL,
  priority TEXT DEFAULT 'low' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  title TEXT NOT NULL,
  message TEXT,
  read BOOLEAN DEFAULT false,
  patient_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
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
ALTER TABLE facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE districts ENABLE ROW LEVEL SECURITY;

-- Drop old policies if re-running
DO $$
BEGIN
  -- Profiles
  DROP POLICY IF EXISTS "Profiles: public read" ON profiles;
  DROP POLICY IF EXISTS "Profiles: update own" ON profiles;
  DROP POLICY IF EXISTS "Profiles: admin manage" ON profiles;
  -- Mothers
  DROP POLICY IF EXISTS "Mothers: health workers read all" ON mothers;
  DROP POLICY IF EXISTS "Mothers: mothers read own" ON mothers;
  DROP POLICY IF EXISTS "Mothers: insert for health workers" ON mothers;
  DROP POLICY IF EXISTS "Mothers: update for health workers" ON mothers;
  DROP POLICY IF EXISTS "Mothers: delete for admin" ON mothers;
  -- Pregnancies
  DROP POLICY IF EXISTS "Pregnancies: read access" ON pregnancies;
  DROP POLICY IF EXISTS "Pregnancies: insert for health workers" ON pregnancies;
  DROP POLICY IF EXISTS "Pregnancies: update for health workers" ON pregnancies;
  DROP POLICY IF EXISTS "Pregnancies: delete for admin" ON pregnancies;
  -- Antenatal Visits
  DROP POLICY IF EXISTS "ANV: read access" ON antenatal_visits;
  DROP POLICY IF EXISTS "ANV: insert for health workers" ON antenatal_visits;
  DROP POLICY IF EXISTS "ANV: update for health workers" ON antenatal_visits;
  DROP POLICY IF EXISTS "ANV: delete for health workers" ON antenatal_visits;
  -- Children
  DROP POLICY IF EXISTS "Children: health workers read all" ON children;
  DROP POLICY IF EXISTS "Children: mothers read own" ON children;
  DROP POLICY IF EXISTS "Children: insert for health workers" ON children;
  DROP POLICY IF EXISTS "Children: update for health workers" ON children;
  DROP POLICY IF EXISTS "Children: delete for health workers" ON children;
  -- Vaccinations
  DROP POLICY IF EXISTS "Vax: read access" ON vaccinations;
  DROP POLICY IF EXISTS "Vax: insert for health workers" ON vaccinations;
  DROP POLICY IF EXISTS "Vax: update for health workers" ON vaccinations;
  DROP POLICY IF EXISTS "Vax: delete for health workers" ON vaccinations;
  -- Growth Records
  DROP POLICY IF EXISTS "Growth: read access" ON growth_records;
  DROP POLICY IF EXISTS "Growth: insert for health workers" ON growth_records;
  DROP POLICY IF EXISTS "Growth: update for health workers" ON growth_records;
  DROP POLICY IF EXISTS "Growth: delete for health workers" ON growth_records;
  -- Milestones
  DROP POLICY IF EXISTS "Milestones: read access" ON milestones;
  DROP POLICY IF EXISTS "Milestones: insert for health workers" ON milestones;
  DROP POLICY IF EXISTS "Milestones: update for health workers" ON milestones;
  DROP POLICY IF EXISTS "Milestones: delete for admin" ON milestones;
  -- Visits
  DROP POLICY IF EXISTS "Visits: read own" ON visits;
  DROP POLICY IF EXISTS "Visits: admin read all" ON visits;
  DROP POLICY IF EXISTS "Visits: insert own" ON visits;
  DROP POLICY IF EXISTS "Visits: update own" ON visits;
  DROP POLICY IF EXISTS "Visits: admin update all" ON visits;
  -- Referrals
  DROP POLICY IF EXISTS "Referrals: read access" ON referrals;
  DROP POLICY IF EXISTS "Referrals: insert for health workers" ON referrals;
  DROP POLICY IF EXISTS "Referrals: update for health workers" ON referrals;
  DROP POLICY IF EXISTS "Referrals: delete for admin" ON referrals;
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
END $$;

-- Profiles
CREATE POLICY "Profiles: public read" ON profiles FOR SELECT USING (true);
CREATE POLICY "Profiles: insert own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Profiles: update own" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Mothers
CREATE POLICY "Mothers: health workers read all" ON mothers
  FOR SELECT USING (public.user_role() IN ('chw', 'nurse', 'doctor', 'admin'));
CREATE POLICY "Mothers: mothers read own" ON mothers
  FOR SELECT USING (profile_id = auth.uid());
CREATE POLICY "Mothers: insert for health workers" ON mothers
  FOR INSERT WITH CHECK (public.user_role() IN ('chw', 'nurse', 'doctor', 'admin'));
CREATE POLICY "Mothers: mothers insert own" ON mothers
  FOR INSERT WITH CHECK (profile_id = auth.uid());
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
CREATE POLICY "ANV: mothers insert own" ON antenatal_visits
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM pregnancies p
      JOIN mothers m ON m.id = p.mother_id
      WHERE p.id = pregnancy_id AND m.profile_id = auth.uid())
  );
CREATE POLICY "ANV: update for health workers" ON antenatal_visits
  FOR UPDATE USING (public.user_role() IN ('chw', 'nurse', 'doctor', 'admin'));
CREATE POLICY "ANV: mothers update own" ON antenatal_visits
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM pregnancies p
      JOIN mothers m ON m.id = p.mother_id
      WHERE p.id = pregnancy_id AND m.profile_id = auth.uid())
  );
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
CREATE POLICY "Vax: mothers insert own" ON vaccinations
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM children c
      JOIN mothers m ON m.id = c.mother_id
      WHERE c.id = child_id AND m.profile_id = auth.uid())
  );
CREATE POLICY "Vax: update for health workers" ON vaccinations
  FOR UPDATE USING (public.user_role() IN ('chw', 'nurse', 'doctor', 'admin'));
CREATE POLICY "Vax: mothers update own" ON vaccinations
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM children c
      JOIN mothers m ON m.id = c.mother_id
      WHERE c.id = child_id AND m.profile_id = auth.uid())
  );
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
CREATE POLICY "Growth: mothers insert own" ON growth_records
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM children c
      JOIN mothers m ON m.id = c.mother_id
      WHERE c.id = child_id AND m.profile_id = auth.uid())
  );
CREATE POLICY "Growth: update for health workers" ON growth_records
  FOR UPDATE USING (public.user_role() IN ('chw', 'nurse', 'doctor', 'admin'));
CREATE POLICY "Growth: mothers update own" ON growth_records
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM children c
      JOIN mothers m ON m.id = c.mother_id
      WHERE c.id = child_id AND m.profile_id = auth.uid())
  );
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
CREATE POLICY "Milestones: mothers insert own" ON milestones
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM children c
      JOIN mothers m ON m.id = c.mother_id
      WHERE c.id = child_id AND m.profile_id = auth.uid())
  );
CREATE POLICY "Milestones: update for health workers" ON milestones
  FOR UPDATE USING (public.user_role() IN ('chw', 'nurse', 'doctor', 'admin'));
CREATE POLICY "Milestones: mothers update own" ON milestones
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM children c
      JOIN mothers m ON m.id = c.mother_id
      WHERE c.id = child_id AND m.profile_id = auth.uid())
  );
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

-- ============================================
-- TRIGGER: Auto-create profile on signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, role, community)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'chw'),
    COALESCE(NEW.raw_user_meta_data->>'community', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

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
CREATE TRIGGER update_referrals_updat +ed_at BEFORE UPDATE ON referrals FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_facilities_updated_at BEFORE UPDATE ON facilities FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_districts_updated_at BEFORE UPDATE ON districts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_milestones_updated_at BEFORE UPDATE ON milestones FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_ai_conversations_updated_at BEFORE UPDATE ON ai_conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_weekly_journals_updated_at BEFORE UPDATE ON weekly_journals FOR EACH ROW EXECUTE FUNCTION update_updated_at();
