import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, MicOff, Send, Check, Sparkles } from 'lucide-react';
import useAuthStore from '../../stores/authStore';
import useOnboardingStore from '../../stores/onboardingStore';
import { useSpeechSynthesis } from '../../hooks/useAminaChat';
import { useFieldDictation } from '../../hooks/useFieldDictation';
import styles from './OnboardingFlow.module.css';

/**
 * NurtureAI — Onboarding Flow
 *
 * Full-screen Amina experience for new mothers.
 * Guides them through health profile setup via conversation.
 */

// Escape user/mother-supplied text before it is rendered with
// dangerouslySetInnerHTML, so profile data can never inject markup.
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

const OnboardingFlow = () => {
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const {
    conversationHistory,
    collectedData,
    currentQuestion,
    progress,
    isStarted,
    isComplete,
    summary,
    error,
    language,
    startOnboarding,
    sendResponse,
    saveDraft,
  } = useOnboardingStore();

  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // These hooks take the app's language key ("en" / "dag") and map it to the right
// provider and browser locale themselves. Passing raw BCP-47 tags here made
// every lookup miss and silently fell back to English.
  const {
    isListening,
    isProcessing: isTranscribing,
    interim,
    error: dictationError,
    isSupported: sttSupported,
    start: startListening,
    stop: stopListening,
    onFinal,
    onInterim,
  } = useFieldDictation(language);
  const [liveTranscript, setLiveTranscript] = useState('');
  const { speak, stop: stopSpeaking } = useSpeechSynthesis(language);

  // Start onboarding on mount
  useEffect(() => {
    if (!isStarted && profile?.id) {
      startOnboarding(profile.id, profile, language);
    }
  }, [isStarted, profile, language, startOnboarding]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationHistory, isTyping]);

  // Focus input
  useEffect(() => {
    if (!isComplete && !showConfirmation) {
      inputRef.current?.focus();
    }
  }, [currentQuestion, isComplete, showConfirmation]);

  const submitAnswer = useCallback(async (answer) => {
    const text = answer.trim();
    if (!text || isTyping) return;

    setInputText('');
    setIsTyping(true);
    stopSpeaking();

    try {
      const result = await sendResponse(text);
      if (result?.isComplete) setShowConfirmation(true);
    } finally {
      setIsTyping(false);
    }
  }, [isTyping, sendResponse, stopSpeaking]);

  // Speak Amina's messages
  useEffect(() => {
    if (conversationHistory.length > 0) {
      const lastMsg = conversationHistory[conversationHistory.length - 1];
      if (lastMsg.role === 'assistant' && !isComplete) {
        speak(lastMsg.content);
      }
    }
  }, [conversationHistory, isComplete, speak]);

  // Keep speech visible while recording, then leave the finalized answer in
  // the input so the mother can review it before sending it to Amina.
  useEffect(() => {
    onInterim((text) => setLiveTranscript(text || ''));
  }, [onInterim]);

  useEffect(() => {
    onFinal((text) => {
      if (!text?.trim()) return;
      setLiveTranscript('');
      stopListening();
      void submitAnswer(text);
    });
  }, [onFinal, stopListening, submitAnswer]);

  const handleSend = async () => {
    await submitAnswer(inputText);
  };

  const handleVoiceToggle = () => {
    if (isListening) {
      stopListening();
    } else {
      setLiveTranscript('');
      stopSpeaking();
      startListening();
    }
  };

  const handleReview = () => {
    // Hand the collected answers to the form so she can correct anything the
    // AI misheard. The old flow showed a read-only summary with a
    // "Something needs correction" button that did nothing but close the card.
    saveDraft(collectedData);
    stopSpeaking();
    stopListening();
    navigate('/mother/onboarding/form', {
      replace: true,
      state: { language, fromVoice: true },
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={styles.onboarding}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logo}>
            <Sparkles size={20} />
            <span>Amina</span>
          </div>
          <span className={styles.subtitle}>Health Profile Setup</span>
        </div>
        <div className={styles.progressArea}>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className={styles.progressText}>{progress}%</span>
        </div>
      </div>

      {/* Messages */}
      <div className={styles.messages}>
        {conversationHistory.map((msg, i) => (
          <div
            key={i}
            className={`${styles.message} ${msg.role === 'user' ? styles.userMessage : styles.aminaMessage}`}
          >
            {msg.role === 'assistant' && (
              <div className={styles.avatar}>
                <Sparkles size={16} />
              </div>
            )}
            <div className={styles.bubble}>
              <p>{msg.content}</p>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className={`${styles.message} ${styles.aminaMessage}`}>
            <div className={styles.avatar}>
              <Sparkles size={16} />
            </div>
            <div className={styles.bubble}>
              <div className={styles.typingIndicator}>
                <span /><span /><span />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Review Screen */}
      {showConfirmation && (
        <div className={styles.confirmationOverlay}>
          <div className={styles.confirmationCard}>
            <h2>Here's what I understood:</h2>
            <div className={styles.summary}>
              {summary?.split('\n').map((line, i) => (
                <p key={i} dangerouslySetInnerHTML={{
                  __html: escapeHtml(line)
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/• /g, '&bull; ')
                }} />
              ))}
            </div>
            <p className={styles.confirmPrompt}>
              Take a moment to check these. You can change anything before saving.
            </p>
            <div className={styles.confirmActions}>
              <button
                className={styles.confirmBtn}
                onClick={handleReview}
              >
                <>
                  <Check size={18} />
                  Review and save my profile
                </>
              </button>
              <button
                className={styles.editBtn}
                onClick={handleReview}
              >
                Something needs correction
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Toast */}
      {(error || dictationError) && (
        <div className={styles.errorToast}>{dictationError || error}</div>
      )}

      {/* Input Area */}
      {!isComplete && !showConfirmation && (
        <div className={styles.inputArea}>
          <div className={styles.inputContainer}>
            <input
              ref={inputRef}
              type="text"
              className={styles.textInput}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isListening ? 'Listening...' : isTranscribing ? 'Transcribing...' : 'Type your answer...'}
              disabled={isTyping || isListening || isTranscribing}
            />
            {sttSupported && (
              <button
                className={`${styles.micBtn} ${isListening ? styles.micActive : ''}`}
                onClick={handleVoiceToggle}
                disabled={isTyping}
              >
                {isListening ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
            )}
            <button
              className={styles.sendBtn}
              onClick={handleSend}
              disabled={!inputText.trim() || isTyping}
            >
              <Send size={20} />
            </button>
          </div>
          {(isListening || isTranscribing) && (
            <p className={styles.voiceStatus} aria-live="polite">
              {isTranscribing
                ? 'Transcribing your answer...'
                : language === 'dag'
                  ? 'Recording... tap the microphone when you are finished.'
                  : liveTranscript || interim || 'Listening...'}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default OnboardingFlow;
