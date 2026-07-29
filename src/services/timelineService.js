import db from '../lib/db';
import { GHANA_EPI_SCHEDULE, findOverdueVaccine } from '../constants/vaccinationSchedule';

/**
 * NurtureAI — Timeline Service
 *
 * Builds a unified timeline of health events from IndexedDB data.
 * Merges pregnancy milestones, ANC visits, vaccinations, growth records,
 * child health events, and AI insights into a single sorted event stream.
 */

const TOTAL_PREGNANCY_WEEKS = 40;

const PREGNANCY_MILESTONES = [
  { week: 4, label: 'Pregnancy Confirmed', icon: 'Sparkles', color: 'primary', category: 'pregnancy' },
  { week: 8, label: 'First Trimester Begins', icon: 'Baby', color: 'primary', category: 'pregnancy' },
  { week: 12, label: 'End of First Trimester', icon: 'Heart', color: 'success', category: 'pregnancy', celebration: true },
  { week: 16, label: 'Baby Can Hear Sounds', icon: 'Ear', color: 'accent', category: 'pregnancy' },
  { week: 20, label: 'Halfway There', icon: 'Heart', color: 'secondary', category: 'pregnancy', celebration: true },
  { week: 24, label: 'Viability Milestone', icon: 'Shield', color: 'success', category: 'pregnancy' },
  { week: 28, label: 'Third Trimester Begins', icon: 'Sun', color: 'primary', category: 'pregnancy', celebration: true },
  { week: 32, label: 'Baby Positioning', icon: 'Baby', color: 'accent', category: 'pregnancy' },
  { week: 36, label: 'Full Term Approaching', icon: 'Calendar', color: 'secondary', category: 'pregnancy', celebration: true },
  { week: 40, label: 'Due Date', icon: 'Gift', color: 'success', category: 'pregnancy', celebration: true },
];

const CHILD_MILESTONES = [
  { ageWeeks: 0, label: 'Birth', icon: 'Sparkles', color: 'primary', category: 'child', celebration: true },
  { ageWeeks: 1, label: 'First Feeding', icon: 'Heart', color: 'primary', category: 'child' },
  { ageWeeks: 1, label: 'BCG Vaccine', icon: 'Syringe', color: 'success', category: 'vaccination' },
  { ageWeeks: 1, label: 'Birth Weight Recorded', icon: 'Scale', color: 'info', category: 'growth' },
  { ageWeeks: 6, label: '6-Week Vaccination', icon: 'Syringe', color: 'success', category: 'vaccination', celebration: true },
  { ageWeeks: 10, label: '10-Week Vaccination', icon: 'Syringe', color: 'success', category: 'vaccination' },
  { ageWeeks: 14, label: '14-Week Vaccination', icon: 'Syringe', color: 'success', category: 'vaccination' },
  { ageWeeks: 24, label: '6-Month Milestone', icon: 'Baby', color: 'accent', category: 'child', celebration: true },
  { ageWeeks: 26, label: 'Complementary Feeding', icon: 'Apple', color: 'secondary', category: 'child' },
  { ageWeeks: 36, label: '9-Month Checkup', icon: 'Stethoscope', color: 'info', category: 'child' },
  { ageWeeks: 52, label: 'First Birthday', icon: 'Cake', color: 'secondary', category: 'child', celebration: true },
];

function calculateWeeksFromLMP(lmp) {
  if (!lmp) return null;
  const start = new Date(lmp);
  const now = new Date();
  const diffDays = Math.floor((now - start) / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.floor(diffDays / 7));
}

function calculateChildAgeWeeks(birthDate) {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const now = new Date();
  const diffDays = Math.floor((now - birth) / (1000 * 60 * 60 * 24));
  return Math.max(0, Math.floor(diffDays / 7));
}

function calculateChildAgeMonths(birthDate) {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const now = new Date();
  return Math.max(0, (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth()));
}

function getTrimester(week) {
  if (!week) return null;
  if (week <= 13) return 1;
  if (week <= 27) return 2;
  return 3;
}

function daysAgo(dateStr) {
  if (!dateStr) return null;
  return Math.floor((new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });
}

function formatDateShort(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric'
  });
}

/**
 * Build the pregnancy timeline from a mother's active pregnancy data.
 */
