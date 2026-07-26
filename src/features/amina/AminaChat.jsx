import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Send, Mic, MicOff, Volume2, VolumeX, Trash2, User, Globe, MessageSquare, Phone, PhoneOff, Pause, Play, Bell, BellOff, Heart, Baby, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVoiceConversation, VOICE_STATES, useSpeechRecognition, useSpeechSynthesis } from '../../hooks/useAminaChat';
import { isAiConfigured, chatCompletion } from '../../lib/groq';
import { isDeepgramConfigured, speak as deepgramSpeak, unlockAudio } from '../../services/deepgram';
import useAuthStore from '../../stores/authStore';
import { buildHealthContext } from '../../services/healthContext';
import { runReminderEngine, generateAminaGreeting } from '../../services/reminderEngine';
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
// VOICE MODE — Real-time conversational experience (Deepgram)
// ============================================================
const VoiceMode = ({ voice, onSwitchToChat }) => {
  const {
    voiceState, messages, transcript, isListening,
    error, language, micPermission, micReady,
    startConversation, retryMicPermission,
    togglePause, bargeIn, clearChat, switchLanguage,
  } = voice;

  const avatarState = useMemo(() => {
    switch (voiceState) {
      case VOICE_STATES.SPEAKING: return 'speaking';
      case VOICE_STATES.LISTENING: return 'listening';
      case VOICE_STATES.PROCESSING: return 'processing';
      case VOICE_STATES.GREETING: return 'greeting';
      case VOICE_STATES.PAUSED: return 'paused';
      case VOICE_STATES.ERROR: return 'error';
      case VOICE_STATES.IDLE: return 'idle';
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
      case VOICE_STATES.IDLE: return micReady ? 'Your Healthcare Companion' : 'Tap to start';
      case VOICE_STATES.GREETING: return 'Speaking...';
      case VOICE_STATES.LISTENING: return isListening ? 'Listening to you...' : 'Starting to listen...';
      case VOICE_STATES.PROCESSING: return 'Thinking...';
      case VOICE_STATES.SPEAKING: return 'Speaking...';
      case VOICE_STATES.PAUSED: return 'Paused';
      case VOICE_STATES.ERROR: return 'Error occurred';
      default: return 'Your Healthcare Companion';
    }
  }, [voiceState, isListening, micReady]);

  const aiConfigured = isAiConfigured();
  const deepgramConfigured = isDeepgramConfigured();
  const conversationActive = voiceState !== VOICE_STATES.IDLE || micReady;

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
          AI is not configured. Set VITE_GROQ_API_KEY in your .env file to enable Amina.
        </div>
      )}

      {!deepgramConfigured && (
        <div className={styles.warningBanner}>
          <p><strong>Voice unavailable:</strong> Set VITE_DEEPGRAM_API_KEY in your .env file to enable voice features.</p>
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)', flexWrap: 'wrap', justifyContent: 'center' }}>
            <Button size="sm" variant="outline" onClick={onSwitchToChat}>
              <MessageSquare size={14} /> Use Chat Instead
            </Button>
          </div>
        </div>
      )}

      {/* Mic permission denied — show after user tried to start */}
      {micPermission === 'denied' && conversationActive && (
        <div className={styles.permissionDeniedOverlay}>
          <div className={styles.permissionDeniedCard}>
            <MicOff size={48} style={{ color: 'var(--color-danger-500)', marginBottom: 'var(--space-3)' }} />
            <h3>Microphone Access Blocked</h3>
            <p>Your browser has blocked microphone access for this site.</p>
            <div className={styles.permissionSteps}>
              <p><strong>To enable voice chat:</strong></p>
              <ul>
                <li><strong>Chrome:</strong> Click the lock/tune icon in the address bar → Microphone → Allow</li>
                <li><strong>Safari:</strong> Safari Settings → Websites → Microphone → Allow</li>
                <li><strong>Firefox:</strong> Click the mic icon in the address bar → Allow</li>
                <li><strong>Edge:</strong> Click the lock icon in the address bar → Microphone → Allow</li>
              </ul>
              <p>After enabling, click <strong>Retry Voice</strong> below.</p>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', justifyContent: 'center' }}>
              <Button size="sm" onClick={() => { unlockAudio(); retryMicPermission(); }}>
                <Mic size={14} /> Retry Voice
              </Button>
              <Button size="sm" variant="outline" onClick={onSwitchToChat}>
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

        {/* Start button — shown when mic is not ready and no active conversation */}
        {!micReady && !conversationActive && deepgramConfigured && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}
          >
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center', maxWidth: '280px' }}>
              Amina needs microphone access to listen and respond to you.
            </p>
            <Button onClick={() => { unlockAudio(); startConversation(); }} size="lg">
              <Mic size={18} /> Start Talking with Amina
            </Button>
            <button
              onClick={onSwitchToChat}
              style={{
                background: 'none', border: 'none', color: 'var(--text-tertiary)',
                fontSize: '13px', cursor: 'pointer', textDecoration: 'underline',
              }}
            >
              Use text chat instead
            </button>
          </motion.div>
        )}
      </div>

      {/* Error */}
      {error && micPermission !== 'denied' && (
        <div className={styles.errorBanner}>
          <p>{error}</p>
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)', flexWrap: 'wrap', justifyContent: 'center' }}>
            <Button size="sm" onClick={retryMicPermission}>
              <Mic size={14} /> Retry Voice
            </Button>
            <Button size="sm" variant="outline" onClick={onSwitchToChat}>
              <MessageSquare size={14} /> Use Chat Instead
            </Button>
          </div>
        </div>
      )}

      {/* Bottom controls — only show when conversation is active */}
      {conversationActive && (
        <div className={styles.voiceControls}>
          {micPermission !== 'denied' && (
            <button className={`${styles.controlBtn} ${styles.pauseBtn}`} onClick={togglePause} title={voiceState === VOICE_STATES.PAUSED ? 'Resume' : 'Pause'}>
              {voiceState === VOICE_STATES.PAUSED ? <Play size={20} /> : <Pause size={20} />}
            </button>
          )}
          {voiceState === VOICE_STATES.SPEAKING && micPermission !== 'denied' && (
            <button className={`${styles.controlBtn} ${styles.micBtn}`} onClick={bargeIn} title="Interrupt Amina">
              <Mic size={22} />
            </button>
          )}
          <button className={`${styles.controlBtn} ${styles.endCallBtn}`} onClick={clearChat} title="End conversation">
            <PhoneOff size={22} />
          </button>
        </div>
      )}
    </div>
  );
};

