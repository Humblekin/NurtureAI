import { NavLink } from 'react-router-dom';
import { 
  Home, Users, Baby, Calendar, Activity, Heart,
  FileText, Settings, HeartPulse, Stethoscope, MessageCircle, 
  ChevronLeft, ChevronRight, Archive, Building2, ClipboardList,
  User, Map
} from 'lucide-react';
import useAuthStore, { ROLES } from '../../stores/authStore';
import useAppStore from '../../stores/appStore';
import styles from './Sidebar.module.css';

const getNavConfig = (role) => {
  switch (role) {
    case ROLES.MOTHER:
      return [
        { name: 'Home', path: '/mother/dashboard', icon: Home },
        { name: 'Health Journey', path: '/mother/timeline', icon: Map },
        { name: 'My Pregnancy', path: '/mother/pregnancy', icon: Heart },
        { name: 'My Children', path: '/mother/children', icon: Baby },
        { name: 'Appointments', path: '/mother/appointments', icon: Calendar },
        { name: 'Chat with Amina', path: '/shared/amina', icon: MessageCircle },
        { name: 'My Profile', path: '/shared/settings', icon: User },
      ];

    case ROLES.CHW:
      return [
        { name: 'Dashboard', path: '/chw/dashboard', icon: Home },
        { name: 'Mothers', path: '/chw/mothers', icon: Users },
        { name: 'Children', path: '/chw/children', icon: Baby },
        { name: 'Home Visits', path: '/chw/visits', icon: Calendar },
        { name: 'Referrals', path: '/chw/referrals', icon: Activity },
        { name: 'Chat with Amina', path: '/shared/amina', icon: MessageCircle },
        { name: 'Profile', path: '/shared/settings', icon: Settings },
      ];

    case ROLES.NURSE:
      return [
        { name: 'Dashboard', path: '/nurse/dashboard', icon: Home },
        { name: 'Patients', path: '/nurse/mothers', icon: Users },
        { name: 'ANC Visits', path: '/nurse/anc', icon: HeartPulse },
        { name: 'Appointments', path: '/nurse/appointments', icon: Calendar },
        { name: 'Referrals', path: '/nurse/referrals', icon: Stethoscope },
        { name: 'Reports', path: '/nurse/reports', icon: FileText },
        { name: 'Chat with Amina', path: '/shared/amina', icon: MessageCircle },
        { name: 'Profile', path: '/shared/settings', icon: Settings },
      ];

    case ROLES.DOCTOR:
      return [
        { name: 'Dashboard', path: '/doctor/dashboard', icon: Home },
        { name: 'Patients', path: '/doctor/mothers', icon: Users },
        { name: 'Referrals', path: '/doctor/referrals', icon: ClipboardList },
        { name: 'Reports', path: '/doctor/reports', icon: FileText },
        { name: 'Chat with Amina', path: '/shared/amina', icon: MessageCircle },
        { name: 'Profile', path: '/shared/settings', icon: Settings },
      ];

    case ROLES.DISTRICT_OFFICER:
      return [
        { name: 'Dashboard', path: '/district/dashboard', icon: Home },
        { name: 'Facilities', path: '/district/facilities', icon: Building2 },
        { name: 'Reports', path: '/district/reports', icon: FileText },
        { name: 'Users', path: '/district/users', icon: Users },
        { name: 'Chat with Amina', path: '/shared/amina', icon: MessageCircle },
        { name: 'Profile', path: '/shared/settings', icon: Settings },
      ];

    case ROLES.ADMIN:
      return [
        { name: 'Dashboard', path: '/admin/dashboard', icon: Home },
        { name: 'Users', path: '/admin/users', icon: Users },
        { name: 'Mothers', path: '/admin/mothers', icon: Users },
        { name: 'Children', path: '/admin/children', icon: Baby },
        { name: 'Facilities', path: '/admin/facilities', icon: Building2 },
        { name: 'Referrals', path: '/admin/referrals', icon: Activity },
        { name: 'Reports', path: '/admin/reports', icon: FileText },
        { name: 'Archive', path: '/admin/archive', icon: Archive },
        { name: 'Settings', path: '/shared/settings', icon: Settings },
      ];

    default:
      return [{ name: 'Dashboard', path: '/dashboard', icon: Home }];
  }
};

export const Sidebar = () => {
  const profile = useAuthStore((state) => state.profile);
  const { sidebarCollapsed, collapseSidebar, mobileMenuOpen, setMobileMenuOpen } = useAppStore();

  const navItems = getNavConfig(profile?.role);

  const sidebarClasses = [
    styles.sidebar,
    sidebarCollapsed && styles.collapsed,
    mobileMenuOpen && styles.mobileOpen
  ].filter(Boolean).join(' ');

  return (
    <>
      <div 
        className={`${styles.overlay} ${mobileMenuOpen ? styles.mobileOpen : ''}`}
        onClick={() => setMobileMenuOpen(false)}
        aria-hidden="true"
      />
      <aside className={sidebarClasses}>
        <div className={styles.navSection}>
          <div className={styles.sectionTitle}>Menu</div>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
                onClick={() => setMobileMenuOpen(false)}
                title={sidebarCollapsed ? item.name : undefined}
              >
                <Icon size={20} />
                <span className={styles.navLabel}>{item.name}</span>
              </NavLink>
            );
          })}
        </div>

        <div className={styles.spacer} />

        <button 
          className={styles.collapseBtn} 
          onClick={collapseSidebar}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? <ChevronRight size={20} /> : (
            <>
              <ChevronLeft size={20} />
              <span>Collapse</span>
            </>
          )}
        </button>
      </aside>
    </>
  );
};

export default Sidebar;
