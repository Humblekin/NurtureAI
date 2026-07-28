import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const DEEPGRAM_API_KEY = Deno.env.get("DEEPGRAM_API_KEY")
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!

console.log("[DG-Proxy] Function loaded")
console.log(`[DG-Proxy] DEEPGRAM_API_KEY present: ${!!DEEPGRAM_API_KEY}`)
console.log(`[DG-Proxy] SUPABASE_URL present: ${!!SUPABASE_URL}`)
console.log(`[DG-Proxy] SUPABASE_ANON_KEY present: ${!!SUPABASE_ANON_KEY}`)

function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  }
}

async function verifyJWT(token: string): Promise<string | null> {
  console.log("[DG-Proxy] verifyJWT: creating supabase client")
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    console.log("[DG-Proxy] verifyJWT: calling getUser")
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error) {
      console.error(`[DG-Proxy] Auth failed: ${error.message}`)
      return null
    }
    if (!user) {
      console.error("[DG-Proxy] Auth failed: no user returned")
      return null
    }
    console.log(`[DG-Proxy] Auth success: user=${user.id}`)
    return user.id
  } catch (err) {
    console.error(`[DG-Proxy] Auth exception: ${err}`)
    console.error(`[DG-Proxy] Auth exception stack: ${(err as Error).stack || "no stack"}`)
    return null
  }
}

