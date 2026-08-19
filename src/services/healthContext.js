import supabase, { isSupabaseConfigured } from '../lib/supabase';
import { calculateWeeksFromLMP } from '../lib/pregnancy';
import { findOverdueVaccine, findNextDueVaccine } from '../constants/vaccinationSchedule';

/**
 * NurtureAI — Health Context Service
 * 
 * Fetches all relevant healthcare data from Supabase for the current
 * user and formats it as structured context that gets injected into every AI
 * prompt. This is what transforms Amina from a generic chatbot into a
 * personal healthcare companion.
 * 
 * Each role sees only the data relevant to their access level.
 */

async function queryRows(table, column, value) {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq(column, value)
    .is('deleted_at', null);
  if (error) {
    console.error(`Failed to fetch ${table}:`, error);
    return [];
  }
  return data || [];
}

async function queryAll(table) {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .is('deleted_at', null);
  if (error) {
    console.error(`Failed to fetch ${table}:`, error);
    return [];
  }
  return data || [];
}

async function queryById(table, id) {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) return null;
  return data;
}

/**
 * Calculate pregnancy week from a start date (LMP or registration date).
 */
function getPregnancyWeek(startDate) {
  if (!startDate) return null;
  const weeks = calculateWeeksFromLMP(startDate);
  return weeks === null ? null : Math.min(weeks, 42);
}

/**
 * Calculate child age in months.
 */
function getChildAgeMonths(dob) {
  if (!dob) return null;
  const birth = new Date(dob);
  const now = new Date();
  const months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  return Math.max(0, months);
}

/**
 * Get days since a given date.
 */
function daysSince(dateStr) {
  if (!dateStr) return Infinity;
  const date = new Date(dateStr);
  const now = new Date();
  return Math.floor((now - date) / (1000 * 60 * 60 * 24));
}

/**
 * Determine the provenance display label for a record.
 * Returns a short tag used in AI context so the model knows whether a
 * fact is worker-verified or mother-reported/pending verification.
 */
function provenanceTag(row) {
  if (!row) return '';
  if (row.verified) return 'VERIFIED (health worker)';
  if (row.data_source === 'mother_reported') return 'MOTHER-REPORTED (not yet verified)';
  if (row.data_source === 'mother_registered') return 'PENDING VERIFICATION (mother-registered)';
  if (row.data_source === 'system') return 'SYSTEM-GENERATED';
  return 'UNVERIFIED';
}

/**
 * Format a date for display.
 */
