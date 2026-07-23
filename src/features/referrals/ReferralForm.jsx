import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Activity } from 'lucide-react';
import useReferralStore from '../../stores/referralStore';
import useAuthStore from '../../stores/authStore';
import useAppStore from '../../stores/appStore';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

export const ReferralForm = () => {
  const navigate = useNavigate();
  const { createReferral, isLoading } = useReferralStore();
  const { profile } = useAuthStore();
  const addToast = useAppStore((state) => state.addToast);
  
  const [formData, setFormData] = useState({
    patient_id: '',
    patient_type: 'mother',
    to_facility_id: '',
    urgency: 'routine',
    reason: '',
    notes: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.patient_id || !formData.reason) {
      addToast({ type: 'error', message: 'Patient ID and reason are required.' });
      return;
    }

    const { success, error } = await createReferral({
      ...formData,
      from_facility_id: profile?.facility_id,
      from_worker_id: profile?.id,
    });
    
    if (success) {
      addToast({ type: 'success', message: 'Referral created successfully.' });
      navigate('/referrals');
    } else {
      addToast({ type: 'error', title: 'Failed to create referral', message: error });
    }
  };

  return (
    <div className="page-content fade-in">
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <Link to="/referrals" className="flex items-center gap-2" style={{ color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: 'var(--space-4)', display: 'inline-flex' }}>
          <ArrowLeft size={16} /> Back to referrals
        </Link>
        <h1 className="heading-2">Create Referral</h1>
        <p className="body-md" style={{ color: 'var(--text-secondary)' }}>
          Refer a patient to another health facility.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card style={{ maxWidth: '600px', marginBottom: 'var(--space-6)' }}>
          <CardHeader title="Referral Details" />
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
                label="Urgency"
                name="urgency"
                type="select"
                value={formData.urgency}
                onChange={handleChange}
                options={[
                  { value: 'routine', label: 'Routine' },
                  { value: 'soon', label: 'Soon' },
                  { value: 'urgent', label: 'Urgent' },
                  { value: 'emergency', label: 'Emergency' },
                ]}
              />
            </div>
            <Input
              label="Destination Facility ID"
              name="to_facility_id"
              value={formData.to_facility_id}
              onChange={handleChange}
              placeholder="Enter facility UUID"
            />
            <div className="input-group">
              <label className="input-label">Reason for Referral</label>
              <textarea 
                className="input-base"
                name="reason"
                value={formData.reason}
                onChange={handleChange}
                rows={4}
                placeholder="Describe why this patient needs to be referred..."
                required
              />
            </div>
            <div className="input-group">
              <label className="input-label">Additional Notes</label>
              <textarea 
                className="input-base"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={3}
                placeholder="Any additional information for the receiving facility"
              />
            </div>
          </CardBody>
        </Card>

        <div className="flex gap-4" style={{ maxWidth: '600px', justifyContent: 'flex-end' }}>
          <Button 
            type="button" 
            variant="secondary" 
            onClick={() => navigate('/referrals')}
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            loading={isLoading}
          >
            Create Referral
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ReferralForm;
