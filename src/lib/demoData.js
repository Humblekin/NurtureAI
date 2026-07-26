import db, { generateId } from './db';

/**
 * NurtureAI — Demo Data Seeder
 *
 * Populates IndexedDB with realistic maternal & child healthcare data
 * so the app feels alive on first launch. Only runs if the database is empty.
 *
 * All data is fictional and inspired by real Ghana healthcare scenarios.
 *
 * NOTE: Field names MUST match the Supabase schema exactly to avoid sync 400 errors.
 */

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function weeksAgo(n) {
  return daysAgo(n * 7);
}

function monthsAgo(n) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString();
}

/**
 * Check if demo data has already been seeded.
 */
export async function isDemoDataSeeded() {
  const mothers = await db.mothers.count();
  return mothers > 0;
}

/**
 * Seed the full demo dataset for a mother user.
 * Creates: mother profile, active pregnancy, ANC visits, children, vaccinations,
 * growth records, CHW visits, referrals, and notifications.
 */
export async function seedDemoData(profileId) {
  const alreadySeeded = await isDemoDataSeeded();
  if (alreadySeeded) return false;

  const motherId = generateId();
  const pregnancyId = generateId();
  const child1Id = generateId();
  const child2Id = generateId();

  // ── Mother Record ──────────────────────────────────
  // Columns: id, profile_id, full_name, phone, date_of_birth, community,
  //          blood_group, medical_history, risk_level, assigned_worker_id, edd, created_at
  const mother = {
    id: motherId,
    profile_id: profileId,
    full_name: 'Fatima Abdulai',
    date_of_birth: '1998-05-15',
    phone: '+233241234567',
    community: 'Tamale South',
    blood_group: 'O+',
    medical_history: 'No significant medical history. Previous pregnancies uncomplicated.',
    risk_level: 'low',
    assigned_worker_id: null,
    edd: null, // Will be set from pregnancy
    synced_at: null,
    created_at: weeksAgo(26),
  };

  // ── Active Pregnancy (24 weeks along) ───────────────
  const lmpDate = new Date();
  lmpDate.setDate(lmpDate.getDate() - 24 * 7);

  const eddDate = new Date(lmpDate);
  eddDate.setDate(eddDate.getDate() + 40 * 7);

  const pregnancy = {
    id: pregnancyId,
    mother_id: motherId,
    status: 'active',
    risk_level: 'low',
    lmp: lmpDate.toISOString().split('T')[0],
    edd: eddDate.toISOString().split('T')[0],
    gravida: 3,
    para: 2,
    notes: 'Third pregnancy. Previous deliveries uncomplicated.',
    synced_at: null,
    created_at: weeksAgo(24),
  };

  // Update mother's EDD
  mother.edd = pregnancy.edd;

  // ── Antenatal Visits (4 visits) ─────────────────────
  // Columns: id, pregnancy_id, visit_date, visit_number, gestational_age,
  //          weight, blood_pressure (TEXT), fundal_height, fetal_heart_rate,
  //          symptoms, notes, assessed_risk_level
  const ancVisits = [
    {
      id: generateId(),
      pregnancy_id: pregnancyId,
      visit_number: 1,
      visit_date: weeksAgo(20),
      gestational_age: 4,
      weight: 62,
      blood_pressure: '118/76',
      fundal_height: 18,
      fetal_heart_rate: 140,
      symptoms: 'none',
      notes: 'First ANC visit. Mother healthy, no complications. Started iron supplements.',
      assessed_risk_level: 'low',
      synced_at: null,
      created_at: weeksAgo(20),
    },
    {
      id: generateId(),
      pregnancy_id: pregnancyId,
      visit_number: 2,
      visit_date: weeksAgo(14),
      gestational_age: 10,
      weight: 64,
      blood_pressure: '120/78',
      fundal_height: 22,
      fetal_heart_rate: 142,
      symptoms: 'none',
      notes: 'Second ANC. Growth on track. Ultrasound requested.',
      assessed_risk_level: 'low',
      synced_at: null,
      created_at: weeksAgo(14),
    },
    {
      id: generateId(),
      pregnancy_id: pregnancyId,
      visit_number: 3,
      visit_date: weeksAgo(6),
      gestational_age: 18,
      weight: 66,
      blood_pressure: '122/80',
      fundal_height: 26,
      fetal_heart_rate: 138,
      symptoms: 'mild fatigue',
      notes: 'Third ANC. Baby is growing well. Continue iron and folic acid.',
      assessed_risk_level: 'low',
      synced_at: null,
      created_at: weeksAgo(6),
    },
    {
      id: generateId(),
      pregnancy_id: pregnancyId,
      visit_number: 4,
      visit_date: weeksAgo(1),
      gestational_age: 23,
      weight: 67,
      blood_pressure: '124/82',
      fundal_height: 28,
      fetal_heart_rate: 140,
      symptoms: 'none',
      notes: 'Fourth ANC. Third trimester. Discussed birth plan. Referred for growth scan.',
      assessed_risk_level: 'low',
      synced_at: null,
      created_at: weeksAgo(1),
    },
  ];

  // ── Children ────────────────────────────────────────
  // Columns: id, mother_id, full_name, date_of_birth, gender,
  //          birth_weight, birth_facility, notes
  const child1 = {
    id: child1Id,
    mother_id: motherId,
    full_name: 'Amina Abdulai',
    date_of_birth: monthsAgo(18),
    gender: 'female',
    birth_weight: 3.2,
    birth_facility: 'Tamale Central Hospital',
    notes: 'Full term delivery. No complications.',
    synced_at: null,
    created_at: monthsAgo(18),
  };

  const child2 = {
    id: child2Id,
    mother_id: motherId,
    full_name: 'Ibrahim Abdulai',
    date_of_birth: monthsAgo(5),
    gender: 'male',
    birth_weight: 3.5,
    birth_facility: 'Tamale Central Hospital',
    notes: 'Full term delivery. Healthy birth.',
    synced_at: null,
    created_at: monthsAgo(5),
  };

  // ── Vaccinations ────────────────────────────────────
  // Columns: id, child_id, vaccine_name, date_given, dose,
  //          batch_number, administered_by, notes
  const vaccinations = [
    // Amina (18 months old) — should have most vaccines
    { id: generateId(), child_id: child1Id, vaccine_name: 'BCG', date_given: daysAgo(18 * 30 - 3), dose: 1, notes: 'Given at birth', synced_at: null, created_at: daysAgo(18 * 30 - 3) },
    { id: generateId(), child_id: child1Id, vaccine_name: 'OPV-0', date_given: daysAgo(18 * 30 - 2), dose: 0, notes: 'Birth dose', synced_at: null, created_at: daysAgo(18 * 30 - 2) },
    { id: generateId(), child_id: child1Id, vaccine_name: 'OPV-1', date_given: daysAgo(18 * 30 - 30 * 6), dose: 1, notes: '6 weeks', synced_at: null, created_at: daysAgo(18 * 30 - 30 * 6) },
    { id: generateId(), child_id: child1Id, vaccine_name: 'Pentavalent-1', date_given: daysAgo(18 * 30 - 30 * 6), dose: 1, notes: '6 weeks', synced_at: null, created_at: daysAgo(18 * 30 - 30 * 6) },
    { id: generateId(), child_id: child1Id, vaccine_name: 'OPV-2', date_given: daysAgo(18 * 30 - 30 * 7), dose: 2, notes: '10 weeks', synced_at: null, created_at: daysAgo(18 * 30 - 30 * 7) },
    { id: generateId(), child_id: child1Id, vaccine_name: 'Pentavalent-2', date_given: daysAgo(18 * 30 - 30 * 7), dose: 2, notes: '10 weeks', synced_at: null, created_at: daysAgo(18 * 30 - 30 * 7) },
    { id: generateId(), child_id: child1Id, vaccine_name: 'OPV-3', date_given: daysAgo(18 * 30 - 30 * 8), dose: 3, notes: '14 weeks', synced_at: null, created_at: daysAgo(18 * 30 - 30 * 8) },
    { id: generateId(), child_id: child1Id, vaccine_name: 'Pentavalent-3', date_given: daysAgo(18 * 30 - 30 * 8), dose: 3, notes: '14 weeks', synced_at: null, created_at: daysAgo(18 * 30 - 30 * 8) },
    { id: generateId(), child_id: child1Id, vaccine_name: 'Measles-1', date_given: daysAgo(18 * 30 - 30 * 12), dose: 1, notes: '9 months', synced_at: null, created_at: daysAgo(18 * 30 - 30 * 12) },
    { id: generateId(), child_id: child1Id, vaccine_name: 'Yellow Fever', date_given: daysAgo(18 * 30 - 30 * 12), dose: 1, notes: '9 months', synced_at: null, created_at: daysAgo(18 * 30 - 30 * 12) },

    // Ibrahim (5 months old) — just starting
    { id: generateId(), child_id: child2Id, vaccine_name: 'BCG', date_given: daysAgo(5 * 30 - 3), dose: 1, notes: 'Birth dose', synced_at: null, created_at: daysAgo(5 * 30 - 3) },
    { id: generateId(), child_id: child2Id, vaccine_name: 'OPV-0', date_given: daysAgo(5 * 30 - 2), dose: 0, notes: 'Birth dose', synced_at: null, created_at: daysAgo(5 * 30 - 2) },
  ];

  // ── Growth Records ──────────────────────────────────
  // Columns: id, child_id, recorded_date, weight_kg, height_cm,
  //          head_circumference_cm, muac_cm, notes
  const growthRecords = [
    // Amina's growth over time
    { id: generateId(), child_id: child1Id, recorded_date: monthsAgo(17), weight_kg: 4.1, height_cm: 54, head_circumference_cm: 37, muac_cm: 13.2, notes: 'Healthy growth', synced_at: null, created_at: monthsAgo(17) },
    { id: generateId(), child_id: child1Id, recorded_date: monthsAgo(14), weight_kg: 5.8, height_cm: 60, head_circumference_cm: 40, muac_cm: 14.1, notes: 'On track', synced_at: null, created_at: monthsAgo(14) },
    { id: generateId(), child_id: child1Id, recorded_date: monthsAgo(11), weight_kg: 7.2, height_cm: 65, head_circumference_cm: 42, muac_cm: 14.8, notes: 'Good progress', synced_at: null, created_at: monthsAgo(11) },
    { id: generateId(), child_id: child1Id, recorded_date: monthsAgo(8), weight_kg: 8.4, height_cm: 69, head_circumference_cm: 43.5, muac_cm: 15.2, notes: 'Steady growth', synced_at: null, created_at: monthsAgo(8) },
    { id: generateId(), child_id: child1Id, recorded_date: monthsAgo(5), weight_kg: 9.3, height_cm: 72, head_circumference_cm: 44.5, muac_cm: 15.5, notes: 'Excellent', synced_at: null, created_at: monthsAgo(5) },

    // Ibrahim's growth
    { id: generateId(), child_id: child2Id, recorded_date: monthsAgo(4), weight_kg: 5.2, height_cm: 57, head_circumference_cm: 38.5, muac_cm: 13.8, notes: 'Newborn check', synced_at: null, created_at: monthsAgo(4) },
    { id: generateId(), child_id: child2Id, recorded_date: monthsAgo(2), weight_kg: 6.8, height_cm: 62, head_circumference_cm: 41, muac_cm: 14.5, notes: 'Growing well', synced_at: null, created_at: monthsAgo(2) },
    { id: generateId(), child_id: child2Id, recorded_date: weeksAgo(2), weight_kg: 7.6, height_cm: 65, head_circumference_cm: 42, muac_cm: 15.0, notes: 'On track', synced_at: null, created_at: weeksAgo(2) },
  ];

  // ── CHW Home Visits ─────────────────────────────────
  // Columns: id, worker_id, patient_id, patient_type, visit_type,
  //          visit_date, notes, findings, actions_taken
  const visits = [
    {
      id: generateId(),
      worker_id: null,
      patient_id: motherId,
      patient_type: 'mother',
      visit_type: 'home',
      visit_date: weeksAgo(18),
      notes: 'Home visit to check on Fatima. She is doing well with pregnancy.',
      findings: 'Mother alert and oriented. No signs of distress. Good nutritional status.',
      actions_taken: 'Reminded about ANC visit schedule. Iron supplements available.',
      synced_at: null,
      created_at: weeksAgo(18),
    },
    {
      id: generateId(),
      worker_id: null,
      patient_id: motherId,
      patient_type: 'mother',
      visit_type: 'home',
      visit_date: weeksAgo(10),
      notes: 'Follow-up visit. Fatima attending ANC regularly.',
      findings: 'Blood pressure normal. No edema. Baby kicking well.',
      actions_taken: 'Provided health education on danger signs.',
      synced_at: null,
      created_at: weeksAgo(10),
    },
    {
      id: generateId(),
      worker_id: null,
      patient_id: motherId,
      patient_type: 'mother',
      visit_type: 'home',
      visit_date: weeksAgo(3),
      notes: 'Third trimester check-in. Fatima is healthy.',
      findings: 'Good weight gain. No complications. Fundal height appropriate.',
      actions_taken: 'Discussed delivery preparedness. Referred for growth scan at hospital.',
      synced_at: null,
      created_at: weeksAgo(3),
    },
  ];

  // ── Referral ────────────────────────────────────────
  // Columns: id, patient_id, patient_type, from_facility_id, to_facility_id,
  //          from_worker_id, urgency, status, reason, notes
  const referrals = [
    {
      id: generateId(),
      patient_id: motherId,
      patient_type: 'mother',
      from_facility_id: null,
      to_facility_id: null,
      from_worker_id: null,
      urgency: 'routine',
      status: 'completed',
      reason: 'Routine growth scan at 28 weeks. Pregnancy progressing normally.',
      notes: 'Scan completed. Normal fetal development confirmed.',
      synced_at: null,
      created_at: weeksAgo(2),
    },
  ];

  // ── Notifications ───────────────────────────────────
  const notifications = [
    {
      id: generateId(),
      type: 'reminder',
      priority: 'medium',
      title: 'Next ANC Visit',
      message: 'Your next antenatal visit is coming up. Remember to attend your appointment.',
      read: false,
      patient_id: motherId,
      created_at: daysAgo(1),
    },
    {
      id: generateId(),
      type: 'reminder',
      priority: 'low',
      title: 'Iron Supplements',
      message: 'Remember to take your iron and folic acid supplements daily.',
      read: false,
      patient_id: motherId,
      created_at: daysAgo(2),
    },
  ];

  // ── Write Everything to IndexedDB ───────────────────
  await db.mothers.put(mother);
  await db.pregnancies.put(pregnancy);
  await db.antenatal_visits.bulkPut(ancVisits);
  await db.children.put(child1);
  await db.children.put(child2);
  await db.vaccinations.bulkPut(vaccinations);
  await db.growth_records.bulkPut(growthRecords);
  await db.visits.bulkPut(visits);
  await db.referrals.bulkPut(referrals);
  await db.notifications.bulkPut(notifications);

  console.log('[NurtureAI] Demo data seeded successfully');
  return true;
}

