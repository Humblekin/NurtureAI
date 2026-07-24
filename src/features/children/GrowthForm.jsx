import { useState } from 'react';
import { TrendingUp, Calendar } from 'lucide-react';
import useChildStore from '../../stores/childStore';
import useAppStore from '../../stores/appStore';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

export const GrowthForm = ({ childId, initialData, onSuccess, onCancel }) => {
  const { recordGrowth, updateGrowthRecord, isLoading } = useChildStore();
  const addToast = useAppStore((state) => state.addToast);
  const isEdit = !!initialData;
  
  const [formData, setFormData] = useState({
    recorded_date: initialData?.recorded_date || new Date().toISOString().split('T')[0],
    weight_kg: initialData?.weight_kg ?? initialData?.weight ?? '',
    height_cm: initialData?.height_cm ?? initialData?.height ?? '',
    head_circumference_cm: initialData?.head_circumference_cm || '',
    muac_cm: initialData?.muac_cm || '',
    notes: initialData?.notes || '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.weight_kg && !formData.height_cm) {
      addToast({ type: 'error', message: 'At least weight or height is required.' });
      return;
    }

    const payload = {
      ...formData,
      weight: parseFloat(formData.weight_kg) || null,
      height: parseFloat(formData.height_cm) || null,
    };
    const { success, error } = isEdit
      ? await updateGrowthRecord(initialData.id, childId, payload)
      : await recordGrowth(childId, payload);
    
    if (success) {
      addToast({ type: 'success', message: isEdit ? 'Growth record updated.' : 'Growth measurement recorded.' });
      if (onSuccess) onSuccess();
    } else {
      addToast({ type: 'error', title: 'Failed to record', message: error });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex-col gap-4">
      <Input
        label="Date"
        name="recorded_date"
        type="date"
        value={formData.recorded_date}
        onChange={handleChange}
        leftIcon={<Calendar size={18} />}
        required
      />

      <div className="grid grid-2" style={{ gap: 'var(--space-4)' }}>
        <Input
          label="Weight (kg)"
          name="weight_kg"
          type="number"
          step="0.1"
          min="0"
          value={formData.weight_kg}
          onChange={handleChange}
          leftIcon={<TrendingUp size={18} />}
        />
        <Input
          label="Height (cm)"
          name="height_cm"
          type="number"
          step="0.1"
          min="0"
          value={formData.height_cm}
          onChange={handleChange}
          leftIcon={<TrendingUp size={18} />}
        />
      </div>

      <div className="grid grid-2" style={{ gap: 'var(--space-4)' }}>
        <Input
          label="Head Circumference (cm)"
          name="head_circumference_cm"
          type="number"
          step="0.1"
          min="0"
          value={formData.head_circumference_cm}
          onChange={handleChange}
        />
        <Input
          label="MUAC (cm)"
          name="muac_cm"
          type="number"
          step="0.1"
          min="0"
          value={formData.muac_cm}
          onChange={handleChange}
        />
      </div>

      <div className="input-group">
        <label className="input-label">Notes</label>
        <textarea 
          className="input-base"
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          rows={2}
          placeholder="Any observations"
        />
      </div>

      <div className="flex gap-3" style={{ justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={isLoading}>{isEdit ? 'Update Measurement' : 'Record Measurement'}</Button>
      </div>
    </form>
  );
};

export default GrowthForm;
