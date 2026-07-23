import { useState } from 'react';
import { Calendar, AlertTriangle } from 'lucide-react';
import usePregnancyStore from '../../stores/pregnancyStore';
import useAppStore from '../../stores/appStore';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

export const PregnancyForm = ({ motherId, onSuccess, onCancel }) => {
  const { registerPregnancy, isLoading } = usePregnancyStore();
  const addToast = useAppStore((state) => state.addToast);
  
  const [formData, setFormData] = useState({
    mother_id: motherId,
    lmp: '', // Last Menstrual Period
    edd: '', // Estimated Date of Delivery
    gravida: 1, // Total number of pregnancies
    para: 0, // Number of viable births
    risk_level: 'low',
    notes: ''
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

    const { success, error } = await registerPregnancy(formData);
    
    if (success) {
      addToast({ type: 'success', message: 'Pregnancy record created.' });
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
        <Button type="submit" loading={isLoading}>Save Record</Button>
      </div>
    </form>
  );
};

export default PregnancyForm;
