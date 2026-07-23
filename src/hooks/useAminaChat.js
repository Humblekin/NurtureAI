import { useState, useRef, useEffect, useCallback } from 'react';
import { chatCompletion } from '../lib/groq';
import { textToSpeech, playAudio, isElevenLabsConfigured } from '../lib/tts';
import useAuthStore from '../stores/authStore';

/**
 * Voice input hook using Web Speech API (SpeechRecognition)
 */
export function useSpeechRecognition(language = 'en') {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setIsSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      // Set language based on selection
      recognition.lang = language === 'dag' ? 'ha-Latn-NG' : 'en-US';

      recognition.onresult = (event) => {
        const current = event.results[event.results.length - 1];
        const text = current[0].transcript;
        setTranscript(text);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, [language]);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      setTranscript('');
      recognitionRef.current.start();
      setIsListening(true);
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, [isListening]);

  return { isListening, transcript, isSupported, startListening, stopListening, setTranscript };
}

/**
 * Text-to-speech hook using ElevenLabs (primary) with Web Speech API fallback.
 * Produces natural African woman voice for Amina's character.
 */
export function useSpeechSynthesis(language = 'en') {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const abortRef = useRef(null);

  useEffect(() => {
    // Supported if ElevenLabs configured OR browser TTS available
    setIsSupported(isElevenLabsConfigured() || 'speechSynthesis' in window);
  }, []);

  const speak = useCallback(async (text, options = {}) => {
    if (!text) return;

    // Cancel any ongoing speech
    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = new AbortController();

    // Try ElevenLabs first (African woman voice)
    if (isElevenLabsConfigured()) {
      try {
        setIsSpeaking(true);
        const isDagbani = language === 'dag';

        const audioData = await textToSpeech(text, {
          modelId: 'eleven_multilingual_v2',
          stability: 0.5,
          similarityBoost: 0.75,
          style: 0.4,
          speed: isDagbani ? 0.9 : 1.0,
        });

        if (!abortRef.current.signal.aborted) {
          await playAudio(audioData);
        }
        setIsSpeaking(false);
        return;
      } catch (err) {
        console.error('ElevenLabs TTS error, falling back to browser TTS:', err);
      }
    }

    // Fallback: Browser Web Speech API — FEMALE VOICE ONLY
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);

      const isDagbani = language === 'dag';

      // Male voices to EXCLUDE — never use these
      const malePatterns = [
        'david', 'james', 'john', 'mike', 'daniel', 'mark', 'robert',
        'richard', 'william', 'thomas', 'christopher', 'matthew',
        'google uk english male', 'google us male',
        'microsoft david', 'microsoft mark', 'microsoft james',
        'microsoft richard', 'microsoft george',
      ];

      // Female voices to PREFER
      const femalePatterns = [
        'female', 'woman', 'girl', 'she',
        'samantha', 'zira', 'karen', 'moira', 'tessa', 'veena',
        'susan', 'sarah', 'linda', 'michelle', 'heather', 'hazel',
        'google uk english female', 'google us female',
        'microsoft zira', 'microsoft hazel', 'microsoft susan',
      ];

      const voices = window.speechSynthesis.getVoices();

      // Find any FEMALE voice — regardless of language
      // We use pitch/rate to make it sound appropriate
      let selectedVoice = null;

      // Step 1: Try British English female (closest to Ghanaian accent)
      selectedVoice = voices.find(v =>
        v.lang === 'en-GB' &&
        femalePatterns.some(f => v.name.toLowerCase().includes(f))
      );
      if (!selectedVoice) {
        selectedVoice = voices.find(v => v.lang === 'en-GB');
      }

      // Step 2: Try any English female voice
      if (!selectedVoice) {
        selectedVoice = voices.find(v =>
          v.lang.startsWith('en') &&
          femalePatterns.some(f => v.name.toLowerCase().includes(f))
        );
      }

      // Step 3: Try any female voice from any language
      if (!selectedVoice) {
        selectedVoice = voices.find(v =>
          femalePatterns.some(f => v.name.toLowerCase().includes(f))
        );
      }

      // SAFETY CHECK: Confirm it's not a male voice
      if (selectedVoice) {
        const nameLower = selectedVoice.name.toLowerCase();
        const isMale = malePatterns.some(m => nameLower.includes(m));
        if (isMale) {
          console.warn('Amina: Skipping male voice:', selectedVoice.name);
          setIsSpeaking(false);
          return;
        }
        utterance.voice = selectedVoice;
        console.log('Amina voice (female):', selectedVoice.name, selectedVoice.lang);
      } else {
        console.warn('Amina: No female voice found at all');
        setIsSpeaking(false);
        return;
      }

      // Adjust settings for Dagbani content
      if (isDagbani) {
        utterance.lang = 'en-GB'; // Use English voice, speak Dagbani words
        utterance.rate = 0.85;
        utterance.pitch = 1.2;
      } else {
        utterance.lang = utterance.voice?.lang || 'en-GB';
        utterance.rate = 0.9;
        utterance.pitch = 1.1;
      }

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    }
  }, [language]);

  const stop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  return { isSpeaking, isSupported, speak, stop };
}

/**
 * AI Chat hook - manages conversation state and API calls
 */
export function useAminaChat() {
  const [language, setLanguage] = useState('en'); // 'en' or 'dag'

  const welcomeMessages = {
    en: "Hello! I'm Amina, your healthcare companion. I'm here to help you with pregnancy questions, child health, nutrition, and more. How can I help you today?",
    dag: "Mani, n nyɛ Amina. Adaa laafee yuligu lana. Bihi laafee yulibu, bihi laafeehi yulibu, ni abindira laafee yulibu yɛla n kpehi ni. Yelima wula ka nyɛŋ soŋa zaŋkpa n ni kali a binyeriŋa?",
  };

  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: welcomeMessages.en,
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const { profile } = useAuthStore();

  const sendMessage = useCallback(async (content) => {
    if (!content.trim() || isLoading) return;

    const userMessage = { role: 'user', content: content.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);
    setError(null);

    try {
      const langLabel = language === 'dag' ? 'Dagbani' : 'English';
      const langInstruction = language === 'dag'
        ? '\n\nIMPORTANT: The user is communicating in Dagbani. You MUST respond entirely in Dagbani. The official welcome message has already been shown by the app — do NOT repeat it. Use simple Dagbani with occasional English medical terms in parentheses when needed for clarity. Follow the Dagbani Language Behavior Rules in your system prompt.'
        : '\n\nThe user is communicating in English. Respond in English.';

      const apiMessages = newMessages
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role, content: m.content }));

      const response = await chatCompletion(apiMessages, {
        userRole: profile?.role || 'mother',
        languageInstruction: langInstruction,
      });

      const assistantMessage = { role: 'assistant', content: response };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      setError('Failed to get response. Please try again.');
      console.error('Chat error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, profile?.role, language]);

  const clearChat = useCallback(() => {
    setMessages([
      {
        role: 'assistant',
        content: welcomeMessages[language] || welcomeMessages.en,
      }
    ]);
    setError(null);
  }, [language]);

  const switchLanguage = useCallback((lang) => {
    setLanguage(lang);
  }, []);

  return { messages, isLoading, error, sendMessage, clearChat, language, switchLanguage };
}