async function handleSTT(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const token = url.searchParams.get("access_token")
  const language = url.searchParams.get("language") === "dag" ? "ha-Latn-NG" : "en-US"

  console.log("[DG-Proxy] STT: received request")
  console.log(`[DG-Proxy] STT: token present: ${!!token}`)
  console.log(`[DG-Proxy] STT: token length: ${token?.length || 0}`)
  console.log(`[DG-Proxy] STT: language: ${language}`)
  console.log(`[DG-Proxy] STT: Upgrade header: ${req.headers.get("upgrade")}`)

  if (!token) {
    console.error("[DG-Proxy] STT: missing access_token")
    return new Response(
      JSON.stringify({ error: "Missing access_token query parameter" }),
      { status: 401, headers: { ...corsHeaders(req.headers.get("origin") || ""), "Content-Type": "application/json" } },
    )
  }

  let socket: WebSocket | null = null
  let deepgramWs: WebSocket | null = null
  let keepAlivePromise: Promise<void> | null = null

  try {
    console.log("[DG-Proxy] STT: calling Deno.upgradeWebSocket")
    const upgrade = Deno.upgradeWebSocket(req)
    socket = upgrade.socket
    const response = upgrade.response
    console.log("[DG-Proxy] STT: upgrade succeeded, returning 101")

    let resolved = false
    keepAlivePromise = new Promise((resolve) => {
      socket!.onclose = () => {
        console.log("[DG-Proxy] STT: Frontend socket closed")
        if (deepgramWs) {
          try {
            if (deepgramWs.readyState === WebSocket.OPEN || deepgramWs.readyState === WebSocket.CONNECTING) {
              deepgramWs.close(1000, "Frontend disconnected")
            }
          } catch (_) { /* ignore */ }
        }
        if (!resolved) { resolved = true; resolve() }
      }
      socket!.onerror = (e) => {
        console.error(`[DG-Proxy] STT: Frontend socket error: ${(e as ErrorEvent).message || "unknown"}`)
        if (!resolved) { resolved = true; resolve() }
      }
    })

    socket.onopen = async () => {
      console.log("[DG-Proxy] STT: Frontend WebSocket open, starting auth")

      if (!DEEPGRAM_API_KEY) {
        console.error("[DG-Proxy] STT: DEEPGRAM_API_KEY not set")
        try { socket!.send(JSON.stringify({ type: "Error", message: "Deepgram API key not configured on server" })) } catch (_) { /* ignore */ }
        try { socket!.close(1011, "Server configuration error") } catch (_) { /* ignore */ }
        return
      }

      console.log("[DG-Proxy] STT: verifying JWT")
      const userId = await verifyJWT(token)
      if (!userId) {
        console.error("[DG-Proxy] STT: JWT verification failed")
        try { socket!.send(JSON.stringify({ type: "Error", message: "Invalid or expired access_token" })) } catch (_) { /* ignore */ }
        try { socket!.close(4001, "Authentication failed") } catch (_) { /* ignore */ }
        return
      }

      console.log(`[DG-Proxy] STT: Authenticated user ${userId}, connecting to Deepgram`)

      try {
        const dgUrl = `wss://api.deepgram.com/v1/listen?${new URLSearchParams({
          model: "nova-2",
          language,
          interim_results: "true",
          endpointing: "1000",
          token: DEEPGRAM_API_KEY!,
        })}`

        console.log("[DG-Proxy] STT: opening Deepgram WebSocket")
        console.log(`[DG-Proxy] STT: Deepgram URL (sanitized): wss://api.deepgram.com/v1/listen?...&token=***&language=${language}`)
        try {
          deepgramWs = new WebSocket(dgUrl)
        } catch (wsErr) {
          console.error(`[DG-Proxy] STT: Failed to create Deepgram WebSocket: ${wsErr}`)
          try { socket!.send(JSON.stringify({ type: "Error", message: "Failed to create Deepgram WebSocket", detail: String(wsErr) })) } catch (_) { /* ignore */ }
          return
        }

        deepgramWs.onopen = () => {
          console.log("[DG-Proxy] STT: Deepgram WebSocket open")
          try {
            socket!.send(JSON.stringify({ type: "Connected", message: "Deepgram STT ready" }))
          } catch (e) {
            console.error("[DG-Proxy] STT: Failed to send Connected message:", e)
          }
        }

        deepgramWs.onmessage = (e) => {
          if (socket!.readyState === WebSocket.OPEN) {
            try { socket!.send(e.data) } catch (_) { /* ignore */ }
          }
        }

        socket!.onmessage = (e) => {
          if (deepgramWs!.readyState === WebSocket.OPEN) {
            try { deepgramWs!.send(e.data) } catch (_) { /* ignore */ }
          }
        }

        deepgramWs.onerror = (e) => {
          const errMsg = (e as ErrorEvent)?.message || "unknown error"
          console.error(`[DG-Proxy] STT: Deepgram WebSocket error: ${errMsg}`)
          try {
            socket!.send(JSON.stringify({ type: "Error", message: "Deepgram connection failed", detail: errMsg }))
          } catch (_) { /* ignore */ }
        }

        deepgramWs.onclose = (e) => {
          console.log(`[DG-Proxy] STT: Deepgram closed (code=${e.code} reason=${e.reason})`)
          if (e.code !== 1000) {
            console.error(`[DG-Proxy] STT: Deepgram abnormal close - code=${e.code} reason=${e.reason}`)
          }
          if (socket!.readyState === WebSocket.OPEN) {
            try { socket!.close(1000, "Deepgram closed") } catch (_) { /* ignore */ }
          }
        }
      } catch (err) {
        console.error(`[DG-Proxy] STT: Error in onopen: ${err}`)
        console.error(`[DG-Proxy] STT: Stack: ${(err as Error).stack || "none"}`)
        try {
          socket!.send(JSON.stringify({ type: "Error", message: "Internal error connecting to Deepgram", detail: String(err) }))
        } catch (_) { /* ignore */ }
      }
    }

    EdgeRuntime.waitUntil(keepAlivePromise)
    return response
  } catch (err) {
    console.error(`[DG-Proxy] STT: CRITICAL error during upgrade: ${err}`)
    console.error(`[DG-Proxy] STT: Stack: ${(err as Error).stack || "none"}`)
    return new Response(
      JSON.stringify({ error: "WebSocket upgrade failed", detail: String(err) }),
      { status: 502, headers: { ...corsHeaders(req.headers.get("origin") || ""), "Content-Type": "application/json" } },
    )
  }
}

async function handleTTS(req: Request): Promise<Response> {
  const origin = req.headers.get("origin") || ""

  console.log("[DG-Proxy] TTS: received request")

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
  console.log(`[DG-Proxy] Headers: upgrade=${req.headers.get("upgrade")}, origin=${req.headers.get("origin")}`)

  try {
    if (path.endsWith("/stt")) {
      const upgrade = (req.headers.get("upgrade") || "").toLowerCase()
      if (upgrade !== "websocket") {
        console.log("[DG-Proxy] Not a WebSocket upgrade request, returning upgrade response")
        return new Response(
          JSON.stringify({ error: "This endpoint requires a WebSocket upgrade. Use ws:// or wss:// to connect." }),
          { status: 426, headers: { ...corsHeaders(req.headers.get("origin") || ""), "Content-Type": "application/json" } },
        )
      }
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
  } catch (err) {
    console.error(`[DG-Proxy] Unhandled error: ${err}`)
    console.error(`[DG-Proxy] Stack: ${(err as Error).stack || "none"}`)
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders(req.headers.get("origin") || ""), "Content-Type": "application/json" } },
    )
  }
})
