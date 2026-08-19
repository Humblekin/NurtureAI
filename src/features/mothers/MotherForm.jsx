import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { User, Phone, MapPin, Calendar, HeartPulse, ArrowLeft, Search } from 'lucide-react';
import useMotherStore from '../../stores/motherStore';
import useAuthStore from '../../stores/authStore';
import useAppStore from '../../stores/appStore';
import { searchPatients } from '../../services/patientSearch';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { provenanceFor } from '../../lib/provenance';
import VerificationBadge from '../../components/VerificationBadge';

export const MotherForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const { profile } = useAuthStore();
  const { registerMother, updateMother, isLoading, mothers } = useMotherStore();
  const addToast = useAppStore((state) => state.addToast);
  const isOnline = useAppStore((state) => state.isOnline);
  const rolePrefix = profile?.role || 'chw';
  const submittingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    date_of_birth: '',
    community: '',
    blood_group: '',
    medical_history: '',
    risk_level: 'low',
    edd: '',
  });

  // Duplicate-protection search: before registering a new mother, workers
  // search for an existing record. Matches are shown with "Open existing
  // record" links — records are never auto-merged.
  const [dupQuery, setDupQuery] = useState('');
  const [dupResults, setDupResults] = useState([]);
  const [dupSearching, setDupSearching] = useState(false);
  const dupDebounceRef = useRef(null);

  useEffect(() => {
    if (isEdit) return;
    if (dupDebounceRef.current) clearTimeout(dupDebounceRef.current);

    const term = dupQuery.trim();
    if (term.length < 2) {
      setDupResults([]);
      setDupSearching(false);
      return;
    }

    dupDebounceRef.current = setTimeout(async () => {
      setDupSearching(true);
      const { mothers } = await searchPatients({ query: term, limit: 10 });
      setDupResults(mothers);
      setDupSearching(false);
    }, 350);

    return () => {
      if (dupDebounceRef.current) clearTimeout(dupDebounceRef.current);
    };
  }, [dupQuery, isEdit]);

  useEffect(() => {
    if (isEdit && mothers.length > 0) {
      const mother = mothers.find(m => m.id === id);
      if (mother) {
        setFormData({
          full_name: mother.full_name || '',
          phone: mother.phone || '',
          date_of_birth: mother.date_of_birth || '',
          community: mother.community || '',
          blood_group: mother.blood_group || '',
          medical_history: mother.medical_history || '',
          risk_level: mother.risk_level || 'low',
          edd: mother.edd || '',
        });
      }
    }
  }, [id, isEdit, mothers]);

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

    // Basic sanity checks on dates/phone so corrupt values don't enter the record.
    const issues = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (formData.date_of_birth) {
      const dob = new Date(formData.date_of_birth + 'T00:00:00');
      if (isNaN(dob.getTime())) {
        issues.push('The date of birth is not valid.');
      } else if (dob > today) {
        issues.push('The date of birth cannot be in the future.');
      } else if ((today - dob) / (1000 * 60 * 60 * 24 * 365) > 120) {
        issues.push('The date of birth seems too far in the past — please double-check it.');
      }
    }
    if (formData.edd) {
      const eddDate = new Date(formData.edd + 'T00:00:00');
      if (isNaN(eddDate.getTime())) {
        issues.push('The EDD date is not valid.');
      } else if (eddDate < today) {
        issues.push('The EDD is in the past — please confirm the expected delivery date.');
      }
    }
    const digitsOnly = String(formData.phone).replace(/\D/g, '');
    if (digitsOnly.length < 9 || digitsOnly.length > 15) {
      issues.push('The phone number looks incorrect (should be 9-15 digits, e.g. +233...).');
    }

    if (issues.length > 0) {
      addToast({ type: 'error', title: 'Please check the values', message: issues.join(' ') });
      return;
    }

    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);

    const provenance = provenanceFor(profile);
    const { success, data, error } = isEdit
      ? await updateMother(id, formData)
      : await registerMother({
          ...formData,
          ...provenance,
          // Worker registration scope so patient search / facility views
          // can find this mother: CHWs own the record, nurses attach the
          // facility. profile_id is intentionally left unset — the mother
          // has not created a login account yet.
          assigned_worker_id: profile?.role === 'chw' ? profile?.id : undefined,
          facility_id: profile?.role === 'nurse' ? profile?.facility_id || null : undefined,
          birth_facility_id: profile?.role === 'nurse' ? profile?.facility_id || null : undefined,
        });
    
    submittingRef.current = false;
    setIsSubmitting(false);

    if (success) {
      addToast({
        type: 'success',
        message: isOnline
          ? (isEdit ? 'Mother profile updated.' : 'Mother registered successfully.')
          : 'Mother saved offline — will sync when back online.',
      });
      if (isEdit) {
        navigate(`/${rolePrefix}/mothers/${id}`);
      } else {
        navigate(`/${rolePrefix}/mothers/${data?.id || ''}`);
      }
    } else {
      addToast({ type: 'error', title: isEdit ? 'Update failed' : 'Registration failed', message: error });
    }
  };

  return (
    <div className="page-content fade-in">
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <Link to={isEdit ? `/${rolePrefix}/mothers/${id}` : `/${rolePrefix}/mothers`} className="flex items-center gap-2" style={{ color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: 'var(--space-4)', display: 'inline-flex' }}>
          <ArrowLeft size={16} /> Back
        </Link>
        <h1 className="heading-2">{isEdit ? 'Edit Mother Profile' : 'Register Mother'}</h1>
        <p className="body-md" style={{ color: 'var(--text-secondary)' }}>
          {isEdit ? 'Update the mother\'s information.' : 'Add a new expecting mother to the system.'}
        </p>
      </div>

      {!isEdit && (
        <Card variant="outlined" style={{ marginBottom: 'var(--space-6)' }}>
          <CardHeader
            title="Check for an existing record"
            description="Search first to avoid registering a mother who is already in the system. This does not merge records."
          />
          <CardBody>
            <Input
              placeholder="Search by name, phone, community, or Patient ID (NRT-…)..."
              value={dupQuery}
              onChange={(e) => setDupQuery(e.target.value)}
              leftIcon={<Search size={18} />}
              style={{ marginBottom: 0 }}
            />
            {dupSearching && (
              <p className="caption text-secondary" style={{ marginTop: 'var(--space-2)' }}>Searching…</p>
            )}
            {!dupSearching && dupResults.length > 0 && (
              <div className="flex-col" style={{ marginTop: 'var(--space-3)' }}>
                <p className="caption text-secondary" style={{ marginBottom: 'var(--space-1)' }}>
                  Existing {dupResults.length === 1 ? 'record' : 'records'} found:
                </p>
                {dupResults.map((m) => (
                  <div key={m.id} className="flex-between p-3" style={{ background: 'var(--surface-sunken)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-2)' }}>
                    <div>
                      <p className="font-medium flex items-center gap-2">
                        {m.full_name || 'Unnamed Mother'}
                        <VerificationBadge row={m} />
                      </p>
                      <p className="caption text-secondary">
                        {m.patient_code ? `${m.patient_code} • ` : ''}{m.phone || 'No phone'} • {m.community || 'Unknown community'}
                      </p>
                    </div>
                    <Link to={`/${rolePrefix}/mothers/${m.id}`}>
                      <Button size="sm" variant="outline">Open existing record</Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      )}

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
            onClick={() => navigate(isEdit ? `/${rolePrefix}/mothers/${id}` : `/${rolePrefix}/mothers`)}
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            loading={isLoading || isSubmitting}
          >
            {isEdit ? 'Update Mother' : 'Register Mother'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default MotherForm;
