import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureConversationManager } from './conversationManager.js';

test('ensureConversationManager creates and reuses a manager ref', async () => {
  const managerRef = { current: null };

  const first = ensureConversationManager(managerRef, {
    sendToAI: async () => 'ok',
    speakText: async () => {},
    stopSpeech: () => {},
    onStateChange: () => {},
    onMessagesChange: () => {},
    onTranscriptChange: () => {},
    onError: () => {},
  });

  assert.ok(first);
  assert.equal(typeof first.getState, 'function');
  assert.equal(managerRef.current, first);

  const second = ensureConversationManager(managerRef, {
    sendToAI: async () => 'still ok',
    speakText: async () => {},
    stopSpeech: () => {},
    onStateChange: () => {},
    onMessagesChange: () => {},
    onTranscriptChange: () => {},
    onError: () => {},
  });

  assert.equal(second, first);
});
