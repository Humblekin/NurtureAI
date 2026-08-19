// Shared pregnancy/date utilities
export function calculateWeeksFromLMP(lmp) {
  if (!lmp) return null;
  const start = new Date(lmp);
  const now = new Date();
  const diffDays = Math.floor((now - start) / (1000 * 60 * 60 * 24));
  if (isNaN(diffDays)) return null;
  const weeks = Math.floor(diffDays / 7);
  // Return at least 1 week for any past LMP; if LMP is in future return 0
  return weeks < 0 ? 0 : Math.max(1, weeks);
}

export function calculateEDDFromLMP(lmp) {
  if (!lmp) return null;
  const start = new Date(lmp);
  if (isNaN(start.getTime())) return null;
  const edd = new Date(start.getTime());
  edd.setDate(edd.getDate() + 280); // 40 weeks
  return edd.toISOString().split('T')[0];
}

// Human-readable label for a pregnancy status, plus the badge variant used
// across profiles. Unknown statuses fall back to a capitalized version of
// the raw value rather than guessing a clinical outcome.
export function pregnancyStatusLabel(status) {
  switch (status) {
    case 'active': return 'Current';
    case 'completed': return 'Completed';
    case 'miscarried': return 'Miscarried';
    case 'aborted': return 'Aborted';
    default:
      return status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown';
  }
}

export function pregnancyStatusVariant(status) {
  switch (status) {
    case 'miscarried':
    case 'aborted':
      return 'critical';
    case 'completed':
      return 'success';
    case 'active':
      return 'primary';
    default:
      return 'neutral';
  }
}

// The next sequential ANC visit number for a pregnancy: one past the highest
// visit_number already recorded for it (not simply count + 1, so deletions
// or out-of-order inserts never reuse a number).
export function nextVisitNumber(visits, pregnancyId) {
  const nums = (visits || [])
    .filter(v => v.pregnancy_id === pregnancyId)
    .map(v => Number(v.visit_number))
    .filter(n => Number.isFinite(n) && n > 0);
  return nums.length > 0 ? Math.max(...nums) + 1 : 1;
}

export default { calculateWeeksFromLMP, calculateEDDFromLMP, pregnancyStatusLabel, pregnancyStatusVariant, nextVisitNumber };
