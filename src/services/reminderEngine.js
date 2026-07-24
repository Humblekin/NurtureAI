import db from '../lib/db';

/**
 * NurtureAI — Reminder Engine
 * 
 * Checks healthcare data for missed appointments, overdue vaccinations,
 * growth monitoring gaps, and inactive users. Generates notifications
 * that appear in the app.
 * 
 * Runs on app open and can be triggered periodically.
 */

const CHILD_AGE_LIMIT_MONTHS = 60; // 5 years

/**
 * Ghana EPI vaccination schedule (simplified).
 * Maps age in months to recommended vaccines.
 */
const VACCINATION_SCHEDULE = [
  { ageMonths: 0, vaccine: 'BCG', description: 'BCG (at birth)' },
  { ageMonths: 0, vaccine: 'OPV-0', description: 'OPV-0 (at birth)' },
  { ageMonths: 6, vaccine: 'OPV-1', description: 'OPV-1, Pentavalent-1, PCV-1, Rotavirus-1' },
  { ageMonths: 7, vaccine: 'OPV-2', description: 'OPV-2, Pentavalent-2, PCV-2, Rotavirus-2' },
  { ageMonths: 8, vaccine: 'OPV-3', description: 'OPV-3, Pentavalent-3, PCV-3, Rotavirus-3' },
  { ageMonths: 9, vaccine: 'IPV', description: 'IPV booster' },
  { ageMonths: 12, vaccine: 'Measles-1', description: 'Measles-Rubella-1, Yellow Fever' },
  { ageMonths: 15, vaccine: 'Measles-2', description: 'Measles-Rubella-2, Meningitis A' },
  { ageMonths: 18, vaccine: 'DPT-Booster', description: 'DPT booster, OPV booster' },
];

/**
 * Check for mothers with active pregnancies that have missed ANC visits.
 * Recommended: at least 4 ANC visits, monthly in first 2 trimesters, twice in 3rd.
 */
async function checkMissedANC(profileId) {
  const notifications = [];

  const mother = await db.mothers.where('profile_id').equals(profileId).first();
  if (!mother) return notifications;

  const activePregnancy = await db.pregnancies
    .where('mother_id').equals(mother.id)
    .filter(p => !p.deleted_at && p.status === 'active')
    .first();

  if (!activePregnancy) return notifications;

  const ancVisits = await db.antenatal_visits
    .where('pregnancy_id').equals(activePregnancy.id)
    .filter(v => !v.deleted_at)
    .toArray();

  // Calculate pregnancy week
  const start = new Date(activePregnancy.created_at);
  const now = new Date();
  const weeksPregnant = Math.floor((now - start) / (1000 * 60 * 60 * 24 * 7));

  // Check if last ANC was more than 30 days ago
  const sortedVisits = ancVisits.sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date));
  const lastVisit = sortedVisits[0];
  const daysSinceLastVisit = lastVisit
    ? Math.floor((now - new Date(lastVisit.visit_date)) / (1000 * 60 * 60 * 24))
    : Infinity;

  if (daysSinceLastVisit > 30 && weeksPregnant <= 28) {
    notifications.push({
      type: 'missed_anc',
      priority: 'high',
      title: 'ANC Visit Overdue',
      message: `Your last antenatal visit was ${daysSinceLastVisit} days ago. Regular check-ups are essential for monitoring your health and your baby's development.`,
      patient_id: mother.id,
    });
  } else if (daysSinceLastVisit > 14 && weeksPregnant > 28) {
    notifications.push({
      type: 'missed_anc',
      priority: 'high',
      title: 'ANC Visit Due',
      message: `In your third trimester, visits should be more frequent. Your last ANC was ${daysSinceLastVisit} days ago.`,
      patient_id: mother.id,
    });
  }

  // Warn if approaching 42 weeks
  if (weeksPregnant >= 40) {
    notifications.push({
      type: 'pregnancy_overdue',
      priority: 'critical',
      title: weeksPregnant >= 42 ? 'Pregnancy Past Due' : 'Approaching Due Date',
      message: weeksPregnant >= 42
        ? 'You are past 42 weeks. Please contact your healthcare provider immediately.'
        : `You are at week ${weeksPregnant}. Please discuss your delivery plan with your healthcare provider.`,
      patient_id: mother.id,
    });
  }

  return notifications;
}

/**
 * Check for children with overdue vaccinations.
 */
