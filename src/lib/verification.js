/**
 * NurtureAI — Verification Status
 *
 * Derives a record's verification status from its provenance fields
 * (verified / data_source). Used to label mother records and clinical
 * entries consistently across lists, dashboards, search results and
 * patient profiles.
 *
 *  - VERIFIED              → confirmed by a health worker (verified = true)
 *  - PENDING_VERIFICATION  → mother self-registered, awaiting worker review
 *  - REQUIRES_REVIEW       → mother-reported, awaiting worker review
 *  - UNVERIFIED            → no provenance / not yet assessed
 */

export const VERIFICATION_STATUS = {
  VERIFIED: 'VERIFIED',
  PENDING_VERIFICATION: 'PENDING_VERIFICATION',
  REQUIRES_REVIEW: 'REQUIRES_REVIEW',
  UNVERIFIED: 'UNVERIFIED',
};

export const VERIFICATION_LABELS = {
  [VERIFICATION_STATUS.VERIFIED]: 'Verified',
  [VERIFICATION_STATUS.PENDING_VERIFICATION]: 'Pending Verification',
  [VERIFICATION_STATUS.REQUIRES_REVIEW]: 'Needs Review',
  [VERIFICATION_STATUS.UNVERIFIED]: 'Unverified',
};

// Badge variant names map to the app's Badge component variants.
export const VERIFICATION_VARIANTS = {
  [VERIFICATION_STATUS.VERIFIED]: 'success',
  [VERIFICATION_STATUS.PENDING_VERIFICATION]: 'warning',
  [VERIFICATION_STATUS.REQUIRES_REVIEW]: 'danger',
  [VERIFICATION_STATUS.UNVERIFIED]: 'neutral',
};

/**
 * @param {{verified?: boolean, data_source?: string}} [row]
 * @returns {{status: string, label: string, variant: string}}
 */
export function getVerificationStatus(row = {}) {
  if (!row) row = {};
  if (row.verified === true) {
    return {
      status: VERIFICATION_STATUS.VERIFIED,
      label: VERIFICATION_LABELS[VERIFICATION_STATUS.VERIFIED],
      variant: VERIFICATION_VARIANTS[VERIFICATION_STATUS.VERIFIED],
    };
  }
  if (row.data_source === 'mother_registered') {
    return {
      status: VERIFICATION_STATUS.PENDING_VERIFICATION,
      label: VERIFICATION_LABELS[VERIFICATION_STATUS.PENDING_VERIFICATION],
      variant: VERIFICATION_VARIANTS[VERIFICATION_STATUS.PENDING_VERIFICATION],
    };
  }
  if (row.data_source === 'mother_reported') {
    return {
      status: VERIFICATION_STATUS.REQUIRES_REVIEW,
      label: VERIFICATION_LABELS[VERIFICATION_STATUS.REQUIRES_REVIEW],
      variant: VERIFICATION_VARIANTS[VERIFICATION_STATUS.REQUIRES_REVIEW],
    };
  }
  return {
    status: VERIFICATION_STATUS.UNVERIFIED,
    label: VERIFICATION_LABELS[VERIFICATION_STATUS.UNVERIFIED],
    variant: VERIFICATION_VARIANTS[VERIFICATION_STATUS.UNVERIFIED],
  };
}

export default getVerificationStatus;
