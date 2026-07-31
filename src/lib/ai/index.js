import { OpenAIProvider } from './OpenAIProvider'

const defaultProvider = new OpenAIProvider()

export function getAIProvider() {
  return defaultProvider
}

export { AIProvider } from './AIProvider'
export { OpenAIProvider } from './OpenAIProvider'
