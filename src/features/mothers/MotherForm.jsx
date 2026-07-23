import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Phone, MapPin, Calendar, HeartPulse, ArrowLeft } from 'lucide-react';
import useMotherStore from '../../stores/motherStore';
import useAppStore from '../../stores/appStore';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

export const MotherForm = () => {
  const navigate = useNavigate();
  const { registerMother, isLoading } = useMotherStore();
  const addToast = useAppStore((state) => state.addToast);
  
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    date_of_birth: '',
    community: '',
    blood_group: '',
    medical_history: '',
    risk_level: 'low',
    edd: '', // Estimated Date of Delivery
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.full_name || !formData.phone) {
      addToast({ type: 'error', message: 'Name and phone are required.' });
      return;
    }

    const { success, data, error } = await registerMother(formData);
    
    if (success) {
      addToast({ type: 'success', message: 'Mother registered successfully.' });
      // In a real app, we'd navigate to the mother's profile, but we don't have it yet.
      // navigate(`/mothers/${data.id}`);
      navigate('/mothers');
    } else {
      addToast({ type: 'error', title: 'Registration failed', message: error });
    }
  };

  return (
    <div className="page-content fade-in">
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <Link to="/mothers" className="flex items-center gap-2" style={{ color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: 'var(--space-4)', display: 'inline-flex' }}>
          <ArrowLeft size={16} /> Back to list
        </Link>
        <h1 className="heading-2">Register Mother</h1>
        <p className="body-md" style={{ color: 'var(--text-secondary)' }}>
          Add a new expecting mother to the system.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-2" style={{ gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
          <Card>
            <CardHeader title="Personal Information" />
            <CardBody className="flex-col gap-4">
              <Input
                label="Full Name"
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                leftIcon={<User size={18} />}
                required
              />
              <Input
                label="Phone Number"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleChange}
                leftIcon={<Phone size={18} />}
                required
              />
              <Input
                label="Date of Birth"
                name="date_of_birth"
                type="date"
                value={formData.date_of_birth}
                onChange={handleChange}
                leftIcon={<Calendar size={18} />}
              />
              <Input
                label="Community / Address"
                name="community"
                value={formData.community}
                onChange={handleChange}
                leftIcon={<MapPin size={18} />}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Medical & Pregnancy Info" />
            <CardBody className="flex-col gap-4">
              <Input
                label="Estimated Date of Delivery (EDD)"
                name="edd"
                type="date"
                value={formData.edd}
                onChange={handleChange}
                leftIcon={<Calendar size={18} />}
              />
              <Input
                label="Blood Group"
                name="blood_group"
                type="select"
                value={formData.blood_group}
                onChange={handleChange}
                leftIcon={<HeartPulse size={18} />}
                options={[
                  { value: '', label: 'Select Blood Group' },
                  { value: 'A+', label: 'A+' },
                  { value: 'A-', label: 'A-' },
                  { value: 'B+', label: 'B+' },
                  { value: 'B-', label: 'B-' },
                  { value: 'AB+', label: 'AB+' },
                  { value: 'AB-', label: 'AB-' },
                  { value: 'O+', label: 'O+' },
                  { value: 'O-', label: 'O-' },
                ]}
              />
              <Input
                label="Initial Risk Assessment"
                name="risk_level"
                type="select"
                value={formData.risk_level}
                onChange={handleChange}
                options={[
                  { value: 'low', label: 'Low Risk' },
                  { value: 'medium', label: 'Medium Risk' },
                  { value: 'high', label: 'High Risk' },
                ]}
              />
              <div className="input-group">
                <label className="input-label">Medical History / Notes</label>
                <textarea 
                  className="input-base"
                  name="medical_history"
                  value={formData.medical_history}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Any previous complications, allergies, etc."
                />
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="flex gap-4" style={{ justifyContent: 'flex-end' }}>
          <Button 
            type="button" 
            variant="secondary" 
            onClick={() => navigate('/mothers')}
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            loading={isLoading}
          >
            Register Mother
          </Button>
        </div>
      </form>
    </div>
  );
};

export default MotherForm;
