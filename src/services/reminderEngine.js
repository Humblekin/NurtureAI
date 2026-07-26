import db, { queueSync } from '../lib/db';
import { GHANA_EPI_SCHEDULE, findOverdueVaccine } from '../constants/vaccinationSchedule';

/**
 * NurtureAI — Reminder Engine
 *
 * Proactive healthcare intelligence system.
 * Checks healthcare data for missed appointments, overdue vaccinations,
 * growth monitoring gaps, nutrition gaps, supplement tracking, and
 * inactive users. Generates personalized notifications that appear
 * in the app and can trigger voice reminders.
 *
 * Runs on app open and can be triggered periodically.
 */

const CHILD_AGE_LIMIT_MONTHS = 60; // 5 years

/**
 * Check for mothers with active pregnancies that have missed ANC visits.
 * Recommended: at least 4 ANC visits, monthly in first 2 trimesters, twice in 3rd.
 * Personalizes messages with the mother's name, pregnancy week, and specific timing.
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

  // Calculate pregnancy week from LMP (preferred) or created_at (fallback)
  const start = new Date(activePregnancy.lmp || activePregnancy.created_at);
  const now = new Date();
  const weeksPregnant = Math.floor((now - start) / (1000 * 60 * 60 * 24 * 7));

  // Check if last ANC was more than 30 days ago
  const sortedVisits = ancVisits.sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date));
  const lastVisit = sortedVisits[0];
  const daysSinceLastVisit = lastVisit
    ? Math.floor((now - new Date(lastVisit.visit_date)) / (1000 * 60 * 60 * 24))
    : Infinity;

  // WHO recommends: at least 8 contacts in pregnancy (or 4 minimum)
  const expectedVisitCount = weeksPregnant <= 28
    ? Math.ceil(weeksPregnant / 12)
    : Math.ceil(28 / 12) + Math.ceil((weeksPregnant - 28) / 6);
  const _missedVisits = Math.max(0, expectedVisitCount - ancVisits.length);

  if (daysSinceLastVisit > 30 && weeksPregnant <= 28) {
    notifications.push({
      type: 'missed_anc',
      priority: 'high',
      title: 'ANC Visit Overdue',
      message: `${mother.full_name}, your last antenatal visit was ${daysSinceLastVisit} days ago. You are now ${weeksPregnant} weeks pregnant. Regular check-ups help monitor your health and your baby's development. Please visit your health facility this week.`,
      patient_id: mother.id,
      voice_message: `Hello ${mother.full_name}. You are now ${weeksPregnant} weeks pregnant. Your last antenatal visit was ${daysSinceLastVisit} days ago. Please visit your health facility for your next check-up.`,
    });
  } else if (daysSinceLastVisit > 14 && weeksPregnant > 28) {
    notifications.push({
      type: 'missed_anc',
      priority: 'critical',
      title: 'ANC Visit Urgently Needed',
      message: `${mother.full_name}, in your third trimester (week ${weeksPregnant}), visits should be more frequent — at least every two weeks. Your last ANC was ${daysSinceLastVisit} days ago. Please schedule your next visit soon.`,
      patient_id: mother.id,
      voice_message: `${mother.full_name}, you are in your third trimester at week ${weeksPregnant}. Your last antenatal visit was ${daysSinceLastVisit} days ago. Third trimester visits should be more frequent. Please visit your health facility soon.`,
    });
  }

  // Check if ANC count is below recommended
  if (ancVisits.length < 4 && weeksPregnant >= 20) {
    notifications.push({
      type: 'insufficient_anc',
      priority: 'medium',
      title: 'More ANC Visits Recommended',
      message: `${mother.full_name}, you have completed ${ancVisits.length} ANC visit${ancVisits.length !== 1 ? 's' : ''} so far. WHO recommends at least 4 visits during pregnancy. You're doing well — keep it up!`,
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
        ? `${mother.full_name}, you are past 42 weeks. Please contact your healthcare provider immediately for assessment.`
        : `${mother.full_name}, you are at week ${weeksPregnant} — very close to your due date. Please discuss your delivery plan with your healthcare provider.`,
      patient_id: mother.id,
      voice_message: weeksPregnant >= 42
        ? `${mother.full_name}, you are past your due date at ${weeksPregnant} weeks. Please contact your healthcare provider immediately.`
        : `${mother.full_name}, you are at week ${weeksPregnant}. Please discuss your delivery plan with your healthcare provider.`,
    });
  }

  return notifications;
}

/**
 * Check for children with overdue vaccinations.
 * Uses the child's name and specific vaccine information for personalization.
 */