export async function buildPregnancyTimeline(motherId) {
  const mother = await db.mothers.where('profile_id').equals(motherId).first();
  if (!mother) return { events: [], progress: null };

  const pregnancy = await db.pregnancies
    .where('mother_id').equals(mother.id)
    .filter(p => !p.deleted_at && p.status === 'active')
    .first();

  if (!pregnancy) return { events: [], progress: null };

  const lmp = pregnancy.lmp;
  const currentWeek = calculateWeeksFromLMP(lmp);
  const trimester = getTrimester(currentWeek);
  const progress = currentWeek ? Math.min(100, Math.round((currentWeek / TOTAL_PREGNANCY_WEEKS) * 100)) : 0;

  const events = [];

  events.push({
    id: `pregnancy-start-${pregnancy.id}`,
    type: 'milestone',
    category: 'pregnancy',
    date: pregnancy.created_at,
    week: 0,
    label: 'Pregnancy Registered',
    description: `Pregnancy registered. EDD: ${formatDate(pregnancy.edd)}`,
    icon: 'Heart',
    color: 'primary',
    completed: true,
    status: 'completed',
  });

  PREGNANCY_MILESTONES.forEach(m => {
    if (currentWeek && m.week <= currentWeek + 2) {
      const milestoneDate = new Date(lmp);
      milestoneDate.setDate(milestoneDate.getDate() + m.week * 7);
      const isPast = m.week <= currentWeek;

      events.push({
        id: `pregnancy-milestone-${m.week}`,
        type: 'milestone',
        category: m.category,
        date: milestoneDate.toISOString(),
        week: m.week,
        label: m.label,
        icon: m.icon,
        color: m.color,
        completed: isPast,
        current: m.week === currentWeek,
        status: isPast ? 'completed' : m.week <= currentWeek + 1 ? 'upcoming' : 'future',
        celebration: m.celebration && isPast,
      });
    }
  });

  const journals = await db.weekly_journals
    .where('pregnancy_id').equals(pregnancy.id)
    .toArray();

  journals.forEach(j => {
    events.push({
      id: `journal-${j.id}`,
      type: 'journal',
      category: 'journal',
      date: j.entry_date || j.created_at,
      week: j.week_number,
      label: `Week ${j.week_number} Check-in`,
      description: j.mother_feeling
        ? `Feeling: ${j.mother_feeling}${j.symptoms ? ` • Symptoms: ${j.symptoms.substring(0, 60)}` : ''}`
        : 'Weekly check-in completed',
      icon: 'Check',
      color: 'primary',
      completed: true,
      status: 'completed',
      data: j,
    });
  });

  const ancVisits = await db.antenatal_visits
    .where('pregnancy_id').equals(pregnancy.id)
    .filter(v => !v.deleted_at)
    .toArray();

  ancVisits.forEach(visit => {
    const visitWeek = lmp
      ? Math.floor((new Date(visit.visit_date) - new Date(lmp)) / (1000 * 60 * 60 * 24 * 7))
      : null;

    events.push({
      id: `anc-${visit.id}`,
      type: 'anc_visit',
      category: 'anc',
      date: visit.visit_date,
      week: visitWeek,
      label: `ANC Visit ${visit.visit_number || ''}`,
      description: `Visit #${visit.visit_number || '?'}${visit.weight ? ` • Weight: ${visit.weight}kg` : ''}${visit.blood_pressure ? ` • BP: ${visit.blood_pressure}` : ''}`,
      icon: 'Stethoscope',
      color: 'success',
      completed: true,
      status: 'completed',
      data: visit,
    });
  });

  const visits = await db.visits
    .where('patient_id').equals(mother.id)
    .filter(v => !v.deleted_at)
    .toArray();

  visits.forEach(visit => {
    events.push({
      id: `visit-${visit.id}`,
      type: 'chw_visit',
      category: 'visit',
      date: visit.visit_date,
      label: visit.visit_type === 'home' ? 'CHW Home Visit' : visit.visit_type === 'facility' ? 'Facility Visit' : 'Health Visit',
      description: visit.notes || '',
      icon: 'UserCheck',
      color: 'accent',
      completed: true,
      status: 'completed',
      data: visit,
    });
  });

  const referrals = await db.referrals
    .where('patient_id').equals(mother.id)
    .filter(r => !r.deleted_at)
    .toArray();

  referrals.forEach(ref => {
    events.push({
      id: `referral-${ref.id}`,
      type: 'referral',
      category: 'referral',
      date: ref.created_at,
      label: `Referral — ${ref.urgency || 'routine'}`,
      description: ref.reason || '',
      icon: 'ArrowRightCircle',
      color: ref.urgency === 'emergency' ? 'danger' : 'warning',
      completed: ref.status === 'completed',
      status: ref.status === 'completed' ? 'completed' : ref.status === 'pending' ? 'upcoming' : 'active',
      data: ref,
    });
  });

  events.sort((a, b) => new Date(b.date) - new Date(a.date));

  const pendingActions = [];
  const lastAnc = ancVisits.sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date))[0];
  const daysSinceLastAnc = lastAnc ? daysAgo(lastAnc.visit_date) : Infinity;

  if (daysSinceLastAnc > 30 && currentWeek <= 28) {
    pendingActions.push({
      id: 'overdue-anc',
      type: 'overdue',
      category: 'anc',
      label: 'ANC Visit Overdue',
      description: `Last ANC was ${daysSinceLastAnc} days ago`,
      icon: 'AlertTriangle',
      color: 'warning',
    });
  } else if (daysSinceLastAnc > 14 && currentWeek > 28) {
    pendingActions.push({
      id: 'anc-due-soon',
      type: 'overdue',
      category: 'anc',
      label: 'ANC Visit Due',
      description: 'Third trimester visits should be more frequent',
      icon: 'AlertTriangle',
      color: 'warning',
    });
  }

  return {
    events: [...events, ...pendingActions],
    progress: {
      currentWeek,
      totalWeeks: TOTAL_PREGNANCY_WEEKS,
      percentage: progress,
      trimester,
      edd: pregnancy.edd,
      riskLevel: pregnancy.risk_level,
    },
  };
}

