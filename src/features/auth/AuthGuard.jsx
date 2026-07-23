import { Navigate, useLocation } from 'react-router-dom';
import useAuthStore from '../../stores/authStore';

/**
 * NurtureAI Auth Guard
 * Protects routes and ensures the user has the required roles.
 */
export const AuthGuard = ({ children, allowedRoles = [] }) => {
  const { isAuthenticated, profile, isLoading } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return null; // The AppShell handles global loading
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: location.pathname }} replace />;
  }

  if (allowedRoles.length > 0 && profile?.role && !allowedRoles.includes(profile.role)) {
    // User is authenticated but doesn't have the right role
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default AuthGuard;