/**
 * Seed demo data for a CHW user (mothers in their catchment area).
 */
export async function seedCHWDemoData(profileId) {
  const alreadySeeded = await db.mothers.count();
  if (alreadySeeded) return false;

  const workerId = profileId;
  const motherIds = [generateId(), generateId(), generateId()];

  const mothers = [
    {
      id: motherIds[0], profile_id: null, full_name: 'Fatima Abdulai',
      date_of_birth: '1998-05-15', phone: '+233241234567',
      community: 'Tamale South', risk_level: 'low',
      assigned_worker_id: workerId, synced_at: null, created_at: weeksAgo(30),
    },
    {
      id: motherIds[1], profile_id: null, full_name: 'Aisha Mohammed',
      date_of_birth: '1995-08-22', phone: '+233241111111',
      community: 'Tamale South', risk_level: 'moderate',
      assigned_worker_id: workerId, synced_at: null, created_at: weeksAgo(20),
    },
    {
      id: motherIds[2], profile_id: null, full_name: 'Hawa Ibrahim',
      date_of_birth: '2000-01-10', phone: '+233242222222',
      community: 'Tamale South', risk_level: 'low',
      assigned_worker_id: workerId, synced_at: null, created_at: weeksAgo(15),
    },
  ];

  const pregnancies = [
    {
      id: generateId(), mother_id: motherIds[0], status: 'active', risk_level: 'low',
      lmp: new Date(Date.now() - 24 * 7 * 86400000).toISOString().split('T')[0],
      edd: new Date(Date.now() + 16 * 7 * 86400000).toISOString().split('T')[0],
      gravida: 3, para: 2, synced_at: null, created_at: weeksAgo(24),
    },
    {
      id: generateId(), mother_id: motherIds[1], status: 'active', risk_level: 'high',
      lmp: new Date(Date.now() - 32 * 7 * 86400000).toISOString().split('T')[0],
      edd: new Date(Date.now() + 8 * 7 * 86400000).toISOString().split('T')[0],
      gravida: 4, para: 3, synced_at: null, created_at: weeksAgo(32),
    },
    {
      id: generateId(), mother_id: motherIds[2], status: 'active', risk_level: 'low',
      lmp: new Date(Date.now() - 14 * 7 * 86400000).toISOString().split('T')[0],
      edd: new Date(Date.now() + 26 * 7 * 86400000).toISOString().split('T')[0],
      gravida: 1, para: 0, synced_at: null, created_at: weeksAgo(14),
    },
  ];

  const visits = [
    { id: generateId(), worker_id: workerId, patient_id: motherIds[0], patient_type: 'mother', visit_type: 'home', visit_date: weeksAgo(2), notes: 'Routine home visit. Fatima is doing well.', findings: 'No concerns.', actions_taken: 'Provided health education.', synced_at: null, created_at: weeksAgo(2) },
    { id: generateId(), worker_id: workerId, patient_id: motherIds[1], patient_type: 'mother', visit_type: 'home', visit_date: weeksAgo(1), notes: 'Aisha has high blood pressure. Referred to hospital.', findings: 'BP 150/95. Edema present.', actions_taken: 'Urgent referral to hospital.', synced_at: null, created_at: weeksAgo(1) },
    { id: generateId(), worker_id: workerId, patient_id: motherIds[2], patient_type: 'mother', visit_type: 'home', visit_date: daysAgo(3), notes: 'First visit for Hawa. She is 14 weeks pregnant.', findings: 'Good general health. No complications.', actions_taken: 'Registered for ANC.', synced_at: null, created_at: daysAgo(3) },
  ];

  const referrals = [
    {
      id: generateId(), patient_id: motherIds[1], patient_type: 'mother',
      from_worker_id: workerId, urgency: 'urgent', status: 'pending',
      reason: 'High blood pressure detected. Needs immediate medical review.',
      synced_at: null, created_at: daysAgo(3),
    },
  ];

  await db.mothers.bulkPut(mothers);
  await db.pregnancies.bulkPut(pregnancies);
  await db.visits.bulkPut(visits);
  await db.referrals.bulkPut(referrals);

  console.log('[NurtureAI] CHW demo data seeded');
  return true;
}

/**
 * Seed demo data based on user role.
 */
export async function seedDemoForRole(profileId, role) {
  switch (role) {
    case 'mother':
      return seedDemoData(profileId);
    case 'chw':
      return seedCHWDemoData(profileId);
    default:
      return false;
  }
}

export default seedDemoData;
