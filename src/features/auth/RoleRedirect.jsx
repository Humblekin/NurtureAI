import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import useAuthStore from '../../stores/authStore';
import Spinner from '../../components/ui/Spinner';
import db from '../../lib/db';

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
  const [checking, setChecking] = useState(true);
  const [target, setTarget] = useState(null);

  useEffect(() => {
    const checkOnboarding = async () => {
      if (isLoading || !profile) {
        setChecking(false);
        return;
      }

      // For mother role, check if they have a mother record
      if (profile.role === 'mother') {
        try {
          const mother = await db.mothers.where('profile_id').equals(profile.id).first();
          if (!mother) {
            // New mother — needs onboarding
            setTarget('/mother/welcome');
          } else {
            setTarget(ROLE_HOME[profile.role] || '/auth/login');
          }
        } catch {
          // If DB check fails, send to onboarding (safe fallback)
          setTarget('/mother/welcome');
        }
      } else {
        setTarget(ROLE_HOME[profile.role] || '/auth/login');
      }

      setChecking(false);
    };

    checkOnboarding();
  }, [profile, isLoading]);

  if (isLoading || checking) return <Spinner fullScreen />;

  if (!profile) return <Navigate to="/auth/login" replace />;

  return <Navigate to={target || '/auth/login'} replace />;
};

export default RoleRedirect;
