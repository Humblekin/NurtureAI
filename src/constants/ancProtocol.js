/**
 * Ghana Health Service / WHO Focused Antenatal Care (FANC) Protocol
 *
 * Per-week institutional recommendations, used by Amina's weekly care
 * suggestions in the health journey timeline. Based on the WHO 2016
 * focused antenatal care model (8 contacts) adapted to the Ghana GHS
 * schedule, consistent with healthContext.js and reminderEngine.js.
 */

export const GHANA_ANC_PROTOCOL = [
  {
    week: 12,
    contact: 'ANC Booking',
    actions: [
      'Attend your ANC booking appointment',
      'Confirm gestational age and check blood pressure',
      'Blood, urine and haemoglobin tests',
      'HIV, syphilis and hepatitis B screening',
      'First tetanus toxoid (TT1) injection',
      'Start daily iron and folic acid tablets',
      'Receive an insecticide-treated bed net',
    ],
  },
  {
    week: 20,
    contact: 'ANC Visit 2',
    actions: [
      'Blood pressure, weight and urine check',
      'Measure fundal height and listen to the baby heartbeat',
      'Second tetanus toxoid (TT2) injection',
      'First dose of intermittent malaria treatment (IPTp-1)',
      'Continue iron and folic acid tablets',
      'Review danger signs and nutrition',
    ],
  },
  {
    week: 26,
    contact: 'ANC Visit 3',
    actions: [
      'Blood pressure, weight and urine check',
      'Monitor baby growth (fundal height and heartbeat)',
      'Second malaria treatment dose (IPTp-2)',
      'Repeat haemoglobin test if you were anaemic',
      'Check for swelling in the hands, face and feet',
    ],
  },
  {
    week: 30,
    contact: 'ANC Visit 4',
    actions: [
      'Blood pressure, weight and urine check',
      'Check the baby position and growth',
      'Third malaria treatment dose (IPTp-3)',
      'Start your birth preparedness and emergency plan',
      'Plan transport to the health facility',
    ],
  },
  {
    week: 34,
    contact: 'ANC Visit 5',
    actions: [
      'Blood pressure, weight and urine check',
      'Confirm the baby position (head down)',
      'Tetanus toxoid booster if needed',
      'Review danger signs: bleeding, severe headache, blurred vision',
      'Prepare baby clothes, delivery bag and birth plan',
    ],
  },
  {
    week: 36,
    contact: 'ANC Visit 6',
    actions: [
      'Blood pressure, weight and urine check',
      'Check for pre-eclampsia signs: swelling, severe headache',
      'Confirm the baby position and movements',
      'Discuss signs of labour and when to go to the facility',
      'Finalise your birth plan',
    ],
  },
  {
    week: 38,
    contact: 'ANC Visit 7',
    actions: [
      'Blood pressure, weight and urine check',
      'Check for swelling, headache and vision changes',
      'Confirm the baby position',
      'Discuss what happens after your due date',
      'Review emergency contact and transport plan',
    ],
  },
  {
    week: 40,
    contact: 'ANC Visit 8',
    actions: [
      'Final blood pressure, weight and urine check',
      'Confirm the baby wellbeing and position',
      'Plan a repeat check if you pass 41 weeks',
      'Discuss induction options with your midwife',
      'Rest and monitor the baby movements daily',
    ],
  },
];

export const WEEKLY_SELF_CARE = [
  'Eat a balanced diet with iron-rich foods',
  'Drink plenty of water and rest when tired',
  'Take your daily iron and folic acid tablets',
  'Do gentle walking or approved exercise',
  'Watch for danger signs: bleeding, severe headache, blurred vision, painful contractions',
];

/**
 * Find the protocol contact whose week is within +/-1 week of the current week.
 */
export function getProtocolContact(week) {
  if (!week) return null;
  return GHANA_ANC_PROTOCOL.find((c) => c.week >= week - 1 && c.week <= week + 1) || null;
}

/**
 * Find the most recent protocol contact at or before the current week.
 */
export function getCurrentContact(week) {
  if (!week) return null;
  let current = null;
  for (const c of GHANA_ANC_PROTOCOL) {
    if (c.week <= week) current = c;
  }
  return current;
}
