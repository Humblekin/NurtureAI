import { useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../../stores/authStore';
import useAppStore from '../../stores/appStore';
import { setupAutoSync } from '../../lib/sync';
import Header from './Header';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import OfflineBanner from '../ui/OfflineBanner';
import Toast from '../ui/Toast';
import Spinner from '../ui/Spinner';
import styles from './AppShell.module.css';

export const AppShell = () => {
  const { isAuthenticated, isLoading, initialize } = useAuthStore();
  const initTheme = useAppStore((state) => state.initTheme);
  const setOnline = useAppStore((state) => state.setOnline);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    initTheme();
    initialize();
    setupAutoSync();

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [initTheme, initialize, setOnline]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !location.pathname.startsWith('/auth')) {
      navigate('/auth/login', { replace: true, state: { from: location.pathname } });
    }
  }, [isLoading, isAuthenticated, navigate, location]);

  if (isLoading) {
    return <Spinner fullScreen color="var(--color-primary-500)" />;
  }

  // Don't wrap auth pages in the main shell layout
  if (location.pathname.startsWith('/auth')) {
    return (
      <>
        <Outlet />
        <Toast />
      </>
    );
  }

  return (
    <div className={styles.appShell}>
      <OfflineBanner />
      <Header />
      <div className={styles.mainContent}>
        {/* Sidebar is hidden on mobile via CSS */}
        <Sidebar />
        <main className={styles.contentArea} id="main-content">
          <Outlet />
        </main>
      </div>
      {/* BottomNav is hidden on desktop via CSS */}
      <BottomNav />
      <Toast />
    </div>
  );
};

export default AppShell;
