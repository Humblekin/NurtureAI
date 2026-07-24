import db from '../lib/db';

/**
 * NurtureAI — Health Context Service
 * 
 * Fetches all relevant healthcare data from IndexedDB (Dexie) for the current
 * user and formats it as structured context that gets injected into every AI
 * prompt. This is what transforms Amina from a generic chatbot into a
 * personal healthcare companion.
 * 
 * Each role sees only the data relevant to their access level.
 */

/**
 * Calculate pregnancy week from a start date (LMP or registration date).
 */
function getPregnancyWeek(createdAt, edd) {
  if (!createdAt) return null;
  const start = new Date(createdAt);
  const now = new Date();
  const diffMs = now - start;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const week = Math.floor(diffDays / 7);
  return Math.min(week, 42);
}

/**
 * Calculate age from date of birth.
 */
function getAgeYears(dob) {
  if (!dob) return null;
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return age;
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
 * This is the richest context — includes pregnancy, children, vaccinations, growth, visits.
 */
async function buildMotherContext(profileId) {
  const context = { role: 'mother' };

  // 1. Mother profile
  const mother = await db.mothers.where('profile_id').equals(profileId).first();
  if (!mother) return context;

  context.mother = {
    id: mother.id,
    name: mother.full_name,
    community: mother.community || 'Not recorded',
    risk_level: mother.risk_level || 'low',
    phone: mother.phone || 'Not recorded',
    assigned_worker_id: mother.assigned_worker_id || null,
    registered: fmt(mother.created_at),
  };

  // 2. Active pregnancy
  const pregnancies = await db.pregnancies
    .where('mother_id').equals(mother.id)
    .filter(p => !p.deleted_at)
    .toArray();

  const activePregnancy = pregnancies.find(p => p.status === 'active');

  if (activePregnancy) {
    const week = getPregnancyWeek(activePregnancy.created_at, activePregnancy.edd);
    const ancVisits = await db.antenatal_visits
      .where('pregnancy_id').equals(activePregnancy.id)
      .filter(v => !v.deleted_at)
      .toArray();

    const sortedVisits = ancVisits.sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date));

    context.pregnancy = {
      status: 'active',
      week: week,
      edd: activePregnancy.edd ? fmt(activePregnancy.edd) : 'Unknown',
      risk_level: activePregnancy.risk_level || 'low',
      complications: activePregnancy.complications || 'None reported',
      blood_group: activePregnancy.blood_group || 'Not recorded',
      anc_visit_count: ancVisits.length,
      last_anc_date: sortedVisits.length > 0 ? fmt(sortedVisits[0].visit_date) : 'No visits recorded',
      last_anc_risk: sortedVisits.length > 0 ? sortedVisits[0].assessed_risk_level || 'Not assessed' : 'N/A',
      anc_details: sortedVisits.slice(0, 5).map(v => ({
        date: fmt(v.visit_date),
        visit_number: v.visit_number,
        risk: v.assessed_risk_level || 'Not assessed',
        weight: v.weight_kg || 'N/A',
        blood_pressure: v.blood_pressure || 'N/A',
        notes: v.clinical_notes || v.notes || null,
      })),
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
    }));
  }

  // 3. Children
  const children = await db.children
    .where('mother_id').equals(mother.id)
    .filter(c => !c.deleted_at)
    .toArray();

  if (children.length > 0) {
    context.children = [];

    for (const child of children) {
      const ageMonths = getChildAgeMonths(child.birth_date);
      const childVax = await db.vaccinations
        .where('child_id').equals(child.id)
        .filter(v => !v.deleted_at)
        .toArray();
      const childGrowth = await db.growth_records
        .where('child_id').equals(child.id)
        .filter(g => !g.deleted_at)
        .toArray();

      const sortedGrowth = childGrowth.sort((a, b) => new Date(a.recorded_date) - new Date(b.recorded_date));
      const latestGrowth = sortedGrowth.length > 0 ? sortedGrowth[sortedGrowth.length - 1] : null;
      const latestWeight = latestGrowth?.weight_kg || null;
      const latestHeight = latestGrowth?.height_cm || null;

      context.children.push({
        name: child.full_name,
        age_months: ageMonths,
        gender: child.gender,
        birth_weight: child.birth_weight || 'N/A',
        current_weight_kg: latestWeight,
        current_height_cm: latestHeight,
        vaccinations_received: childVax.map(v => ({
          vaccine: v.vaccine_name,
          date: fmt(v.date_given),
        })),
        vaccination_count: childVax.length,
        growth_records_count: childGrowth.length,
        last_growth_check: sortedGrowth.length > 0 ? fmt(sortedGrowth[sortedGrowth.length - 1].recorded_date) : 'No records',
        days_since_growth_check: sortedGrowth.length > 0 ? daysSince(sortedGrowth[sortedGrowth.length - 1].recorded_date) : null,
      });
    }
  }

  // 4. Home visits by CHW
  const visits = await db.visits
    .where('patient_id').equals(mother.id)
    .filter(v => !v.deleted_at)
    .toArray();

  if (visits.length > 0) {
    const sortedVisits = visits.sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date));
    context.visit_history = {
      total: visits.length,
      last_visit_date: fmt(sortedVisits[0].visit_date),
      last_visit_type: sortedVisits[0].visit_type || 'Not specified',
      last_visit_notes: sortedVisits[0].notes || sortedVisits[0].findings || null,
      recent_visits: sortedVisits.slice(0, 3).map(v => ({
        date: fmt(v.visit_date),
        type: v.visit_type,
        notes: v.notes || v.findings || null,
      })),
    };
  }

  // 5. Referrals
  const referrals = await db.referrals
    .where('patient_id').equals(mother.id)
    .filter(r => !r.deleted_at)
    .toArray();

  if (referrals.length > 0) {
    context.referrals = referrals.map(r => ({
      urgency: r.urgency,
      status: r.status,
      reason: r.reason || r.notes || 'Not specified',
      date: fmt(r.created_at),
    }));
  }

  // 6. Assigned healthcare worker
  if (mother.assigned_worker_id) {
    const workerProfile = await db.profiles.get(mother.assigned_worker_id);
    if (workerProfile) {
      context.assigned_worker = {
        name: workerProfile.full_name,
        role: workerProfile.role,
        facility_id: workerProfile.facility_id,
      };
    }
  }

  return context;
}

