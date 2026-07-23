import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import useAppStore from '../../stores/appStore';
import styles from './Toast.module.css';

const icons = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

export const Toast = () => {
  const toasts = useAppStore((state) => state.toasts);
  const removeToast = useAppStore((state) => state.removeToast);

  return (
    <div className={styles.toastContainer} aria-live="polite">
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = icons[toast.type] || Info;
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className={`${styles.toast} ${styles[toast.type]}`}
              role="alert"
            >
              <Icon className={styles.icon} size={20} />
              <div className={styles.content}>
                {toast.title && <div className={styles.title}>{toast.title}</div>}
                <div className={styles.message}>{toast.message}</div>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className={styles.closeButton}
                aria-label="Close notification"
              >
                <X size={16} />
              </button>
              {toast.duration > 0 && (
                <motion.div
                  className={`${styles.progressBar} ${styles[toast.type]}`}
                  initial={{ width: '100%' }}
                  animate={{ width: 0 }}
                  transition={{ duration: toast.duration / 1000, ease: 'linear' }}
                />
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export default Toast;
