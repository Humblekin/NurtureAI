import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY")
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!

const OPENROUTER_BASE = "https://openrouter.ai/api/v1"

console.log("[OpenRouter-Proxy] Function loaded")

const DEFAULT_MODEL = "google/gemini-2.5-flash"

// Deprecated/unsupported models mapped to their current replacements
const MODEL_FALLBACKS: Record<string, string> = {
  "google/gemini-2.0-flash-001": "google/gemini-2.5-flash",
  "google/gemini-2.0-flash": "google/gemini-2.5-flash",
  "google/gemini-flash-latest": "google/gemini-2.5-flash",
}

const VALID_MODEL_PREFIXES = [
  "google/gemini-",
  "google/gemma-",
]

function resolveModel(model: string): string {
  if (MODEL_FALLBACKS[model]) {
    console.log(`[OpenRouter-Proxy] Mapping model ${model} -> ${MODEL_FALLBACKS[model]}`)
    return MODEL_FALLBACKS[model]
  }
  if (VALID_MODEL_PREFIXES.some(p => model.startsWith(p))) return model
  console.log(`[OpenRouter-Proxy] Unrecognized model "${model}", falling back to ${DEFAULT_MODEL}`)
  return DEFAULT_MODEL
}

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
      console.error(`[OpenRouter-Proxy] Auth failed: ${error?.message}`)
      return null
    }
    return user.id
  } catch (err) {
    console.error(`[OpenRouter-Proxy] Auth exception: ${err}`)
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

  if (!OPENROUTER_API_KEY) {
    return new Response(
      JSON.stringify({ error: "OpenRouter API key not configured on server" }),
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

  const requestedModel = (body.model as string) || DEFAULT_MODEL
  const model = resolveModel(requestedModel)
  console.log(`[OpenRouter-Proxy] Chat completion for user ${userId}, requested=${requestedModel}, resolved=${model}`)

  try {
    const openRouterBody: Record<string, unknown> = {
      ...body,
      model,
    }

    const orResponse = await fetch(
      `${OPENROUTER_BASE}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://nurtureai.app",
          "X-Title": "NurtureAI",
        },
        body: JSON.stringify(openRouterBody),
      },
    )

    const responseText = await orResponse.text()

    if (!orResponse.ok) {
      console.error(`[OpenRouter-Proxy] OpenRouter error ${orResponse.status}: ${responseText.slice(0, 300)}`)

      if (orResponse.status === 429) {
        return new Response(
          JSON.stringify({
            error: "Rate limit exceeded. Please wait a moment and try again.",
          }),
          { status: 429, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } },
        )
      }

      return new Response(
        JSON.stringify({
          error: `OpenRouter API error: ${orResponse.status}`,
          detail: responseText.slice(0, 300),
        }),
        { status: orResponse.status, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } },
      )
    }

    console.log(`[OpenRouter-Proxy] Response received (${responseText.length} bytes)`)

    return new Response(responseText, {
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders(origin),
      },
    })
  } catch (err) {
    console.error(`[OpenRouter-Proxy] Fetch error: ${err}`)
    return new Response(
      JSON.stringify({ error: "Failed to reach OpenRouter API" }),
      { status: 502, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } },
    )
  }
})
