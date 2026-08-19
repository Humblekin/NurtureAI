import useAuthStore from '../stores/authStore';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

/**
 * Resolve the patient-search Edge Function URL from the configured
 * Supabase project (mirrors the pattern used by the AI proxy).
 */
export function getPatientSearchBase() {
  if (!SUPABASE_URL) return null;
  const match = SUPABASE_URL.match(/https:\/\/(.+?)\.supabase\.co/);
  return match ? `https://${match[1]}.supabase.co/functions/v1/patient-search` : null;
}

/**
 * Secured, role-checked patient search.
 *
 * The Edge Function verifies the JWT server-side, resolves the caller's
 * role from the database (never trusting client metadata), and scopes the
 * query: CHW -> assigned mothers only, Nurse -> facility mothers, Doctor/Admin -> all.
 *
 * @param {object} params
 * @param {string} [params.query] - Search by name, phone, or community.
 * @param {number} [params.limit] - Max results (clamped server-side to 1-100).
 * @param {AbortSignal} [params.signal]
 * @returns {Promise<{ mothers: object[], scope: string | null, error?: string }>}
 */
export async function searchPatients({ query = '', limit = 25, signal } = {}) {
  const base = getPatientSearchBase();

  if (!base) {
    return {
      mothers: [],
      scope: null,
      error: 'Patient search is not configured. Please check your Supabase settings.',
    };
  }

  const session = useAuthStore.getState().session;
  const token = session?.access_token;
  if (!token) {
    return { mothers: [], scope: null, error: 'Authentication required to search patients.' };
  }

  try {
    const res = await fetch(base, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query, limit }),
      signal,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error('[PatientSearch] Search failed:', res.status, data.error);
      return { mothers: [], scope: null, error: data.error || `Search failed (${res.status}).` };
    }

    return { mothers: data.mothers || [], scope: data.scope || null, error: null };
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    console.error('[PatientSearch] Request error:', err);
    return { mothers: [], scope: null, error: 'Unable to reach the patient search service.' };
  }
}

export default searchPatients;
