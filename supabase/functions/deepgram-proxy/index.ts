import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const DEEPGRAM_API_KEY = Deno.env.get("DEEPGRAM_API_KEY")
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!

console.log("[DG-Proxy] Function loaded")

function corsHeaders(origin: string): Headers {
  return new Headers({
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  })
}

async function verifyJWT(token: string): Promise<string | null> {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) {
      console.error(`[DG-Proxy] Auth failed: ${error?.message}`)
      return null
    }
    return user.id
  } catch (err) {
    console.error(`[DG-Proxy] Auth exception: ${err}`)
    return null
  }
}

async function handleSTT(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const token = url.searchParams.get("access_token")

  if (!token) {
    console.error("[DG-Proxy] STT: Missing access_token")
    return new Response(
      JSON.stringify({ error: "Missing access_token query parameter" }),
      { status: 401, headers: { ...corsHeaders(req.headers.get("origin") || ""), "Content-Type": "application/json" } },
    )
  }

  const userId = await verifyJWT(token)
  if (!userId) {
    console.error("[DG-Proxy] STT: Invalid or expired access_token")
    return new Response(
      JSON.stringify({ error: "Invalid or expired access_token" }),
      { status: 401, headers: { ...corsHeaders(req.headers.get("origin") || ""), "Content-Type": "application/json" } },
    )
  }

  console.log(`[DG-Proxy] STT: Authenticated user ${userId}, upgrading to WebSocket`)

  if (!DEEPGRAM_API_KEY) {
    return new Response(
      JSON.stringify({ error: "Deepgram API key not configured on server" }),
      { status: 500, headers: { ...corsHeaders(req.headers.get("origin") || ""), "Content-Type": "application/json" } },
    )
  }

  const { response, socket } = Deno.upgradeWebSocket(req)

  const language = url.searchParams.get("language") === "dag" ? "ha-Latn-NG" : "en-US"

  const dgUrl = `wss://api.deepgram.com/v1/listen?${new URLSearchParams({
    model: "nova-2",
    language,
    interim_results: "true",
    endpointing: "1000",
  })}`

  const deepgramWs = new WebSocket(dgUrl, {
    headers: { Authorization: `Token ${DEEPGRAM_API_KEY}` },
  })

  socket.onopen = () => console.log("[DG-Proxy] STT: Frontend WebSocket open")

  deepgramWs.onopen = () => {
    console.log("[DG-Proxy] STT: Deepgram WebSocket open")
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: "Connected",
        message: "Deepgram STT ready",
      }))
    }
  }

  deepgramWs.onmessage = (e) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(e.data)
    }
  }

  socket.onmessage = (e) => {
    if (deepgramWs.readyState === WebSocket.OPEN) {
      deepgramWs.send(e.data)
    }
  }

  deepgramWs.onerror = () => {
    console.error("[DG-Proxy] STT: Deepgram WebSocket error")
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: "Error",
        message: "Deepgram connection failed",
        detail: "Check that the DEEPGRAM_API_KEY secret is set and valid in Supabase.",
      }))
    }
  }

  deepgramWs.onclose = (e) => {
    console.log(`[DG-Proxy] STT: Deepgram closed (code=${e.code})`)
    if (socket.readyState === WebSocket.OPEN) {
      socket.close(1000, "Deepgram closed")
    }
  }

  socket.onclose = () => {
    console.log("[DG-Proxy] STT: Frontend closed")
    if (deepgramWs.readyState === WebSocket.OPEN || deepgramWs.readyState === WebSocket.CONNECTING) {
      deepgramWs.close(1000, "Frontend disconnected")
    }
  }

  socket.onerror = () => {
    console.error("[DG-Proxy] STT: Frontend WebSocket error")
    if (deepgramWs.readyState === WebSocket.OPEN || deepgramWs.readyState === WebSocket.CONNECTING) {
      deepgramWs.close(1000, "Frontend error")
    }
  }

  return response
}

async function handleTTS(req: Request): Promise<Response> {
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

  if (!DEEPGRAM_API_KEY) {
    return new Response(
      JSON.stringify({ error: "Deepgram API key not configured on server" }),
      { status: 500, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } },
    )
  }

  let body: { text?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } },
    )
  }

  if (!body.text?.trim()) {
    return new Response(
      JSON.stringify({ error: "Missing text field" }),
      { status: 400, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } },
    )
  }

  console.log(`[DG-Proxy] TTS: Generating speech for user ${userId}, text length=${body.text.length}`)

  try {
    const dgResponse = await fetch(
      "https://api.deepgram.com/v1/speak?model=aura-asteria-en",
      {
        method: "POST",
        headers: {
          Authorization: `Token ${DEEPGRAM_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: body.text }),
      },
    )

    if (!dgResponse.ok) {
      const errText = await dgResponse.text()
      console.error(`[DG-Proxy] TTS: Deepgram error ${dgResponse.status}: ${errText}`)
      return new Response(
        JSON.stringify({
          error: `Deepgram TTS error: ${dgResponse.status}`,
          detail: dgResponse.status === 401 ? "Deepgram API key is invalid or expired." : errText.slice(0, 200),
        }),
        { status: dgResponse.status, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } },
      )
    }

    const audioBytes = await dgResponse.arrayBuffer()
    console.log(`[DG-Proxy] TTS: Received ${audioBytes.byteLength} bytes`)

    return new Response(audioBytes, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-cache",
        ...corsHeaders(origin),
      },
    })
  } catch (err) {
    console.error(`[DG-Proxy] TTS: Fetch error: ${err}`)
    return new Response(
      JSON.stringify({ error: "Failed to reach Deepgram TTS API" }),
      { status: 502, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } },
    )
  }
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const path = url.pathname

  console.log(`[DG-Proxy] Request: ${req.method} ${path}`)

  if (path.endsWith("/stt")) {
    return handleSTT(req)
  }

  if (path.endsWith("/tts")) {
    return handleTTS(req)
  }

  return new Response(
    JSON.stringify({
      error: "Not found",
      available: ["GET /stt (WebSocket)", "POST /tts"],
    }),
    { status: 404, headers: { "Content-Type": "application/json" } },
  )
})
