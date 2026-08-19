/**
 * NurtureAI — Data Utilities
 *
 * There is no local/offline database anymore. All reads and writes go
 * directly to Supabase so data is always persisted server-side.
 */

/**
 * Generate a UUID v4 for record creation.
 */
export function generateId() {
  return crypto.randomUUID();
}

/**
 * Generate a human-readable patient identifier (e.g. NRT-1A2B3C4D)
 * derived deterministically from the record UUID. Unique per record and
 * safe to compute client-side so it works offline. Mirrors the SQL
 * backfill formula used in migration 202608140004.
 */
export function generatePatientCode(id) {
  const raw = String(id || generateId()).replace(/-/g, '');
  return `NRT-${raw.slice(0, 8).toUpperCase()}`;
}

export default { generateId, generatePatientCode };