/**
 * Build the child timeline from a child's health records.
 */
export async function buildChildTimeline(childId) {
  const child = await db.children.get(childId);
  if (!child) return { events: [], progress: null };

  const ageWeeks = calculateChildAgeWeeks(child.date_of_birth);
  const ageMonths = calculateChildAgeMonths(child.date_of_birth);
  const events = [];

  events.push({
    id: `child-birth-${child.id}`,
    type: 'milestone',
    category: 'child',
    date: child.date_of_birth || child.created_at,
    ageWeeks: 0,
    label: 'Birth',
    description: `Born ${formatDate(child.date_of_birth)}${child.birth_weight ? ` • Weight: ${child.birth_weight}kg` : ''}${child.gender ? ` • ${child.gender === 'male' ? 'Boy' : 'Girl'}` : ''}`,
    icon: 'Sparkles',
    color: 'primary',
    completed: true,
    status: 'completed',
    celebration: true,
    data: child,
  });

  const vaccinations = await db.vaccinations
    .where('child_id').equals(child.id)
    .filter(v => !v.deleted_at)
    .toArray();

  const vaxNames = new Set(vaccinations.map(v => v.vaccine_name));

  CHILD_MILESTONES.forEach(m => {
    if (ageWeeks !== null && m.ageWeeks <= ageWeeks + 2) {
      const milestoneDate = new Date(child.date_of_birth);
      milestoneDate.setDate(milestoneDate.getDate() + m.ageWeeks * 7);

      let isCompleted = m.ageWeeks <= ageWeeks;
      if (m.category === 'vaccination') {
        isCompleted = vaxNames.has(m.label);
      }

      events.push({
        id: `child-milestone-${child.id}-${m.ageWeeks}-${m.label}`,
        type: 'milestone',
        category: m.category,
        date: milestoneDate.toISOString(),
        ageWeeks: m.ageWeeks,
        label: m.label,
        icon: m.icon,
        color: m.color,
        completed: isCompleted,
        status: isCompleted ? 'completed' : m.ageWeeks <= ageWeeks + 1 ? 'upcoming' : 'future',
        celebration: m.celebration && isCompleted,
      });
    }
  });

  vaccinations.forEach(vax => {
    const vaxAgeDays = child.date_of_birth
      ? Math.floor((new Date(vax.date_given) - new Date(child.date_of_birth)) / (1000 * 60 * 60 * 24))
      : null;
    const vaxAgeWeeks = vaxAgeDays !== null ? Math.floor(vaxAgeDays / 7) : null;

    events.push({
      id: `vax-${vax.id}`,
      type: 'vaccination',
      category: 'vaccination',
      date: vax.date_given,
      ageWeeks: vaxAgeWeeks,
      label: vax.vaccine_name,
      description: `Vaccination recorded${vax.batch_number ? ` • Batch: ${vax.batch_number}` : ''}`,
      icon: 'Syringe',
      color: 'success',
      completed: true,
      status: 'completed',
      data: vax,
    });
  });

  const growthRecords = await db.growth_records
    .where('child_id').equals(child.id)
    .filter(g => !g.deleted_at)
    .toArray();

  growthRecords.forEach(gr => {
    const grAgeDays = child.date_of_birth
      ? Math.floor((new Date(gr.recorded_date) - new Date(child.date_of_birth)) / (1000 * 60 * 60 * 24))
      : null;
    const grAgeWeeks = grAgeDays !== null ? Math.floor(grAgeDays / 7) : null;

    events.push({
      id: `growth-${gr.id}`,
      type: 'growth',
      category: 'growth',
      date: gr.recorded_date,
      ageWeeks: grAgeWeeks,
      label: 'Growth Check',
      description: [
        gr.weight_kg ? `${gr.weight_kg}kg` : '',
        gr.height_cm ? `${gr.height_cm}cm` : '',
        gr.muac_cm ? `MUAC: ${gr.muac_cm}cm` : '',
      ].filter(Boolean).join(' • '),
      icon: 'TrendingUp',
      color: 'info',
      completed: true,
      status: 'completed',
      data: gr,
    });
  });

  const childVisits = await db.visits
    .where('patient_id').equals(child.id)
    .filter(v => !v.deleted_at)
    .toArray();

  childVisits.forEach(visit => {
    events.push({
      id: `child-visit-${visit.id}`,
      type: 'visit',
      category: 'visit',
      date: visit.visit_date,
      label: visit.visit_type === 'facility' ? 'Clinic Visit' : 'Health Visit',
      description: visit.notes || '',
      icon: 'Stethoscope',
      color: 'accent',
      completed: true,
      status: 'completed',
      data: visit,
    });
  });

  events.sort((a, b) => new Date(b.date) - new Date(a.date));

  const pendingActions = [];
  if (ageMonths !== null) {
    const overdueVax = findOverdueVaccine(ageMonths, vaxNames);
    if (overdueVax) {
      pendingActions.push({
        id: `overdue-vax-${overdueVax.vaccine}`,
        type: 'overdue',
        category: 'vaccination',
        label: `${overdueVax.vaccine} Vaccination Overdue`,
        description: `Scheduled at ${overdueVax.ageMonths} months`,
        icon: 'AlertTriangle',
        color: 'warning',
      });
    }

    const lastGrowth = growthRecords.sort((a, b) => new Date(b.recorded_date) - new Date(a.recorded_date))[0];
    const daysSinceGrowth = lastGrowth ? daysAgo(lastGrowth.recorded_date) : Infinity;
    const maxDays = ageMonths <= 12 ? 30 : 90;
    if (daysSinceGrowth > maxDays) {
      pendingActions.push({
        id: 'overdue-growth',
        type: 'overdue',
        category: 'growth',
        label: 'Growth Check Overdue',
        description: `Last check was ${daysSinceGrowth} days ago`,
        icon: 'AlertTriangle',
        color: 'warning',
      });
    }
  }

  return {
    events: [...events, ...pendingActions],
    progress: {
      ageWeeks,
      ageMonths,
      totalVaccinations: vaccinations.length,
      totalGrowthChecks: growthRecords.length,
    },
  };
}