/**
 * Build health context for a CHW user.
 * Shows their assigned mothers, recent visits, pending referrals.
 */
async function buildCHWContext(profileId) {
  const context = { role: 'chw' };

  const profile = await db.profiles.get(profileId);
  if (profile) {
    context.worker = {
      name: profile.full_name,
      facility_id: profile.facility_id,
      community: profile.community,
    };
  }

  // All mothers assigned to this CHW
  const mothers = await db.mothers
    .where('assigned_worker_id').equals(profileId)
    .filter(m => !m.deleted_at)
    .toArray();

  context.assigned_mothers = mothers.map(m => ({
    name: m.full_name,
    community: m.community,
    risk_level: m.risk_level || 'low',
    id: m.id,
  }));

  // High-risk mothers
  context.high_risk_mothers = mothers
    .filter(m => m.risk_level === 'high' || m.risk_level === 'critical')
    .map(m => ({ name: m.full_name, risk: m.risk_level, community: m.community }));

  // Recent visits by this CHW
  const visits = await db.visits
    .where('worker_id').equals(profileId)
    .filter(v => !v.deleted_at)
    .toArray();

  const sortedVisits = visits.sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date));
  context.recent_visits = sortedVisits.slice(0, 5).map(v => ({
    date: fmt(v.visit_date),
    patient_id: v.patient_id,
    type: v.visit_type,
    notes: v.notes || null,
  }));

  // Pending referrals from this CHW
  const referrals = await db.referrals
    .where('from_facility_id').equals(profileId)
    .filter(r => !r.deleted_at)
    .toArray();

  context.pending_referrals = referrals
    .filter(r => r.status === 'pending')
    .map(r => ({
      patient_id: r.patient_id,
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

  const profile = await db.profiles.get(profileId);
  if (profile) {
    context.worker = {
      name: profile.full_name,
      facility_id: profile.facility_id,
    };
  }

  // Mothers at this facility (via assigned_worker's facility or direct facility_id)
  if (profile?.facility_id) {
    const allMothers = await db.mothers.filter(m => !m.deleted_at).toArray();
    const facilityMothers = allMothers.filter(m => {
      // Check if any assigned worker is at this facility
      return m.facility_id === profile.facility_id || m.birth_facility_id === profile.facility_id;
    });

    context.facility_patients = facilityMothers.map(m => ({
      name: m.full_name,
      community: m.community,
      risk_level: m.risk_level || 'low',
    }));

    // Incoming referrals to this facility
    const referrals = await db.referrals
      .where('to_facility_id').equals(profile.facility_id)
      .filter(r => !r.deleted_at)
      .toArray();

    context.incoming_referrals = referrals
      .filter(r => r.status === 'pending')
      .map(r => ({
        patient_id: r.patient_id,
        urgency: r.urgency,
        reason: r.reason || 'Not specified',
      }));
  }

  // All mothers (for general nurse access)
  const mothers = await db.mothers.filter(m => !m.deleted_at).toArray();
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

  const profile = await db.profiles.get(profileId);
  if (profile) {
    context.worker = {
      name: profile.full_name,
      facility_id: profile.facility_id,
    };
  }

  // Aggregate stats
  const mothers = await db.mothers.filter(m => !m.deleted_at).toArray();
  const children = await db.children.filter(c => !c.deleted_at).toArray();
  const pregnancies = await db.pregnancies.filter(p => !p.deleted_at).toArray();
  const activePregnancies = pregnancies.filter(p => p.status === 'active');
  const referrals = await db.referrals.filter(r => !r.deleted_at).toArray();
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
          const mother = await db.mothers.get(p.mother_id);
          return {
            mother_name: mother?.full_name || 'Unknown',
            risk: p.risk_level,
            pregnancy_week: getPregnancyWeek(p.created_at, p.edd),
          };
        })
    );
    context.high_risk_patients = highRiskPregnancies;
  }

  return context;
}

