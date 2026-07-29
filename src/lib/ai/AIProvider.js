export class AIProvider {
  async chatCompletion(_messages, _options = {}) {
    throw new Error('chatCompletion() must be implemented by subclass')
  }

  async assessRisk(_patientContext, _symptoms) {
    throw new Error('assessRisk() must be implemented by subclass')
  }

  isConfigured() {
    return false
  }
}