/**
 * Generate AI insight cards for the timeline.
 */
export function generateAIInsights(pregnancyProgress, childProgress, ancCount, vaxCount) {
  const insights = [];

  if (pregnancyProgress) {
    const { currentWeek, trimester } = pregnancyProgress;

    if (currentWeek >= 12 && ancCount === 0) {
      insights.push({
        id: 'insight-no-anc',
        type: 'ai_insight',
        category: 'ai',
        label: "Amina's Insight",
        description: "You haven't logged any ANC visits yet. Regular antenatal check-ups help keep you and your baby healthy. Would you like to schedule your first visit?",
        icon: 'MessageCircle',
        color: 'accent',
        isAI: true,
      });
    }

    if (currentWeek >= 20 && ancCount >= 2) {
      insights.push({
        id: 'insight-good-anc',
        type: 'ai_insight',
        category: 'ai',
        label: "Amina's Insight",
        description: `Great job! You've attended ${ancCount} ANC visit${ancCount > 1 ? 's' : ''}. You're doing an amazing job taking care of yourself and your baby. Keep it up!`,
        icon: 'MessageCircle',
        color: 'accent',
        isAI: true,
      });
    }

    if (trimester === 3) {
      insights.push({
        id: 'insight-third-trimester',
        type: 'ai_insight',
        category: 'ai',
        label: "Amina's Insight",
        description: "You're entering your third trimester. This is a great time to prepare for delivery. Continue attending your ANC appointments and discuss your birth plan with your healthcare provider.",
        icon: 'MessageCircle',
        color: 'accent',
        isAI: true,
      });
    }
  }

  if (childProgress) {
    const { ageMonths } = childProgress;
    if (ageMonths !== null && ageMonths >= 6 && vaxCount === 0) {
      insights.push({
        id: 'insight-vax-due',
        type: 'ai_insight',
        category: 'ai',
        label: "Amina's Insight",
        description: "Your baby is at the age where vaccinations are important. Please visit your nearest health facility to keep your baby protected.",
        icon: 'MessageCircle',
        color: 'accent',
        isAI: true,
      });
    }

    if (vaxCount >= 3) {
      insights.push({
        id: 'insight-vax-good',
        type: 'ai_insight',
        category: 'ai',
        label: "Amina's Insight",
        description: `Wonderful! ${vaxCount} vaccinations have been recorded. Staying on schedule gives your baby the best protection. You're a great parent!`,
        icon: 'MessageCircle',
        color: 'accent',
        isAI: true,
      });
    }
  }

  return insights;
}

export { formatDate, formatDateShort, daysAgo, calculateWeeksFromLMP, calculateChildAgeWeeks, calculateChildAgeMonths, getTrimester };
