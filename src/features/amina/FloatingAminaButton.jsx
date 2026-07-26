import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X } from 'lucide-react';
import { AminaAvatar } from './avatar';
import styles from './FloatingAminaButton.module.css';

const FloatingAminaButton = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [avatarState, setAvatarState] = useState('idle');

  useEffect(() => {
    const timer = setTimeout(() => setAvatarState('greeting'), 1200);
    const idleTimer = setTimeout(() => setAvatarState('idle'), 4000);
    return () => { clearTimeout(timer); clearTimeout(idleTimer); };
  }, []);

  const handleOpen = () => {
    setIsOpen(true);
    setAvatarState('greeting');
    setTimeout(() => setAvatarState('idle'), 3000);
  };

  const handleClose = () => {
    setIsOpen(false);
    setAvatarState('idle');
  };

  const handleStartChat = () => {
    navigate('/shared/amina');
  };

  return (
    <>
      {/* Expanded panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className={styles.panel}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            <div className={styles.panelHeader}>
              <span className={styles.panelTitle}>Amina</span>
              <button className={styles.closeBtn} onClick={handleClose}>
                <X size={18} />
              </button>
            </div>
            <div className={styles.panelBody}>
              <div className={styles.avatarArea}>
                <AminaAvatar state={avatarState} emotion="happy" size="sm" />
              </div>
              <p className={styles.greeting}>Sannu! How can I help you today?</p>
              <button className={styles.startChatBtn} onClick={handleStartChat}>
                <MessageCircle size={18} />
                Start Chat
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB */}
      <motion.button
        className={styles.fab}
        onClick={isOpen ? handleClose : handleOpen}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
              <X size={24} />
            </motion.div>
          ) : (
            <motion.div key="chat" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}>
              <MessageCircle size={24} />
            </motion.div>
          )}
        </AnimatePresence>
        {!isOpen && <div className={styles.pulse} />}
      </motion.button>
    </>
  );
};

export default FloatingAminaButton;
