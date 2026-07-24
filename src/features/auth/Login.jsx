import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, LogIn } from 'lucide-react';
import useAuthStore from '../../stores/authStore';
import useAppStore from '../../stores/appStore';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { isSupabaseConfigured } from '../../lib/supabase';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { signIn } = useAuthStore();
  const addToast = useAppStore((state) => state.addToast);
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      addToast({ type: 'error', message: 'Please enter both email and password.' });
      return;
    }

    setIsSubmitting(true);
    const { success, error } = await signIn(email, password);
    setIsSubmitting(false);
    
    if (success) {
      addToast({ type: 'success', message: 'Welcome back to NurtureAI!' });
      navigate(from, { replace: true });
    } else {
      addToast({ type: 'error', title: 'Login Failed', message: error });
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-6)', textAlign: 'center' }}>
        <h2 className="heading-3" style={{ marginBottom: 'var(--space-2)' }}>Welcome Back</h2>
        <p className="body-sm" style={{ color: 'var(--text-secondary)' }}>
          Sign in to your NurtureAI account
        </p>
      </div>

      {!isSupabaseConfigured() && (
        <div style={{ 
          background: 'var(--color-info-50)', 
          color: 'var(--color-info-800)',
          padding: 'var(--space-3)',
          borderRadius: 'var(--radius-md)',
          marginBottom: 'var(--space-6)',
          fontSize: 'var(--text-sm)',
          border: '1px solid var(--color-info-200)'
        }}>
          <strong>Demo Mode:</strong> Supabase is not configured. Any email/password will log you in as a demo user.
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex-col gap-4">
        <Input
          label="Email Address"
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          leftIcon={<Mail size={18} />}
          required
        />

        <Input
          label="Password"
          type="password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          leftIcon={<Lock size={18} />}
          required
        />

        <div className="flex-between" style={{ marginTop: '-8px' }}>
          <label className="flex-center gap-2" style={{ cursor: 'pointer', fontSize: 'var(--text-sm)' }}>
            <input type="checkbox" />
            <span>Remember me</span>
          </label>
          
          <Link to="/auth/forgot-password" style={{ 
            fontSize: 'var(--text-sm)', 
            color: 'var(--color-primary-600)',
            fontWeight: 'var(--font-medium)' 
          }}>
            Forgot Password?
          </Link>
        </div>

        <Button 
          type="submit" 
          fullWidth 
          size="lg" 
          loading={isSubmitting}
          rightIcon={!isSubmitting && <LogIn size={18} />}
          style={{ marginTop: 'var(--space-2)' }}
        >
          Sign In
        </Button>
      </form>

      <div style={{ marginTop: 'var(--space-6)', textAlign: 'center', fontSize: 'var(--text-sm)' }}>
        <span style={{ color: 'var(--text-secondary)' }}>Don't have an account? </span>
        <Link to="/auth/register" style={{ color: 'var(--color-primary-600)', fontWeight: 'var(--font-semibold)' }}>
          Create Account
        </Link>
      </div>
    </div>
  );
};

export default Login;