function fmt(dateStr) {
  if (!dateStr) return 'N/A';
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

/**
 * Build health context for a MOTHER user.
 * This is the richest context — includes pregnancy, children, vaccinations, growth, visits,
 * milestones, conversation history, and proactive health alerts.
 */
async function buildMotherContext(profileId) {
  const context = { role: 'mother' };

  // 1. Mother profile
  const { data: motherRows } = await supabase
    .from('mothers')
    .select('*')
    .eq('profile_id', profileId)
    .is('deleted_at', null);
  const mother = (motherRows || [])[0];
  if (!mother) return context;

  context.mother = {
    id: mother.id,
    name: mother.full_name,
    community: mother.community || 'Not recorded',
    risk_level: mother.risk_level || 'low',
    phone: mother.phone || 'Not recorded',
    assigned_worker_id: mother.assigned_worker_id || null,
    blood_group: mother.blood_group || 'Not recorded',
    medical_history: mother.medical_history || 'None recorded',
    registered: fmt(mother.created_at),
    data_source: mother.data_source || null,
    verified: mother.verified === true,
  };

  // 2. Active pregnancy
  const pregnancies = await queryRows('pregnancies', 'mother_id', mother.id);

  const activePregnancy = pregnancies.find(p => p.status === 'active');

  if (activePregnancy) {
    const week = getPregnancyWeek(activePregnancy.lmp || activePregnancy.created_at);
    const ancVisits = await queryRows('antenatal_visits', 'pregnancy_id', activePregnancy.id);

    const sortedVisits = ancVisits.sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date));
    const lastVisit = sortedVisits[0];
    const daysSinceLastVisit = lastVisit ? daysSince(lastVisit.visit_date) : null;

    // Calculate ANC adherence (WHO recommends at least 4 visits)
    const recommendedAncCount = week <= 28 ? Math.ceil(week / 12) : Math.ceil(28 / 12) + Math.ceil((week - 28) / 6);
    const ancAdherence = ancVisits.length > 0 ? Math.min(100, Math.round((ancVisits.length / Math.max(recommendedAncCount, 1)) * 100)) : 0;

    context.pregnancy = {
      status: 'active',
      week: week,
      trimester: week <= 13 ? 1 : week <= 27 ? 2 : 3,
      edd: activePregnancy.edd ? fmt(activePregnancy.edd) : 'Unknown',
      risk_level: activePregnancy.risk_level || 'low',
      complications: activePregnancy.complications || 'None reported',
      blood_group: activePregnancy.blood_group || 'Not recorded',
      gravida: activePregnancy.gravida || null,
      para: activePregnancy.para || null,
      data_source: activePregnancy.data_source || null,
      verified: activePregnancy.verified === true,
      anc_visit_count: ancVisits.length,
      anc_adherence_percent: ancAdherence,
      recommended_anc_count: recommendedAncCount,
      last_anc_date: lastVisit ? fmt(lastVisit.visit_date) : 'No visits recorded',
      days_since_last_anc: daysSinceLastVisit,
      last_anc_risk: lastVisit?.assessed_risk_level || 'Not assessed',
      anc_details: sortedVisits.slice(0, 5).map(v => ({
        date: fmt(v.visit_date),
        visit_number: v.visit_number,
        risk: v.assessed_risk_level || 'Not assessed',
        weight: v.weight || 'N/A',
        blood_pressure: v.blood_pressure || 'N/A',
        fundal_height: v.fundal_height || 'N/A',
        fetal_heart_rate: v.fetal_heart_rate || 'N/A',
        notes: v.notes || null,
        verified: v.verified === true,
      })),
      // Proactive alerts
      overdue_anc: daysSinceLastVisit > 30 && week <= 28,
      urgent_anc: daysSinceLastVisit > 14 && week > 28,
      approaching_due_date: week >= 38,
      past_due_date: week >= 40,
    };
  } else {
    context.pregnancy = { status: 'none active' };
  }

  // Previous pregnancies
  const completedPregnancies = pregnancies.filter(p => p.status !== 'active');
  if (completedPregnancies.length > 0) {
    context.pregnancy_history = completedPregnancies.map(p => ({
      status: p.status,
      outcome: p.outcome || 'Not recorded',
      delivery_date: p.delivery_date ? fmt(p.delivery_date) : 'N/A',
      complications: p.complications || null,
      verified: p.verified === true,
      data_source: p.data_source || null,
    }));
  }

  // 3. Children
  const children = await queryRows('children', 'mother_id', mother.id);

  if (children.length > 0) {
    context.children = [];

    for (const child of children) {
      const ageMonths = getChildAgeMonths(child.date_of_birth || child.birth_date);
      const childVax = await queryRows('vaccinations', 'child_id', child.id);
      const childGrowth = await queryRows('growth_records', 'child_id', child.id);
      const childMilestones = await queryRows('milestones', 'child_id', child.id);

      const sortedGrowth = childGrowth.sort((a, b) => new Date(a.recorded_date) - new Date(b.recorded_date));
      const latestGrowth = sortedGrowth.length > 0 ? sortedGrowth[sortedGrowth.length - 1] : null;
      const latestWeight = latestGrowth?.weight_kg || null;
      const latestHeight = latestGrowth?.height_cm || null;

      // Calculate days since last growth check
      const daysSinceGrowth = latestGrowth ? daysSince(latestGrowth.recorded_date) : null;
      const maxGrowthDays = ageMonths <= 12 ? 30 : 90;
      const growthOverdue = daysSinceGrowth !== null ? daysSinceGrowth > maxGrowthDays : ageMonths > 1;

      // Check vaccination status against Ghana EPI schedule
      const vaxNames = new Set(childVax.map(v => v.vaccine_name));
      const overdueVax = findOverdueVaccine(ageMonths, vaxNames);
      const nextDueVax = findNextDueVaccine(ageMonths, vaxNames);

      context.children.push({
        name: child.full_name,
        age_months: ageMonths,
        gender: child.gender,
        birth_weight: child.birth_weight || 'N/A',
        current_weight_kg: latestWeight,
        current_height_cm: latestHeight,
        data_source: child.data_source || null,
        verified: child.verified === true,
        vaccinations_received: childVax.map(v => ({
          vaccine: v.vaccine_name,
          date: fmt(v.date_given),
          verified: v.verified === true,
        })),
        vaccination_count: childVax.length,
        growth_records_count: childGrowth.length,
        last_growth_check: latestGrowth ? fmt(latestGrowth.recorded_date) : 'No records',
        days_since_growth_check: daysSinceGrowth,
        growth_overdue: growthOverdue,
        overdue_vaccination: overdueVax ? overdueVax.description : null,
        next_due_vaccination: nextDueVax ? `${nextDueVax.description} (at ${nextDueVax.ageMonths} months)` : null,
        milestones_achieved: childMilestones.length,
        feeding_method: child.feeding_method || 'Not recorded',
      });
    }
  }

  // 4. Home visits by CHW
  const visits = await queryRows('visits', 'patient_id', mother.id);

  if (visits.length > 0) {
    const sortedVisits = visits.sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date));
    const lastVisit = sortedVisits[0];
    const daysSinceVisit = lastVisit ? daysSince(lastVisit.visit_date) : null;

    context.visit_history = {
      total: visits.length,
      last_visit_date: fmt(lastVisit.visit_date),
      last_visit_type: lastVisit.visit_type || 'Not specified',
      days_since_last_visit: daysSinceVisit,
      last_visit_notes: lastVisit.notes || lastVisit.findings || null,
      recent_visits: sortedVisits.slice(0, 3).map(v => ({
        date: fmt(v.visit_date),
        type: v.visit_type,
        notes: v.notes || v.findings || null,
      })),
    };
  }

  // 5. Referrals
  const referrals = await queryRows('referrals', 'patient_id', mother.id);

  if (referrals.length > 0) {
    context.referrals = referrals.map(r => ({
      urgency: r.urgency,
      status: r.status,
      reason: r.reason || r.notes || 'Not specified',
      date: fmt(r.created_at),
      days_pending: daysSince(r.created_at),
      verified: r.verified === true,
      data_source: r.data_source || null,
    }));
  }

  // 5b. Pending mother-reported items — explicitly PENDING (unverified) so
  // Amina never presents these as confirmed clinical facts.
  const pendingReports = (await queryRows('mother_reports', 'mother_id', mother.id))
    .filter(r => r.status === 'pending');
  if (pendingReports.length > 0) {
    context.pending_mother_reports = pendingReports.map(r => ({
      type: r.report_type || 'note',
      detail: r.detail || '',
      value: r.value != null ? `${r.value}${r.unit ? ` ${r.unit}` : ''}` : null,
      reported_at: fmt(r.reported_at),
    }));
  }

  // 6. Weekly journals (recent 3 for Amina context)
  if (activePregnancy) {
    const journals = await queryRows('weekly_journals', 'pregnancy_id', activePregnancy.id);
    journals.sort((a, b) => a.week_number - b.week_number);

    if (journals.length > 0) {
      context.recent_journals = journals.slice(-3).map(j => ({
        week: j.week_number,
        date: fmt(j.entry_date),
        feeling: j.mother_feeling || null,
        symptoms: j.symptoms || null,
        mood: j.mood || null,
        baby_movement: j.baby_movement || null,
        sleep_quality: j.sleep_quality || null,
        missed: false,
      }));

      // Track missed weeks
      const reportedWeeks = new Set(journals.map(j => j.week_number));
      const missedWeeks = [];
      const maxWeek = Math.max(...reportedWeeks);
      if (week && maxWeek < week - 1) {
        for (let w = maxWeek + 1; w < week; w++) {
          missedWeeks.push(w);
        }
      }
      if (missedWeeks.length > 0) {
        context.recent_journals.push({
          week: missedWeeks.join(', '),
          date: null,
          feeling: null,
          missed: true,
          note: `No check-in recorded for week${missedWeeks.length > 1 ? 's' : ''} ${missedWeeks.join(', ')}`,
        });
      }
    }
  }

  // 7. Assigned healthcare worker
  if (mother.assigned_worker_id) {
    const workerProfile = await queryById('profiles', mother.assigned_worker_id);
    if (workerProfile) {
      context.assigned_worker = {
        name: workerProfile.full_name,
        role: workerProfile.role,
        facility_id: workerProfile.facility_id,
      };
    }
  }

  // 7. Recent AI conversation summaries (long-term memory)
  const conversations = await queryRows('ai_conversations', 'user_id', profileId);

  if (conversations.length > 0) {
    const sortedConversations = conversations
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    context.conversation_history = sortedConversations.slice(0, 3).map(c => ({
      summary: c.summary || c.last_message || 'Previous conversation',
      date: fmt(c.created_at),
      topics: c.topics || [],
    }));

    context.total_conversations = conversations.length;
    context.last_conversation_date = fmt(sortedConversations[0].created_at);
  }

  // 8. Generate proactive health alerts
  const alerts = [];
  if (context.pregnancy?.status === 'active') {
    if (context.pregnancy.overdue_anc) {
      alerts.push(`ANC VISIT OVERDUE: Last visit was ${context.pregnancy.days_since_last_anc} days ago (pregnancy week ${context.pregnancy.week}).`);
    }
    if (context.pregnancy.urgent_anc) {
      alerts.push(`URGENT ANC NEEDED: Third trimester requires more frequent visits. Last ANC was ${context.pregnancy.days_since_last_anc} days ago.`);
    }
    if (context.pregnancy.approaching_due_date) {
      alerts.push(`APPROACHING DUE DATE: Week ${context.pregnancy.week}. Delivery preparation discussion recommended.`);
    }
    if (context.pregnancy.past_due_date) {
      alerts.push(`PAST DUE DATE: Week ${context.pregnancy.week}. Immediate medical consultation required.`);
    }
  }
  if (context.children) {
    for (const child of context.children) {
      if (child.overdue_vaccination) {
        alerts.push(`VACCINATION OVERDUE: ${child.name} (age ${child.age_months}mo) — ${child.overdue_vaccination}.`);
      }
      if (child.growth_overdue) {
        alerts.push(`GROWTH CHECK OVERDUE: ${child.name} — last check was ${child.days_since_growth_check} days ago.`);
      }
    }
  }
  if (context.mother?.risk_level === 'high' || context.mother?.risk_level === 'critical') {
    alerts.push(`HIGH RISK MOTHER: ${context.mother.name} is flagged as ${context.mother.risk_level} risk. Ensure regular follow-up.`);
  }

  if (alerts.length > 0) {
    context.proactive_alerts = alerts;
  }

  return context;
}

