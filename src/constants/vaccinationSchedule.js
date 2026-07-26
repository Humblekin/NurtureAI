/**
 * Ghana EPI (Expanded Programme on Immunization) Vaccination Schedule
 * Single source of truth — used by healthContext, reminderEngine, and timelineService.
 *
 * Source: Ghana Health Service EPI Schedule 2024
 */

export const GHANA_EPI_SCHEDULE = [
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
 * Find the next overdue vaccine for a child.
 * @param {number} ageMonths - Child's age in months
 * @param {Set<string>} receivedVaccines - Set of vaccine names already received
 * @returns {{ ageMonths: number, vaccine: string, description: string } | null}
 */
export function findOverdueVaccine(ageMonths, receivedVaccines) {
  return GHANA_EPI_SCHEDULE.find(
    (s) => ageMonths >= s.ageMonths + 1 && !receivedVaccines.has(s.vaccine)
  ) || null;
}

/**
 * Find the next due vaccine (not yet overdue but coming up).
 * @param {number} ageMonths - Child's age in months
 * @param {Set<string>} receivedVaccines - Set of vaccine names already received
 * @returns {{ ageMonths: number, vaccine: string, description: string } | null}
 */
export function findNextDueVaccine(ageMonths, receivedVaccines) {
  return GHANA_EPI_SCHEDULE.find(
    (s) => ageMonths < s.ageMonths && !receivedVaccines.has(s.vaccine)
  ) || null;
}
