import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, RefreshCw } from 'lucide-react';
import useAppStore from '../../stores/appStore';
import styles from './OfflineBanner.module.css';

export const OfflineBanner = () => {
  const isOnline = useAppStore((state) => state.isOnline);
  const syncStatus = useAppStore((state) => state.syncStatus);

  return (
    <AnimatePresence>
      {(!isOnline || syncStatus === 'syncing') && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className={`${styles.banner} ${syncStatus === 'syncing' ? styles.syncing : ''}`}
        >
          {!isOnline ? (
            <>
              <WifiOff size={16} />
              <span>You are offline. Changes will be saved locally and synced when connected.</span>
            </>
          ) : (
            <>
              <RefreshCw size={16} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
              <span>Syncing data with NurtureAI secure servers...</span>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OfflineBanner;
