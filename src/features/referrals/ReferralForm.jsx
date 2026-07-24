import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Activity, ExternalLink, AlertTriangle } from 'lucide-react';
import useReferralStore from '../../stores/referralStore';
import useAuthStore from '../../stores/authStore';
import useAppStore from '../../stores/appStore';
import db from '../../lib/db';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';

export const ReferralForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { createReferral, isLoading } = useReferralStore();
  const { profile } = useAuthStore();
  const addToast = useAppStore((state) => state.addToast);

  const patientId = searchParams.get('patientId') || '';
  const patientType = searchParams.get('patientType') || 'mother';
  const motherId = searchParams.get('motherId') || '';

  const [facilities, setFacilities] = useState([]);
  const [loadingFacilities, setLoadingFacilities] = useState(true);

  const [formData, setFormData] = useState({
    patient_id: patientId,
    patient_type: patientType,
    to_facility_id: '',
    urgency: 'routine',
    reason: '',
    notes: '',
  });

  useEffect(() => {
    async function loadFacilities() {
      setLoadingFacilities(true);
      try {
        const local = await db.facilities.toArray();
        setFacilities(local);
      } catch (err) {
        console.error('Failed to load facilities:', err);
      }
      setLoadingFacilities(false);
    }
    loadFacilities();
  }, []);

  useEffect(() => {
    setFormData(prev => ({ ...prev, patient_id: patientId, patient_type: patientType }));
  }, [patientId, patientType]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.patient_id || !formData.reason) {
      addToast({ type: 'error', message: 'Patient and reason are required.' });
      return;
    }

    const { success, error } = await createReferral({
      ...formData,
      from_facility_id: profile?.facility_id,
      from_worker_id: profile?.id,
      mother_id: motherId || undefined,
    });

    if (success) {
      addToast({ type: 'success', message: 'Referral created successfully.' });
      navigate('/referrals');
    } else {
      addToast({ type: 'error', title: 'Failed to create referral', message: error });
    }
  };

  const otherFacilities = facilities.filter(f => f.id !== profile?.facility_id);

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
            {/* Patient ID — auto-filled, read-only */}
            <Input
              label="Patient ID"
              name="patient_id"
              value={formData.patient_id}
              readOnly
              placeholder="Auto-filled from patient profile"
              required
              style={{ opacity: 0.8, cursor: 'not-allowed' }}
            />

            {/* Mother Profile ID — optional link */}
            {patientType === 'child' && motherId && (
              <div className="flex items-center gap-2" style={{ padding: 'var(--space-3)', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-md)' }}>
                <span className="body-sm" style={{ color: 'var(--text-secondary)' }}>Mother Profile:</span>
                <Link
                  to={`/mothers/${motherId}`}
                  className="flex items-center gap-1"
                  style={{ color: 'var(--color-primary-600)', textDecoration: 'none', fontWeight: 500 }}
                >
                  View Mother Profile <ExternalLink size={14} />
                </Link>
              </div>
            )}

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

            {/* Destination Facility — dropdown */}
            {loadingFacilities ? (
              <div className="flex items-center gap-2" style={{ padding: 'var(--space-3)' }}>
                <Spinner size={16} />
                <span className="body-sm" style={{ color: 'var(--text-secondary)' }}>Loading facilities...</span>
              </div>
            ) : (
              <Input
                label="Destination Facility"
                name="to_facility_id"
                type="select"
                value={formData.to_facility_id}
                onChange={handleChange}
                placeholder="Select a facility"
                required
                options={[
                  { value: '', label: '— Select destination facility —' },
                  ...otherFacilities.map(f => ({
                    value: f.id,
                    label: `${f.name} (${f.type === 'hospital' ? 'Hospital' : f.type === 'clinic' ? 'Clinic' : f.type === 'chps' ? 'CHPS Compound' : f.type === 'health_post' ? 'Health Post' : f.type})`,
                  })),
                ]}
              />
            )}

            {otherFacilities.length === 0 && !loadingFacilities && (
              <div className="warning-banner">
                <AlertTriangle size={18} className="warning-banner-icon" />
                <div className="warning-banner-text">
                  No other facilities registered. Add facilities in{' '}
                  <Link to="/admin/facilities">Admin → Facility Management</Link>{' '}
                  first.
                </div>
              </div>
            )}

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