async function checkOverdueVaccinations(profileId) {
  const notifications = [];

  // Get children based on role
  let children = [];
  if (profileId) {
    const mother = await db.mothers.where('profile_id').equals(profileId).first();
    if (mother) {
      children = await db.children
        .where('mother_id').equals(mother.id)
        .filter(c => !c.deleted_at)
        .toArray();
    }
  } else {
    children = await db.children.filter(c => !c.deleted_at).toArray();
  }

  for (const child of children) {
    const ageMonths = getChildAgeMonths(child.birth_date);
    if (ageMonths === null || ageMonths > CHILD_AGE_LIMIT_MONTHS) continue;

    const vaccinations = await db.vaccinations
      .where('child_id').equals(child.id)
      .filter(v => !v.deleted_at)
      .toArray();

    const vaxNames = new Set(vaccinations.map(v => v.vaccine_name));

    // Check which vaccines should have been given by now
    for (const schedule of VACCINATION_SCHEDULE) {
      if (ageMonths >= schedule.ageMonths + 1 && !vaxNames.has(schedule.vaccine)) {
        // Only notify for overdue vaccines (past the scheduled age + 1 month grace)
        const overdueMonths = ageMonths - schedule.ageMonths;
        if (overdueMonths >= 1 && overdueMonths <= 6) {
          notifications.push({
            type: 'missed_vaccination',
            priority: overdueMonths > 3 ? 'high' : 'medium',
            title: 'Vaccination Overdue',
            message: `${child.full_name} (age ${ageMonths}mo) is due for ${schedule.description}. Please visit your nearest health facility.`,
            patient_id: child.id,
            child_name: child.full_name,
          });
          break; // One notification per child is enough
        }
      }
    }
  }

  return notifications;
}

/**
 * Check for children with overdue growth monitoring.
 * Recommended: monthly for first year, quarterly for years 1-5.
 */
async function checkOverdueGrowthMonitoring(profileId) {
  const notifications = [];

  let children = [];
  if (profileId) {
    const mother = await db.mothers.where('profile_id').equals(profileId).first();
    if (mother) {
      children = await db.children
        .where('mother_id').equals(mother.id)
        .filter(c => !c.deleted_at)
        .toArray();
    }
  }

  for (const child of children) {
    const ageMonths = getChildAgeMonths(child.birth_date);
    if (ageMonths === null) continue;

    const growthRecords = await db.growth_records
      .where('child_id').equals(child.id)
      .filter(g => !g.deleted_at)
      .toArray();

    if (growthRecords.length === 0 && ageMonths > 1) {
      notifications.push({
        type: 'growth_monitoring_due',
        priority: 'medium',
        title: 'Growth Check Needed',
        message: `${child.full_name} has no growth records. Regular weight and height monitoring is important.`,
        patient_id: child.id,
        child_name: child.full_name,
      });
      continue;
    }

    const sorted = growthRecords.sort((a, b) => new Date(b.recorded_date) - new Date(a.recorded_date));
    const lastCheck = sorted[0];
    const daysSince = Math.floor((new Date() - new Date(lastCheck.recorded_date)) / (1000 * 60 * 60 * 24));

    const maxDays = ageMonths <= 12 ? 30 : 90; // Monthly for first year, quarterly after

    if (daysSince > maxDays) {
      notifications.push({
        type: 'growth_monitoring_due',
        priority: daysSince > maxDays * 2 ? 'high' : 'medium',
        title: 'Growth Check Overdue',
        message: `${child.full_name}'s last growth check was ${daysSince} days ago. Regular monitoring helps detect growth problems early.`,
        patient_id: child.id,
        child_name: child.full_name,
      });
    }
  }

  return notifications;
}

/**
 * Check for inactive mothers (no login activity for several days).
 */
async function checkInactiveMothers() {
  const notifications = [];

  const mothers = await db.mothers.filter(m => !m.deleted_at).toArray();

  for (const mother of mothers) {
    // Check if there are any recent visits or activity
    const recentVisits = await db.visits
      .where('patient_id').equals(mother.id)
      .filter(v => !v.deleted_at)
      .toArray();

    const sortedVisits = recentVisits.sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date));
    const lastVisit = sortedVisits[0];

    const daysSinceActivity = lastVisit
      ? Math.floor((new Date() - new Date(lastVisit.visit_date)) / (1000 * 60 * 60 * 24))
      : 999;

    if (daysSinceActivity > 7) {
      notifications.push({
        type: 'inactive_mother',
        priority: daysSinceActivity > 14 ? 'high' : 'medium',
        title: 'Inactive Mother',
        message: `${mother.full_name} has not had any recorded activity for ${daysSinceActivity} days. Consider following up.`,
        patient_id: mother.id,
        assign_to_worker: mother.assigned_worker_id,
      });
    }
  }

  return notifications;
}

