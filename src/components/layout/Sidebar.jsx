import { NavLink } from 'react-router-dom';
import { 
  Home, Users, Baby, Calendar, Activity,
  FileText, Settings, HeartPulse, Stethoscope, MessageCircle, 
  ChevronLeft, ChevronRight
} from 'lucide-react';
import useAuthStore, { ROLES } from '../../stores/authStore';
import useAppStore from '../../stores/appStore';
import styles from './Sidebar.module.css';

// Navigation configuration based on roles
const getNavConfig = (role) => {
  const baseNav = [
    { name: 'Amina AI', path: '/amina', icon: MessageCircle },
  ];

  switch (role) {
    case ROLES.MOTHER:
      return [
        { name: 'Dashboard', path: '/dashboard', icon: Home },
        { name: 'My Health', path: '/health', icon: HeartPulse },
        { name: 'My Children', path: '/children', icon: Baby },
        ...baseNav
      ];
    case ROLES.CHW:
      return [
        { name: 'Dashboard', path: '/dashboard', icon: Home },
        { name: 'Patients', path: '/mothers', icon: Users },
        { name: 'Visits', path: '/visits', icon: Calendar },
        { name: 'Referrals', path: '/referrals', icon: Activity },
        ...baseNav
      ];
    case ROLES.NURSE:
    case ROLES.DOCTOR:
      return [
        { name: 'Dashboard', path: '/dashboard', icon: Home },
        { name: 'Patients', path: '/mothers', icon: Users },
        { name: 'Appointments', path: '/appointments', icon: Calendar },
        { name: 'Referrals', path: '/referrals', icon: Stethoscope },
        { name: 'Reports', path: '/reports', icon: FileText },
        ...baseNav
      ];
    case ROLES.DISTRICT_OFFICER:
      return [
        { name: 'Dashboard', path: '/dashboard', icon: Home },
        { name: 'Patients', path: '/mothers', icon: Users },
        { name: 'Reports', path: '/reports', icon: FileText },
        { name: 'Facilities', path: '/admin/facilities', icon: Activity },
        ...baseNav
      ];
    case ROLES.ADMIN:
      return [
        { name: 'Dashboard', path: '/dashboard', icon: Home },
        { name: 'Users', path: '/admin/users', icon: Users },
        { name: 'Facilities', path: '/admin/facilities', icon: Activity },
        { name: 'Reports', path: '/reports', icon: FileText },
        { name: 'Settings', path: '/settings', icon: Settings },
      ];
    default:
      return [
        { name: 'Dashboard', path: '/dashboard', icon: Home },
      ];
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
          <div className={styles.sectionTitle}>Main Menu</div>
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