async function checkOverdueVaccinations(profileId) {
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
  // If no profileId, return empty — never load all children globally

  for (const child of children) {
    const ageMonths = getChildAgeMonths(child.date_of_birth || child.birth_date);
    if (ageMonths === null || ageMonths > CHILD_AGE_LIMIT_MONTHS) continue;

    const vaccinations = await db.vaccinations
      .where('child_id').equals(child.id)
      .filter(v => !v.deleted_at)
      .toArray();

    const vaxNames = new Set(vaccinations.map(v => v.vaccine_name));

    // Check which vaccines should have been given by now
    for (const schedule of GHANA_EPI_SCHEDULE) {
      if (ageMonths >= schedule.ageMonths + 1 && !vaxNames.has(schedule.vaccine)) {
        // Only notify for overdue vaccines (past the scheduled age + 1 month grace)
        const overdueMonths = ageMonths - schedule.ageMonths;
        if (overdueMonths >= 1 && overdueMonths <= 6) {
          notifications.push({
            type: 'missed_vaccination',
            priority: overdueMonths > 3 ? 'high' : 'medium',
            title: 'Vaccination Overdue',
            message: `${child.full_name} (age ${ageMonths} months) is due for ${schedule.description}. Vaccination protects your child from serious diseases. Please visit your nearest health facility.`,
            patient_id: child.id,
            child_name: child.full_name,
            voice_message: `${child.full_name} is ${ageMonths} months old and is due for ${schedule.description}. Please visit your health facility to keep your child protected.`,
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
    const ageMonths = getChildAgeMonths(child.date_of_birth || child.birth_date);
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
        message: `${child.full_name} has no growth records. Regular weight and height monitoring helps ensure your child is growing well. Please visit your nearest health facility.`,
        patient_id: child.id,
        child_name: child.full_name,
        voice_message: `${child.full_name} has no growth records yet. Regular weight and height monitoring is important for your child's health.`,
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
        message: `${child.full_name}'s last growth check was ${daysSince} days ago. Regular monitoring helps detect growth problems early. Please schedule a visit.`,
        patient_id: child.id,
        child_name: child.full_name,
        voice_message: `${child.full_name}'s last growth check was ${daysSince} days ago. Regular monitoring helps catch any concerns early.`,
      });
    }
  }

  return notifications;
}

/**
 * Check for mothers with no recent nutrition logs.
 * Encourages regular nutrition tracking.
 */
async function checkNutritionTracking(profileId) {
  const notifications = [];

  const mother = await db.mothers.where('profile_id').equals(profileId).first();
  if (!mother) return notifications;

  // Check for nutrition-related activities in recent visits
  const recentVisits = await db.visits
    .where('patient_id').equals(mother.id)
    .filter(v => !v.deleted_at)
    .toArray();

  const sortedVisits = recentVisits.sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date));
  const lastVisit = sortedVisits[0];

  const daysSinceActivity = lastVisit
    ? Math.floor((new Date() - new Date(lastVisit.visit_date)) / (1000 * 60 * 60 * 24))
    : 999;

  // If no activity in 7 days, suggest logging nutrition
  if (daysSinceActivity > 7) {
    notifications.push({
      type: 'nutrition_reminder',
      priority: 'low',
      title: 'Health Tracking Reminder',
      message: `${mother.full_name}, it's been a while since you logged your health information. Regular tracking helps Amina provide better support for you and your baby.`,
      patient_id: mother.id,
    });
  }

  return notifications;
}

/**
 * Check for inactive mothers (no login activity for several days).
 * @param {Object} [scope] - Optional scope filter.
 * @param {string} [scope.facilityId] - Only check mothers at this facility.
 * @param {string} [scope.assignedWorkerId] - Only check mothers assigned to this worker.
 */
