import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!

const OPENAI_BASE = "https://api.openai.com/v1"

console.log("[OpenAI-Proxy] Function loaded")

const DEFAULT_MODEL = "gpt-4.1-mini"

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
      console.error(`[OpenAI-Proxy] Auth failed: ${error?.message}`)
      return null
    }
    return user.id
  } catch (err) {
    console.error(`[OpenAI-Proxy] Auth exception: ${err}`)
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

  if (!OPENAI_API_KEY) {
    return new Response(
      JSON.stringify({ error: "OpenAI API key not configured on server" }),
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

  const model = (body.model as string) || DEFAULT_MODEL
  console.log(`[OpenAI-Proxy] Chat completion for user ${userId}, model=${model}`)

  try {
    const openAIBody: Record<string, unknown> = {
      ...body,
      model,
    }

    const MAX_ATTEMPTS = 3
    let apiResponse: Response | null = null
    let responseText = ""

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      apiResponse = await fetch(
        `${OPENAI_BASE}/chat/completions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(openAIBody),
        },
      )
      responseText = await apiResponse.text()

      const retryable = apiResponse.status === 429 || apiResponse.status >= 500
      if (apiResponse.ok || !retryable || attempt === MAX_ATTEMPTS) break

      const retryAfter = apiResponse.headers.get("retry-after")
      let delayMs = Math.pow(2, attempt) * 1000
      if (retryAfter) {
        const seconds = parseInt(retryAfter, 10)
        if (!isNaN(seconds) && seconds >= 0 && seconds <= 30) delayMs = seconds * 1000
      }
      console.log(
        `[OpenAI-Proxy] Upstream ${apiResponse.status}, retrying in ${delayMs}ms (attempt ${attempt}/${MAX_ATTEMPTS})`,
      )
      await new Promise((r) => setTimeout(r, delayMs))
    }

    if (!apiResponse) {
      return new Response(
        JSON.stringify({ error: "Failed to reach OpenAI API" }),
        { status: 502, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } },
      )
    }

    if (!apiResponse.ok) {
      console.error(`[OpenAI-Proxy] OpenAI error ${apiResponse.status}: ${responseText.slice(0, 300)}`)

      if (apiResponse.status === 429) {
        return new Response(
          JSON.stringify({
            error: "Rate limit exceeded. Please wait a moment and try again.",
          }),
          { status: 429, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } },
        )
      }

      return new Response(
        JSON.stringify({
          error: `OpenAI API error: ${apiResponse.status}`,
          detail: responseText.slice(0, 300),
        }),
        { status: apiResponse.status, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } },
      )
    }

    console.log(`[OpenAI-Proxy] Response received (${responseText.length} bytes)`)

    return new Response(responseText, {
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders(origin),
      },
    })
  } catch (err) {
    console.error(`[OpenAI-Proxy] Fetch error: ${err}`)
    return new Response(
      JSON.stringify({ error: "Failed to reach OpenAI API" }),
      { status: 502, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } },
    )
  }
})
