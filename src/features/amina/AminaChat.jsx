import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Send, Mic, MicOff, Volume2, VolumeX, Trash2, User, Globe, MessageSquare, Phone, PhoneOff, Pause, Play, Bell, BellOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVoiceConversation, VOICE_STATES, useSpeechRecognition, useSpeechSynthesis } from '../../hooks/useAminaChat';
import { isAiConfigured, chatCompletion } from '../../lib/groq';
import useAuthStore from '../../stores/authStore';
import { buildHealthContext } from '../../services/healthContext';
import { runReminderEngine } from '../../services/reminderEngine';
import useNotificationStore from '../../stores/notificationStore';
import Button from '../../components/ui/Button';
import AminaAvatar from './avatar/AminaAvatar';
import styles from './AminaChat.module.css';

const MessageBubble = ({ message }) => {
  const isUser = message.role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`${styles.message} ${isUser ? styles.userMessage : styles.assistantMessage}`}
    >
      {!isUser && (
        <div className={styles.avatarBubble}>
          <span style={{ fontSize: '14px' }}>A</span>
        </div>
      )}
      <div className={`${styles.bubble} ${isUser ? styles.userBubble : styles.assistantBubble}`}>
        <p className={styles.messageText}>{message.content}</p>
      </div>
      {isUser && (
        <div className={`${styles.avatarBubble} ${styles.userAvatarBubble}`}>
          <User size={16} />
        </div>
      )}
    </motion.div>
  );
};

const TypingIndicator = () => (
  <div className={`${styles.message} ${styles.assistantMessage}`}>
    <div className={styles.avatarBubble}>
      <span style={{ fontSize: '14px' }}>A</span>
    </div>
    <div className={`${styles.bubble} ${styles.assistantBubble}`}>
      <div className={styles.typingDots}>
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.dot} />
      </div>
    </div>
  </div>
);

