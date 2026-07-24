import { useState } from 'react';
import { Syringe, Calendar } from 'lucide-react';
import useChildStore from '../../stores/childStore';
import useAppStore from '../../stores/appStore';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

export const VaccineForm = ({ childId, initialData, onSuccess, onCancel }) => {
  const { recordVaccination, updateVaccination, isLoading } = useChildStore();
  const addToast = useAppStore((state) => state.addToast);
  const isEdit = !!initialData;
  
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

    const { success, error } = isEdit
      ? await updateVaccination(initialData.id, childId, formData)
      : await recordVaccination(childId, formData);
    
    if (success) {
      addToast({ type: 'success', message: isEdit ? 'Vaccination updated.' : 'Vaccination recorded.' });
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
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={isLoading}>{isEdit ? 'Update Vaccine' : 'Record Vaccine'}</Button>
      </div>
    </form>
  );
};

export default VaccineForm;