/**
 * Build health context for a CHW user.
 * Shows their assigned mothers, recent visits, pending referrals.
 */
async function buildCHWContext(profileId) {
  const context = { role: 'chw' };

  const profile = await queryById('profiles', profileId);
  if (profile) {
    context.worker = {
      name: profile.full_name,
      facility_id: profile.facility_id,
      community: profile.community,
    };
  }

  // All mothers assigned to this CHW
  const mothers = await queryRows('mothers', 'assigned_worker_id', profileId);

  context.assigned_mothers_count = mothers.length;

  const highRisk = mothers.filter(m => m.risk_level === 'high' || m.risk_level === 'critical');
  context.high_risk_mothers_count = highRisk.length;
  // Keep only the first 3 if any, as actionable examples, otherwise hide to prevent huge contexts
  context.high_risk_examples = highRisk.slice(0, 3).map(m => ({
    name: m.full_name,
    risk: m.risk_level,
    community: m.community,
  }));

  // Recent visits by this CHW
  const visits = await queryRows('visits', 'worker_id', profileId);

  const sortedVisits = visits.sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date));
  context.recent_visits = sortedVisits.slice(0, 5).map(v => ({
    date: fmt(v.visit_date),
    patient_id: v.patient_id,
    type: v.visit_type,
    notes: v.notes || null,
  }));

  // Pending referrals created by this CHW
  const referrals = await queryRows('referrals', 'from_worker_id', profileId);

  context.pending_referrals_count = referrals.filter(r => r.status === 'pending').length;
  context.recent_pending_referrals = referrals
    .filter(r => r.status === 'pending')
    .slice(0, 3)
    .map(r => ({
      urgency: r.urgency,
      reason: r.reason || r.notes || 'Not specified',
    }));

  return context;
}

/**
 * Build health context for a NURSE user.
 * Shows patients at their facility, ANC visits, pending referrals.
 */
async function buildNurseContext(profileId) {
  const context = { role: 'nurse' };

  const profile = await queryById('profiles', profileId);
  if (profile) {
    context.worker = {
      name: profile.full_name,
      facility_id: profile.facility_id,
    };
  }

  // Mothers at this facility (via assigned_worker's facility or direct facility_id)
  if (profile?.facility_id) {
    const allMothers = await queryAll('mothers');
    const facilityMothers = allMothers.filter(m => {
      // Check if any assigned worker is at this facility
      return m.facility_id === profile.facility_id || m.birth_facility_id === profile.facility_id;
    });

    context.facility_patients_count = facilityMothers.length;

    // Incoming referrals to this facility
    const referrals = await queryRows('referrals', 'to_facility_id', profile.facility_id);

    const pendingRefs = referrals.filter(r => r.status === 'pending');
    context.incoming_referrals_count = pendingRefs.length;
    context.recent_incoming_referrals = pendingRefs.slice(0, 3).map(r => ({
      urgency: r.urgency,
      reason: r.reason || 'Not specified',
    }));
  }

  // All mothers (for general nurse access)
  const mothers = await queryAll('mothers');
  context.total_mothers = mothers.length;
  context.high_risk_count = mothers.filter(m => m.risk_level === 'high' || m.risk_level === 'critical').length;

  return context;
}

/**
 * Build health context for DOCTOR, DISTRICT_OFFICER, ADMIN.
 * Aggregated overview data.
 */
