import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Phone, Globe, Briefcase } from 'lucide-react';
import useAuthStore, { ROLES, ROLE_LABELS } from '../../stores/authStore';
import useAppStore from '../../stores/appStore';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

export const Register = () => {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    full_name: '',
    phone: '',
    role: ROLES.MOTHER,
    preferred_language: 'en',
    community: '',
  });

  const { signUp } = useAuthStore();
  const addToast = useAppStore((state) => state.addToast);
  const navigate = useNavigate();

  const isMother = formData.role === ROLES.MOTHER;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleNext = (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      addToast({ type: 'error', message: 'Passwords do not match.' });
      return;
    }
    if (formData.password.length < 6) {
      addToast({ type: 'error', message: 'Password must be at least 6 characters.' });
      return;
    }
    if (!formData.full_name.trim()) {
      addToast({ type: 'error', message: 'Please enter your full name.' });
      return;
    }
    if (!formData.phone.trim()) {
      addToast({ type: 'error', message: 'Please enter your phone number.' });
      return;
    }
    setStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const { email, password, confirmPassword, ...profileData } = formData;

    setIsSubmitting(true);
    const { success, error } = await signUp(email, password, profileData);
    setIsSubmitting(false);

    if (success) {
      if (isMother) {
        addToast({ type: 'success', message: 'Account created! Welcome to NurtureAI.' });
        navigate('/mother/welcome', { replace: true });
      } else {
        addToast({ type: 'success', message: 'Account created successfully!' });
        navigate('/', { replace: true });
      }
    } else {
      addToast({ type: 'error', title: 'Registration Failed', message: error });
    }
  };

  const roleOptions = Object.entries(ROLE_LABELS).map(([value, label]) => ({
    value, label
  }));

  const languageOptions = [
    { value: 'en', label: 'English' },
    { value: 'dag', label: 'Dagbani' },
  ];

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-6)', textAlign: 'center' }}>
        <h2 className="heading-3" style={{ marginBottom: 'var(--space-2)' }}>Create Account</h2>
        <p className="body-sm" style={{ color: 'var(--text-secondary)' }}>
          {step === 1
            ? 'Set up your account details'
            : 'Almost done — just a couple more things'
          }
        </p>
      </div>

      <form onSubmit={step === 1 ? handleNext : handleSubmit} className="flex-col gap-4">
        {step === 1 ? (
          <>
            <Input
              label="Full Name"
              name="full_name"
              placeholder="Your full name"
              value={formData.full_name}
              onChange={handleChange}
              leftIcon={<User size={18} />}
              required
            />
            <Input
              label="Phone Number"
              name="phone"
              type="tel"
              placeholder="e.g. +233..."
              value={formData.phone}
              onChange={handleChange}
              leftIcon={<Phone size={18} />}
              required
            />
            <Input
              label="Email Address"
              name="email"
              type="email"
              placeholder="Enter your email"
              value={formData.email}
              onChange={handleChange}
              leftIcon={<Mail size={18} />}
              required
            />
            <Input
              label="Password"
              name="password"
              type="password"
              placeholder="Create a password"
              value={formData.password}
              onChange={handleChange}
              leftIcon={<Lock size={18} />}
              required
            />
            <Input
              label="Confirm Password"
              name="confirmPassword"
              type="password"
              placeholder="Confirm your password"
              value={formData.confirmPassword}
              onChange={handleChange}
              leftIcon={<Lock size={18} />}
              required
            />

            <Button
              type="submit"
              fullWidth
              size="lg"
              style={{ marginTop: 'var(--space-2)' }}
            >
              Continue
            </Button>
          </>
        ) : (
          <>
            <Input
              label="Preferred Language"
              name="preferred_language"
              type="select"
              value={formData.preferred_language}
              onChange={handleChange}
              leftIcon={<Globe size={18} />}
              options={languageOptions}
            />

            {!isMother && (
              <>
                <Input
                  label="I am a"
                  name="role"
                  type="select"
                  value={formData.role}
                  onChange={handleChange}
                  leftIcon={<Briefcase size={18} />}
                  options={roleOptions}
                />
                <Input
                  label="Assigned Area"
                  name="community"
                  placeholder="e.g. Tamale South"
                  value={formData.community}
                  onChange={handleChange}
                />
              </>
            )}

            {isMother && (
              <div style={{
                background: 'var(--color-primary-50)',
                color: 'var(--color-primary-800)',
                padding: 'var(--space-4)',
                borderRadius: 'var(--radius-lg)',
                fontSize: 'var(--text-sm)',
                border: '1px solid var(--color-primary-200)',
                lineHeight: 'var(--leading-normal)',
              }}>
                <strong>Amina will guide you!</strong> After creating your account, Amina will welcome you and help set up your health profile — either through a friendly conversation or a simple form.
              </div>
            )}

            <div className="flex gap-4" style={{ marginTop: 'var(--space-2)' }}>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setStep(1)}
                fullWidth
              >
                Back
              </Button>
              <Button
                type="submit"
                fullWidth
                loading={isSubmitting}
              >
                Create Account
              </Button>
            </div>
          </>
        )}
      </form>

      <div style={{ marginTop: 'var(--space-6)', textAlign: 'center', fontSize: 'var(--text-sm)' }}>
        <span style={{ color: 'var(--text-secondary)' }}>Already have an account? </span>
        <Link to="/auth/login" style={{ color: 'var(--color-primary-600)', fontWeight: 'var(--font-semibold)' }}>
          Sign In
        </Link>
      </div>
    </div>
  );
};

export default Register;
