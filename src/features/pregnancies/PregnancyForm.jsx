import { useState } from 'react';
import { Calendar, AlertTriangle } from 'lucide-react';
import usePregnancyStore from '../../stores/pregnancyStore';
import useAppStore from '../../stores/appStore';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

export const PregnancyForm = ({ motherId, initialData, onSuccess, onCancel }) => {
  const { registerPregnancy, updatePregnancy, isLoading } = usePregnancyStore();
  const addToast = useAppStore((state) => state.addToast);
  const isEdit = !!initialData;
  
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

    const { success, error } = isEdit
      ? await updatePregnancy(initialData.id, formData)
      : await registerPregnancy(formData);
    
    if (success) {
      addToast({ type: 'success', message: isEdit ? 'Pregnancy record updated.' : 'Pregnancy record created.' });
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
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={isLoading}>{isEdit ? 'Update Record' : 'Save Record'}</Button>
      </div>
    </form>
  );
};

export default PregnancyForm;