async function buildOverviewContext(profileId, role) {
  const context = { role };

  const profile = await queryById('profiles', profileId);
  if (profile) {
    context.worker = {
      name: profile.full_name,
      facility_id: profile.facility_id,
    };
  }

  // Aggregate stats
  const mothers = await queryAll('mothers');
  const children = await queryAll('children');
  const pregnancies = await queryAll('pregnancies');
  const activePregnancies = pregnancies.filter(p => p.status === 'active');
  const referrals = await queryAll('referrals');
  const pendingReferrals = referrals.filter(r => r.status === 'pending');

  context.stats = {
    total_mothers: mothers.length,
    total_children: children.length,
    active_pregnancies: activePregnancies.length,
    high_risk_mothers: mothers.filter(m => m.risk_level === 'high' || m.risk_level === 'critical').length,
    high_risk_pregnancies: activePregnancies.filter(p => p.risk_level === 'high' || p.risk_level === 'critical').length,
    pending_referrals: pendingReferrals.length,
    urgent_referrals: pendingReferrals.filter(r => r.urgency === 'urgent' || r.urgency === 'emergency').length,
  };

  if (role === 'doctor') {
    // Doctor-specific: show high-risk patients needing attention
    const highRiskPregnancies = await Promise.all(
      activePregnancies
        .filter(p => p.risk_level === 'high' || p.risk_level === 'critical')
        .map(async p => {
          const mother = await queryById('mothers', p.mother_id);
          return {
            mother_name: mother?.full_name || 'Unknown',
            risk: p.risk_level,
            pregnancy_week: getPregnancyWeek(p.created_at),
          };
        })
    );
    context.high_risk_patients = highRiskPregnancies;
  }

  return context;
}

/**
 * Main function: Build health context based on user role.
 *
 * Workers may pass `{ patientId }` to scope Amina to the patient record
 * that is currently open. The patient data is fetched through RLS, so a
 * worker can only pull up records they are authorized to see. When no
 * patient is selected (or the selected patient is not accessible), the
 * context stays aggregate-only and NEVER contains patient names.
 *
 * Returns a formatted string ready to be injected into the AI system prompt.
 */
export async function buildHealthContext(profile, options = {}) {
  if (!profile?.id || !profile?.role) return '';

  let rawData;

  if (profile.role === 'mother') {
    // Mothers only ever see their own records — the mother context is
    // already patient-scoped by construction.
    rawData = await buildMotherContext(profile.id);
  } else {
    if (options.patientId) {
      // RLS is the authority: if the worker may not read this mother, the
      // query returns nothing and we fall back to aggregate context.
      const patientData = await buildSelectedPatientContext(options.patientId);
      if (patientData) rawData = patientData;
    }
    if (!rawData) {
      switch (profile.role) {
        case 'chw':
          rawData = await buildCHWContext(profile.id);
          break;
        case 'nurse':
          rawData = await buildNurseContext(profile.id);
          break;
        case 'doctor':
        case 'district_officer':
        case 'admin':
          rawData = await buildOverviewContext(profile.id, profile.role);
          break;
        default:
          return '';
      }
      // Aggregate (no patient selected) worker contexts must never hand
      // patient names to the model — counts and stats only.
      delete rawData.high_risk_examples;
      delete rawData.high_risk_patients;
    }
  }

  let formatted = formatContextForAI(rawData);

  if (profile.role !== 'mother' && !rawData.patient_scoped) {
    formatted += '\n\nNOTE: No patient record is currently open. Do not guess or discuss any specific patient\'s personal data. If the user asks about a specific patient, tell them to open that patient\'s record first (or search for the patient in the app).';
  }

  return formatted;
}

/**
 * Build a patient-scoped context for a health worker. Fetched through RLS
 * so access is enforced by the database, never by the UI. Returns null
 * when the mother is not visible to the caller (or not found).
 */