async function checkInactiveMothers(scope = {}) {
  const notifications = [];

  let query = db.mothers.filter(m => !m.deleted_at);
  if (scope.facilityId) {
    query = query.filter(m => m.facility_id === scope.facilityId);
  }
  if (scope.assignedWorkerId) {
    query = query.filter(m => m.assigned_worker_id === scope.assignedWorkerId);
  }
  const mothers = await query.toArray();

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
 * Generate Amina's proactive voice greeting based on health context.
 * Called when the mother opens the app — Amina speaks a personalized greeting.
 */
export async function generateAminaGreeting(profile) {
  if (!profile || profile.role !== 'mother') return null;

  const mother = await db.mothers.where('profile_id').equals(profile.id).first();
  if (!mother) return null;

  const activePregnancy = await db.pregnancies
    .where('mother_id').equals(mother.id)
    .filter(p => !p.deleted_at && p.status === 'active')
    .first();

  const children = await db.children
    .where('mother_id').equals(mother.id)
    .filter(c => !c.deleted_at)
    .toArray();

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  let voiceGreeting = `${greeting}, ${mother.full_name}. `;

  if (activePregnancy) {
    const week = Math.floor((now - new Date(activePregnancy.lmp || activePregnancy.created_at)) / (1000 * 60 * 60 * 24 * 7));
    voiceGreeting += `You are now ${week} weeks pregnant. `;

    // Check for upcoming ANC
    const ancVisits = await db.antenatal_visits
      .where('pregnancy_id').equals(activePregnancy.id)
      .filter(v => !v.deleted_at)
      .toArray();

    const sortedVisits = ancVisits.sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date));
    const lastVisit = sortedVisits[0];
    const daysSinceVisit = lastVisit
      ? Math.floor((now - new Date(lastVisit.visit_date)) / (1000 * 60 * 60 * 24))
      : Infinity;

    if (daysSinceVisit > 28) {
      voiceGreeting += `It's been ${daysSinceVisit} days since your last antenatal visit. Remember to schedule your next check-up. `;
    }
  }

  if (children.length > 0) {
    const youngest = children.reduce((a, b) =>
      new Date(a.date_of_birth || a.birth_date) > new Date(b.date_of_birth || b.birth_date) ? a : b
    );
    voiceGreeting += `How is ${youngest.full_name} doing today? `;
  }

  voiceGreeting += `I'm here to help with any health questions you have.`;

  return {
    text: voiceGreeting,
    mother_name: mother.full_name,
    pregnancy_week: activePregnancy ? Math.floor((now - new Date(activePregnancy.lmp || activePregnancy.created_at)) / (1000 * 60 * 60 * 24 * 7)) : null,
    children_count: children.length,
  };
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
      const nutrition = await checkNutritionTracking(profile.id);
      allNotifications.push(...anc, ...vax, ...growth, ...nutrition);
    } else if (profile.role === 'chw') {
      const inactive = await checkInactiveMothers({ assignedWorkerId: profile.id });
      const pendingRef = await checkPendingReferrals(profile.id, null);
      allNotifications.push(...inactive, ...pendingRef);
    } else if (profile.role === 'nurse' || profile.role === 'doctor') {
      const pendingRef = await checkPendingReferrals(profile.id, profile.facility_id);
      allNotifications.push(...pendingRef);
    } else if (profile.role === 'admin' || profile.role === 'district_officer') {
      const inactive = await checkInactiveMothers({ facilityId: profile.facility_id });
      const pendingRef = await checkPendingReferrals();
      allNotifications.push(...inactive, ...pendingRef);
    }

    // Store notifications in IndexedDB and queue for sync
    if (allNotifications.length > 0) {
      const toStore = allNotifications.map((n, i) => ({
        ...n,
        id: `reminder-${profile.id}-${Date.now()}-${i}`,
        user_id: profile.id,
        created_at: new Date().toISOString(),
        read: false,
      }));
      await db.notifications.bulkPut(toStore);
      for (const n of toStore) {
        await queueSync('notifications', n.id, 'INSERT', n);
      }
    }
  } catch (error) {
    console.error('Reminder engine error:', error);
  }

  return allNotifications;
}

/**
 * Fetch unread notifications for a specific user.
 * @param {string} userId - The profile ID to filter notifications for.
 */
export async function getUnreadNotifications(userId) {
  try {
    if (userId) {
      return await db.notifications
        .filter(n => !n.read && n.user_id === userId)
        .toArray();
    }
    return await db.notifications.filter(n => !n.read).toArray();
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
 * Mark all notifications as read for a specific user.
 * @param {string} userId - The profile ID to filter notifications for.
 */
export async function markAllRead(userId) {
  try {
    let unread;
    if (userId) {
      unread = await db.notifications.filter(n => !n.read && n.user_id === userId).toArray();
    } else {
      unread = await db.notifications.filter(n => !n.read).toArray();
    }
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
