/**
 * NurtureAI — Blood Group Utilities
 *
 * The DB column `mothers.blood_group` is constrained to the canonical
 * ABO/Rh codes (A+, A-, B+, B-, AB+, AB-, O+, O-). Users may type or say
 * "O positive" / "a negative" / "ab+" — normalize those to the stored code.
 */

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const SPOKEN = {
  'OPOSITIVE': 'O+',
  'ONEGATIVE': 'O-',
  'APOSITIVE': 'A+',
  'ANEGATIVE': 'A-',
  'BPOSITIVE': 'B+',
  'BNEGATIVE': 'B-',
  'ABPOSITIVE': 'AB+',
  'ABNEGATIVE': 'AB-',
};

/**
 * Convert any common blood-group phrasing to its canonical code.
 * Returns null for empty/unrecognized input (null passes the DB CHECK).
 * @param {*} value
 * @returns {string|null}
 */
export function normalizeBloodGroup(value) {
  if (!value && value !== '') return null;
  const cleaned = String(value).trim().toUpperCase().replace(/\s+/g, '');
  if (!cleaned) return null;
  if (SPOKEN[cleaned]) return SPOKEN[cleaned];
  return BLOOD_GROUPS.includes(cleaned) ? cleaned : null;
}

/**
 * Normalize blood_group on a record only when the field is present.
 * @param {object} data
 * @returns {object}
 */
export function withNormalizedBloodGroup(data) {
  if (data && 'blood_group' in data) {
    return { ...data, blood_group: normalizeBloodGroup(data.blood_group) };
  }
  return data;
}

export default { normalizeBloodGroup, withNormalizedBloodGroup, BLOOD_GROUPS };
