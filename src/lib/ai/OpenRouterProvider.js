import { AIProvider } from './AIProvider'
import useAuthStore from '../../stores/authStore'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

const DEFAULT_MODEL = 'google/gemini-flash-latest'
const MAX_RETRIES = 3
const BASE_RETRY_DELAY = 1000

function getFunctionsBase() {
  if (!SUPABASE_URL) return null
  const match = SUPABASE_URL.match(/https:\/\/(.+?)\.supabase\.co/)
  return match ? `https://${match[1]}.supabase.co/functions/v1/openrouter-proxy` : null
}

function estimateTokens(text) {
  if (typeof text === 'string') return Math.ceil(text.length / 4)
  if (Array.isArray(text)) return text.reduce((sum, m) => sum + estimateTokens(m.content || ''), 0)
  return 0
}

function truncateConversation(messages, maxTurns = 5) {
  if (messages.length <= maxTurns * 2) return messages

  const recent = messages.slice(-maxTurns * 2)
  const older = messages.slice(0, -maxTurns * 2)

  const firstUser = older.find(m => m.role === 'user')
  const summary = firstUser
    ? `Earlier discussion: ${firstUser.content.substring(0, 120).trim()}...`
    : ''

  return summary
    ? [{ role: 'system', content: `[Previous conversation context: ${summary}]` }, ...recent]
    : recent
}

let requestCounter = 0

export class OpenRouterProvider extends AIProvider {
  constructor(options = {}) {
    super()
    this.model = options.model || DEFAULT_MODEL
    this.temperature = options.temperature ?? 0.7
    this.maxTokens = options.maxTokens ?? 400
  }

  isConfigured() {
    return !!getFunctionsBase()
  }

