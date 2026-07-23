import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft } from 'lucide-react';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import useAppStore from '../../stores/appStore';
import supabase, { isSupabaseConfigured } from '../../lib/supabase';

export const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const addToast = useAppStore((state) => state.addToast);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);

    if (!isSupabaseConfigured()) {
      setTimeout(() => {
        setIsSent(true);
        setIsLoading(false);
        addToast({ type: 'success', message: 'Demo mode: Password reset email "sent"!' });
      }, 1000);
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });

      if (error) throw error;
      
      setIsSent(true);
      addToast({ type: 'success', message: 'Password reset link sent to your email.' });
    } catch (error) {
      addToast({ type: 'error', title: 'Reset Failed', message: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  if (isSent) {
    return (
      <div className="flex-col items-center text-center">
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <h2 className="heading-3" style={{ marginBottom: 'var(--space-2)' }}>Check Your Email</h2>
          <p className="body-sm" style={{ color: 'var(--text-secondary)' }}>
            We've sent a password reset link to <br/><strong>{email}</strong>
          </p>
        </div>
        
        <Link to="/auth/login" style={{ textDecoration: 'none', width: '100%' }}>
          <Button fullWidth variant="secondary" leftIcon={<ArrowLeft size={18} />}>
            Back to Login
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-6)', textAlign: 'center' }}>
        <h2 className="heading-3" style={{ marginBottom: 'var(--space-2)' }}>Reset Password</h2>
        <p className="body-sm" style={{ color: 'var(--text-secondary)' }}>
          Enter your email address and we'll send you a link to reset your password.
        </p>
      </div>

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

        <Button 
          type="submit" 
          fullWidth 
          size="lg" 
          loading={isLoading}
          style={{ marginTop: 'var(--space-2)' }}
        >
          Send Reset Link
        </Button>
      </form>

      <div style={{ marginTop: 'var(--space-6)', textAlign: 'center' }}>
        <Link to="/auth/login" className="flex-center gap-2" style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
          <ArrowLeft size={16} />
          <span>Back to Login</span>
        </Link>
      </div>
    </div>
  );
};

export default ForgotPassword;
