import { Navigate, useLocation } from 'react-router-dom';
import useAuthStore from '../../stores/authStore';

const ROLE_HOME = {
  mother: '/mother/dashboard',
  chw: '/chw/dashboard',
  nurse: '/nurse/dashboard',
  doctor: '/doctor/dashboard',
  district_officer: '/district/dashboard',
  admin: '/admin/dashboard',
};

export const AuthGuard = ({ children, allowedRoles = [] }) => {
  const { isAuthenticated, profile, isLoading } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: location.pathname }} replace />;
  }

  if (allowedRoles.length > 0 && profile?.role && !allowedRoles.includes(profile.role)) {
    const home = ROLE_HOME[profile.role] || '/auth/login';
    return <Navigate to={home} replace />;
  }

  return children;
};

export default AuthGuard;
