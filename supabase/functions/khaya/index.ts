import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

// Khaya AI speech proxy.
//
// The Khaya API key is a server-side secret (KHAYA_API_KEY). It is never sent
// to the browser. The React app calls this function with the user's Supabase
// JWT; we validate it, then proxy ASR / TTS / language-catalogue requests to
// Khaya. Raw Khaya errors are logged here (server-side) only — the client
// receives friendly, code-bearing messages it can use to fall back to the
// browser speech layer.
//
//   POST /functions/v1/khaya?op=tts&...        JSON { text, language, speaker_id, stream, format }
//   POST /functions/v1/khaya?op=asr&language=.. raw audio bytes body
//   GET  /functions/v1/khaya?op=languages       Khaya language catalogue (best effort)

const KHAYA_API_KEY = Deno.env.get("KHAYA_API_KEY")
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!

const KHAYA_BASE = "https://translation-api.ghananlp.org"
const TTS_V2 = `${KHAYA_BASE}/tts/v2/synthesize`
const ASR_V3 = `${KHAYA_BASE}/asr/v3/transcribe`
const ASR_LANGUAGES = `${KHAYA_BASE}/asr/v3/languages`
const TTS_LANGUAGES_V2 = `${KHAYA_BASE}/tts/v2/languages`
const TTS_LANGUAGES_V1 = `${KHAYA_BASE}/tts/v1/languages`

const MAX_AUDIO_BYTES = 25 * 1024 * 1024

console.log("[Khaya] Function loaded")

function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  }
}

function khayaHeaders(): Record<string, string> {
  return { "Ocp-Apim-Subscription-Key": KHAYA_API_KEY || "" }
}

async function verifyJWT(token: string): Promise<string | null> {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) {
      console.error(`[Khaya] Auth failed: ${error?.message}`)
      return null
    }
    return user.id
  } catch (err) {
    console.error(`[Khaya] Auth exception: ${err}`)
    return null
  }
}

function json(origin: string, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  })
}

function error(origin: string, code: string, message: string, status: number): Response {
  return json(origin, { error: message, code }, status)
}

function mapUpstreamError(op: string, status: number, bodyText: string, origin: string): Response {
  // Server-side log only — never echo raw upstream details to the client.
  console.error(`[Khaya] ${op} upstream ${status}: ${bodyText.slice(0, 200)}`)

  if (status === 401 || status === 403) {
    return error(origin, "khaya_auth", "Voice service authentication failed.", 502)
  }
  if (status === 429) {
    return error(origin, "khaya_quota", "Voice service is temporarily unavailable. Please try again in a moment.", 503)
  }
  if (status === 400 || status === 422) {
    return error(origin, "khaya_bad_request", "Voice service rejected the request (unsupported language or invalid audio).", 400)
  }
  if (status >= 500) {
    return error(origin, "khaya_unavailable", "Voice service is temporarily unavailable. Please try again in a moment.", 502)
  }
  return error(origin, "khaya_error", "Voice service is temporarily unavailable. Please try again in a moment.", 502)
}

async function handleLanguages(origin: string): Promise<Response> {
  if (!KHAYA_API_KEY) {
    return error(origin, "khaya_not_configured", "Voice service is not configured.", 500)
  }

  const headers = khayaHeaders()

  let asr: string[] = []
  try {
    const res = await fetch(ASR_LANGUAGES, { headers })
    if (res.ok) {
      const data = await res.json().catch(() => null)
      asr = Array.isArray(data) ? data.map(String) : []
    }
  } catch (err) {
    console.error(`[Khaya] Languages fetch (asr) failed: ${err}`)
  }

  let tts: string[] = []
  for (const endpoint of [TTS_LANGUAGES_V2, TTS_LANGUAGES_V1]) {
    try {
      const res = await fetch(endpoint, { headers })
      if (res.ok) {
        const data = await res.json().catch(() => null)
        tts = Array.isArray(data) ? data.map(String) : []
        if (tts.length > 0) break
      }
    } catch (err) {
      console.error(`[Khaya] Languages fetch (${endpoint}) failed: ${err}`)
    }
  }

  return json(origin, { asr, tts, source: "khaya" })
}

