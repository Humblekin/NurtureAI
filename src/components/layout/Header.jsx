import { Link, useNavigate } from 'react-router-dom';
import { Menu, Heart, Bell, Moon, Sun, LogOut } from 'lucide-react';
import useAuthStore, { ROLE_LABELS } from '../../stores/authStore';
import useAppStore from '../../stores/appStore';
import styles from './Header.module.css';

export const Header = () => {
  const { profile, signOut } = useAuthStore();
  const { theme, toggleTheme, setMobileMenuOpen } = useAppStore();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth/login');
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <header className={styles.header}>
      <div className={styles.leftArea}>
        <button 
          className={styles.menuBtn}
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Open menu"
        >
          <Menu size={24} />
        </button>
        
        <Link to="/dashboard" className={styles.brand}>
          <Heart fill="currentColor" size={24} />
          <span className={styles.brandText}>NurtureAI</span>
        </Link>
      </div>

      <div className={styles.rightArea}>
        <button 
          className={styles.iconBtn} 
          onClick={toggleTheme}
          aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
        >
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
        </button>

        <button className={styles.iconBtn} aria-label="Notifications">
          <Bell size={20} />
        </button>

        <div className={styles.profileArea}>
          <div className={styles.profileInfo}>
            <span className={styles.profileName}>{profile?.full_name || 'User'}</span>
            <span className={styles.profileRole}>
              {profile?.role ? ROLE_LABELS[profile.role] : 'Loading...'}
            </span>
          </div>
          
          <div className={styles.avatar}>
            {getInitials(profile?.full_name)}
          </div>

          <button 
            className={styles.iconBtn} 
            onClick={handleSignOut}
            title="Sign out"
            style={{ marginLeft: 'var(--space-1)' }}
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