  async chatCompletion(messages, options = {}) {
    const requestId = ++requestCounter
    const functionsBase = getFunctionsBase()

    if (!functionsBase) {
      console.warn(`[OpenRouter #${requestId}] AI service not configured`)
      return 'AI service is not configured. Please check your API key or Supabase configuration.'
    }

    const session = useAuthStore.getState().session
    const token = session?.access_token
    if (!token) {
      console.warn(`[OpenRouter #${requestId}] No auth token`)
      return 'AI service requires authentication. Please sign in to use Amina.'
    }

    const {
      model = this.model,
      temperature = this.temperature,
      maxTokens = this.maxTokens,
      userRole = 'mother',
      languageInstruction = '',
      healthContext = '',
      conversationSummary = '',
      proactiveContext = '',
      signal,
    } = options

    const roleContexts = {
      mother: 'User is a MOTHER. Use simple warm language. Celebrate milestones. Reference her children by name, ANC attendance, vaccination schedules. Use locally available Ghanaian foods for nutrition advice.',
      chw: 'User is a CHW. Semi-technical. Prioritize high-risk mothers. Reference assigned patients. Help with CHPS protocols and GHS guidelines.',
      nurse: 'User is a NURSE/MIDWIFE. Clinical terminology. Evidence-based. GHS/WHO guidelines. ANC management, labor monitoring, postnatal care.',
      doctor: 'User is a DOCTOR. Full clinical terms. Evidence-based. Differential diagnoses. Flag specialist cases.',
      district_officer: 'User is a DISTRICT OFFICER. Population-level health management. Administrative language. Data-driven interventions.',
      admin: 'User is an ADMIN. System usage and configuration. Data management.',
    }

    const SYSTEM_PROMPT = `You are Amina — an AI Maternal and Child Healthcare Companion for NurtureAI, built for Ghana.

## CORE IDENTITY
Amina — warm, experienced community nurse and maternal health educator. Calm, knowledgeable, patient, respectful, culturally aware of Ghanaian customs (especially Northern Ghana). Never robotic or like a search engine.

## DOMAIN BOUNDARY
You ONLY handle: pregnancy, child health, maternal nutrition, breastfeeding, vaccination schedules (Ghana EPI), growth monitoring, ANC, CHPS healthcare, emergency warning signs, healthcare navigation, family planning, postnatal recovery, maternal mental health.

If asked outside these topics: "I'm Amina, your maternal and child healthcare companion. I specialize in pregnancy, child health, nutrition, vaccinations, and maternal wellbeing. Is there anything about your health or your baby's health I can help with?"
Do NOT answer: football, politics, programming, weather, celebrities, general knowledge, math, non-health recipes.

## AI WORKFLOW
1. Identify user role (mother/CHW/nurse/doctor/admin) and language (English/Dagbani)
2. Use PATIENT HEALTH CONTEXT to personalize — this is REAL patient data, never ask them to repeat it
3. Reason using WHO + Ghana Health Service guidance
4. Generate personalized response with a specific next step or follow-up question

## HEALTH CONTEXT RULES
You will receive a block of structured health context (=== PATIENT HEALTH CONTEXT ===). Use it every response. NEVER ask for info already in context. Personalize every answer using their name, pregnancy week, children, appointments, etc.

## ROLE GUIDELINES
- MOTHER: simple warm language, reference her children by name, celebrate milestones, use locally available foods
- CHW: semi-technical, help prioritize high-risk mothers, reference assigned patients
- NURSE/MIDWIFE: clinical terminology, evidence-based, GHS/WHO guidelines
- DOCTOR: full clinical terms, differentials, specialist referrals
- DISTRICT OFFICER: population-level, administrative, data-driven interventions
- ADMIN: system usage and configuration

## PROACTIVE CARE
After answering, suggest one relevant next step: a check-in question, a reminder about overdue ANC/vaccination/growth check, or risk awareness based on health context.

## EMERGENCY SIGNS
Watch for: severe headache, vaginal bleeding, leaking fluid, high fever (>38C), severe abdominal pain, blurred vision, swollen face/hands, reduced fetal movement, convulsions, difficulty breathing, severe chest pain, fainting.
If present: STOP advice. Say "These symptoms may require URGENT medical assessment. Please contact your healthcare provider or visit the nearest health facility RIGHT AWAY." Do NOT diagnose.

## CLINICAL SAFETY — NEVER
Diagnose conditions, prescribe or change medication, recommend dosages, interpret lab results as final diagnoses, tell mothers to ignore symptoms, replace healthcare professionals, contradict WHO/GHS guidelines. Always add when appropriate: "I recommend discussing this with your healthcare provider for a proper assessment."

## LANGUAGE SUPPORT
Detect and respond in the user's language (English or Dagbani). When Dagbani: use simple words rural mothers understand, include English medical terms in parentheses. Common Dagbani words: ni (pregnant), daali (baby), hewali (health), lunsi (medicine), chichirigu (hospital), nambahan (thank you), n na (yes), aya (no).

## CARE & BOUNDARIES
Be compassionate. Never create panic. Never minimize concerns. Balance honesty with hope. Respect Ghanaian culture and local practices; explain respectfully when safer practices are recommended. You empower, not replace, healthcare professionals.`

    let fullSystem = `${SYSTEM_PROMPT}\n\n${roleContexts[userRole] || roleContexts.mother}`
    if (healthContext) fullSystem += `\n\n${healthContext}`
    if (conversationSummary) fullSystem += `\n\n=== PREVIOUS CONVERSATIONS ===\n${conversationSummary}`
    if (proactiveContext) fullSystem += `\n\n=== ALERTS ===\nThe following health concerns were detected. Weave the most relevant 1-2 into your response naturally.\n${proactiveContext}`
    fullSystem += languageInstruction

    const truncatedMessages = truncateConversation(messages, 5)

    const apiMessages = [
      { role: 'system', content: fullSystem },
      ...truncatedMessages,
    ]

    const promptTokens = estimateTokens(apiMessages)
    console.log(`[OpenRouter #${requestId}] ${apiMessages.length} messages, ~${promptTokens} prompt tokens`)

    let lastError = null

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

      try {
        const response = await fetch(functionsBase, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: apiMessages,
            temperature,
            max_tokens: maxTokens,
          }),
          signal,
        })

        const errBody = await response.text()

        if (!response.ok) {
          console.error(`[OpenRouter #${requestId}] Error ${response.status}:`, errBody.slice(0, 200))

          if (response.status === 401) throw new Error('Authentication failed. Please sign in again.')
          if (response.status === 429) {
            if (attempt < MAX_RETRIES) {
              const delay = Math.pow(2, attempt + 1) * BASE_RETRY_DELAY
              console.log(`[OpenRouter #${requestId}] Rate limited, retrying in ${delay}ms (${attempt + 1}/${MAX_RETRIES})`)
              await new Promise(r => setTimeout(r, delay))
              continue
            }
            throw new Error('Too many requests. Please wait a moment and try again.')
          }
          let parsed
          try { parsed = JSON.parse(errBody) } catch {}
          throw new Error(parsed?.error || `API error ${response.status}. Please try again later.`)
        }

        const data = JSON.parse(errBody)
        const content = data.choices?.[0]?.message?.content || ''
        const responseTokens = estimateTokens(content)
        console.log(`[OpenRouter #${requestId}] ~${promptTokens}p + ~${responseTokens}r = ~${promptTokens + responseTokens}t total`)

        return content || 'I apologize, I could not generate a response. Please try again.'
      } catch (error) {
        if (error.name === 'AbortError') throw error

        lastError = error

        if (error.message?.includes('rate limit') || error.message?.includes('429')) {
          if (attempt < MAX_RETRIES) {
            const delay = Math.pow(2, attempt + 1) * BASE_RETRY_DELAY
            console.log(`[OpenRouter #${requestId}] Rate limited, retrying in ${delay}ms (${attempt + 1}/${MAX_RETRIES})`)
            await new Promise(r => setTimeout(r, delay))
            continue
          }
        }

        if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError') || error.name === 'TypeError') {
          throw new Error('Network error. Please check your internet connection and try again.')
        }

        if (attempt < MAX_RETRIES) {
          const delay = Math.pow(2, attempt) * 500
          await new Promise(r => setTimeout(r, delay))
          continue
        }
      }
    }

    throw lastError || new Error('Failed to get response. Please try again.')
  }

  async assessRisk(patientContext, symptoms) {
    const prompt = `Based on the following patient context and symptoms, provide a risk assessment.

PATIENT CONTEXT:
${JSON.stringify(patientContext, null, 2)}

REPORTED SYMPTOMS:
${symptoms.join(', ')}

Respond in this exact JSON format:
{
  "risk_level": "low" | "moderate" | "high" | "critical",
  "summary": "Brief assessment summary",
  "recommendations": ["recommendation 1", "recommendation 2"],
  "urgency": "routine" | "soon" | "urgent" | "emergency",
  "refer": true | false}`

    const response = await this.chatCompletion([{ role: 'user', content: prompt }], {
      temperature: 0.3,
      userRole: 'chw',
    })

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
    } catch {}

    return {
      risk_level: 'moderate',
      summary: 'Unable to fully assess. Please consult a healthcare professional.',
      recommendations: ['Visit your nearest health facility for a proper assessment'],
      urgency: 'soon',
      refer: true,
    }
  }
}
