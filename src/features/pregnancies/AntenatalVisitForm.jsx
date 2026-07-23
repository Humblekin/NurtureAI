import { useState } from 'react';
import { Activity, Thermometer, HeartPulse, Scale, ActivityIcon } from 'lucide-react';
import usePregnancyStore from '../../stores/pregnancyStore';
import useAppStore from '../../stores/appStore';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

export const AntenatalVisitForm = ({ pregnancyId, onSuccess, onCancel }) => {
  const { logAntenatalVisit, isLoading } = usePregnancyStore();
  const addToast = useAppStore((state) => state.addToast);
  
  const [formData, setFormData] = useState({
    pregnancy_id: pregnancyId,
    visit_date: new Date().toISOString().split('T')[0],
    gestational_age: '', // in weeks
    weight: '', // kg
    blood_pressure: '', // e.g., 120/80
    fundal_height: '', // cm
    fetal_heart_rate: '', // bpm
    symptoms: '',
    notes: '',
    assessed_risk_level: '' // optional update to risk level
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const { success, error } = await logAntenatalVisit(formData);
    
    if (success) {
      addToast({ type: 'success', message: 'Antenatal visit logged successfully.' });
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
          leftIcon={<ActivityIcon size={18} />}
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
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={isLoading}>Log Visit</Button>
      </div>
    </form>
  );
};

export default AntenatalVisitForm;
