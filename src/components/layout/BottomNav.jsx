import { NavLink } from 'react-router-dom';
import { Home, Users, MessageCircle, Calendar, Settings } from 'lucide-react';
import useAuthStore, { ROLES } from '../../stores/authStore';
import styles from './BottomNav.module.css';

// Simplistic 5-tab mobile nav configuration
const getMobileNavConfig = (role) => {
  const aminaTab = { name: 'Amina', path: '/amina', icon: MessageCircle };
  const settingsTab = { name: 'Settings', path: '/settings', icon: Settings };

  switch (role) {
    case ROLES.MOTHER:
      return [
        { name: 'Home', path: '/dashboard', icon: Home },
        { name: 'Health', path: '/health', icon: Calendar },
        aminaTab,
        { name: 'Children', path: '/children', icon: Users },
        settingsTab,
      ];
    case ROLES.CHW:
      return [
        { name: 'Home', path: '/dashboard', icon: Home },
        { name: 'Patients', path: '/mothers', icon: Users },
        aminaTab,
        { name: 'Visits', path: '/visits', icon: Calendar },
        settingsTab,
      ];
    case ROLES.NURSE:
    case ROLES.DOCTOR:
      return [
        { name: 'Home', path: '/dashboard', icon: Home },
        { name: 'Patients', path: '/mothers', icon: Users },
        aminaTab,
        { name: 'Appointments', path: '/appointments', icon: Calendar },
        settingsTab,
      ];
    case ROLES.DISTRICT_OFFICER:
    case ROLES.ADMIN:
      return [
        { name: 'Home', path: '/dashboard', icon: Home },
        { name: 'Reports', path: '/reports', icon: Users },
        aminaTab,
        { name: 'Facilities', path: '/admin/facilities', icon: Calendar },
        settingsTab,
      ];
    default:
      return [
        { name: 'Home', path: '/dashboard', icon: Home },
        aminaTab,
        settingsTab,
      ];
  }
};

export const BottomNav = () => {
  const profile = useAuthStore((state) => state.profile);
  const navItems = getMobileNavConfig(profile?.role);

  return (
    <nav className={styles.bottomNav}>
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
          >
            <Icon size={24} strokeWidth={2} />
            <span className={styles.label}>{item.name}</span>
          </NavLink>
        );
      })}
    </nav>
  );
};

export default BottomNav;
