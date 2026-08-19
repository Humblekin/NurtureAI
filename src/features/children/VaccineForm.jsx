import { useRef, useState } from 'react';
import { Syringe, Calendar } from 'lucide-react';
import useChildStore from '../../stores/childStore';
import useAuthStore from '../../stores/authStore';
import useTimelineStore from '../../stores/timelineStore';
import useAppStore from '../../stores/appStore';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { provenanceFor } from '../../lib/provenance';

export const VaccineForm = ({ childId, initialData, onSuccess, onCancel }) => {
  const { recordVaccination, updateVaccination, isLoading } = useChildStore();
  const { profile } = useAuthStore();
  const addToast = useAppStore((state) => state.addToast);
  const isOnline = useAppStore((state) => state.isOnline);
  const isEdit = !!initialData;
  const submittingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    vaccine_name: initialData?.vaccine_name || '',
    date_given: initialData?.date_given || new Date().toISOString().split('T')[0],
    dose: initialData?.dose || 1,
    batch_number: initialData?.batch_number || '',
    notes: initialData?.notes || '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.vaccine_name) {
      addToast({ type: 'error', message: 'Vaccine name is required.' });
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const givenDate = new Date(formData.date_given);
    givenDate.setHours(0, 0, 0, 0);
    if (isNaN(givenDate.getTime())) {
      addToast({ type: 'error', message: 'Please enter a valid date.' });
      return;
    }
    if (givenDate > today) {
      addToast({ type: 'error', message: 'Vaccination date cannot be in the future.' });
      return;
    }
    if (!formData.dose || +formData.dose < 1) {
      addToast({ type: 'error', message: 'Dose number must be at least 1.' });
      return;
    }

    if (!profile?.id) {
      addToast({ type: 'error', message: 'You must be signed in to record a vaccination.' });
      return;
    }

    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);

    const provenance = provenanceFor(profile);
    const { success, error } = isEdit
      ? await updateVaccination(initialData.id, childId, formData)
      : await recordVaccination(childId, { ...formData, ...provenance, administered_by: profile.id });
    
    submittingRef.current = false;
    setIsSubmitting(false);

    if (success) {
      await useTimelineStore.getState().buildChildTimeline(childId);
      addToast({
        type: 'success',
        message: isOnline
          ? (isEdit ? 'Vaccination updated.' : 'Vaccination recorded.')
          : 'Vaccination saved offline — will sync when back online.',
      });
      if (onSuccess) onSuccess();
    } else {
      addToast({ type: 'error', title: 'Failed to record', message: error });
    }
  };

  const vaccines = [
    'BCG', 'OPV 0', 'OPV 1', 'OPV 2', 'OPV 3',
    'Penta 1', 'Penta 2', 'Penta 3',
    'PCV 1', 'PCV 2', 'PCV 3',
    'Rota 1', 'Rota 2', 'Rota 3',
    'Measles-Rubella 1', 'Measles-Rubella 2',
    'Yellow Fever', 'Meningitis A',
  ];

  return (
    <form onSubmit={handleSubmit} className="flex-col gap-4">
      <Input
        label="Vaccine Name"
        name="vaccine_name"
        type="select"
        value={formData.vaccine_name}
        onChange={handleChange}
        leftIcon={<Syringe size={18} />}
        options={[
          { value: '', label: 'Select Vaccine' },
          ...vaccines.map(v => ({ value: v, label: v })),
        ]}
        required
      />

      <div className="grid grid-2" style={{ gap: 'var(--space-4)' }}>
        <Input
          label="Date Given"
          name="date_given"
          type="date"
          value={formData.date_given}
          onChange={handleChange}
          leftIcon={<Calendar size={18} />}
          required
        />
        <Input
          label="Dose Number"
          name="dose"
          type="number"
          min="1"
          value={formData.dose}
          onChange={handleChange}
          required
        />
      </div>

      <Input
        label="Batch Number (Optional)"
        name="batch_number"
        value={formData.batch_number}
        onChange={handleChange}
      />

      <div className="input-group">
        <label className="input-label">Notes</label>
        <textarea 
          className="input-base"
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          rows={2}
          placeholder="Any reactions or observations"
        />
      </div>

      <div className="flex gap-3" style={{ justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>Cancel</Button>
        <Button type="submit" loading={isLoading || isSubmitting}>{isEdit ? 'Update Vaccine' : 'Record Vaccine'}</Button>
      </div>
    </form>
  );
};

export default VaccineForm;
