import { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeft, Send, Mic, MicOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../stores/authStore';
import { chatCompletion } from '../../lib/groq';
import { useSpeechRecognition, useSpeechSynthesis } from '../../hooks/useAminaChat';
import { buildHealthContext } from '../../services/healthContext';
import Button from '../../components/ui/Button';
import styles from './PregnancyAminaFlow.module.css';

/**
 * PregnancyAminaFlow
 *
 * A conversational pregnancy registration flow powered by Amina AI.
 * Only asks pregnancy-related questions (the mother already has a profile).
 * After completion, creates a pregnancy record and navigates to dashboard.
 */
const PREGNANCY_QUESTIONS = [
  {
    id: 'is_pregnant',
    text: "Let's start with the basics. Are you currently pregnant?",
    textDag: "Mu fara da abubuwan da suka fi muhimmanci. Kana ciki a yanzu?",
    field: 'is_pregnant',
    type: 'choice',
  },
  {
    id: 'lmp',
    text: "When was the first day of your last menstrual period? This helps me know how far along you are. You can say something like '15th January 2026'.",
    textDag: "Yaushe ne ranar fara jinin ka na ƙarshe? Wannan yana taimaka mana mu san yawan watankin ciki. Za ka iya cewa '15 ga watan Janairu 2026'.",
    field: 'lmp',
    type: 'date',
  },
  {
    id: 'is_first_pregnancy',
    text: "Is this your first pregnancy?",
    textDag: "Shin wannan shine fara cikin ka?",
    field: 'is_first_pregnancy',
    type: 'choice',
  },
  {
    id: 'gravida',
    text: "How many times have you been pregnant in total, including this current pregnancy?",
    textDag: "Yaya yawan cikin ka gaba ɗaya, gami da wannan cikin yanzu?",
    field: 'gravida',
    type: 'number',
  },
  {
    id: 'para',
    text: "How many babies have you delivered that survived?",
    textDag: "Yaya yawan 'ya'yan da ka haife sun rai?",
    field: 'para',
    type: 'number',
  },
  {
    id: 'previous_complications',
    text: "Have you had any complications in previous pregnancies? For example, high blood pressure, excessive bleeding, or premature delivery?",
    textDag: "Kana da wani irin matsala a cikin ka na baya? Misali, ƙwanƙwasa jini, yawan jini, ko haifar da ƙaramin ƙwaƙƙwara?",
    field: 'previous_complications',
    type: 'text',
  },
  {
    id: 'existing_conditions',
    text: "Do you have any existing medical conditions? For example, high blood pressure, diabetes, asthma, or sickle cell?",
    textDag: "Kana da wani irin cuta? Misali, ƙwanƙwasa jini, sugar, Asthma, ko Sickle Cell?",
    field: 'existing_conditions',
    type: 'text',
  },
  {
    id: 'blood_group',
    text: "Do you know your blood group? For example, O positive, A negative, or AB positive?",
    textDag: "Ka san irin jinin ka? Misali, O positive, A negative, ko AB positive?",
    field: 'blood_group',
    type: 'text',
  },
  {
    id: 'previous_anc',
    text: "Have you attended any antenatal care (ANC) visits during this pregnancy?",
    textDag: "Ka taɓa ziyarce wani asibit a lokacin cikin ka?",
    field: 'previous_anc',
    type: 'choice',
  },
  {
    id: 'supplements',
    text: "Are you taking any supplements like iron or folic acid?",
    textDag: "Kana ɗauke da wani irin ƙarin abinci kamar iron ko folic acid?",
    field: 'supplements',
    type: 'choice',
  },
];

function calculateEDDFromLMP(lmp) {
  if (!lmp) return null;
  const start = new Date(lmp);
  start.setDate(start.getDate() + 280);
  return start.toISOString().split('T')[0];
}

const PregnancyAminaFlow = () => {
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const [language, setLanguage] = useState('en');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [collectedData, setCollectedData] = useState({});
  const [questionIndex, setQuestionIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [summary, setSummary] = useState('');
  const messagesEndRef = useRef(null);
  const healthContextRef = useRef('');

  const { isListening, transcript, isSupported: sttSupported, startListening, stopListening, setTranscript } = useSpeechRecognition(language);
  const { isSpeaking, speak } = useSpeechSynthesis(language);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  // Build health context
  useEffect(() => {
    if (profile?.id && profile?.role) {
      buildHealthContext(profile).then(ctx => {
        healthContextRef.current = ctx;
      }).catch(() => {});
    }
  }, [profile]);

  // Start conversation
  useEffect(() => {
    if (messages.length === 0) {
      const greeting = language === 'dag'
        ? "Sannu! Ni ce Amina, abokiyar ki ta lafiya. Zan taimaka wa ki yi rajista ta cikin ki a hankali. Mu fara!"
        : "Hello! I'm Amina, your healthcare companion. I'll help you register your pregnancy step by step. Let's begin!";

      const firstQ = PREGNANCY_QUESTIONS[0];
      const firstText = language === 'dag' ? firstQ.textDag : firstQ.text;

      setMessages([
        { role: 'assistant', content: greeting },
        { role: 'assistant', content: firstText },
      ]);
    }
  }, [language, messages.length]);

  // Auto-speak new assistant messages
  useEffect(() => {
    if (!isSpeaking && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role === 'assistant') {
        setTimeout(() => speak(lastMsg.content), 400);
      }
    }
  }, [messages, isSpeaking, speak]);

  const getCurrentQuestion = () => {
    if (questionIndex >= PREGNANCY_QUESTIONS.length) return null;
    return PREGNANCY_QUESTIONS[questionIndex];
  };

  const processResponse = async (userResponse) => {
    const question = getCurrentQuestion();
    if (!question) return;

    // Store response
    const newData = { ...collectedData, [question.field]: userResponse };
    setCollectedData(newData);

    // Move to next question
    const nextIndex = questionIndex + 1;
    setQuestionIndex(nextIndex);

    if (nextIndex >= PREGNANCY_QUESTIONS.length) {
      // All questions answered — show summary
      buildSummary(newData);
      return;
    }

    // Generate natural follow-up with AI
    const nextQuestion = PREGNANCY_QUESTIONS[nextIndex];
    const langInstruction = language === 'dag'
      ? '\n\nIMPORTANT: The user is communicating in Dagbani. Respond entirely in Dagbani.'
      : '\n\nThe user is communicating in English. Respond in English.';

    const prompt = `You are Amina, a warm healthcare AI companion in Ghana. You are guiding a mother through pregnancy registration.

The mother just answered:
Previous question: "${question.text}"
Her answer: "${userResponse}"

Now ask the next question naturally. DO NOT just repeat the question. Create a natural conversational transition.

Next question: "${language === 'dag' ? nextQuestion.textDag : nextQuestion.text}"

Rules:
- Be warm and encouraging
- Acknowledge her answer briefly (1 sentence)
- Ask the next question naturally
- Keep it brief (2-3 sentences)
- ${langInstruction}`;

    try {
      const response = await chatCompletion(
        [
          { role: 'system', content: 'You are Amina, a warm healthcare AI companion. Be natural and caring.' },
          { role: 'user', content: prompt },
        ],
        { temperature: 0.7, maxTokens: 150 }
      );
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: language === 'dag' ? nextQuestion.textDag : nextQuestion.text }]);
    }
  };

  const buildSummary = (data) => {
    const lines = [];
    if (data.lmp) {
      const lmpDate = new Date(data.lmp);
      const now = new Date();
      const weeks = Math.floor((now - lmpDate) / (1000 * 60 * 60 * 24 * 7));
      lines.push(`Last Menstrual Period: ${data.lmp} (~${weeks} weeks ago)`);
      const edd = calculateEDDFromLMP(data.lmp);
      if (edd) lines.push(`Estimated Due Date: ${edd}`);
    }
    if (data.is_first_pregnancy) lines.push(`First pregnancy: ${data.is_first_pregnancy}`);
    if (data.gravida) lines.push(`Total pregnancies: ${data.gravida}`);
    if (data.para) lines.push(`Previous deliveries: ${data.para}`);
    if (data.previous_complications) lines.push(`Previous complications: ${data.previous_complications}`);
    if (data.existing_conditions) lines.push(`Medical conditions: ${data.existing_conditions}`);
    if (data.blood_group) lines.push(`Blood group: ${data.blood_group}`);
    if (data.previous_anc) lines.push(`Previous ANC visits: ${data.previous_anc}`);
    if (data.supplements) lines.push(`Taking supplements: ${data.supplements}`);

    setSummary(lines.join('\n'));
    setIsComplete(true);

    const confirmMsg = language === 'dag'
      ? "An gama! Ga takaitaccen bayanin ki. Idan kyau, danna 'Tabbatar'. Idan kuna son canza wani abu, danna 'Gyara'."
      : "All done! Here's a summary of your pregnancy information. If everything looks correct, tap 'Confirm'. If you need to change anything, tap 'Edit'.";

    setMessages(prev => [...prev, { role: 'assistant', content: confirmMsg }]);
  };

  const handleConfirm = async () => {
    setIsSaving(true);
    try {
      // Save pregnancy via store
      const { default: usePregnancyStore } = await import('../../stores/pregnancyStore');
      const { registerPregnancy } = usePregnancyStore.getState();

      const lmpDate = collectedData.lmp || null;
      const edd = calculateEDDFromLMP(lmpDate);

      const pregnancyData = {
        lmp: lmpDate,
        edd: edd,
        gravida: parseInt(collectedData.gravida) || 1,
        para: parseInt(collectedData.para) || 0,
        risk_level: 'low',
        notes: [
          collectedData.previous_complications ? `Previous complications: ${collectedData.previous_complications}` : null,
          collectedData.existing_conditions ? `Medical conditions: ${collectedData.existing_conditions}` : null,
          collectedData.blood_group ? `Blood group: ${collectedData.blood_group}` : null,
          collectedData.supplements === 'Yes' ? 'Taking supplements' : null,
        ].filter(Boolean).join('. ') || null,
      };

      const result = await registerPregnancy(pregnancyData);

      if (result.success) {
        const successMsg = language === 'dag'
          ? "An yi nasara! An rubuta cikin ki. Zan kai ki zuwa dashen gida."
          : "Pregnancy registered successfully! Taking you to your dashboard.";

        setMessages(prev => [...prev, { role: 'assistant', content: successMsg }]);
        setTimeout(() => navigate('/mother/dashboard', { replace: true }), 1500);
      } else {
        const errorMsg = language === 'dag'
          ? "Wani abu ya faru. Da fatan za a sake gwadawa."
          : "Something went wrong. Please try again.";
        setMessages(prev => [...prev, { role: 'assistant', content: errorMsg }]);
      }
    } catch {
      const errorMsg = language === 'dag'
        ? "Wani abu ya faru. Da fatan za a sake gwadawa."
        : "Something went wrong. Please try again.";
      setMessages(prev => [...prev, { role: 'assistant', content: errorMsg }]);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSend = () => {
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput('');
    setTranscript('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    processResponse(userMsg).finally(() => setIsLoading(false));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={styles.onboardingPage}>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/mother/dashboard')}>
          <ArrowLeft size={20} />
        </button>
        <div className={styles.headerCenter}>
          <h2 className={styles.headerTitle}>Pregnancy Registration</h2>
          <p className={styles.headerSubtitle}>Chat with Amina</p>
        </div>
        <div className={styles.langToggle}>
          <button onClick={() => setLanguage('en')} className={`${styles.langBtn} ${language === 'en' ? styles.langBtnActive : ''}`}>EN</button>
          <button onClick={() => setLanguage('dag')} className={`${styles.langBtn} ${language === 'dag' ? styles.langBtnActive : ''}`}>DAG</button>
        </div>
      </div>

      {/* Messages */}
      <div className={styles.messagesArea}>
        <div className={styles.messagesInner}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`${styles.message} ${msg.role === 'user' ? styles.userMessage : styles.assistantMessage}`}
            >
              {msg.role === 'assistant' && (
                <div className={styles.avatarBubble}>
                  <span style={{ fontSize: '14px' }}>A</span>
                </div>
              )}
              <div className={`${styles.bubble} ${msg.role === 'user' ? styles.userBubble : styles.assistantBubble}`}>
                <p className={styles.messageText}>{msg.content}</p>
              </div>
            </motion.div>
          ))}
          {isLoading && (
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
          )}

          {/* Summary display */}
          {isComplete && summary && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={styles.summaryCard}
            >
              <h4 className={styles.summaryTitle}>Pregnancy Summary</h4>
              <div className={styles.summaryContent}>
                {summary.split('\n').map((line, i) => (
                  <p key={i} className={styles.summaryLine}>{line}</p>
                ))}
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className={styles.inputArea}>
        {isComplete ? (
          <div className={styles.confirmActions}>
            <Button
              variant="outline"
              onClick={() => {
                setIsComplete(false);
                setSummary('');
                setQuestionIndex(0);
                setCollectedData({});
                const firstQ = PREGNANCY_QUESTIONS[0];
                setMessages([
                  { role: 'assistant', content: language === 'dag' ? "To, mu sake farawa." : "Okay, let's start over." },
                  { role: 'assistant', content: language === 'dag' ? firstQ.textDag : firstQ.text },
                ]);
              }}
            >
              Edit
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Confirm'}
            </Button>
          </div>
        ) : (
          <div className={styles.inputWrapper}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isListening ? 'Listening...' : 'Type your answer...'}
              className={styles.textInput}
              disabled={isLoading}
            />
            {sttSupported && (
              <button
                type="button"
                onClick={() => isListening ? stopListening() : startListening()}
                className={`${styles.voiceBtn} ${isListening ? styles.voiceBtnActive : ''}`}
              >
                {isListening ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
            )}
            <button
              type="button"
              onClick={handleSend}
              className={styles.sendBtn}
              disabled={!input.trim() || isLoading}
            >
              <Send size={20} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PregnancyAminaFlow;
