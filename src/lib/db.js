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

export default { generateId };
