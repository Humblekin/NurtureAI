import { NavLink } from 'react-router-dom';
import { Home, Users, Baby, Calendar, MessageCircle, Settings, Heart, Activity, HeartPulse, ClipboardList, Building2, FileText } from 'lucide-react';
import useAuthStore, { ROLES } from '../../stores/authStore';
import styles from './BottomNav.module.css';

const getMobileNavConfig = (role) => {
  switch (role) {
    case ROLES.MOTHER:
      return [
        { name: 'Amina', path: '/mother/amina', icon: MessageCircle },
        { name: 'Home', path: '/mother/dashboard', icon: Home },
        { name: 'Health', path: '/mother/pregnancy', icon: Heart },
        { name: 'Children', path: '/mother/children', icon: Baby },
        { name: 'Settings', path: '/shared/settings', icon: Settings },
      ];

    case ROLES.CHW:
      return [
        { name: 'Home', path: '/chw/dashboard', icon: Home },
        { name: 'Mothers', path: '/chw/mothers', icon: Users },
        { name: 'Amina', path: '/shared/amina', icon: MessageCircle },
        { name: 'Visits', path: '/chw/visits', icon: Calendar },
        { name: 'Settings', path: '/shared/settings', icon: Settings },
      ];

    case ROLES.NURSE:
      return [
        { name: 'Home', path: '/nurse/dashboard', icon: Home },
        { name: 'Patients', path: '/nurse/mothers', icon: Users },
        { name: 'Amina', path: '/shared/amina', icon: MessageCircle },
        { name: 'ANC', path: '/nurse/anc', icon: HeartPulse },
        { name: 'Settings', path: '/shared/settings', icon: Settings },
      ];

    case ROLES.DOCTOR:
      return [
        { name: 'Home', path: '/doctor/dashboard', icon: Home },
        { name: 'Patients', path: '/doctor/mothers', icon: Users },
        { name: 'Visits', path: '/doctor/visits', icon: Calendar },
        { name: 'Referrals', path: '/doctor/referrals', icon: ClipboardList },
        { name: 'Settings', path: '/shared/settings', icon: Settings },
      ];

    case ROLES.DISTRICT_OFFICER:
      return [
        { name: 'Home', path: '/district/dashboard', icon: Home },
        { name: 'Facilities', path: '/district/facilities', icon: Building2 },
        { name: 'Amina', path: '/shared/amina', icon: MessageCircle },
        { name: 'Reports', path: '/district/reports', icon: FileText },
        { name: 'Settings', path: '/shared/settings', icon: Settings },
      ];

    case ROLES.ADMIN:
      return [
        { name: 'Home', path: '/admin/dashboard', icon: Home },
        { name: 'Users', path: '/admin/users', icon: Users },
        { name: 'Amina', path: '/shared/amina', icon: MessageCircle },
        { name: 'Facilities', path: '/admin/facilities', icon: Activity },
        { name: 'Settings', path: '/shared/settings', icon: Settings },
      ];

    default:
      return [
        { name: 'Home', path: '/dashboard', icon: Home },
        { name: 'Amina', path: '/shared/amina', icon: MessageCircle },
        { name: 'Settings', path: '/shared/settings', icon: Settings },
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
            <Icon size={20} />
            <span className={styles.navLabel}>{item.name}</span>
          </NavLink>
        );
      })}
    </nav>
  );
};

export default BottomNav;
