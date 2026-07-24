import { Navigate } from 'react-router-dom';
import useAuthStore from '../../stores/authStore';
import Spinner from '../../components/ui/Spinner';

const ROLE_HOME = {
  mother: '/mother/dashboard',
  chw: '/chw/dashboard',
  nurse: '/nurse/dashboard',
  doctor: '/doctor/dashboard',
  district_officer: '/district/dashboard',
  admin: '/admin/dashboard',
};

export const RoleRedirect = () => {
  const { profile, isLoading } = useAuthStore();

  if (isLoading) return <Spinner fullScreen />;

  const home = ROLE_HOME[profile?.role] || '/auth/login';
  return <Navigate to={home} replace />;
};

export default RoleRedirect;
