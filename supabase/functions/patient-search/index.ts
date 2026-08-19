import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!

const WORKER_ROLES = ["chw", "nurse", "doctor", "admin"]

console.log("[PatientSearch] Function loaded")

function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  }
}

// Escape LIKE/ILIKE wildcards so user input is matched literally.
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (m) => `\\${m}`)
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") || ""

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(origin) })
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } },
    )
  }

  const authHeader = req.headers.get("Authorization")
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: "Missing Authorization header" }),
      { status: 401, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } },
    )
  }

  const token = authHeader.replace("Bearer ", "")

  let body: { query?: string; limit?: number }
  try {
    body = await req.json()
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } },
    )
  }

  // Authenticate with the caller's token so RLS still applies (defense in depth).
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    console.error(`[PatientSearch] Auth failed: ${authError?.message}`)
    return new Response(
      JSON.stringify({ error: "Invalid or expired token" }),
      { status: 401, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } },
    )
  }
  const userId = user.id

  // Resolve role from the DB — never trust client-side metadata.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, facility_id")
    .eq("id", userId)
    .single()

  if (profileError || !profile) {
    console.error(`[PatientSearch] Profile lookup failed: ${profileError?.message}`)
    return new Response(
      JSON.stringify({ error: "Profile not found" }),
      { status: 403, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } },
    )
  }

  if (!WORKER_ROLES.includes(profile.role)) {
    return new Response(
      JSON.stringify({ error: "Access denied: worker role required" }),
      { status: 403, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } },
    )
  }

  const query = String(body.query || "").trim().slice(0, 100)
  const limit = Math.min(Math.max(Number(body.limit) || 25, 1), 100)

  // Role-based scoping:
  //   chw    -> only mothers assigned to this worker
  //   nurse  -> mothers at the nurse's facility (if the nurse has one)
  //   doctor/admin -> all mothers
  let dbQuery = supabase
    .from("mothers")
    .select(
      "id, profile_id, patient_code, full_name, phone, community, risk_level, edd, data_source, verified, assigned_worker_id, facility_id, birth_facility_id",
    )
    .is("deleted_at", null)

  if (profile.role === "chw") {
    dbQuery = dbQuery.eq("assigned_worker_id", userId)
  } else if (profile.role === "nurse") {
    if (profile.facility_id) {
      const facility = String(profile.facility_id)
      dbQuery = dbQuery.or(`facility_id.eq.${facility},birth_facility_id.eq.${facility}`)
    } else {
      // A nurse with no facility must never fall through to an unfiltered
      // search of all mothers. Return an empty scoped result instead.
      console.warn(`[PatientSearch] Nurse ${userId} has no facility_id — returning empty scope`)
      return new Response(
        JSON.stringify({ mothers: [], scope: "nurse", limited: true }),
        { headers: { ...corsHeaders(origin), "Content-Type": "application/json" } },
      )
    }
  }

  if (query) {
    const term = escapeLike(query)
    // Note: PostgREST's logical-tree parser does NOT accept `id::text.ilike` casts
    // inside .or() (PGRST100). UUID substring search was removed; patient_code
    // (the human-facing NRT-… ID), name, phone and community remain searchable.
    dbQuery = dbQuery.or(
      `full_name.ilike.%${term}%,phone.ilike.%${term}%,community.ilike.%${term}%,patient_code.ilike.%${term}%`,
    )
  }

  dbQuery = dbQuery.order("full_name", { ascending: true }).limit(limit)

  const { data: mothers, error: queryError } = await dbQuery
  if (queryError) {
    console.error(`[PatientSearch] Query error: ${queryError.message}`)
    return new Response(
      JSON.stringify({ error: "Search failed" }),
      { status: 500, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } },
    )
  }

  console.log(`[PatientSearch] User ${userId} (${profile.role}) searched "${query}" -> ${(mothers || []).length} rows`)

  return new Response(
    JSON.stringify({ mothers: mothers || [], scope: profile.role }),
    { headers: { ...corsHeaders(origin), "Content-Type": "application/json" } },
  )
})
