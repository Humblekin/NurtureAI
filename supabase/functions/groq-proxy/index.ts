import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY")
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!

console.log("[Groq-Proxy] Function loaded")

function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  }
}

async function verifyJWT(token: string): Promise<string | null> {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) {
      console.error(`[Groq-Proxy] Auth failed: ${error?.message}`)
      return null
    }
    return user.id
  } catch (err) {
    console.error(`[Groq-Proxy] Auth exception: ${err}`)
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

  const userId = await verifyJWT(authHeader.replace("Bearer ", ""))
  if (!userId) {
    return new Response(
      JSON.stringify({ error: "Invalid or expired token" }),
      { status: 401, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } },
    )
  }

  if (!GROQ_API_KEY) {
    return new Response(
      JSON.stringify({ error: "Groq API key not configured on server" }),
      { status: 500, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } },
    )
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } },
    )
  }

  console.log(`[Groq-Proxy] Chat completion for user ${userId}, model=${body.model || "default"}`)

  try {
    const groqResponse = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    )

    const responseText = await groqResponse.text()

    if (!groqResponse.ok) {
      console.error(`[Groq-Proxy] Groq error ${groqResponse.status}: ${responseText.slice(0, 200)}`)
      return new Response(
        JSON.stringify({
          error: `Groq API error: ${groqResponse.status}`,
          detail: responseText.slice(0, 200),
        }),
        { status: groqResponse.status, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } },
      )
    }

    console.log(`[Groq-Proxy] Response received (${responseText.length} bytes)`)

    return new Response(responseText, {
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders(origin),
      },
    })
  } catch (err) {
    console.error(`[Groq-Proxy] Fetch error: ${err}`)
    return new Response(
      JSON.stringify({ error: "Failed to reach Groq API" }),
      { status: 502, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } },
    )
  }
})