/**
 * Check for pending referrals that need attention.
 */
async function checkPendingReferrals(profileId, facilityId) {
  const notifications = [];

  let referrals;
  if (facilityId) {
    referrals = await db.referrals
      .where('to_facility_id').equals(facilityId)
      .filter(r => !r.deleted_at && r.status === 'pending')
      .toArray();
  } else {
    referrals = await db.referrals
      .filter(r => !r.deleted_at && r.status === 'pending')
      .toArray();
  }

  for (const ref of referrals) {
    const daysSinceCreated = Math.floor(
      (new Date() - new Date(ref.created_at)) / (1000 * 60 * 60 * 24)
    );

    if (ref.urgency === 'emergency' && daysSinceCreated >= 1) {
      notifications.push({
        type: 'urgent_referral',
        priority: 'critical',
        title: 'Emergency Referral Pending',
        message: `An emergency referral for patient ${ref.patient_id} has been pending for ${daysSinceCreated} day(s). Immediate action required.`,
        referral_id: ref.id,
      });
    } else if (ref.urgency === 'urgent' && daysSinceCreated >= 3) {
      notifications.push({
        type: 'urgent_referral',
        priority: 'high',
        title: 'Urgent Referral Pending',
        message: `An urgent referral for patient ${ref.patient_id} has been pending for ${daysSinceCreated} days.`,
        referral_id: ref.id,
      });
    }
  }

  return notifications;
}

/**
 * Main reminder engine — runs all checks and stores notifications.
 */
export async function runReminderEngine(profile) {
  if (!profile) return [];

  const allNotifications = [];

  try {
    // Role-specific checks
    if (profile.role === 'mother') {
      const anc = await checkMissedANC(profile.id);
      const vax = await checkOverdueVaccinations(profile.id);
      const growth = await checkOverdueGrowthMonitoring(profile.id);
      allNotifications.push(...anc, ...vax, ...growth);
    } else if (profile.role === 'chw') {
      const inactive = await checkInactiveMothers();
      const pendingRef = await checkPendingReferrals(profile.id, null);
      allNotifications.push(...inactive, ...pendingRef);
    } else if (profile.role === 'nurse' || profile.role === 'doctor') {
      const pendingRef = await checkPendingReferrals(profile.id, profile.facility_id);
      allNotifications.push(...pendingRef);
    } else if (profile.role === 'admin' || profile.role === 'district_officer') {
      const inactive = await checkInactiveMothers();
      const pendingRef = await checkPendingReferrals();
      allNotifications.push(...inactive, ...pendingRef);
    }

    // Store notifications in IndexedDB
    if (allNotifications.length > 0) {
      await db.notifications.bulkPut(allNotifications.map((n, i) => ({
        ...n,
        id: `reminder-${profile.id}-${Date.now()}-${i}`,
        created_at: new Date().toISOString(),
        read: false,
      })));
    }
  } catch (error) {
    console.error('Reminder engine error:', error);
  }

  return allNotifications;
}

/**
 * Fetch unread notifications for a user.
 */
export async function getUnreadNotifications() {
  try {
    return await db.notifications
      .filter(n => !n.read)
      .toArray();
  } catch {
    return [];
  }
}

/**
 * Mark a notification as read.
 */
export async function markNotificationRead(id) {
  try {
    await db.notifications.update(id, { read: true });
  } catch (error) {
    console.error('Failed to mark notification read:', error);
  }
}

/**
 * Mark all notifications as read.
 */
export async function markAllRead() {
  try {
    const unread = await db.notifications.filter(n => !n.read).toArray();
    await Promise.all(unread.map(n => db.notifications.update(n.id, { read: true })));
  } catch (error) {
    console.error('Failed to mark all notifications read:', error);
  }
}

function getChildAgeMonths(dob) {
  if (!dob) return null;
  const birth = new Date(dob);
  const now = new Date();
  return Math.max(0, (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth()));
}

export default runReminderEngine;
