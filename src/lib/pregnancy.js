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

export default { calculateWeeksFromLMP, calculateEDDFromLMP };
