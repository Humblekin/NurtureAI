import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import useAuthStore from '../../stores/authStore';
import Spinner from '../../components/ui/Spinner';
import supabase, { isSupabaseConfigured } from '../../lib/supabase';

const ROLE_HOME = {
  mother: '/mother/amina',
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
          if (isSupabaseConfigured()) {
            const { data, error } = await supabase
              .from('mothers')
              .select('id')
              .eq('profile_id', profile.id)
              .is('deleted_at', null)
              .maybeSingle();
            if (error) throw error;
            if (!data) {
              // New mother — needs onboarding
              setTarget('/mother/welcome');
            } else {
              setTarget(ROLE_HOME[profile.role] || '/auth/login');
            }
          } else {
            setTarget('/mother/welcome');
          }
        } catch {
          // If check fails, send to onboarding (safe fallback)
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
