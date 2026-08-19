import { useRef, useState } from 'react';
import { Activity, Thermometer, HeartPulse, Scale } from 'lucide-react';
import usePregnancyStore from '../../stores/pregnancyStore';
import useAuthStore from '../../stores/authStore';
import useAppStore from '../../stores/appStore';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { provenanceFor } from '../../lib/provenance';

export const AntenatalVisitForm = ({ pregnancyId, initialData, onSuccess, onCancel }) => {
  const { logAntenatalVisit, updateAntenatalVisit, isLoading } = usePregnancyStore();
  const { profile } = useAuthStore();
  const addToast = useAppStore((state) => state.addToast);
  const isOnline = useAppStore((state) => state.isOnline);
  const isEdit = !!initialData;
  const submittingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    pregnancy_id: pregnancyId,
    visit_date: initialData?.visit_date || new Date().toISOString().split('T')[0],
    gestational_age: initialData?.gestational_age || '',
    weight: initialData?.weight || '',
    blood_pressure: initialData?.blood_pressure || '',
    fundal_height: initialData?.fundal_height || '',
    fetal_heart_rate: initialData?.fetal_heart_rate || '',
    symptoms: initialData?.symptoms || '',
    notes: initialData?.notes || '',
    assessed_risk_level: initialData?.assessed_risk_level || ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Basic clinical sanity checks — reject impossible values instead of
    // storing corrupt records.
    const issues = [];
    if (formData.weight !== '' && (isNaN(formData.weight) || +formData.weight < 25 || +formData.weight > 160)) {
      issues.push('Weight should be between 25 and 160 kg.');
    }
    if (formData.fundal_height !== '' && (isNaN(formData.fundal_height) || +formData.fundal_height < 10 || +formData.fundal_height > 50)) {
      issues.push('Fundal height should be between 10 and 50 cm.');
    }
    if (formData.fetal_heart_rate !== '' && (isNaN(formData.fetal_heart_rate) || +formData.fetal_heart_rate < 80 || +formData.fetal_heart_rate > 220)) {
      issues.push('Fetal heart rate should be between 80 and 220 bpm.');
    }
    if (formData.gestational_age !== '' && (isNaN(formData.gestational_age) || +formData.gestational_age < 1 || +formData.gestational_age > 45)) {
      issues.push('Gestational age should be between 1 and 45 weeks.');
    }
    if (formData.blood_pressure) {
      const bpMatch = String(formData.blood_pressure).match(/^(\d{2,3})\s*\/\s*(\d{2,3})$/);
      if (!bpMatch) {
        issues.push('Blood pressure must be in "120/80" format.');
      } else {
        const systolic = +bpMatch[1];
        const diastolic = +bpMatch[2];
        if (systolic < 70 || systolic > 250 || diastolic < 40 || diastolic > 150 || systolic <= diastolic) {
          issues.push('Blood pressure values look incorrect (systolic 70-250, diastolic 40-150, systolic must exceed diastolic).');
        }
      }
    }

    if (issues.length > 0) {
      addToast({ type: 'error', title: 'Please check the values', message: issues.join(' ') });
      return;
    }

    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);

    const provenance = provenanceFor(profile);
    const { success, error } = isEdit
      ? await updateAntenatalVisit(initialData.id, formData)
      : await logAntenatalVisit({ ...formData, ...provenance, recorded_by: profile?.id || null });
    
    submittingRef.current = false;
    setIsSubmitting(false);

    if (success) {
      addToast({
        type: 'success',
        message: isOnline
          ? (isEdit ? 'Antenatal visit updated.' : 'Antenatal visit logged successfully.')
          : 'Antenatal visit saved offline — will sync when back online.',
      });
      if (onSuccess) onSuccess();
    } else {
      addToast({ type: 'error', title: 'Failed to log visit', message: error });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex-col gap-4">
      <div className="grid grid-2" style={{ gap: 'var(--space-4)' }}>
        <Input
          label="Visit Date"
          name="visit_date"
          type="date"
          value={formData.visit_date}
          onChange={handleChange}
          required
        />
        <Input
          label="Gestational Age (weeks)"
          name="gestational_age"
          type="number"
          value={formData.gestational_age}
          onChange={handleChange}
        />
      </div>

      <div style={{ borderTop: '1px solid var(--border-default)', margin: 'var(--space-2) 0' }} />
      <h4 className="heading-5" style={{ marginBottom: 'var(--space-2)' }}>Vitals & Measurements</h4>

      <div className="grid grid-2" style={{ gap: 'var(--space-4)' }}>
        <Input
          label="Weight (kg)"
          name="weight"
          type="number"
          step="0.1"
          value={formData.weight}
          onChange={handleChange}
          leftIcon={<Scale size={18} />}
        />
        <Input
          label="Blood Pressure (mmHg)"
          name="blood_pressure"
          placeholder="120/80"
          value={formData.blood_pressure}
          onChange={handleChange}
          leftIcon={<Activity size={18} />}
        />
        <Input
          label="Fundal Height (cm)"
          name="fundal_height"
          type="number"
          step="0.1"
          value={formData.fundal_height}
          onChange={handleChange}
          leftIcon={<Thermometer size={18} />}
        />
        <Input
          label="Fetal Heart Rate (bpm)"
          name="fetal_heart_rate"
          type="number"
          value={formData.fetal_heart_rate}
          onChange={handleChange}
          leftIcon={<HeartPulse size={18} />}
        />
      </div>

      <div style={{ borderTop: '1px solid var(--border-default)', margin: 'var(--space-2) 0' }} />
      
      <Input
        label="Symptoms / Complaints"
        name="symptoms"
        placeholder="e.g., Headache, Swelling, Bleeding (comma separated)"
        value={formData.symptoms}
        onChange={handleChange}
      />

      <Input
        label="Update Risk Level (Optional)"
        name="assessed_risk_level"
        type="select"
        value={formData.assessed_risk_level}
        onChange={handleChange}
        options={[
          { value: '', label: 'Keep Current Risk Level' },
          { value: 'low', label: 'Low Risk' },
          { value: 'medium', label: 'Medium Risk' },
          { value: 'high', label: 'High Risk' },
        ]}
      />

      <div className="input-group">
        <label className="input-label">Clinical Notes</label>
        <textarea 
          className="input-base"
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          rows={3}
          placeholder="Detailed observations and actions taken..."
        />
      </div>

      <div className="flex gap-3" style={{ justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>Cancel</Button>
        <Button type="submit" loading={isLoading || isSubmitting}>{isEdit ? 'Update Visit' : 'Log Visit'}</Button>
      </div>
    </form>
  );
};

export default AntenatalVisitForm;
