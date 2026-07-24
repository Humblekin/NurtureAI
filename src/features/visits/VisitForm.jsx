import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Calendar, ArrowLeft } from 'lucide-react';
import useVisitStore from '../../stores/visitStore';
import useAuthStore from '../../stores/authStore';
import useAppStore from '../../stores/appStore';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

export const VisitForm = () => {
  const navigate = useNavigate();
  const { logVisit, isLoading } = useVisitStore();
  const { profile } = useAuthStore();
  const addToast = useAppStore((state) => state.addToast);
  
  const [formData, setFormData] = useState({
    patient_id: '',
    patient_type: 'mother',
    visit_type: 'home',
    visit_date: new Date().toISOString().split('T')[0],
    notes: '',
    findings: '',
    actions_taken: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.patient_id) {
      addToast({ type: 'error', message: 'Patient ID is required.' });
      return;
    }

    const { success, error } = await logVisit({
      ...formData,
      worker_id: profile?.id,
    });
    
    if (success) {
      addToast({ type: 'success', message: 'Visit logged successfully.' });
      navigate('/visits');
    } else {
      addToast({ type: 'error', title: 'Failed to log visit', message: error });
    }
  };

  return (
    <div className="page-content fade-in">
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <Link to="/visits" className="flex items-center gap-2" style={{ color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: 'var(--space-4)', display: 'inline-flex' }}>
          <ArrowLeft size={16} /> Back to visits
        </Link>
        <h1 className="heading-2">Log Health Visit</h1>
        <p className="body-md" style={{ color: 'var(--text-secondary)' }}>
          Record a health visit for a patient.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-2" style={{ gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
          <Card>
            <CardHeader title="Visit Details" />
            <CardBody className="flex-col gap-4">
              <Input
                label="Patient ID"
                name="patient_id"
                value={formData.patient_id}
                onChange={handleChange}
                placeholder="Enter patient UUID"
                required
              />
              <div className="grid grid-2" style={{ gap: 'var(--space-4)' }}>
                <Input
                  label="Patient Type"
                  name="patient_type"
                  type="select"
                  value={formData.patient_type}
                  onChange={handleChange}
                  options={[
                    { value: 'mother', label: 'Mother' },
                    { value: 'child', label: 'Child' },
                  ]}
                />
                <Input
                  label="Visit Type"
                  name="visit_type"
                  type="select"
                  value={formData.visit_type}
                  onChange={handleChange}
                  options={[
                    { value: 'home', label: 'Home Visit' },
                    { value: 'facility', label: 'Facility Visit' },
                    { value: 'follow_up', label: 'Follow-up' },
                    { value: 'emergency', label: 'Emergency' },
                  ]}
                />
              </div>
              <Input
                label="Visit Date"
                name="visit_date"
                type="date"
                value={formData.visit_date}
                onChange={handleChange}
                leftIcon={<Calendar size={18} />}
                required
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Observations" />
            <CardBody className="flex-col gap-4">
              <Input
                label="Notes"
                name="notes"
                type="textarea"
                value={formData.notes}
                onChange={handleChange}
                rows={3}
                placeholder="General notes about the visit"
              />
              <Input
                label="Findings"
                name="findings"
                type="textarea"
                value={formData.findings}
                onChange={handleChange}
                rows={3}
                placeholder="Clinical findings and observations"
              />
              <Input
                label="Actions Taken"
                name="actions_taken"
                type="textarea"
                value={formData.actions_taken}
                onChange={handleChange}
                rows={3}
                placeholder="Treatments, referrals, or follow-up plans"
              />
            </CardBody>
          </Card>
        </div>

        <div className="flex gap-4" style={{ justifyContent: 'flex-end' }}>
          <Button 
            type="button" 
            variant="secondary" 
            onClick={() => navigate('/visits')}
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            loading={isLoading}
          >
            Log Visit
          </Button>
        </div>
      </form>
    </div>
  );
};

export default VisitForm;
