import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MessageCircle, FileText, Sparkles } from 'lucide-react';
import useAuthStore from '../../stores/authStore';
import { AminaAvatar } from '../amina/avatar';
import styles from './MotherWelcome.module.css';

const MotherWelcome = () => {
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const [language, setLanguage] = useState('en');
  const [avatarState, setAvatarState] = useState('initializing');

  const firstName = profile?.full_name?.split(' ')[0] || 'there';

  useEffect(() => {
    const timer = setTimeout(() => setAvatarState('greeting'), 800);
    const idleTimer = setTimeout(() => setAvatarState('idle'), 3500);
    return () => { clearTimeout(timer); clearTimeout(idleTimer); };
  }, []);

  const handleTalkWithAmina = () => {
    navigate('/mother/onboarding', { state: { mode: 'voice', language } });
  };

  const handleFillForm = () => {
    navigate('/mother/onboarding/form', { state: { language } });
  };

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        {/* Avatar */}
        <motion.div
          className={styles.avatarSection}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <div className={styles.avatarGlow} />
          <div className={styles.avatarWrapper}>
            <AminaAvatar state={avatarState} emotion="happy" />
          </div>
        </motion.div>

        {/* Welcome text */}
        <motion.div
          className={styles.textSection}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <h1 className={styles.title}>
            {language === 'dag' ? 'Barka da zuwa, ' : 'Welcome, '}
            <span className={styles.nameHighlight}>{firstName}</span>!
          </h1>
          <p className={styles.subtitle}>
            {language === 'dag'
              ? 'Ni ce Amina, abokiyar ki ta lafiya. Zan taimaka wa ki kirkira littafin ki na lafiya domin hanji ki a shawarar ciki da haruffan da ke zuwa.'
              : "I'm Amina, your healthcare companion. I'll help you set up your health profile so I can support you throughout your pregnancy and beyond."}
          </p>
        </motion.div>

        {/* Option cards */}
        <motion.div
          className={styles.optionsSection}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
        >
          <button className={styles.optionCard} onClick={handleTalkWithAmina}>
            <div className={`${styles.iconCircle} ${styles.iconVoice}`}>
              <MessageCircle size={24} />
            </div>
            <div className={styles.optionContent}>
              <h3 className={styles.optionTitle}>
                {language === 'dag' ? 'Yi magana da Amina' : 'Talk With Amina'}
                <span className={styles.recommendedBadge}>
                  {language === 'dag' ? 'An shawarta' : 'Recommended'}
                </span>
              </h3>
              <p className={styles.optionDesc}>
                {language === 'dag'
                  ? 'Zan tambayi ki tambayi daya bayan daya a hanyar magana mai kyau. Za ki iya magana ko rubuta.'
                  : "I'll ask you questions one at a time in a friendly conversation. You can speak or type your answers."}
              </p>
            </div>
            <Sparkles size={18} className={styles.optionArrow} />
          </button>

          <button className={styles.optionCard} onClick={handleFillForm}>
            <div className={`${styles.iconCircle} ${styles.iconForm}`}>
              <FileText size={24} />
            </div>
            <div className={styles.optionContent}>
              <h3 className={styles.optionTitle}>
                {language === 'dag' ? 'Cika fom ɗin da kanka' : 'Fill the Form Myself'}
              </h3>
              <p className={styles.optionDesc}>
                {language === 'dag'
                  ? 'Cika fom ɗin a kan sauri. Za a adana ci gaban ki koda ta yaya.'
                  : 'Complete a structured form at your own pace. Your progress is saved automatically.'}
              </p>
            </div>
          </button>
        </motion.div>

        {/* Language toggle */}
        <motion.div
          className={styles.langSection}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.4 }}
        >
          <button
            className={`${styles.langBtn} ${language === 'en' ? styles.langBtnActive : ''}`}
            onClick={() => setLanguage('en')}
          >
            English
          </button>
          <span className={styles.langDivider}>|</span>
          <button
            className={`${styles.langBtn} ${language === 'dag' ? styles.langBtnActive : ''}`}
            onClick={() => setLanguage('dag')}
          >
            Dagbani
          </button>
        </motion.div>
      </div>
    </div>
  );
};

export default MotherWelcome;