// ============================================================
// CHAT MODE — Text-based conversation (manual)
// ================================================= */
const ChatMode = ({ onSwitchToVoice }) => {
  const { messages, isLoading, error, sendMessage, clearChat, language, switchLanguage, greeting } = useAminaChatChatMode();
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

  // Quick action suggestions based on health context
  const quickActions = useMemo(() => {
    if (!greeting) return [];
    const actions = [];
    if (greeting.pregnancy_week) {
      actions.push({ label: 'How is my baby developing?', icon: Heart });
      actions.push({ label: 'What should I eat this week?', icon: Baby });
    }
    actions.push({ label: 'Check vaccination schedule', icon: Baby });
    actions.push({ label: 'Any health reminders?', icon: AlertTriangle });
    return actions.slice(0, 3);
  }, [greeting]);

  return (
    <div className={styles.chatPage}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div>
            <h2 className={styles.headerTitle}>Chat with Amina</h2>
            <p className={styles.headerSubtitle}>Your personalized maternal & child healthcare companion</p>
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

          {/* Quick action suggestions */}
          {!isLoading && messages.length <= 2 && quickActions.length > 0 && (
            <div className={styles.quickActions}>
              {quickActions.map((action, i) => (
                <button
                  key={i}
                  className={styles.quickActionBtn}
                  onClick={() => sendMessage(action.label)}
                >
                  <action.icon size={14} />
                  <span>{action.label}</span>
                </button>
              ))}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}
      {sttError && <div className={styles.errorBanner}>{sttError}</div>}

      <form onSubmit={handleSubmit} className={styles.inputArea}>
        <div className={styles.inputWrapper}>
          <input ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)}
            placeholder={isListening ? 'Listening...' : 'Ask Amina about pregnancy, child health, nutrition...'}
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
  const [greeting, setGreeting] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const { profile } = useAuthStore();
  const healthContextRef = useRef('');
  const proactiveContextRef = useRef('');
  const initializedRef = useRef(false);

  const welcomeMessages = useMemo(() => ({
    en: "Hello! I'm Amina, your AI healthcare companion. I'm here to support you with pregnancy, child health, nutrition, breastfeeding, vaccination, and maternal healthcare. How can I help you today?",
    dag: "Mani n nyɛ Amina. Adaa laafee yuligu lana. Bihi alaafee yulibu lana, bihi laafeehi yulibu lana, abindira alaafee yulibu lana. Yelima wula ka nyen soŋa zaŋkpa n ni kali a binyerishaŋa?",
  }), []);

  // Build health context and generate personalized greeting on mount
  useEffect(() => {
    if (!profile?.id || !profile?.role || initializedRef.current) return;
    initializedRef.current = true;

    buildHealthContext(profile).then(ctx => {
      healthContextRef.current = ctx;

      // Extract proactive alerts
      if (ctx) {
        const alertMatch = ctx.match(/\[PROACTIVE HEALTH ALERTS[^\]]*\]\n([\s\S]*?)(?=\n===|\n\n\[|\n$)/);
        if (alertMatch) {
          proactiveContextRef.current = alertMatch[1].trim();
        }
      }

      // Generate personalized greeting for mothers
      if (profile.role === 'mother') {
        generateAminaGreeting(profile).then(greetingData => {
          if (greetingData) {
            setGreeting(greetingData);
            setMessages([{ role: 'assistant', content: greetingData.text }]);
          } else {
            setMessages([{ role: 'assistant', content: welcomeMessages.en }]);
          }
        }).catch(() => {
          setMessages([{ role: 'assistant', content: welcomeMessages.en }]);
        });
      } else {
        // For non-mother roles, use default greeting
        const roleGreeting = profile.role === 'chw'
          ? `Hello! I'm Amina. I can see you're logged in as a Community Health Worker. How can I help you today?`
          : profile.role === 'nurse'
          ? `Hello! I'm Amina. I can see you're logged in as a Nurse. How can I help you today?`
          : profile.role === 'doctor'
          ? `Hello! I'm Amina. I can see you're logged in as a Doctor. How can I help you today?`
          : `Hello! I'm Amina, your healthcare companion. How can I help you today?`;
        setMessages([{ role: 'assistant', content: roleGreeting }]);
      }
    }).catch(err => {
      console.error('Failed to build health context:', err);
      setMessages([{ role: 'assistant', content: welcomeMessages.en }]);
    });
  }, [profile?.id, profile?.role, welcomeMessages]);

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
        proactiveContext: proactiveContextRef.current,
      });
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch {
      setError('Failed to get response. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, profile?.role, language]);

  const clearChat = useCallback(() => {
    // Re-generate personalized greeting on clear
    if (profile?.role === 'mother') {
      generateAminaGreeting(profile).then(greetingData => {
        if (greetingData) {
          setMessages([{ role: 'assistant', content: greetingData.text }]);
        } else {
          setMessages([{ role: 'assistant', content: welcomeMessages[language] || welcomeMessages.en }]);
        }
      }).catch(() => {
        setMessages([{ role: 'assistant', content: welcomeMessages[language] || welcomeMessages.en }]);
      });
    } else {
      setMessages([{ role: 'assistant', content: welcomeMessages[language] || welcomeMessages.en }]);
    }
    setError(null);
  }, [language, welcomeMessages, profile]);

  const switchLanguage = useCallback((lang) => setLanguage(lang), []);

  return { messages, isLoading, error, sendMessage, clearChat, language, switchLanguage, greeting };
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
  const [voiceNotificationsEnabled, setVoiceNotificationsEnabled] = useState(true);
  const hasSpokenRemindersRef = useRef(false);

  // Run reminder engine on mount
  useEffect(() => {
    if (profile?.id) {
      runReminderEngine(profile).then((result) => {
        fetchNotifications(profile.id);
        // Auto-speak critical reminders if voice notifications enabled
        if (voiceNotificationsEnabled && result.length > 0 && !hasSpokenRemindersRef.current) {
          hasSpokenRemindersRef.current = true;
          const criticalReminders = result.filter(n => n.priority === 'critical' || n.priority === 'high');
          if (criticalReminders.length > 0 && criticalReminders[0].voice_message) {
            if (isDeepgramConfigured()) {
              deepgramSpeak(criticalReminders[0].voice_message).catch(() => {});
            }
          }
        }
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
                <div className={styles.notifActions}>
                  <button
                    className={styles.voiceNotifToggle}
                    onClick={() => setVoiceNotificationsEnabled(!voiceNotificationsEnabled)}
                    title={voiceNotificationsEnabled ? 'Voice reminders ON' : 'Voice reminders OFF'}
                  >
                    {voiceNotificationsEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                  </button>
                </div>
              </div>
              {notifications.map(n => (
                <div key={n.id} className={`${styles.notifItem} ${styles[`priority_${n.priority}`]}`}>
                  <strong>{n.title}</strong>
                  <p>{n.message}</p>
                  {n.voice_message && voiceNotificationsEnabled && (
                    <button
                      className={styles.speakNotifBtn}
                      onClick={() => {
                        if (isDeepgramConfigured()) {
                          unlockAudio();
                          deepgramSpeak(n.voice_message).catch(() => {});
                        }
                      }}
                      title="Listen to this reminder"
                    >
                      <Volume2 size={12} />
                    </button>
                  )}
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
