import { useRef, useState } from 'react';
import { Calendar, AlertTriangle } from 'lucide-react';
import usePregnancyStore from '../../stores/pregnancyStore';
import useAuthStore from '../../stores/authStore';
import useAppStore from '../../stores/appStore';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { provenanceFor } from '../../lib/provenance';

export const PregnancyForm = ({ motherId, initialData, onSuccess, onCancel }) => {
  const { registerPregnancy, updatePregnancy, isLoading } = usePregnancyStore();
  const { profile } = useAuthStore();
  const addToast = useAppStore((state) => state.addToast);
  const isOnline = useAppStore((state) => state.isOnline);
  const isEdit = !!initialData;
  const submittingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    mother_id: motherId,
    lmp: initialData?.lmp || '',
    edd: initialData?.edd || '',
    gravida: initialData?.gravida || 1,
    para: initialData?.para || 0,
    risk_level: initialData?.risk_level || 'low',
    notes: initialData?.notes || ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.lmp && !formData.edd) {
      addToast({ type: 'error', message: 'Please provide either LMP or EDD.' });
      return;
    }

    // Basic sanity checks so impossible dates/counts never corrupt the record.
    const issues = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (formData.lmp) {
      const lmpDate = new Date(formData.lmp + 'T00:00:00');
      if (isNaN(lmpDate.getTime())) {
        issues.push('The LMP date is not valid.');
      } else if (lmpDate > today) {
        issues.push('The LMP date cannot be in the future.');
      } else if ((today - lmpDate) / (1000 * 60 * 60 * 24) > 315) {
        issues.push('The LMP date is more than 45 weeks ago — please double-check it.');
      }
    }
    if (formData.edd) {
      const eddDate = new Date(formData.edd + 'T00:00:00');
      if (isNaN(eddDate.getTime())) {
        issues.push('The EDD date is not valid.');
      } else if (eddDate < today) {
        issues.push('The EDD is in the past — please confirm the expected delivery date.');
      } else if ((eddDate - today) / (1000 * 60 * 60 * 24) > 315) {
        issues.push('The EDD is more than 45 weeks away — please double-check it.');
      }
    }
    const gravida = Number(formData.gravida);
    const para = Number(formData.para);
    if (isNaN(gravida) || gravida < 1 || gravida > 30) issues.push('Gravida should be between 1 and 30.');
    if (isNaN(para) || para < 0 || para > 30) issues.push('Para should be between 0 and 30.');
    if (!isNaN(gravida) && !isNaN(para) && para > gravida) issues.push('Para cannot exceed gravida.');

    if (issues.length > 0) {
      addToast({ type: 'error', title: 'Please check the values', message: issues.join(' ') });
      return;
    }

    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);

    const provenance = provenanceFor(profile);
    const { success, error } = isEdit
      ? await updatePregnancy(initialData.id, formData)
      : await registerPregnancy({ ...formData, ...provenance });
    
    submittingRef.current = false;
    setIsSubmitting(false);

    if (success) {
      addToast({
        type: 'success',
        message: isOnline
          ? (isEdit ? 'Pregnancy record updated.' : 'Pregnancy record created.')
          : 'Pregnancy record saved offline — will sync when back online.',
      });
      if (onSuccess) onSuccess();
    } else {
      addToast({ type: 'error', title: 'Failed to create record', message: error });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex-col gap-4">
      <div className="grid grid-2" style={{ gap: 'var(--space-4)' }}>
        <Input
          label="Last Menstrual Period (LMP)"
          name="lmp"
          type="date"
          value={formData.lmp}
          onChange={handleChange}
          leftIcon={<Calendar size={18} />}
        />
        <Input
          label="Estimated Date of Delivery (EDD)"
          name="edd"
          type="date"
          value={formData.edd}
          onChange={handleChange}
          leftIcon={<Calendar size={18} />}
        />
      </div>

      <div className="grid grid-2" style={{ gap: 'var(--space-4)' }}>
        <Input
          label="Gravida (Total Pregnancies)"
          name="gravida"
          type="number"
          min="1"
          value={formData.gravida}
          onChange={handleChange}
          required
        />
        <Input
          label="Para (Live Births)"
          name="para"
          type="number"
          min="0"
          value={formData.para}
          onChange={handleChange}
          required
        />
      </div>

      <Input
        label="Initial Risk Assessment"
        name="risk_level"
        type="select"
        value={formData.risk_level}
        onChange={handleChange}
        leftIcon={<AlertTriangle size={18} />}
        options={[
          { value: 'low', label: 'Low Risk' },
          { value: 'medium', label: 'Medium Risk' },
          { value: 'high', label: 'High Risk' },
        ]}
      />

      <div className="input-group">
        <label className="input-label">Notes</label>
        <textarea 
          className="input-base"
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          rows={3}
          placeholder="Any initial observations or notes"
        />
      </div>

      <div className="flex gap-3" style={{ justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>Cancel</Button>
        <Button type="submit" loading={isLoading || isSubmitting}>{isEdit ? 'Update Record' : 'Save Record'}</Button>
      </div>
    </form>
  );
};

export default PregnancyForm;