// ============================================================
// VOICE MODE — Real-time conversational experience
// ============================================================
const VoiceMode = ({ voice, onSwitchToChat }) => {
  const {
    voiceState, messages, transcript, isListening,
    error, language, micPermission, togglePause, clearChat, switchLanguage,
  } = voice;

  const avatarState = useMemo(() => {
    switch (voiceState) {
      case VOICE_STATES.SPEAKING: return 'speaking';
      case VOICE_STATES.LISTENING: return 'listening';
      case VOICE_STATES.PROCESSING: return 'processing';
      case VOICE_STATES.GREETING: return 'greeting';
      case VOICE_STATES.PAUSED: return 'paused';
      case VOICE_STATES.ERROR: return 'error';
      case VOICE_STATES.INITIALIZING: return 'initializing';
      default: return 'idle';
    }
  }, [voiceState]);

  const avatarEmotion = useMemo(() => {
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role === 'user') return 'neutral';
    const content = lastMsg.content.toLowerCase();
    if (content.includes('congratulations') || content.includes('great') || content.includes('healthy')) return 'happy';
    if (content.includes('concern') || content.includes('urgent') || content.includes('warning') || content.includes('risk')) return 'concerned';
    return 'neutral';
  }, [messages]);

  const statusText = useMemo(() => {
    switch (voiceState) {
      case VOICE_STATES.INITIALIZING: return 'Starting up...';
      case VOICE_STATES.GREETING: return 'Speaking...';
      case VOICE_STATES.LISTENING: return isListening ? 'Listening to you...' : 'Starting to listen...';
      case VOICE_STATES.PROCESSING: return 'Thinking...';
      case VOICE_STATES.SPEAKING: return 'Speaking...';
      case VOICE_STATES.PAUSED: return 'Paused';
      case VOICE_STATES.ERROR: return 'Error occurred';
      default: return 'Your Healthcare Companion';
    }
  }, [voiceState, isListening]);

  const aiConfigured = isAiConfigured();

  return (
    <div className={styles.voicePage}>
      <div className={styles.voiceBackground} />

      {/* Top bar */}
      <div className={styles.voiceTopBar}>
        <div className={styles.languageSelector}>
          <Globe size={14} style={{ color: 'var(--text-tertiary)' }} />
          <button onClick={() => switchLanguage('en')} className={`${styles.langBtn} ${language === 'en' ? styles.langBtnActive : ''}`}>EN</button>
          <button onClick={() => switchLanguage('dag')} className={`${styles.langBtn} ${language === 'dag' ? styles.langBtnActive : ''}`}>DAG</button>
        </div>
        <div className={styles.voiceTopActions}>
          <button className={styles.modeToggleBtn} onClick={onSwitchToChat} title="Switch to Chat Mode">
            <MessageSquare size={16} />
            <span>Chat</span>
          </button>
        </div>
      </div>

      {!aiConfigured && (
        <div className={styles.warningBanner}>
          AI is not configured. Set VITE_OPENROUTER_API_KEY in your .env file to enable Amina.
        </div>
      )}

      {/* Mic permission denied — dedicated screen */}
      {micPermission === 'denied' && (
        <div className={styles.permissionDeniedOverlay}>
          <div className={styles.permissionDeniedCard}>
            <MicOff size={48} style={{ color: 'var(--color-danger-500)', marginBottom: 'var(--space-3)' }} />
            <h3>Microphone Access Needed</h3>
            <p>Your browser has blocked microphone access for this site.</p>
            <div className={styles.permissionSteps}>
              <p><strong>To enable voice chat:</strong></p>
              <ul>
                <li><strong>Chrome:</strong> Click the lock/tune icon in the address bar → Microphone → Allow</li>
                <li><strong>Safari:</strong> Safari Settings → Websites → Microphone → Allow</li>
                <li><strong>Firefox:</strong> Click the mic icon in the address bar → Allow</li>
                <li><strong>Edge:</strong> Click the lock icon in the address bar → Microphone → Allow</li>
              </ul>
              <p>After enabling, click <strong>Retry</strong> below.</p>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', justifyContent: 'center' }}>
              <Button size="sm" variant="outline" onClick={clearChat}>Retry</Button>
              <Button size="sm" onClick={onSwitchToChat}>
                <MessageSquare size={14} /> Use Chat Instead
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Avatar area */}
      <div className={styles.voiceAvatarArea}>
        <AminaAvatar state={avatarState} emotion={avatarEmotion} className={styles.voiceAvatar} />

        {/* Name + status */}
        <div className={styles.voiceInfo}>
          <h2 className={styles.voiceName}>Amina</h2>
          <p className={styles.voiceStatus}>{statusText}</p>
        </div>

        {/* Listening ring */}
        <AnimatePresence>
          {voiceState === VOICE_STATES.LISTENING && isListening && (
            <motion.div
              className={styles.listeningRing}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            />
          )}
        </AnimatePresence>

        {/* Live transcript */}
        <AnimatePresence>
          {voiceState === VOICE_STATES.LISTENING && transcript && (
            <motion.div
              className={styles.liveTranscript}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
            >
              <p>{transcript}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Thinking indicator */}
        <AnimatePresence>
          {voiceState === VOICE_STATES.PROCESSING && (
            <motion.div
              className={styles.thinkingIndicator}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className={styles.typingDots}>
                <span className={styles.dot} />
                <span className={styles.dot} />
                <span className={styles.dot} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Error */}
      {error && micPermission !== 'denied' && (
        <div className={styles.errorBanner}>
          <p>{error}</p>
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)', flexWrap: 'wrap', justifyContent: 'center' }}>
            <Button size="sm" variant="outline" onClick={clearChat}>
              Retry
            </Button>
            <Button size="sm" variant="outline" onClick={onSwitchToChat}>
              <MessageSquare size={14} /> Use Chat Instead
            </Button>
          </div>
        </div>
      )}

      {/* Bottom controls */}
      <div className={styles.voiceControls}>
        {micPermission !== 'denied' && (
          <button className={`${styles.controlBtn} ${styles.pauseBtn}`} onClick={togglePause} title={voiceState === VOICE_STATES.PAUSED ? 'Resume' : 'Pause'}>
            {voiceState === VOICE_STATES.PAUSED ? <Play size={20} /> : <Pause size={20} />}
          </button>
        )}
        <button className={`${styles.controlBtn} ${styles.endCallBtn}`} onClick={clearChat} title="End conversation">
          <PhoneOff size={22} />
        </button>
      </div>
    </div>
  );
};

// ============================================================
// CHAT MODE — Text-based conversation (manual)
// ================================================= */
const ChatMode = ({ onSwitchToVoice }) => {
  const { messages, isLoading, error, sendMessage, clearChat, language, switchLanguage } = useAminaChatChatMode();
  const { isListening, transcript, isSupported: sttSupported, error: sttError, startListening, stopListening, setTranscript } = useSpeechRecognition(language);
  const { isSpeaking, isSupported: ttsSupported, speak } = useSpeechSynthesis(language);
  const [input, setInput] = useState('');
  const [autoSpeak, setAutoSpeak] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const lastSpokenIdxRef = useRef(-1);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, isLoading, scrollToBottom]);
  useEffect(() => { if (transcript) setInput(transcript); }, [transcript]);

  // Auto-speak responses
  useEffect(() => {
    if (!autoSpeak || isSpeaking || isLoading) return;
    const lastAssistantIdx = [...messages].findLastIndex(m => m.role === 'assistant');
    if (lastAssistantIdx > 0 && lastAssistantIdx !== lastSpokenIdxRef.current) {
      lastSpokenIdxRef.current = lastAssistantIdx;
      setTimeout(() => speak(messages[lastAssistantIdx].content), 400);
    }
  }, [messages, autoSpeak, isSpeaking, isLoading, speak]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim()) {
      sendMessage(input);
      setInput('');
      setTranscript('');
    }
  };

  return (
    <div className={styles.chatPage}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div>
            <h2 className={styles.headerTitle}>Chat with Amina</h2>
            <p className={styles.headerSubtitle}>Ask anything about maternal & child health</p>
          </div>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.languageSelector}>
            <Globe size={14} style={{ color: 'var(--text-tertiary)' }} />
            <button onClick={() => switchLanguage('en')} className={`${styles.langBtn} ${language === 'en' ? styles.langBtnActive : ''}`}>EN</button>
            <button onClick={() => switchLanguage('dag')} className={`${styles.langBtn} ${language === 'dag' ? styles.langBtnActive : ''}`}>DAG</button>
          </div>
          {ttsSupported && (
            <Button size="sm" variant="ghost" onClick={() => setAutoSpeak(!autoSpeak)} title={autoSpeak ? 'Auto-speak ON' : 'Auto-speak OFF'} style={{ color: autoSpeak ? 'var(--color-primary-500)' : 'var(--text-tertiary)' }}>
              {autoSpeak ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={clearChat} title="Clear chat"><Trash2 size={18} /></Button>
          <button className={styles.modeToggleBtn} onClick={onSwitchToVoice} title="Switch to Voice Mode">
            <Phone size={16} />
            <span>Voice</span>
          </button>
        </div>
      </div>

      <div className={styles.messagesArea}>
        <div className={styles.messagesInner}>
          {messages.map((msg, i) => <MessageBubble key={i} message={msg} />)}
          {isLoading && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}
      {sttError && <div className={styles.errorBanner}>{sttError}</div>}

      <form onSubmit={handleSubmit} className={styles.inputArea}>
        <div className={styles.inputWrapper}>
          <input ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)}
            placeholder={isListening ? 'Listening...' : 'Ask Amina anything about health...'}
            className={styles.textInput} disabled={isLoading} />
          {sttSupported && (
            <button type="button" onClick={() => isListening ? stopListening() : startListening()}
              className={`${styles.voiceBtn} ${isListening ? styles.voiceBtnActive : ''}`}>
              {isListening ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
          )}
          <button type="submit" className={styles.sendBtn} disabled={!input.trim() || isLoading}><Send size={20} /></button>
        </div>
        <p className={styles.disclaimer}>Amina is not a doctor. Always consult a healthcare professional for medical advice.</p>
      </form>
    </div>
  );
};

