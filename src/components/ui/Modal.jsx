import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import styles from './Modal.module.css';

export const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md', // sm, md, lg, xl
  closeOnOutsideClick = true,
}) => {
  const modalRef = useRef(null);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Trap focus and prevent body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleBackdropClick = (e) => {
    if (closeOnOutsideClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <div 
        className={styles.backdrop} 
        onClick={handleBackdropClick}
        aria-modal="true"
        role="dialog"
      >
        <motion.div
          ref={modalRef}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className={`${styles.modal} ${styles[size]}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.header}>
            <h3 className={styles.title}>{title}</h3>
            <button 
              className={styles.closeBtn} 
              onClick={onClose}
              aria-label="Close modal"
            >
              <X size={20} />
            </button>
          </div>
          
          <div className={styles.body}>
            {children}
          </div>

          {footer && (
            <div className={styles.footer}>
              {footer}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
};

export default Modal;
