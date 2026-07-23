import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Calendar, Scale, ArrowLeft } from 'lucide-react';
import useChildStore from '../../stores/childStore';
import useAppStore from '../../stores/appStore';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

export const ChildForm = () => {
  const navigate = useNavigate();
  const { registerChild, isLoading } = useChildStore();
  const addToast = useAppStore((state) => state.addToast);
  
  const [formData, setFormData] = useState({
    mother_id: '', // Would normally be selected or pre-filled
    full_name: '',
    date_of_birth: '',
    gender: 'female',
    birth_weight: '', // kg
    birth_facility: '',
    notes: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.full_name || !formData.date_of_birth) {
      addToast({ type: 'error', message: 'Name and Date of Birth are required.' });
      return;
    }

    const { success, data, error } = await registerChild(formData);
    
    if (success) {
      addToast({ type: 'success', message: 'Child registered successfully.' });
      navigate('/children');
    } else {
      addToast({ type: 'error', title: 'Registration failed', message: error });
    }
  };

  return (
    <div className="page-content fade-in">
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <Link to="/children" className="flex items-center gap-2" style={{ color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: 'var(--space-4)', display: 'inline-flex' }}>
          <ArrowLeft size={16} /> Back to list
        </Link>
        <h1 className="heading-2">Register Child</h1>
        <p className="body-md" style={{ color: 'var(--text-secondary)' }}>
          Create a new health record for a child.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card style={{ marginBottom: 'var(--space-6)', maxWidth: '600px' }}>
          <CardHeader title="Birth Details" />
          <CardBody className="flex-col gap-4">
            <Input
              label="Mother Profile ID (Optional link)"
              name="mother_id"
              placeholder="e.g. MOT-1234"
              value={formData.mother_id}
              onChange={handleChange}
            />
            
            <div style={{ borderTop: '1px solid var(--border-default)', margin: 'var(--space-2) 0' }} />

            <Input
              label="Child's Full Name"
              name="full_name"
              value={formData.full_name}
              onChange={handleChange}
              leftIcon={<User size={18} />}
              required
            />
            <div className="grid grid-2" style={{ gap: 'var(--space-4)' }}>
              <Input
                label="Date of Birth"
                name="date_of_birth"
                type="date"
                value={formData.date_of_birth}
                onChange={handleChange}
                leftIcon={<Calendar size={18} />}
                required
              />
              <Input
                label="Gender"
                name="gender"
                type="select"
                value={formData.gender}
                onChange={handleChange}
                options={[
                  { value: 'female', label: 'Female' },
                  { value: 'male', label: 'Male' },
                ]}
                required
              />
            </div>
            
            <div className="grid grid-2" style={{ gap: 'var(--space-4)' }}>
              <Input
                label="Birth Weight (kg)"
                name="birth_weight"
                type="number"
                step="0.1"
                value={formData.birth_weight}
                onChange={handleChange}
                leftIcon={<Scale size={18} />}
              />
              <Input
                label="Place of Birth"
                name="birth_facility"
                placeholder="Hospital/Clinic/Home"
                value={formData.birth_facility}
                onChange={handleChange}
              />
            </div>

            <div className="input-group">
              <label className="input-label">Notes / Complications</label>
              <textarea 
                className="input-base"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={3}
                placeholder="Any delivery complications or observations"
              />
            </div>
          </CardBody>
        </Card>

        <div className="flex gap-4" style={{ maxWidth: '600px', justifyContent: 'flex-end' }}>
          <Button 
            type="button" 
            variant="secondary" 
            onClick={() => navigate('/children')}
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            loading={isLoading}
          >
            Register Child
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ChildForm;
