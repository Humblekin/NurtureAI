import { useEffect, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../../stores/authStore';
import useAppStore from '../../stores/appStore';
import Header from './Header';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import OfflineBanner from '../ui/OfflineBanner';
import Toast from '../ui/Toast';
import Spinner from '../ui/Spinner';
import FloatingAminaButton from '../../features/amina/FloatingAminaButton';
import styles from './AppShell.module.css';

export const AppShell = () => {
  const { isAuthenticated, isLoading, initialize } = useAuthStore();
  const initTheme = useAppStore((state) => state.initTheme);
  const setOnline = useAppStore((state) => state.setOnline);
  const navigate = useNavigate();
  const location = useLocation();
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    initTheme();
    initialize();

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
        <Sidebar />
        <main className={styles.contentArea} id="main-content">
          <Outlet />
        </main>
      </div>
      <BottomNav />
      {location.pathname.startsWith('/mother') && <FloatingAminaButton />}
      <Toast />
    </div>
  );
};

export default AppShell;
