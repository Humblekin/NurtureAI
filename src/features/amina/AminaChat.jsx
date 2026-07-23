import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Send, Mic, MicOff, Volume2, VolumeX, Trash2, User, Globe } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAminaChat, useSpeechRecognition, useSpeechSynthesis } from '../../hooks/useAminaChat';
import { isAiConfigured } from '../../lib/groq';
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

export const AminaChat = () => {
  const { messages, isLoading, error, sendMessage, clearChat, language, switchLanguage } = useAminaChat();
  const { isListening, transcript, isSupported: sttSupported, startListening, stopListening, setTranscript } = useSpeechRecognition(language);
  const { isSpeaking, isSupported: ttsSupported, speak, stop: stopSpeaking } = useSpeechSynthesis(language);
  const [input, setInput] = useState('');
  const [autoSpeak, setAutoSpeak] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const prevLangRef = useRef(language);
  const lastSpokenIdxRef = useRef(-1);

  // Determine avatar state
  const avatarState = useMemo(() => {
    if (isLoading) return 'speaking';
    if (isSpeaking) return 'speaking';
    if (isListening) return 'listening';
    return 'idle';
  }, [isLoading, isSpeaking, isListening]);

  // Determine emotion based on last message
  const avatarEmotion = useMemo(() => {
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role === 'user') return 'neutral';
    const content = lastMsg.content.toLowerCase();
    if (content.includes('congratulations') || content.includes('great') || content.includes('healthy')) return 'happy';
    if (content.includes('concern') || content.includes('urgent') || content.includes('warning') || content.includes('risk')) return 'concerned';
    return 'neutral';
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    if (transcript) {
      setInput(transcript);
    }
  }, [transcript]);

  // Auto-speak welcome message when language changes to Dagbani
  useEffect(() => {
    if (prevLangRef.current !== language && language === 'dag') {
      const dagbaniWelcome = "Mani, n nyɛ Amina. Adaa laafee yuligu lana. Bihi laafee yulibu, bihi laafeehi yulibu, ni abindira laafee yulibu yɛla n kpehi ni. Yelima wula ka nyɛŋ soŋa zaŋkpa n ni kali a binyeriŋa?";
      setTimeout(() => speak(dagbaniWelcome), 600);
    }
    if (prevLangRef.current !== language && language === 'en') {
      const englishWelcome = "Hello! I'm Amina, your healthcare companion. I'm here to help you with pregnancy questions, child health, nutrition, and more. How can I help you today?";
      setTimeout(() => speak(englishWelcome), 600);
    }
    prevLangRef.current = language;
  }, [language, speak]);

  // Auto-speak Amina's responses
  useEffect(() => {
    if (!autoSpeak || isSpeaking || isLoading) return;
    const lastAssistantIdx = [...messages].findLastIndex(m => m.role === 'assistant');
    if (lastAssistantIdx > 0 && lastAssistantIdx !== lastSpokenIdxRef.current) {
      lastSpokenIdxRef.current = lastAssistantIdx;
      const text = messages[lastAssistantIdx].content;
      setTimeout(() => speak(text), 400);
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

  const handleVoiceToggle = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleSpeakLast = () => {
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
    if (lastAssistant) {
      if (isSpeaking) {
        stopSpeaking();
      } else {
        speak(lastAssistant.content);
      }
    }
  };

  const aiConfigured = isAiConfigured();

  return (
    <div className={styles.chatPage}>
      {/* 3D Avatar Section */}
      <div className={styles.avatarSection}>
        <div className={styles.avatarScene}>
          <AminaAvatar 
            state={avatarState}
            emotion={avatarEmotion}
          />
        </div>
        <div className={styles.avatarInfo}>
          <h2 className={styles.aminaName}>Amina</h2>
          <p className={styles.aminaStatus}>
            {avatarState === 'speaking' ? (isSpeaking ? 'Speaking...' : 'Thinking...') : 
             avatarState === 'listening' ? 'Listening to you...' : 
             'Your Healthcare Companion'}
          </p>
        </div>
      </div>

      {/* Chat Section */}
      <div className={styles.chatSection}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div>
              <h2 className={styles.headerTitle}>Chat with Amina</h2>
              <p className={styles.headerSubtitle}>Ask anything about maternal & child health</p>
            </div>
          </div>
          <div className={styles.headerActions}>
            {/* Language Selector */}
            <div className={styles.languageSelector}>
              <Globe size={14} style={{ color: 'var(--text-tertiary)' }} />
              <button
                onClick={() => switchLanguage('en')}
                className={`${styles.langBtn} ${language === 'en' ? styles.langBtnActive : ''}`}
              >
                EN
              </button>
              <button
                onClick={() => switchLanguage('dag')}
                className={`${styles.langBtn} ${language === 'dag' ? styles.langBtnActive : ''}`}
              >
                DAG
              </button>
            </div>
            {ttsSupported && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setAutoSpeak(!autoSpeak)}
                title={autoSpeak ? 'Auto-speak ON' : 'Auto-speak OFF'}
                style={{ color: autoSpeak ? 'var(--color-primary-500)' : 'var(--text-tertiary)' }}
              >
                {autoSpeak ? <Volume2 size={18} /> : <VolumeX size={18} />}
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={clearChat} title="Clear chat">
              <Trash2 size={18} />
            </Button>
          </div>
        </div>

        {!aiConfigured && (
          <div className={styles.warningBanner}>
            AI is not configured. Set VITE_OPENROUTER_API_KEY in your .env file to enable Amina.
          </div>
        )}

        {/* Messages */}
        <div className={styles.messagesArea}>
          <div className={styles.messagesInner}>
            {messages.map((msg, i) => (
              <MessageBubble key={i} message={msg} />
            ))}
            {isLoading && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className={styles.errorBanner}>{error}</div>
        )}

        {/* Input */}
        <form onSubmit={handleSubmit} className={styles.inputArea}>
          <div className={styles.inputWrapper}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isListening ? (language === 'dag' ? 'Na yeyi...' : 'Listening...') : (language === 'dag' ? 'Yi ni Amina ni hewali...' : 'Ask Amina anything about health...')}
              className={styles.textInput}
              disabled={isLoading}
            />
            {sttSupported && (
              <button
                type="button"
                onClick={handleVoiceToggle}
                className={`${styles.voiceBtn} ${isListening ? styles.voiceBtnActive : ''}`}
                title={isListening ? 'Stop listening' : 'Start voice input'}
              >
                {isListening ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
            )}
            <button
              type="submit"
              className={styles.sendBtn}
              disabled={!input.trim() || isLoading}
            >
              <Send size={20} />
            </button>
          </div>
          <p className={styles.disclaimer}>
            Amina is not a doctor. Always consult a healthcare professional for medical advice.
          </p>
        </form>
      </div>
    </div>
  );
};

export default AminaChat;
