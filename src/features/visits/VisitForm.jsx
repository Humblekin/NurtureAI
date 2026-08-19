import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link, useParams, useSearchParams, useBlocker } from 'react-router-dom';
import { Calendar, ArrowLeft, Search, User, X } from 'lucide-react';
import useVisitStore from '../../stores/visitStore';
import useAuthStore from '../../stores/authStore';
import useChildStore from '../../stores/childStore';
import useAppStore from '../../stores/appStore';
import { searchPatients } from '../../services/patientSearch';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { provenanceFor } from '../../lib/provenance';

const emptyForm = (params) => ({
  patient_id: params.get('patientId') || '',
  patient_type: params.get('patientType') || 'mother',
  visit_type: 'facility',
  visit_date: new Date().toISOString().split('T')[0],
  notes: '',
  findings: '',
  actions_taken: '',
});

export const VisitForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEdit = !!id;
  const { logVisit, updateVisit, fetchVisitById, isLoading, visits } = useVisitStore();
  const { profile } = useAuthStore();
  const addToast = useAppStore((state) => state.addToast);
  const isOnline = useAppStore((state) => state.isOnline);
  const rolePrefix = profile?.role || 'chw';

  const [formData, setFormData] = useState(() => emptyForm(searchParams));
  const [initialSnapshot, setInitialSnapshot] = useState(() => emptyForm(searchParams));
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingEdit, setIsLoadingEdit] = useState(false);
  const submittingRef = useRef(false);
  const submittedRef = useRef(false);
  const [blockedNavigation, setBlockedNavigation] = useState(null);

  const [patientName, setPatientName] = useState(searchParams.get('name') || '');
  const [patientCode, setPatientCode] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef(null);

  const isDirty = !isSubmitted && JSON.stringify(formData) !== JSON.stringify(initialSnapshot);

  // Resolve a pre-selected patient's name so the worker sees who they're logging for.
  useEffect(() => {
    if (!formData.patient_id || patientName) return;
    (async () => {
      if (formData.patient_type === 'child') {
        const list = await useChildStore.getState().fetchChildrenList();
        const match = list.find(c => c.id === formData.patient_id);
        if (match) setPatientName(match.full_name);
        return;
      }
      const { mothers } = await searchPatients({ query: formData.patient_id, limit: 10 });
      // Only ever use an exact ID match — never fall back to the first search
      // result, which could resolve to a different patient.
      const match = mothers.find(m => m.id === formData.patient_id);
      if (match) {
        setPatientName(match.full_name);
        setPatientCode(match.patient_code);
      }
    })();
  }, [formData.patient_id, formData.patient_type, patientName]);

  const applyVisit = (visit) => {
    const fields = {
      patient_id: visit.patient_id || '',
      patient_type: visit.patient_type || 'mother',
      visit_type: visit.visit_type || 'home',
      visit_date: visit.visit_date || new Date().toISOString().split('T')[0],
      notes: visit.notes || '',
      findings: visit.findings || '',
      actions_taken: visit.actions_taken || '',
    };
    setFormData(fields);
    setInitialSnapshot(fields);
  };

  useEffect(() => {
    if (!isEdit) return;
    if (visits.length > 0) {
      const visit = visits.find(v => v.id === id);
      if (visit) {
        applyVisit(visit);
        return;
      }
    }
    // Not in the in-memory list (e.g. page refresh on /visits/:id/edit) —
    // fetch the record directly so the form never renders blank.
    setIsLoadingEdit(true);
    fetchVisitById(id).then(visit => {
      if (visit) applyVisit(visit);
      else addToast({ type: 'error', message: 'Visit not found or you no longer have access to it.' });
      setIsLoadingEdit(false);
    }).catch(() => setIsLoadingEdit(false));
  }, [id, isEdit, visits, fetchVisitById, addToast]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const runSearch = useCallback(async (term) => {
    setIsSearching(true);
    const { mothers, error } = await searchPatients({ query: term, limit: 20 });
    setIsSearching(false);
    setResults(mothers || []);
    setSearched(true);
    if (error) addToast({ type: 'error', message: error });
  }, [addToast]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    debounceRef.current = setTimeout(() => runSearch(term), 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  const selectPatient = (mother) => {
    setFormData(prev => ({
      ...prev,
      patient_id: mother.id,
      patient_type: 'mother',
    }));
    setPatientName(mother.full_name);
    setPatientCode(mother.patient_code);
    setResults([]);
    setQuery('');
  };

  const clearPatient = () => {
    setFormData(prev => ({ ...prev, patient_id: '', patient_type: 'mother' }));
    setPatientName('');
    setPatientCode('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.patient_id) {
      addToast({ type: 'error', message: 'Please select a patient for this visit.' });
      return;
    }

    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);

    try {
      const { success, error } = isEdit
        ? await updateVisit(id, formData)
        : await logVisit({ ...formData, worker_id: profile?.id, ...provenanceFor(profile) });

      if (success) {
        submittedRef.current = true;
        setIsSubmitted(true);
        addToast({
          type: 'success',
          message: isOnline
            ? (isEdit ? 'Visit updated.' : 'Visit logged successfully.')
            : 'Visit saved offline — will sync when back online.',
        });
        setTimeout(() => {
          if (formData.patient_type === 'mother') {
            navigate(`/${rolePrefix}/mothers/${formData.patient_id}`);
          } else if (formData.patient_type === 'child') {
            navigate(`/${rolePrefix}/children/${formData.patient_id}`);
          } else {
            navigate(`/${rolePrefix}/visits`);
          }
        }, 800);
      } else {
        addToast({ type: 'error', title: isEdit ? 'Update failed' : 'Failed to log visit', message: error });
      }
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // Unsaved-changes protection: warn on browser close/reload...
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // ...and confirm before navigating away within the app. The ref guard makes
  // the blocker release synchronously on a successful save, so it can never
  // block the navigate() call that follows.
  const blocker = useBlocker(() => isDirty && !submittedRef.current);
  useEffect(() => {
    if (blocker.state === 'blocked') {
      setBlockedNavigation(blocker);
    }
  }, [blocker]);

  return (
    <div className="page-content fade-in">
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <Link to={`/${rolePrefix}/visits`} className="flex items-center gap-2" style={{ color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: 'var(--space-4)', display: 'inline-flex' }}>
          <ArrowLeft size={16} /> Back to visits
        </Link>
        <h1 className="heading-2">{isEdit ? 'Edit Visit' : 'Record Health Visit'}</h1>
        <p className="body-md" style={{ color: 'var(--text-secondary)' }}>
          {isEdit ? 'Update the visit record.' : 'Assessment → Record findings → Save. Every visit becomes a new historical record.'}
        </p>
      </div>

      {isLoadingEdit ? (
        <div className="flex-center" style={{ padding: 'var(--space-12)' }}>
          <Spinner size={32} />
        </div>
      ) : (
      <form onSubmit={handleSubmit}>
        <div className="grid grid-2" style={{ gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
          <Card>
            <CardHeader title="Patient" description="Find the patient's existing record — do not create a duplicate" />
            <CardBody className="flex-col gap-4">
              {!formData.patient_id && (
                <>
                  <Input
                    label="Search Mother"
                    placeholder="Search by name, phone, community, or ID..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    leftIcon={<Search size={18} />}
                    helperText="Search the existing patient registry"
                  />
                  {isSearching && (
                    <div className="flex items-center gap-2">
                      <Spinner size={16} />
                      <span className="body-sm text-secondary">Searching...</span>
                    </div>
                  )}
                  {!isSearching && results.length > 0 && (
                    <div className="flex-col gap-2" style={{ maxHeight: '240px', overflowY: 'auto' }}>
                      {results.map(mother => (
                        <button
                          key={mother.id}
                          type="button"
                          onClick={() => selectPatient(mother)}
                          className="flex-between p-3"
                          style={{ background: 'var(--surface-sunken)', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', textAlign: 'left', width: '100%' }}
                        >
                          <span>
                            <span className="font-medium">{mother.full_name}</span>
                            <span className="caption text-secondary" style={{ display: 'block' }}>
                              {mother.community || 'Unknown community'}{mother.phone ? ` • ${mother.phone}` : ''}
                            </span>
                          </span>
                          {mother.risk_level === 'high' && <Badge variant="critical" solid>High Risk</Badge>}
                        </button>
                      ))}
                    </div>
                  )}
                  {!isSearching && searched && results.length === 0 && (
                    <p className="body-sm" style={{ color: 'var(--text-tertiary)' }}>
                      No matching patients. Check the name, phone number, or ID.
                    </p>
                  )}
                </>
              )}

              {formData.patient_id && (
                <div className="flex items-center gap-3 p-3" style={{ background: 'var(--surface-sunken)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ color: 'var(--color-primary-500)' }}><User size={20} /></div>
                  <div style={{ flex: 1 }}>
                    <p className="font-medium">{patientName || 'Patient selected'}</p>
                    <p className="caption text-secondary">Patient ID: <span className="font-medium">{patientCode || formData.patient_id.slice(0, 8)}</span></p>
                  </div>
                  <button type="button" className="icon-btn-sm" onClick={clearPatient} title="Change patient" aria-label="Change patient">
                    <X size={14} />
                  </button>
                </div>
              )}

              <div className="grid grid-2" style={{ gap: 'var(--space-4)' }}>
                <Input
                  label="Patient Type"
                  name="patient_type"
                  value={formData.patient_type === 'child' ? 'Child' : 'Mother'}
                  readOnly
                  onChange={() => {}}
                  helperText="Set from the patient record you selected"
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
            <CardHeader title="Health Assessment & Findings" />
            <CardBody className="flex-col gap-4">
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
              <Input
                label="Notes"
                name="notes"
                type="textarea"
                value={formData.notes}
                onChange={handleChange}
                rows={3}
                placeholder="General notes about the visit"
              />
            </CardBody>
          </Card>
        </div>

        <div className="flex gap-4" style={{ justifyContent: 'flex-end' }}>
          <Button 
            type="button" 
            variant="secondary" 
            onClick={() => navigate(`/${rolePrefix}/visits`)}
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            loading={isLoading || isSubmitting}
            variant={isSubmitted ? "success" : "primary"}
          >
            {isSubmitted ? 'Saved!' : isEdit ? 'Update Visit' : 'Save Visit'}
          </Button>
        </div>
      </form>
      )}

      <ConfirmDialog
        open={!!blockedNavigation}
        title="Unsaved changes"
        message="You have unsaved changes on this visit form. Leaving now will lose them. Do you want to continue?"
        onConfirm={() => { blockedNavigation?.proceed(); setBlockedNavigation(null); }}
        onCancel={() => { blockedNavigation?.reset(); setBlockedNavigation(null); }}
      />
    </div>
  );
};

export default VisitForm;
