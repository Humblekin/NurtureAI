/**
 * NurtureAI — Data Provenance
 *
 * New model: mother-provided info is 'mother_registered' (pending worker
 * verification); worker-entered info is 'healthcare_worker' (verified).
 * This stamps the correct provenance on records at the call site.
 */

export const DATA_SOURCE = {
  HEALTHCARE_WORKER: 'healthcare_worker',
  MOTHER_REPORTED: 'mother_reported',
  MOTHER_REGISTERED: 'mother_registered',
  SYSTEM: 'system',
};

/**
 * Provenance fields for a record being created/updated by the current user.
 * @param {{id?: string, role?: string}} profile - The authenticated user profile.
 * @returns {{data_source: string, verified: boolean, verified_by?: string, verified_at?: string}}
 */
export function provenanceFor(profile) {
  if (profile?.role === 'mother') {
    return {
      data_source: DATA_SOURCE.MOTHER_REGISTERED,
      verified: false,
    };
  }
  return {
    data_source: DATA_SOURCE.HEALTHCARE_WORKER,
    verified: true,
    verified_by: profile?.id || null,
    verified_at: new Date().toISOString(),
  };
}

export default { DATA_SOURCE, provenanceFor };