// ============================================================
// Chat mode hook (text-only, separate from voice conversation)
// ============================================================
function useAminaChatChatMode() {
  const [language, setLanguage] = useState('en');
  const welcomeMessages = useMemo(() => ({
    en: "Hello! I'm Amina, your AI healthcare companion. I'm here to support you with pregnancy, child health, nutrition, breastfeeding, vaccination, and maternal healthcare. How can I help you today?",
    dag: "Mani n nyɛ Amina. Adaa laafee yuligu lana. Bihi alaafee yulibu lana, bihi laafeehi yulibu lana, abindira alaafee yulibu lana. Yelima wula ka nyen soŋa zaŋkpa n ni kali a binyerishaŋa?",
  }), []);
  const [messages, setMessages] = useState([{ role: 'assistant', content: welcomeMessages.en }]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const { profile } = useAuthStore();
  const healthContextRef = useRef('');

  // Fetch health context when profile changes
  useEffect(() => {
    if (profile?.id && profile?.role) {
      buildHealthContext(profile).then(ctx => {
        healthContextRef.current = ctx;
      }).catch(err => {
        console.error('Failed to build health context:', err);
      });
    }
  }, [profile]);

  const sendMessage = useCallback(async (content) => {
    if (!content.trim() || isLoading) return;
    const userMessage = { role: 'user', content: content.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);
    setError(null);
    try {
      const langInstruction = language === 'dag'
        ? '\n\nIMPORTANT: The user is communicating in Dagbani. You MUST respond entirely in Dagbani. Follow the Dagbani Language Behavior Rules in your system prompt.'
        : '\n\nThe user is communicating in English. Respond in English.';
      const apiMessages = newMessages.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: m.content }));
      const response = await chatCompletion(apiMessages, {
        userRole: profile?.role || 'mother',
        languageInstruction: langInstruction,
        healthContext: healthContextRef.current,
      });
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch {
      setError('Failed to get response. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, profile?.role, language]);

  const clearChat = useCallback(() => {
    setMessages([{ role: 'assistant', content: welcomeMessages[language] || welcomeMessages.en }]);
    setError(null);
  }, [language, welcomeMessages]);

  const switchLanguage = useCallback((lang) => setLanguage(lang), []);

  return { messages, isLoading, error, sendMessage, clearChat, language, switchLanguage };
}

// ============================================================
// Main component
// ============================================================
export const AminaChat = () => {
  const [mode, setMode] = useState('voice');
  const voice = useVoiceConversation();
  const { profile } = useAuthStore();
  const { unreadCount, fetchNotifications } = useNotificationStore();
  const [showNotifications, setShowNotifications] = useState(false);
  const { notifications } = useNotificationStore();

  // Run reminder engine on mount
  useEffect(() => {
    if (profile?.id) {
      runReminderEngine(profile).then(() => {
        fetchNotifications();
      }).catch(console.error);
    }
  }, [profile?.id]);

  return (
    <div className={styles.aminaChat}>
      {/* Notification bell */}
      <div className={styles.notificationBell}>
        <button
          className={styles.bellButton}
          onClick={() => setShowNotifications(!showNotifications)}
          aria-label="Notifications"
        >
          {unreadCount > 0 ? <Bell size={20} /> : <BellOff size={20} />}
          {unreadCount > 0 && <span className={styles.badge}>{unreadCount}</span>}
        </button>

        <AnimatePresence>
          {showNotifications && notifications.length > 0 && (
            <motion.div
              className={styles.notificationDropdown}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className={styles.notifHeader}>
                <h4>Health Reminders</h4>
              </div>
              {notifications.map(n => (
                <div key={n.id} className={`${styles.notifItem} ${styles[`priority_${n.priority}`]}`}>
                  <strong>{n.title}</strong>
                  <p>{n.message}</p>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {mode === 'voice' ? (
        <VoiceMode voice={voice} onSwitchToChat={() => setMode('chat')} />
      ) : (
        <ChatMode onSwitchToVoice={() => setMode('voice')} />
      )}
    </div>
  );
};

export default AminaChat;
