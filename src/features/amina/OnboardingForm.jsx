import { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Check, Calendar, Heart, Stethoscope, Hospital, Apple, Baby, Plus, Trash2 } from 'lucide-react';
import useAuthStore from '../../stores/authStore';
import useMotherStore from '../../stores/motherStore';
import usePregnancyStore from '../../stores/pregnancyStore';
import useChildStore from '../../stores/childStore';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { provenanceFor } from '../../lib/provenance';
import styles from './OnboardingForm.module.css';

function buildInitialFormData() {
  const fields = {};
  for (const step of STEPS) {
    for (const f of step.fields) {
      fields[f.name] = '';
    }
  }
  return fields;
}

const STEPS = [
  {
    id: 'personal',
    title: 'Personal Information',
    titleDag: 'Bayanan Kai',
    icon: Heart,
    fields: [
      { name: 'full_name', label: 'Full Name', labelDag: 'Sunan Cikakke', type: 'text', required: true, placeholder: 'Your full name' },
      { name: 'date_of_birth', label: 'Date of Birth', labelDag: 'Ranar Haihuwa', type: 'date', required: true },
      { name: 'community', label: 'Community', labelDag: 'Al\'umma', type: 'text', required: true, placeholder: 'e.g. Tamale South' },
      { name: 'district', label: 'District', labelDag: 'Yanki', type: 'text', required: false, placeholder: 'e.g. Tamale Metropolitan' },
      { name: 'emergency_contact', label: 'Emergency Contact', labelDag: 'Lambar Gaggawa', type: 'text', required: false, placeholder: 'Phone number or name' },
    ],
  },
  {
    id: 'pregnancy',
    title: 'Pregnancy Information',
    titleDag: 'Bayanan Ciki',
    icon: Calendar,
    fields: [
      { name: 'is_pregnant', label: 'Are you currently pregnant?', labelDag: 'Kana ciki a yanzu?', type: 'select', required: true, options: [{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }] },
      { name: 'lmp', label: 'Last Menstrual Period', labelDag: 'Jinin na ƙarshe', type: 'date', required: true, condition: (d) => d.is_pregnant === 'Yes' },
      { name: 'is_first_pregnancy', label: 'Is this your first pregnancy?', labelDag: 'Shin wannan shine fara cikin ka?', type: 'select', required: true, options: [{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }], condition: (d) => d.is_pregnant === 'Yes' },
      { name: 'gravida', label: 'Total pregnancies (including current)', labelDag: 'Jimlar ciki', type: 'number', required: true, min: 1, condition: (d) => d.is_pregnant === 'Yes' },
      { name: 'para', label: 'Live births', labelDag: 'Yawan haihuwa', type: 'number', required: true, min: 0, condition: (d) => d.is_pregnant === 'Yes' && d.is_first_pregnancy !== 'Yes' },
      { name: 'previous_complications', label: 'Previous pregnancy complications', labelDag: 'Matsalar ciki na baya', type: 'textarea', required: false, placeholder: 'e.g. high blood pressure, bleeding', condition: (d) => d.is_pregnant === 'Yes' && d.is_first_pregnancy !== 'Yes' },
    ],
  },
  {
    id: 'medical',
    title: 'Medical History',
    titleDag: 'Tarihin Lafiya',
    icon: Stethoscope,
    fields: [
      { name: 'existing_conditions', label: 'Existing medical conditions', labelDag: 'Cututtukan da ke tattare', type: 'textarea', required: false, placeholder: 'e.g. diabetes, asthma, sickle cell' },
      { name: 'current_medications', label: 'Current medications or supplements', labelDag: 'Magungunan da ke tattare', type: 'textarea', required: false, placeholder: 'e.g. iron tablets, folic acid' },
      { name: 'blood_group', label: 'Blood group', labelDag: 'Irin jini', type: 'select', required: false, options: [
        { value: '', label: 'Select blood group' },
        { value: 'A+', label: 'A+' }, { value: 'A-', label: 'A-' },
        { value: 'B+', label: 'B+' }, { value: 'B-', label: 'B-' },
        { value: 'AB+', label: 'AB+' }, { value: 'AB-', label: 'AB-' },
        { value: 'O+', label: 'O+' }, { value: 'O-', label: 'O-' },
      ] },
    ],
  },
  {
    id: 'healthcare',
    title: 'Healthcare Information',
    titleDag: 'Bayanan Lafiya',
    icon: Hospital,
    fields: [
      { name: 'preferred_facility', label: 'Preferred health facility', labelDag: 'Asibitin da aka fi so', type: 'text', required: false, placeholder: 'e.g. Tamale Hospital' },
      { name: 'previous_anc', label: 'Have you attended ANC visits?', labelDag: 'Ka taɓa ziyarce asibit?', type: 'select', required: true, options: [{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }], condition: (d) => d.is_pregnant === 'Yes' },
    ],
  },
  {
    id: 'lifestyle',
    title: 'Lifestyle & Nutrition',
    titleDag: 'Rayuwa & Abinci',
    icon: Apple,
    fields: [
      { name: 'nutrition', label: 'Describe your eating habits', labelDag: 'Bayyana yadda kake cin abinci', type: 'textarea', required: false, placeholder: 'e.g. I eat three meals a day, lots of vegetables' },
      { name: 'supplements', label: 'Taking supplements (iron, folic acid)?', labelDag: 'Kana ɗauke da ƙarin abinci?', type: 'select', required: false, options: [{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }] },
    ],
  },
  {
    id: 'children',
    title: 'Children',
    titleDag: 'Yara',
    icon: Baby,
    fields: [
      { name: 'has_children', label: 'Do you have any children?', labelDag: 'Kana da wani yaro?', type: 'select', required: true, options: [{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }] },
    ],
  },
];

