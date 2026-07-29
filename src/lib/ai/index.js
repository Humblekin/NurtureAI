import { OpenRouterProvider } from './OpenRouterProvider'

const defaultProvider = new OpenRouterProvider()

export function getAIProvider() {
  return defaultProvider
}

export { AIProvider } from './AIProvider'
export { OpenRouterProvider } from './OpenRouterProvider'
