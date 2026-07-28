import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const DEEPGRAM_API_KEY = Deno.env.get("DEEPGRAM_API_KEY")
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!

function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  }
}

async function tryAuthGrant(): Promise<{ token: string; expiresIn: number } | null> {
  try {
    const res = await fetch("https://api.deepgram.com/v1/auth/grant", {
      method: "POST",
      headers: {
        Authorization: `Token ${DEEPGRAM_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ttl: 120 }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return { token: data.access_token, expiresIn: data.expires_in ?? 120 }
  } catch {
    return null
  }
}

async function getProjectId(): Promise<string> {
  const res = await fetch("https://api.deepgram.com/v1/projects", {
    headers: { Authorization: `Token ${DEEPGRAM_API_KEY}` },
  })
  if (!res.ok) throw new Error(`Failed to list Deepgram projects: ${res.status}`)
  const data = await res.json()
  const projectId = data.projects?.[0]?.project_id
  if (!projectId) throw new Error("No Deepgram projects found")
  return projectId
}

async function tryManagementApi(): Promise<{ token: string; expiresIn: number } | null> {
  try {
    const projectId = await getProjectId()
    const res = await fetch(`https://api.deepgram.com/v1/projects/${projectId}/keys`, {
      method: "POST",
      headers: {
        Authorization: `Token ${DEEPGRAM_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        comment: "Temporary session key for STT",
        scopes: ["member"],
        time_to_live_in_seconds: 120,
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return { token: data.key, expiresIn: 120 }
  } catch {
    return null
  }
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

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  const { data: { user }, error } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""))
  if (error || !user) {
    return new Response(
      JSON.stringify({ error: "Invalid or expired token" }),
      { status: 401, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } },
    )
  }

  if (!DEEPGRAM_API_KEY) {
    return new Response(
      JSON.stringify({ error: "Deepgram API key not configured on server" }),
      { status: 500, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } },
    )
  }

  const result = (await tryAuthGrant()) ?? (await tryManagementApi())

  if (!result) {
    return new Response(
      JSON.stringify({
        error: "Failed to generate temporary credentials",
        detail: "Both /v1/auth/grant and Management API failed. Check that DEEPGRAM_API_KEY is set and has valid permissions.",
      }),
      { status: 502, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } },
    )
  }

  return new Response(
    JSON.stringify(result),
    { headers: { ...corsHeaders(origin), "Content-Type": "application/json" } },
  )
})