async function buildSelectedPatientContext(patientId) {
  const mother = await queryById('mothers', patientId);
  if (!mother) return null;

  const ctx = {
    role: 'patient',
    patient_scoped: true,
    patient: {
      id: mother.id,
      name: mother.full_name,
      patient_code: mother.patient_code || 'Unknown',
      community: mother.community || 'Not recorded',
      risk_level: mother.risk_level || 'low',
      blood_group: mother.blood_group || 'Not recorded',
      medical_history: mother.medical_history || 'None recorded',
      registered: fmt(mother.created_at),
      data_source: mother.data_source || null,
      verified: mother.verified === true,
    },
  };

  // Active pregnancy + ANC history
  const pregnancies = await queryRows('pregnancies', 'mother_id', mother.id);
  const activePregnancy = pregnancies.find(p => p.status === 'active');

  if (activePregnancy) {
    const week = getPregnancyWeek(activePregnancy.lmp || activePregnancy.created_at);
    const ancVisits = await queryRows('antenatal_visits', 'pregnancy_id', activePregnancy.id);
    const sortedVisits = ancVisits.sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date));
    const lastVisit = sortedVisits[0];
    const daysSinceLastVisit = lastVisit ? daysSince(lastVisit.visit_date) : null;

    const recommendedAncCount = week <= 28 ? Math.ceil(week / 12) : Math.ceil(28 / 12) + Math.ceil((week - 28) / 6);
    const ancAdherence = ancVisits.length > 0 ? Math.min(100, Math.round((ancVisits.length / Math.max(recommendedAncCount, 1)) * 100)) : 0;

    ctx.pregnancy = {
      status: 'active',
      week: week,
      trimester: week <= 13 ? 1 : week <= 27 ? 2 : 3,
      edd: activePregnancy.edd ? fmt(activePregnancy.edd) : 'Unknown',
      risk_level: activePregnancy.risk_level || 'low',
      complications: activePregnancy.complications || 'None reported',
      data_source: activePregnancy.data_source || null,
      verified: activePregnancy.verified === true,
      anc_visit_count: ancVisits.length,
      anc_adherence_percent: ancAdherence,
      recommended_anc_count: recommendedAncCount,
      last_anc_date: lastVisit ? fmt(lastVisit.visit_date) : 'No visits recorded',
      days_since_last_anc: daysSinceLastVisit,
      last_anc_risk: lastVisit?.assessed_risk_level || 'Not assessed',
      anc_details: sortedVisits.slice(0, 5).map(v => ({
        date: fmt(v.visit_date),
        visit_number: v.visit_number,
        risk: v.assessed_risk_level || 'Not assessed',
        weight: v.weight || 'N/A',
        blood_pressure: v.blood_pressure || 'N/A',
        fundal_height: v.fundal_height || 'N/A',
        fetal_heart_rate: v.fetal_heart_rate || 'N/A',
        notes: v.notes || null,
        verified: v.verified === true,
      })),
      overdue_anc: daysSinceLastVisit > 30 && week <= 28,
      urgent_anc: daysSinceLastVisit > 14 && week > 28,
      approaching_due_date: week >= 38,
      past_due_date: week >= 40,
    };
  } else {
    ctx.pregnancy = { status: 'none active' };
  }

  // Children
  const children = await queryRows('children', 'mother_id', mother.id);
  if (children.length > 0) {
    ctx.children = [];
    for (const child of children) {
      const ageMonths = getChildAgeMonths(child.date_of_birth || child.birth_date);
      const childVax = await queryRows('vaccinations', 'child_id', child.id);
      const childGrowth = await queryRows('growth_records', 'child_id', child.id);
      const sortedGrowth = childGrowth.sort((a, b) => new Date(a.recorded_date) - new Date(b.recorded_date));
      const latestGrowth = sortedGrowth.length > 0 ? sortedGrowth[sortedGrowth.length - 1] : null;
      const vaxNames = new Set(childVax.map(v => v.vaccine_name));
      const overdueVax = findOverdueVaccine(ageMonths, vaxNames);
      const nextDueVax = findNextDueVaccine(ageMonths, vaxNames);
      const daysSinceGrowth = latestGrowth ? daysSince(latestGrowth.recorded_date) : null;
      const maxGrowthDays = ageMonths <= 12 ? 30 : 90;
      const growthOverdue = daysSinceGrowth !== null ? daysSinceGrowth > maxGrowthDays : ageMonths > 1;

      ctx.children.push({
        name: child.full_name,
        age_months: ageMonths,
        gender: child.gender,
        birth_weight: child.birth_weight || 'N/A',
        current_weight_kg: latestGrowth?.weight_kg || null,
        current_height_cm: latestGrowth?.height_cm || null,
        data_source: child.data_source || null,
        verified: child.verified === true,
        vaccination_count: childVax.length,
        vaccinations_received: childVax.map(v => ({
          vaccine: v.vaccine_name,
          date: fmt(v.date_given),
          verified: v.verified === true,
        })),
        growth_records_count: childGrowth.length,
        last_growth_check: latestGrowth ? fmt(latestGrowth.recorded_date) : 'No records',
        days_since_growth_check: daysSinceGrowth,
        growth_overdue: growthOverdue,
        overdue_vaccination: overdueVax ? overdueVax.description : null,
        next_due_vaccination: nextDueVax ? `${nextDueVax.description} (at ${nextDueVax.ageMonths} months)` : null,
      });
    }
  }

  // Visits
  const visits = await queryRows('visits', 'patient_id', mother.id);
  if (visits.length > 0) {
    const sortedVisits = visits.sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date));
    ctx.visit_history = {
      total: visits.length,
      recent_visits: sortedVisits.slice(0, 5).map(v => ({
        date: fmt(v.visit_date),
        type: v.visit_type,
        notes: v.notes || v.findings || null,
      })),
    };
  }

  // Referrals
  const referrals = await queryRows('referrals', 'patient_id', mother.id);
  if (referrals.length > 0) {
    ctx.referrals = referrals.map(r => ({
      urgency: r.urgency,
      status: r.status,
      reason: r.reason || r.notes || 'Not specified',
      date: fmt(r.created_at),
      days_pending: daysSince(r.created_at),
    }));
  }

  // Pending mother-reported items — always flagged as unverified.
  const pendingReports = (await queryRows('mother_reports', 'mother_id', mother.id))
    .filter(r => r.status === 'pending');
  if (pendingReports.length > 0) {
    ctx.pending_mother_reports = pendingReports.map(r => ({
      type: r.report_type || 'note',
      detail: r.detail || '',
      value: r.value != null ? `${r.value}${r.unit ? ` ${r.unit}` : ''}` : null,
      reported_at: fmt(r.reported_at),
    }));
  }

  // Patient-specific alerts
  const alerts = [];
  if (ctx.pregnancy?.status === 'active') {
    if (ctx.pregnancy.overdue_anc) {
      alerts.push(`ANC VISIT OVERDUE: last visit ${ctx.pregnancy.days_since_last_anc} days ago (pregnancy week ${ctx.pregnancy.week}).`);
    }
    if (ctx.pregnancy.urgent_anc) {
      alerts.push(`URGENT ANC NEEDED: third trimester requires more frequent visits. Last ANC was ${ctx.pregnancy.days_since_last_anc} days ago.`);
    }
    if (ctx.pregnancy.approaching_due_date) {
      alerts.push(`APPROACHING DUE DATE: week ${ctx.pregnancy.week}. Delivery preparation discussion recommended.`);
    }
    if (ctx.pregnancy.past_due_date) {
      alerts.push(`PAST DUE DATE: week ${ctx.pregnancy.week}. Immediate medical consultation required.`);
    }
  }
  if (ctx.children) {
    for (const child of ctx.children) {
      if (child.overdue_vaccination) {
        alerts.push(`VACCINATION OVERDUE: ${child.name} (age ${child.age_months} months) — ${child.overdue_vaccination}.`);
      }
      if (child.growth_overdue) {
        alerts.push(`GROWTH CHECK OVERDUE: ${child.name} — last check ${child.days_since_growth_check} days ago.`);
      }
    }
  }
  if (ctx.patient.risk_level === 'high' || ctx.patient.risk_level === 'critical') {
    alerts.push(`HIGH RISK PATIENT: flagged as ${ctx.patient.risk_level} risk. Prioritize follow-up.`);
  }
  if (alerts.length > 0) {
    ctx.proactive_alerts = alerts;
  }

  return ctx;
}

/**
 * Format the structured context data into a readable string for the AI.
 */
