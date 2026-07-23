import { Outlet } from 'react-router-dom';
import { Heart } from 'lucide-react';
import styles from './AuthLayout.module.css';

export const AuthLayout = () => {
  return (
    <div className={styles.layout}>
      <div className={styles.leftSide}>
        <div className={styles.brand}>
          <Heart fill="currentColor" size={32} />
          <span>NurtureAI</span>
        </div>
        
        <div className={styles.authCard}>
          <Outlet />
        </div>
      </div>
      
      <div className={styles.rightSide}>
        <div className={styles.pattern} />
        <div style={{ position: 'relative', zIndex: 10 }}>
          <h1 className={styles.tagline}>
            Empowering Maternal and Child Healthcare in Ghana.
          </h1>
          <p className={styles.description}>
            Connecting mothers, community health workers, and AI to provide timely, offline-first care and guidance.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
