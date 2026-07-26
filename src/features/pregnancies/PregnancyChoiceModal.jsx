import { Heart, MessageCircle, FileText, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import Modal from '../../components/ui/Modal';
import styles from './PregnancyChoiceModal.module.css';

/**
 * PregnancyChoiceModal
 *
 * Appears when a mother clicks "Register Pregnancy" on the dashboard.
 * Offers two options:
 * 1. Fill the form manually (traditional form)
 * 2. Let Amina AI ask the questions (conversational onboarding)
 */
export const PregnancyChoiceModal = ({ isOpen, onClose, onSelectForm, onSelectAmina }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Register Pregnancy" size="md">
      <div className={styles.container}>
        <p className={styles.subtitle}>
          How would you like to register your pregnancy?
        </p>

        <div className={styles.options}>
          <motion.button
            className={styles.optionCard}
            onClick={onSelectForm}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className={`${styles.iconWrapper} ${styles.formIcon}`}>
              <FileText size={28} />
            </div>
            <div className={styles.optionContent}>
              <h3 className={styles.optionTitle}>Fill the Form</h3>
              <p className={styles.optionDescription}>
                Complete a simple form with your pregnancy details. Quick and straightforward.
              </p>
            </div>
            <ArrowRight size={18} className={styles.arrow} />
          </motion.button>

          <motion.button
            className={styles.optionCard}
            onClick={onSelectAmina}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className={`${styles.iconWrapper} ${styles.aminaIcon}`}>
              <MessageCircle size={28} />
            </div>
            <div className={styles.optionContent}>
              <h3 className={styles.optionTitle}>Chat with Amina</h3>
              <p className={styles.optionDescription}>
                Let Amina ask you questions one at a time in a friendly conversation. She'll help you fill in everything.
              </p>
            </div>
            <ArrowRight size={18} className={styles.arrow} />
          </motion.button>
        </div>

        <p className={styles.hint}>
          Both options save the same information. Choose whichever feels more comfortable for you.
        </p>
      </div>
    </Modal>
  );
};

export default PregnancyChoiceModal;
