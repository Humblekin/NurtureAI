import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Phone, MapPin, Briefcase } from 'lucide-react';
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
    community: '',
    facility_id: '' // For health workers
  });

  const { signUp } = useAuthStore();
  const addToast = useAppStore((state) => state.addToast);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleNext = (e) => {
    e.preventDefault();
    if (step === 1) {
      if (formData.password !== formData.confirmPassword) {
        addToast({ type: 'error', message: 'Passwords do not match.' });
        return;
      }
      if (formData.password.length < 6) {
        addToast({ type: 'error', message: 'Password must be at least 6 characters.' });
        return;
      }
      setStep(2);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.full_name || !formData.phone) {
      addToast({ type: 'error', message: 'Please fill in all required fields.' });
      return;
    }

    const { email, password, confirmPassword, ...profileData } = formData;
    
    setIsSubmitting(true);
    const { success, error } = await signUp(email, password, profileData);
    setIsSubmitting(false);
    
    if (success) {
      addToast({ type: 'success', message: 'Account created successfully!' });
      navigate('/');
    } else {
      addToast({ type: 'error', title: 'Registration Failed', message: error });
    }
  };

  const roleOptions = Object.entries(ROLE_LABELS).map(([value, label]) => ({
    value, label
  }));

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-6)', textAlign: 'center' }}>
        <h2 className="heading-3" style={{ marginBottom: 'var(--space-2)' }}>Create Account</h2>
        <p className="body-sm" style={{ color: 'var(--text-secondary)' }}>
          {step === 1 ? 'Step 1: Account Details' : 'Step 2: Profile Information'}
        </p>
      </div>

      <form onSubmit={step === 1 ? handleNext : handleSubmit} className="flex-col gap-4">
        {step === 1 ? (
          // Step 1: Account Credentials
          <>
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
          // Step 2: Profile Info
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
              label="Role"
              name="role"
              type="select"
              value={formData.role}
              onChange={handleChange}
              leftIcon={<Briefcase size={18} />}
              options={roleOptions}
              required
            />
            <Input
              label={formData.role === ROLES.MOTHER ? "Community" : "Assigned Area"}
              name="community"
              placeholder="e.g. Tamale South"
              value={formData.community}
              onChange={handleChange}
              leftIcon={<MapPin size={18} />}
            />
            
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
