import { getAIProvider } from './ai'

const provider = getAIProvider()

export async function chatCompletion(messages, options = {}) {
  return provider.chatCompletion(messages, options)
}

export async function assessRisk(patientContext, symptoms) {
  return provider.assessRisk(patientContext, symptoms)
}

export const isAiConfigured = () => provider.isConfigured()
