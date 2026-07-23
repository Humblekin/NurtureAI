import { Navigate } from 'react-router-dom';
import useAuthStore, { ROLES } from '../../stores/authStore';
import MotherDashboard from './MotherDashboard';
import CHWDashboard from './CHWDashboard';
import NurseDashboard from './NurseDashboard';
import AdminDashboard from './AdminDashboard';
import Spinner from '../../components/ui/Spinner';

export const DashboardRouter = () => {
  const { profile, isLoading } = useAuthStore();

  if (isLoading || !profile) {
    return <Spinner fullScreen color="var(--color-primary-500)" />;
  }

  switch (profile.role) {
    case ROLES.MOTHER:
      return <MotherDashboard />;
    case ROLES.CHW:
      return <CHWDashboard />;
    case ROLES.NURSE:
    case ROLES.DOCTOR:
      return <NurseDashboard />;
    case ROLES.ADMIN:
    case ROLES.DISTRICT_OFFICER:
      return <AdminDashboard />;
    default:
      // Fallback
      return <Navigate to="/auth/login" />;
  }
};

export default DashboardRouter;