async function handleTTS(req: Request, origin: string): Promise<Response> {
  if (!KHAYA_API_KEY) {
    return error(origin, "khaya_not_configured", "Voice service is not configured.", 500)
  }

  let body: { text?: unknown; language?: unknown; speaker_id?: unknown; stream?: unknown; format?: unknown }
  try {
    body = await req.json()
  } catch {
    return error(origin, "khaya_bad_request", "Invalid JSON body.", 400)
  }

  const text = String(body.text || "").trim().slice(0, 2000)
  const language = String(body.language || "").trim().slice(0, 32)
  const speakerId = String(body.speaker_id || "female")
  const stream = body.stream !== false
  const format = String(body.format || "wav").slice(0, 8)

  if (!text) return error(origin, "khaya_bad_request", "Missing text.", 400)
  if (!language) return error(origin, "khaya_bad_request", "Missing language.", 400)

  try {
    const upstream = await fetch(TTS_V2, {
      method: "POST",
      headers: { ...khayaHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ text, language, speaker_id: speakerId, stream, format }),
    })

    if (!upstream.ok) {
      return mapUpstreamError("tts", upstream.status, await upstream.text(), origin)
    }

    const contentType = upstream.headers.get("Content-Type") || "audio/wav"
    const bytes = await upstream.arrayBuffer()

    if (!bytes || bytes.byteLength === 0) {
      return error(origin, "khaya_invalid_audio", "Voice service returned empty audio.", 502)
    }
    if (
      !contentType.toLowerCase().includes("audio") &&
      !(bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46)
    ) {
      return error(origin, "khaya_invalid_audio", "Voice service returned invalid audio.", 502)
    }

    return new Response(bytes, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
        ...corsHeaders(origin),
      },
    })
  } catch (err) {
    console.error(`[Khaya] TTS fetch error: ${err}`)
    return error(origin, "khaya_unavailable", "Voice service is temporarily unavailable. Please try again in a moment.", 502)
  }
}

async function handleASR(req: Request, origin: string, language: string | null): Promise<Response> {
  if (!KHAYA_API_KEY) {
    return error(origin, "khaya_not_configured", "Voice service is not configured.", 500)
  }

  if (!language) return error(origin, "khaya_bad_request", "Missing language.", 400)

  const audio = await req.arrayBuffer().catch(() => null)
  if (!audio || audio.byteLength === 0) {
    return error(origin, "khaya_invalid_audio", "Empty audio.", 400)
  }
  if (audio.byteLength > MAX_AUDIO_BYTES) {
    return error(origin, "khaya_invalid_audio", "Audio is too large.", 400)
  }

  const contentType = req.headers.get("Content-Type") || "audio/webm"

  try {
    const upstream = await fetch(`${ASR_V3}?language=${encodeURIComponent(language)}`, {
      method: "POST",
      headers: { ...khayaHeaders(), "Content-Type": contentType },
      body: audio,
    })

    if (!upstream.ok) {
      return mapUpstreamError("asr", upstream.status, await upstream.text(), origin)
    }

    const raw = await upstream.text()
    let parsed: { text?: unknown; warnings?: unknown }
    try {
      parsed = JSON.parse(raw)
    } catch {
      console.error(`[Khaya] ASR returned non-JSON body: ${raw.slice(0, 200)}`)
      return error(origin, "khaya_invalid_response", "Voice service returned an invalid response.", 502)
    }

    const transcript = String(parsed.text || "").trim()
    if (!transcript) {
      return error(origin, "khaya_no_speech", "No speech recognized.", 422)
    }

    return json(origin, { text: transcript, language, warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [] })
  } catch (err) {
    console.error(`[Khaya] ASR fetch error: ${err}`)
    return error(origin, "khaya_unavailable", "Voice service is temporarily unavailable. Please try again in a moment.", 502)
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") || ""

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(origin) })
  }

  const url = new URL(req.url)
  const op = url.searchParams.get("op")

  if (!op) {
    return error(origin, "khaya_bad_request", "Missing op parameter.", 400)
  }

  const authHeader = req.headers.get("Authorization")
  if (!authHeader) {
    return error(origin, "khaya_auth", "Missing Authorization header.", 401)
  }

  const userId = await verifyJWT(authHeader.replace("Bearer ", ""))
  if (!userId) {
    return error(origin, "khaya_auth", "Invalid or expired token.", 401)
  }

  console.log(`[Khaya] op=${op} user=${userId}`)

  if (op === "languages") {
    if (req.method !== "GET") return error(origin, "khaya_bad_request", "Method not allowed.", 405)
    return await handleLanguages(origin)
  }

  if (op === "tts") {
    if (req.method !== "POST") return error(origin, "khaya_bad_request", "Method not allowed.", 405)
    return await handleTTS(req, origin)
  }

  if (op === "asr") {
    if (req.method !== "POST") return error(origin, "khaya_bad_request", "Method not allowed.", 405)
    return await handleASR(req, origin, url.searchParams.get("language"))
  }

  return error(origin, "khaya_bad_request", `Unknown op: ${op}.`, 400)
})