/**
 * Main function: Build health context based on user role.
 * Returns a formatted string ready to be injected into the AI system prompt.
 */
export async function buildHealthContext(profile) {
  if (!profile?.id || !profile?.role) return '';

  let rawData;

  switch (profile.role) {
    case 'mother':
      rawData = await buildMotherContext(profile.id);
      break;
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

  return formatContextForAI(rawData);
}

/**
 * Format the structured context data into a readable string for the AI.
 */
function formatContextForAI(ctx) {
  if (!ctx || Object.keys(ctx).length <= 1) return '';

  const lines = ['=== PATIENT HEALTH CONTEXT (auto-generated, do not ask user to repeat) ==='];

  if (ctx.role === 'mother') {
    if (ctx.mother) {
      lines.push(`\n[MOTHER PROFILE]`);
      lines.push(`Name: ${ctx.mother.name}`);
      lines.push(`Community: ${ctx.mother.community}`);
      lines.push(`Risk Level: ${ctx.mother.risk_level}`);
      lines.push(`Registered: ${ctx.mother.registered}`);
    }

    if (ctx.pregnancy?.status === 'active') {
      lines.push(`\n[CURRENT PREGNANCY]`);
      lines.push(`Status: Active — Week ${ctx.pregnancy.week || 'unknown'}`);
      lines.push(`Due Date: ${ctx.pregnancy.edd}`);
      lines.push(`Risk Level: ${ctx.pregnancy.risk_level}`);
      lines.push(`Blood Group: ${ctx.pregnancy.blood_group}`);
      lines.push(`Complications: ${ctx.pregnancy.complications}`);
      lines.push(`ANC Visits Completed: ${ctx.pregnancy.anc_visit_count}`);
      lines.push(`Last ANC Visit: ${ctx.pregnancy.last_anc_date} (Risk: ${ctx.pregnancy.last_anc_risk})`);
      if (ctx.pregnancy.anc_details?.length > 0) {
        lines.push(`Recent ANC Details:`);
        ctx.pregnancy.anc_details.forEach(v => {
          lines.push(`  - ${v.date} (Visit #${v.visit_number}): Risk=${v.risk}, Weight=${v.weight}kg, BP=${v.blood_pressure}${v.notes ? ', Notes: ' + v.notes : ''}`);
        });
      }
    } else {
      lines.push(`\n[PREGNANCY] No active pregnancy`);
    }

    if (ctx.pregnancy_history?.length > 0) {
      lines.push(`\n[PREGNANCY HISTORY]`);
      ctx.pregnancy_history.forEach(p => {
        lines.push(`  - ${p.outcome || p.status} (${p.delivery_date})`);
      });
    }

    if (ctx.children?.length > 0) {
      lines.push(`\n[CHILDREN]`);
      ctx.children.forEach(c => {
        lines.push(`  ${c.name} (${c.gender}, ${c.age_months} months old)`);
        lines.push(`    Birth Weight: ${c.birth_weight}kg`);
        if (c.current_weight_kg) lines.push(`    Current Weight: ${c.current_weight_kg}kg`);
        if (c.current_height_cm) lines.push(`    Height: ${c.current_height_cm}cm`);
        lines.push(`    Vaccinations Received: ${c.vaccination_count} (${c.vaccinations_received.map(v => v.vaccine).join(', ') || 'None recorded'})`);
        lines.push(`    Growth Records: ${c.growth_records_count} entries, Last Check: ${c.last_growth_check}${c.days_since_growth_check != null ? ' (' + c.days_since_growth_check + ' days ago)' : ''}`);
      });
    }

    if (ctx.visit_history) {
      lines.push(`\n[VISIT HISTORY]`);
      lines.push(`Total Visits: ${ctx.visit_history.total}`);
      lines.push(`Last Visit: ${ctx.visit_history.last_visit_date} (${ctx.visit_history.last_visit_type})`);
      if (ctx.visit_history.last_visit_notes) lines.push(`  Notes: ${ctx.visit_history.last_visit_notes}`);
    }

    if (ctx.referrals?.length > 0) {
      lines.push(`\n[REFERRALS]`);
      ctx.referrals.forEach(r => {
        lines.push(`  - ${r.date}: ${r.urgency} — ${r.status} — ${r.reason}`);
      });
    }

    if (ctx.assigned_worker) {
      lines.push(`\n[ASSIGNED HEALTHCARE WORKER]`);
      lines.push(`${ctx.assigned_worker.name} (${ctx.assigned_worker.role})`);
    }
  }

  if (ctx.role === 'chw') {
    if (ctx.worker) {
      lines.push(`\n[WORKER PROFILE]`);
      lines.push(`Name: ${ctx.worker.name}`);
      lines.push(`Community: ${ctx.worker.community || 'N/A'}`);
    }
    if (ctx.assigned_mothers?.length > 0) {
      lines.push(`\n[ASSIGNED MOTHERS] (${ctx.assigned_mothers.length} total)`);
      ctx.assigned_mothers.forEach(m => {
        lines.push(`  - ${m.name} (${m.community}) — Risk: ${m.risk_level}`);
      });
    }
    if (ctx.high_risk_mothers?.length > 0) {
      lines.push(`\n[HIGH RISK MOTHERS] (${ctx.high_risk_mothers.length})`);
      ctx.high_risk_mothers.forEach(m => {
        lines.push(`  - ${m.name} — ${m.risk} — ${m.community}`);
      });
    }
    if (ctx.pending_referrals?.length > 0) {
      lines.push(`\n[PENDING REFERRALS] (${ctx.pending_referrals.length})`);
      ctx.pending_referrals.forEach(r => {
        lines.push(`  - Patient ${r.patient_id}: ${r.urgency} — ${r.reason}`);
      });
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
    if (ctx.incoming_referrals?.length > 0) {
      lines.push(`Incoming Referrals: ${ctx.incoming_referrals.length}`);
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

  lines.push('\n=== END HEALTH CONTEXT ===');
  return lines.join('\n');
}

export default buildHealthContext;