const calculateEDD = (lmp) => {
  if (!lmp) return null;
  const d = new Date(lmp);
  d.setDate(d.getDate() + 280);
  return d.toISOString().split('T')[0];
};

const OnboardingForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, user } = useAuthStore();
  const { registerMother } = useMotherStore();
  const { registerPregnancy } = usePregnancyStore();
  const { registerChild } = useChildStore();
  const language = location.state?.language || profile?.preferred_language || 'en';
  const [currentStep, setCurrentStep] = useState(0);
  const initialData = useRef(null);
  if (!initialData.current) {
    initialData.current = {
      ...buildInitialFormData(),
      phone: user?.phone || profile?.phone || '',
      preferred_language: language,
      children_list: [],
    };
  }
  const [formData, setFormData] = useState(initialData.current);
  const formRef = useRef(formData);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const step = STEPS[currentStep];
  const visibleFields = step.fields.filter(f => !f.condition || f.condition(formData));
  const totalSteps = STEPS.length;
  const progress = Math.round(((currentStep + 1) / totalSteps) * 100);

  const lang = (en, dag) => language === 'dag' ? dag : en;

  const handleChange = (name, value) => {
    formRef.current = { ...formRef.current, [name]: value };
    setFormData(formRef.current);
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }));
  };

  const validateStep = () => {
    const newErrors = {};
    const data = formRef.current;
    const fieldsToCheck = step.fields.filter(f => !f.condition || f.condition(data));
    for (const field of fieldsToCheck) {
      if (field.required && !data[field.name]?.toString().trim()) {
        newErrors[field.name] = `${field.label} is required`;
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    if (currentStep < totalSteps - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep(prev => prev - 1);
  };

  const handleSubmit = async () => {
    if (!validateStep()) return;
    const data = formRef.current;
    setIsSaving(true);
    setErrors({});

    try {
      // 1. Register mother profile
      const medicalHistory = [
        data.existing_conditions,
        data.current_medications ? `Current medications: ${data.current_medications}` : null,
        data.previous_complications ? `Previous complications: ${data.previous_complications}` : null,
      ].filter(Boolean).join('. ') || null;

      const edd = data.lmp ? calculateEDD(data.lmp) : null;

      const motherResult = await registerMother({
        profile_id: profile.id,
        full_name: data.full_name || profile?.full_name || 'Unknown',
        date_of_birth: data.date_of_birth || null,
        phone: user?.phone || profile?.phone || null,
        community: data.community || null,
        blood_group: data.blood_group || null,
        medical_history: medicalHistory,
        risk_level: 'low',
        assigned_worker_id: null,
        edd,
        ...provenanceFor(profile),
      });

      if (!motherResult.success) {
        setErrors({ submit: 'Failed to save your profile. Please try again.' });
        return;
      }

      const motherId = motherResult.data.id;

      // 2. Register pregnancy if applicable
      if (data.is_pregnant === 'Yes') {
        const pregResult = await registerPregnancy({
          mother_id: motherId,
          status: 'active',
          risk_level: 'low',
          lmp: data.lmp || null,
          edd,
          gravida: parseInt(data.gravida) || 1,
          para: parseInt(data.para) || 0,
          notes: [
            data.previous_complications ? `Previous complications: ${data.previous_complications}` : null,
            data.nutrition ? `Nutrition: ${data.nutrition}` : null,
            data.supplements === 'Yes' ? 'Taking supplements' : null,
          ].filter(Boolean).join('. ') || null,
          ...provenanceFor(profile),
        });

        if (!pregResult.success) {
          console.warn('Pregnancy registration failed:', pregResult.error);
        }
      }

      // 3. Register children if applicable
      if (data.has_children === 'Yes' && data.children_list?.length > 0) {
        for (const child of data.children_list) {
          const childResult = await registerChild({
            mother_id: motherId,
            full_name: child.name || 'Unknown',
            date_of_birth: child.date_of_birth || null,
            gender: child.gender || null,
            birth_weight: child.birth_weight ? parseFloat(child.birth_weight) : null,
            ...provenanceFor(profile),
          });

          if (!childResult.success) {
            console.warn('Child registration failed:', childResult.error);
          }
        }
      }

      // 4. Navigate to Amina (mother's home)
      navigate('/mother/amina', { replace: true });
    } catch (err) {
      console.error('Onboarding form error:', err);
      setErrors({ submit: 'Something went wrong. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  const renderField = (field) => {
    const value = formData[field.name] || '';
    const error = errors[field.name];
    const label = lang(field.label, field.labelDag || field.label);

    const inputProps = {
      label,
      name: field.name,
      value,
      onChange: (e) => handleChange(field.name, e.target.value),
      error,
      required: field.required,
    };

    if (field.type === 'select') {
      return <Input {...inputProps} type="select" options={field.options} />;
    }
    if (field.type === 'textarea') {
      return <Input {...inputProps} type="textarea" placeholder={field.placeholder} />;
    }
    if (field.type === 'date') {
      return <Input {...inputProps} type="date" />;
    }
    if (field.type === 'number') {
      return <Input {...inputProps} type="number" min={field.min} />;
    }
    return <Input {...inputProps} type="text" placeholder={field.placeholder} />;
  };

  const addChild = () => {
    const next = {
      ...formRef.current,
      children_list: [...(formRef.current.children_list || []), { name: '', date_of_birth: '', gender: '', birth_weight: '' }],
    };
    formRef.current = next;
    setFormData(next);
  };

  const removeChild = (index) => {
    const next = {
      ...formRef.current,
      children_list: formRef.current.children_list.filter((_, i) => i !== index),
    };
    formRef.current = next;
    setFormData(next);
  };

  const updateChild = (index, field, value) => {
    const next = {
      ...formRef.current,
      children_list: formRef.current.children_list.map((child, i) =>
        i === index ? { ...child, [field]: value } : child
      ),
    };
    formRef.current = next;
    setFormData(next);
  };

  const renderChildrenSection = () => {
    const children = formData.children_list || [];
    const hasChildren = formData.has_children === 'Yes';

    return (
      <div>
        <Input
          label={lang('Do you have any children?', 'Kana da wani yaro?')}
          name="has_children"
          type="select"
          value={formData.has_children || ''}
          onChange={(e) => {
            handleChange('has_children', e.target.value);
            if (e.target.value === 'No') {
              const next = { ...formRef.current, children_list: [] };
              formRef.current = next;
              setFormData(next);
            }
          }}
          options={[{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }]}
          required
        />

        {hasChildren && (
          <div style={{ marginTop: 'var(--space-4)' }}>
            {children.map((child, index) => (
              <div
                key={index}
                style={{
                  padding: 'var(--space-4)',
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-lg)',
                  marginBottom: 'var(--space-3)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                  <span style={{ fontWeight: '600', fontSize: 'var(--text-sm)' }}>
                    {lang(`Child ${index + 1}`, `Yaro ${index + 1}`)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeChild(index)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-danger-500)',
                      cursor: 'pointer',
                      padding: 'var(--space-1)',
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="flex-col gap-3">
                  <Input
                    label={lang('Name', 'Sunan')}
                    value={child.name}
                    onChange={(e) => updateChild(index, 'name', e.target.value)}
                    placeholder={lang("Child's name", "Sunan yaro")}
                    required
                  />
                  <Input
                    label={lang('Date of Birth', 'Ranar Haihuwa')}
                    type="date"
                    value={child.date_of_birth}
                    onChange={(e) => updateChild(index, 'date_of_birth', e.target.value)}
                  />
                  <Input
                    label={lang('Gender', 'Jinsi')}
                    type="select"
                    value={child.gender}
                    onChange={(e) => updateChild(index, 'gender', e.target.value)}
                    options={[
                      { value: '', label: lang('Select', 'Zaɓi') },
                      { value: 'male', label: lang('Boy', 'Baɗɗo') },
                      { value: 'female', label: lang('Girl', 'Kuɗiya') },
                    ]}
                  />
                  <Input
                    label={lang('Birth Weight (kg)', 'Nauyin Haihuwa (kg)')}
                    type="number"
                    value={child.birth_weight}
                    onChange={(e) => updateChild(index, 'birth_weight', e.target.value)}
                    placeholder="e.g. 3.2"
                    min="0.5"
                    max="6"
                    step="0.1"
                  />
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addChild}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: 'var(--space-3) var(--space-4)',
                background: 'var(--color-primary-50)',
                color: 'var(--color-primary-600)',
                border: '1px dashed var(--color-primary-300)',
                borderRadius: 'var(--radius-lg)',
                cursor: 'pointer',
                width: '100%',
                justifyContent: 'center',
                fontSize: 'var(--text-sm)',
                fontWeight: '600',
              }}
            >
              <Plus size={16} />
              {lang('Add Another Child', 'Ƙara Wani Yaro')}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <button className={styles.backBtn} onClick={() => navigate('/mother/welcome')}>
            <ArrowLeft size={20} />
          </button>
          <div className={styles.headerCenter}>
            <h2 className={styles.headerTitle}>{lang('Health Profile Setup', 'Kirkira Littafin Lafiya')}</h2>
            <p className={styles.headerSubtitle}>{lang(`Step ${currentStep + 1} of ${totalSteps}`, `Mataki ${currentStep + 1} na ${totalSteps}`)}</p>
          </div>
          <div className={styles.progressRing}>
            <svg viewBox="0 0 36 36">
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="var(--border-color)"
                strokeWidth="3"
              />
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="var(--color-primary-500)"
                strokeWidth="3"
                strokeDasharray={`${progress}, 100`}
                strokeLinecap="round"
              />
            </svg>
            <span className={styles.progressText}>{progress}%</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>

        {/* Step dots */}
        <div className={styles.stepDots}>
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <div
                key={s.id}
                className={`${styles.stepDot} ${i === currentStep ? styles.stepDotActive : ''} ${i < currentStep ? styles.stepDotDone : ''}`}
              >
                <Icon size={14} />
              </div>
            );
          })}
        </div>

        {/* Form content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
            className={styles.formSection}
          >
            <h3 className={styles.stepTitle}>{lang(step.title, step.titleDag)}</h3>
            <div className={styles.fields}>
              {step.id === 'children' ? (
                renderChildrenSection()
              ) : (
                visibleFields.map(field => (
                  <div key={field.name}>{renderField(field)}</div>
                ))
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Error message */}
        {errors.submit && (
          <div className={styles.errorMessage}>{errors.submit}</div>
        )}

        {/* Navigation */}
        <div className={styles.nav}>
          {currentStep > 0 && (
            <Button variant="secondary" onClick={handleBack} fullWidth>
              {lang('Back', 'Baya')}
            </Button>
          )}
          {currentStep < totalSteps - 1 ? (
            <Button onClick={handleNext} fullWidth>
              {lang('Next', 'Gaba')}
            </Button>
          ) : (
            <Button onClick={handleSubmit} fullWidth loading={isSaving}>
              <Check size={18} />
              {lang('Complete Setup', 'Kammala Saitin')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingForm;