function formatContextForAI(ctx) {
  if (!ctx || Object.keys(ctx).length <= 1) return '';

  const lines = ['=== PATIENT HEALTH CONTEXT (auto-generated, do not ask user to repeat) ==='];
  lines.push('PROVENANCE: Facts tagged VERIFIED were confirmed by a health worker. Facts tagged PENDING VERIFICATION or MOTHER-REPORTED come from the mother herself and have NOT been confirmed — treat them with caution and never present them as confirmed clinical facts.');

  if (ctx.role === 'mother') {
    if (ctx.mother) {
      lines.push(`\n[MOTHER PROFILE]`);
      lines.push(`Name: ${ctx.mother.name}`);
      lines.push(`Community: ${ctx.mother.community}`);
      lines.push(`Risk Level: ${ctx.mother.risk_level}`);
      lines.push(`Blood Group: ${ctx.mother.blood_group}`);
      lines.push(`Medical History: ${ctx.mother.medical_history}`);
      lines.push(`Registered: ${ctx.mother.registered}`);
      lines.push(`Provenance: ${provenanceTag({ verified: ctx.mother.verified, data_source: ctx.mother.data_source })}`);
    }

    if (ctx.pregnancy?.status === 'active') {
      lines.push(`\n[CURRENT PREGNANCY]`);
      lines.push(`Status: Active — Week ${ctx.pregnancy.week || 'unknown'} (Trimester ${ctx.pregnancy.trimester || '?'})`);
      lines.push(`Due Date: ${ctx.pregnancy.edd}`);
      lines.push(`Risk Level: ${ctx.pregnancy.risk_level}`);
      lines.push(`Blood Group: ${ctx.pregnancy.blood_group}`);
      lines.push(`Gravida: ${ctx.pregnancy.gravida || 'N/A'} | Para: ${ctx.pregnancy.para || 'N/A'}`);
      lines.push(`Complications: ${ctx.pregnancy.complications}`);
      lines.push(`Provenance: ${provenanceTag({ verified: ctx.pregnancy.verified, data_source: ctx.pregnancy.data_source })}`);
      lines.push(`ANC Visits Completed: ${ctx.pregnancy.anc_visit_count} (Adherence: ${ctx.pregnancy.anc_adherence_percent}%)`);
      lines.push(`Recommended ANC Count: ${ctx.pregnancy.recommended_anc_count}`);
      lines.push(`Last ANC Visit: ${ctx.pregnancy.last_anc_date} (${ctx.pregnancy.days_since_last_anc != null ? ctx.pregnancy.days_since_last_anc + ' days ago' : 'N/A'})`);
      lines.push(`Last ANC Risk Assessment: ${ctx.pregnancy.last_anc_risk}`);
      if (ctx.pregnancy.overdue_anc) lines.push(`*** ALERT: ANC VISIT IS OVERDUE ***`);
      if (ctx.pregnancy.urgent_anc) lines.push(`*** ALERT: URGENT — THIRD TRIMESTER ANC NEEDED ***`);
      if (ctx.pregnancy.approaching_due_date) lines.push(`*** ALERT: APPROACHING DUE DATE ***`);
      if (ctx.pregnancy.past_due_date) lines.push(`*** ALERT: PAST DUE DATE — IMMEDIATE CONSULTATION NEEDED ***`);
      if (ctx.pregnancy.anc_details?.length > 0) {
        lines.push(`Recent ANC Details:`);
        ctx.pregnancy.anc_details.forEach(v => {
          lines.push(`  - ${v.date} (Visit #${v.visit_number}): Risk=${v.risk}, Weight=${v.weight}kg, BP=${v.blood_pressure}, Fundal Height=${v.fundal_height}, FHR=${v.fetal_heart_rate}${v.notes ? ', Notes: ' + v.notes : ''} [${v.verified ? 'VERIFIED' : 'UNVERIFIED'}]`);
        });
      }
    } else {
      lines.push(`\n[PREGNANCY] No active pregnancy`);
    }

    if (ctx.recent_journals?.length > 0) {
      lines.push(`\n[WEEKLY CHECK-INS] (mother-reported)`);
      ctx.recent_journals.forEach(j => {
        if (j.missed) {
          lines.push(`  - Week ${j.week}: ${j.note}`);
        } else {
          const parts = [];
          if (j.feeling) parts.push(`Feeling: ${j.feeling}`);
          if (j.symptoms) parts.push(`Symptoms: ${j.symptoms}`);
          if (j.mood) parts.push(`Mood: ${j.mood}`);
          if (j.baby_movement) parts.push(`Movement: ${j.baby_movement}`);
          if (j.sleep_quality) parts.push(`Sleep: ${j.sleep_quality}`);
          lines.push(`  - Week ${j.week} (${j.date}): ${parts.join(' | ')}`);
        }
      });
    }

    if (ctx.pregnancy_history?.length > 0) {
      lines.push(`\n[PREGNANCY HISTORY]`);
      ctx.pregnancy_history.forEach(p => {
        lines.push(`  - ${p.outcome || p.status} (${p.delivery_date})${p.complications ? ' — Complications: ' + p.complications : ''} [${provenanceTag({ verified: p.verified, data_source: p.data_source })}]`);
      });
    }

    if (ctx.children?.length > 0) {
      lines.push(`\n[CHILDREN]`);
      ctx.children.forEach(c => {
        lines.push(`  ${c.name} (${c.gender}, ${c.age_months} months old) [${provenanceTag({ verified: c.verified, data_source: c.data_source })}]`);
        lines.push(`    Birth Weight: ${c.birth_weight}kg`);
        if (c.current_weight_kg) lines.push(`    Current Weight: ${c.current_weight_kg}kg`);
        if (c.current_height_cm) lines.push(`    Height: ${c.current_height_cm}cm`);
        lines.push(`    Feeding Method: ${c.feeding_method}`);
        lines.push(`    Vaccinations: ${c.vaccination_count} received (${c.vaccinations_received.map(v => `${v.vaccine}${v.verified ? ' [VERIFIED]' : ' [MOTHER-REPORTED]'}`).join(', ') || 'None recorded'})`);
        if (c.overdue_vaccination) lines.push(`    *** VACCINATION OVERDUE: ${c.overdue_vaccination} ***`);
        if (c.next_due_vaccination) lines.push(`    Next Due: ${c.next_due_vaccination}`);
        lines.push(`    Growth Records: ${c.growth_records_count} entries, Last Check: ${c.last_growth_check}${c.days_since_growth_check != null ? ' (' + c.days_since_growth_check + ' days ago)' : ''}`);
        if (c.growth_overdue) lines.push(`    *** GROWTH CHECK OVERDUE ***`);
        lines.push(`    Milestones Achieved: ${c.milestones_achieved}`);
      });
    }

    if (ctx.visit_history) {
      lines.push(`\n[VISIT HISTORY]`);
      lines.push(`Total Visits: ${ctx.visit_history.total}`);
      lines.push(`Last Visit: ${ctx.visit_history.last_visit_date} (${ctx.visit_history.last_visit_type}) — ${ctx.visit_history.days_since_last_visit != null ? ctx.visit_history.days_since_last_visit + ' days ago' : 'N/A'}`);
      if (ctx.visit_history.last_visit_notes) lines.push(`  Notes: ${ctx.visit_history.last_visit_notes}`);
    }

    if (ctx.referrals?.length > 0) {
      lines.push(`\n[REFERRALS]`);
      ctx.referrals.forEach(r => {
        lines.push(`  - ${r.date}: ${r.urgency} — ${r.status} — ${r.reason}${r.days_pending != null ? ' (' + r.days_pending + ' days pending)' : ''} [${provenanceTag({ verified: r.verified, data_source: r.data_source })}]`);
      });
    }

    if (ctx.pending_mother_reports?.length > 0) {
      lines.push(`\n[PENDING MOTHER-REPORTED ITEMS — NOT YET VERIFIED BY A HEALTH WORKER]`);
      lines.push(`These come from the mother herself and have NOT been confirmed. Do not present them as confirmed clinical facts; suggest the mother speak to her healthcare worker about them.`);
      ctx.pending_mother_reports.forEach(r => {
        lines.push(`  - ${r.type}: ${r.detail}${r.value ? ` (${r.value})` : ''} — reported ${r.reported_at}`);
      });
    }

    if (ctx.assigned_worker) {
      lines.push(`\n[ASSIGNED HEALTHCARE WORKER]`);
      lines.push(`${ctx.assigned_worker.name} (${ctx.assigned_worker.role}, Facility: ${ctx.assigned_worker.facility_id || 'N/A'})`);
    }

    if (ctx.conversation_history?.length > 0) {
      lines.push(`\n[PREVIOUS CONVERSATIONS] (You remember these)`);
      ctx.conversation_history.forEach(c => {
        lines.push(`  - ${c.date}: ${c.summary}${c.topics?.length > 0 ? ' [Topics: ' + c.topics.join(', ') + ']' : ''}`);
      });
      lines.push(`Total conversations: ${ctx.total_conversations}, Last: ${ctx.last_conversation_date}`);
    }

    if (ctx.proactive_alerts?.length > 0) {
      lines.push(`\n[PROACTIVE HEALTH ALERTS — ADDRESS THESE NATURALLY]`);
      ctx.proactive_alerts.forEach(a => {
        lines.push(`  - ${a}`);
      });
    }
  }

  if (ctx.role === 'chw') {
    if (ctx.worker) {
      lines.push(`\n[WORKER PROFILE]`);
      lines.push(`Name: ${ctx.worker.name}`);
      lines.push(`Community: ${ctx.worker.community || 'N/A'}`);
    }
    if (ctx.assigned_mothers_count !== undefined) {
      lines.push(`\n[ASSIGNED MOTHERS]`);
      lines.push(`Total Assigned: ${ctx.assigned_mothers_count}`);
      lines.push(`High Risk Mothers: ${ctx.high_risk_mothers_count}`);
      if (ctx.high_risk_examples?.length > 0) {
        lines.push(`High Risk Examples (max 3):`);
        ctx.high_risk_examples.forEach(m => {
          lines.push(`  - ${m.name} (${m.community}) — Risk: ${m.risk}`);
        });
      }
    }
    if (ctx.pending_referrals_count !== undefined) {
      lines.push(`\n[PENDING REFERRALS]`);
      lines.push(`Total Pending: ${ctx.pending_referrals_count}`);
      if (ctx.recent_pending_referrals?.length > 0) {
        ctx.recent_pending_referrals.forEach(r => {
          lines.push(`  - Urgency: ${r.urgency} — Reason: ${r.reason}`);
        });
      }
    }
  }

  if (ctx.role === 'nurse') {
    if (ctx.worker) {
      lines.push(`\n[WORKER PROFILE]`);
      lines.push(`Name: ${ctx.worker.name}`);
      lines.push(`Facility: ${ctx.worker.facility_id || 'N/A'}`);
    }
    lines.push(`\n[FACILITY OVERVIEW]`);
    lines.push(`Total Mothers: ${ctx.total_mothers || 0}`);
    lines.push(`High Risk: ${ctx.high_risk_count || 0}`);
    if (ctx.facility_patients_count !== undefined) {
      lines.push(`Total Facility Mothers: ${ctx.facility_patients_count}`);
    }
    if (ctx.incoming_referrals_count !== undefined) {
      lines.push(`Total Incoming Referrals: ${ctx.incoming_referrals_count}`);
      if (ctx.recent_incoming_referrals?.length > 0) {
        ctx.recent_incoming_referrals.forEach(r => {
          lines.push(`  - Urgency: ${r.urgency} — Reason: ${r.reason}`);
        });
      }
    }
  }

  if (ctx.stats) {
    lines.push(`\n[SYSTEM OVERVIEW]`);
    lines.push(`Total Mothers: ${ctx.stats.total_mothers}`);
    lines.push(`Total Children: ${ctx.stats.total_children}`);
    lines.push(`Active Pregnancies: ${ctx.stats.active_pregnancies}`);
    lines.push(`High Risk Mothers: ${ctx.stats.high_risk_mothers}`);
    lines.push(`High Risk Pregnancies: ${ctx.stats.high_risk_pregnancies}`);
    lines.push(`Pending Referrals: ${ctx.stats.pending_referrals}`);
    lines.push(`Urgent Referrals: ${ctx.stats.urgent_referrals}`);
  }

  if (ctx.high_risk_patients?.length > 0) {
    lines.push(`\n[HIGH RISK PATIENTS NEEDING ATTENTION]`);
    ctx.high_risk_patients.forEach(p => {
      lines.push(`  - ${p.mother_name}: ${p.risk} risk, Week ${p.pregnancy_week || '?'}`);
    });
  }

  if (ctx.role === 'patient' && ctx.patient) {
    const p = ctx.patient;
    lines.push(`\n[SELECTED PATIENT RECORD]`);
    lines.push(`Patient: ${p.name}`);
    lines.push(`Patient ID: ${p.patient_code}`);
    lines.push(`Community: ${p.community}`);
    lines.push(`Risk Level: ${p.risk_level}`);
    lines.push(`Blood Group: ${p.blood_group}`);
    lines.push(`Medical History: ${p.medical_history}`);
    lines.push(`Registered: ${p.registered}`);
    lines.push(`Provenance: ${provenanceTag({ verified: p.verified, data_source: p.data_source })}`);
    lines.push(`SCOPE: Discuss ONLY this patient. Do not reference any other patient, mother, child, worker or staff.`);

    if (ctx.pregnancy?.status === 'active') {
      lines.push(`\n[SELECTED PATIENT — PREGNANCY]`);
      lines.push(`Status: Active — Pregnancy week: ${ctx.pregnancy.week || 'unknown'} (Trimester ${ctx.pregnancy.trimester || '?'})`);
      lines.push(`Due Date: ${ctx.pregnancy.edd}`);
      lines.push(`Risk Level: ${ctx.pregnancy.risk_level}`);
      lines.push(`Complications: ${ctx.pregnancy.complications}`);
      lines.push(`Provenance: ${provenanceTag({ verified: ctx.pregnancy.verified, data_source: ctx.pregnancy.data_source })}`);
      lines.push(`ANC Visits Completed: ${ctx.pregnancy.anc_visit_count} (Adherence: ${ctx.pregnancy.anc_adherence_percent}%)`);
      lines.push(`Last ANC Visit: ${ctx.pregnancy.last_anc_date}${ctx.pregnancy.days_since_last_anc != null ? ' (' + ctx.pregnancy.days_since_last_anc + ' days ago)' : ''}`);
      lines.push(`Last ANC Risk Assessment: ${ctx.pregnancy.last_anc_risk}`);
      if (ctx.pregnancy.overdue_anc) lines.push(`*** ALERT: ANC VISIT IS OVERDUE ***`);
      if (ctx.pregnancy.urgent_anc) lines.push(`*** ALERT: URGENT — THIRD TRIMESTER ANC NEEDED ***`);
      if (ctx.pregnancy.approaching_due_date) lines.push(`*** ALERT: APPROACHING DUE DATE ***`);
      if (ctx.pregnancy.past_due_date) lines.push(`*** ALERT: PAST DUE DATE — IMMEDIATE CONSULTATION NEEDED ***`);
      if (ctx.pregnancy.anc_details?.length > 0) {
        lines.push(`Recent ANC Details:`);
        ctx.pregnancy.anc_details.forEach(v => {
          lines.push(`  - ${v.date} (Visit #${v.visit_number}): Risk=${v.risk}, Weight=${v.weight}kg, BP=${v.blood_pressure}, Fundal Height=${v.fundal_height}, FHR=${v.fetal_heart_rate}${v.notes ? ', Notes: ' + v.notes : ''} [${v.verified ? 'VERIFIED' : 'UNVERIFIED'}]`);
        });
      }
    } else {
      lines.push(`\n[PREGNANCY] No active pregnancy`);
    }

    if (ctx.children?.length > 0) {
      lines.push(`\n[SELECTED PATIENT — CHILDREN]`);
      ctx.children.forEach(c => {
        lines.push(`  Child: ${c.name} — ${c.gender}, age ${c.age_months} months [${provenanceTag({ verified: c.verified, data_source: c.data_source })}]`);
        lines.push(`    Birth Weight: ${c.birth_weight}kg`);
        if (c.current_weight_kg) lines.push(`    Current Weight: ${c.current_weight_kg}kg`);
        lines.push(`    Vaccinations: ${c.vaccination_count} received (${c.vaccinations_received.map(v => `${v.vaccine}${v.verified ? ' [VERIFIED]' : ' [MOTHER-REPORTED]'}`).join(', ') || 'None recorded'})`);
        if (c.overdue_vaccination) lines.push(`    *** VACCINATION OVERDUE: ${c.overdue_vaccination} ***`);
        if (c.next_due_vaccination) lines.push(`    Next Due: ${c.next_due_vaccination}`);
        lines.push(`    Growth Records: ${c.growth_records_count} entries, Last Check: ${c.last_growth_check}${c.days_since_growth_check != null ? ' (' + c.days_since_growth_check + ' days ago)' : ''}`);
        if (c.growth_overdue) lines.push(`    *** GROWTH CHECK OVERDUE ***`);
      });
    }

    if (ctx.visit_history?.recent_visits?.length > 0) {
      lines.push(`\n[SELECTED PATIENT — VISIT HISTORY]`);
      lines.push(`Total Visits: ${ctx.visit_history.total}`);
      ctx.visit_history.recent_visits.forEach(v => {
        lines.push(`  - ${v.date}: ${v.type || 'visit'}${v.notes ? ' — ' + v.notes : ''}`);
      });
    }

    if (ctx.referrals?.length > 0) {
      lines.push(`\n[SELECTED PATIENT — REFERRALS]`);
      ctx.referrals.forEach(r => {
        lines.push(`  - ${r.date}: ${r.urgency} — ${r.status} — ${r.reason}${r.days_pending != null ? ' (' + r.days_pending + ' days pending)' : ''}`);
      });
    }

    if (ctx.pending_mother_reports?.length > 0) {
      lines.push(`\n[SELECTED PATIENT — PENDING MOTHER-REPORTED ITEMS — NOT YET VERIFIED BY A HEALTH WORKER]`);
      lines.push(`These come from the mother herself and have NOT been confirmed. Do not present them as confirmed clinical facts; advise the worker to verify them.`);
      ctx.pending_mother_reports.forEach(r => {
        lines.push(`  - ${r.type}: ${r.detail}${r.value ? ` (${r.value})` : ''} — reported ${r.reported_at}`);
      });
    }

    if (ctx.proactive_alerts?.length > 0) {
      lines.push(`\n[PROACTIVE HEALTH ALERTS — ADDRESS THESE NATURALLY]`);
      ctx.proactive_alerts.forEach(a => {
        lines.push(`  - ${a}`);
      });
    }
  }

  lines.push('\n=== END HEALTH CONTEXT ===');
  return lines.join('\n');
}

export default buildHealthContext;
