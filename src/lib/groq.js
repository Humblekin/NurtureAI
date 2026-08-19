import { getAIProvider } from './ai'
import { screenForEmergency, buildEmergencyReply } from '../services/emergencyScreen'

const provider = getAIProvider()

export async function chatCompletion(messages, options = {}) {
  // Central deterministic safety pre-screen: runs before EVERY chat-style AI
  // call so emergency cues always get a guaranteed, non-model-dependent
  // answer. Only direct user utterances are screened (short messages) —
  // long structured prompts (onboarding/extraction) are never matched, so a
  // question that merely ASKS about a symptom can't false-positive.
  const lastUser = [...messages].reverse().find((m) => m.role === 'user' && typeof m.content === 'string')
  if (lastUser && lastUser.content.length <= 400 && options.emergencyScreen !== false) {
    const match = screenForEmergency(lastUser.content)
    if (match) {
      const language = options.language === 'dag' ? 'dag' : 'en'
      return buildEmergencyReply(match, language)
    }
  }
  return provider.chatCompletion(messages, options)
}

export async function assessRisk(patientContext, symptoms) {
  return provider.assessRisk(patientContext, symptoms)
}

export const isAiConfigured = () => provider.isConfigured()
