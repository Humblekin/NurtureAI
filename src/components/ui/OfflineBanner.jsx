import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, CloudOff } from 'lucide-react';
import useAppStore from '../../stores/appStore';
import { isSupabaseConfigured } from '../../lib/supabase';
import styles from './OfflineBanner.module.css';

export const OfflineBanner = () => {
  const isOnline = useAppStore((state) => state.isOnline);
  const supabaseOk = isSupabaseConfigured();

  return (
    <AnimatePresence>
      {!supabaseOk && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className={`${styles.banner} ${styles.warning}`}
        >
          <CloudOff size={16} />
          <span><strong>Database unavailable:</strong> Nothing can be saved until the database is configured.</span>
        </motion.div>
      )}

      {!isOnline && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className={styles.banner}
        >
          <WifiOff size={16} />
          <span>You are offline. Reconnect before saving; unsaved changes remain only in this form.</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OfflineBanner;
