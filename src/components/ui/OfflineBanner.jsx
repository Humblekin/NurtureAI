import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, RefreshCw, AlertTriangle, CloudOff } from 'lucide-react';
import useAppStore from '../../stores/appStore';
import { isSupabaseConfigured } from '../../lib/supabase';
import styles from './OfflineBanner.module.css';

export const OfflineBanner = () => {
  const isOnline = useAppStore((state) => state.isOnline);
  const syncStatus = useAppStore((state) => state.syncStatus);
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
          <span><strong>Offline mode:</strong> Data stays on this device only. Cloud sync is not configured.</span>
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
          <span>You are offline. Changes will be saved locally and synced when connected.</span>
        </motion.div>
      )}

      {isOnline && syncStatus === 'syncing' && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className={`${styles.banner} ${styles.syncing}`}
        >
          <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
          <span>Syncing data with cloud servers...</span>
        </motion.div>
      )}

      {isOnline && syncStatus === 'error' && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className={`${styles.banner} ${styles.error}`}
        >
          <AlertTriangle size={16} />
          <span>Sync failed. Some changes may not have been saved to the cloud.</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OfflineBanner;
