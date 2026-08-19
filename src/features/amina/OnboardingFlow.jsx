import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, MicOff, Send, Check, ArrowRight, Sparkles } from 'lucide-react';
import useAuthStore from '../../stores/authStore';
import useOnboardingStore from '../../stores/onboardingStore';
import { useSpeechRecognition, useSpeechSynthesis } from '../../hooks/useAminaChat';
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
  const { profile, user } = useAuthStore();
  const {
    conversationHistory,
    collectedData,
    currentQuestion,
    progress,
    isStarted,
    isComplete,
    isSaving,
    summary,
    error,
    language,
    startOnboarding,
    sendResponse,
    confirmAndSave,
  } = useOnboardingStore();

  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const { isListening, transcript, startListening, stopListening, isSupported: sttSupported } = useSpeechRecognition(language === 'dag' ? 'ha-Latn-NG' : 'en-US');
  const { speak, stop: stopSpeaking, isSpeaking } = useSpeechSynthesis(language === 'dag' ? 'ha-Latn-NG' : 'en-US');

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

  // Speak Amina's messages
  useEffect(() => {
    if (conversationHistory.length > 0) {
      const lastMsg = conversationHistory[conversationHistory.length - 1];
      if (lastMsg.role === 'assistant' && !isComplete) {
        speak(lastMsg.content);
      }
    }
  }, [conversationHistory, isComplete, speak]);

  // Handle voice input
  useEffect(() => {
    if (transcript && !isListening) {
      setInputText(transcript);
    }
  }, [transcript, isListening]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || isTyping) return;

    setInputText('');
    setIsTyping(true);
    stopSpeaking();

    const result = await sendResponse(text);

    setIsTyping(false);

    if (result?.isComplete) {
      setShowConfirmation(true);
    }
  };

  const handleVoiceToggle = () => {
    if (isListening) {
      stopListening();
    } else {
      stopSpeaking();
      startListening();
    }
  };

  const handleConfirm = async (confirmed) => {
    if (!confirmed) {
      setShowConfirmation(false);
      // TODO: Allow editing specific fields
      return;
    }

    const result = await confirmAndSave(true, {
      phone: user?.phone || profile?.phone,
    });

    if (result?.success) {
      navigate('/mother/amina', { replace: true });
    }
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

      {/* Confirmation Screen */}
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
              Is everything correct?
            </p>
            <div className={styles.confirmActions}>
              <button
                className={styles.confirmBtn}
                onClick={() => handleConfirm(true)}
                disabled={isSaving}
              >
                {isSaving ? (
                  <span className={styles.spinner} />
                ) : (
                  <>
                    <Check size={18} />
                    Yes, save my profile
                  </>
                )}
              </button>
              <button
                className={styles.editBtn}
                onClick={() => handleConfirm(false)}
                disabled={isSaving}
              >
                Something needs correction
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Toast */}
      {error && (
        <div className={styles.errorToast}>
          {error}
        </div>
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
              placeholder={isListening ? 'Listening...' : 'Type your answer...'}
              disabled={isTyping || isListening}
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
        </div>
      )}
    </div>
  );
};

export default OnboardingFlow;
