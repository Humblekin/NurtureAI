import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Check, Calendar, Heart, Stethoscope, Hospital, Apple, Baby, Plus, Trash2, Mic, MicOff, AlertTriangle } from 'lucide-react';
import useAuthStore from '../../stores/authStore';
import useOnboardingStore from '../../stores/onboardingStore';
import {
  PROFILE_STEPS,
  CHILD_FIELDS,
  formDataFromDraft,
  draftFromFormData,
  fieldValueFromSpeech,
} from '../../services/onboardingFields';
import { useFieldDictation } from '../../hooks/useFieldDictation';
import { calculateEDDFromLMP } from '../../lib/pregnancy';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import styles from './OnboardingForm.module.css';

// Icons stay in the view layer; the shared module holds only data so the
// conversation engine can use the same field definitions without importing JSX.
const STEP_ICONS = {
  personal: Heart,
  pregnancy: Calendar,
  medical: Stethoscope,
  healthcare: Hospital,
  lifestyle: Apple,
  children: Baby,
};

const STEPS = PROFILE_STEPS.map((step) => ({ ...step, icon: STEP_ICONS[step.id] }));

const OnboardingForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, user } = useAuthStore();
  const { draft, confirmAndSave, clearDraft } = useOnboardingStore();
  const language = location.state?.language || profile?.preferred_language || 'en';
  const fromVoice = !!location.state?.fromVoice;
  const [currentStep, setCurrentStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState({});

  // Seed once. When Amina collected the answers first, they arrive as a draft
  // and every field is pre-filled — so this screen is a review she can correct,
  // not a second interview. `formDataFromDraft` coerces each value, so a date
  // the AI heard wrong still lands as a usable input or a blank to fix.
  const initialData = useRef(null);
  if (!initialData.current) {
    const seeded = draft ? formDataFromDraft(draft) : null;
    const base = seeded || formDataFromDraft({});
    initialData.current = {
      ...base,
      phone: user?.phone || profile?.phone || seeded?.phone || '',
      preferred_language: language,
    };
  }

  const [formData, setFormData] = useState(initialData.current);
  const formRef = useRef(formData);

  // The due date is derived from the last menstrual period. Amina may have
  // collected an explicit one, otherwise show what the system expects so she
  // can sanity-check the maths instead of wondering why it is blank.
  const lmp = formData.lmp;
  useEffect(() => {
    const current = formRef.current;
    if (!current.lmp || current.edd) return;
    const derived = calculateEDDFromLMP(current.lmp);
    if (derived) {
      formRef.current = { ...current, edd: derived };
      setFormData(formRef.current);
    }
  }, [lmp]);

  // Which field the mic is dictating into: null | { name } | { childIndex, field }
  const [dictateTarget, setDictateTarget] = useState(null);
  const [pendingOverwrite, setPendingOverwrite] = useState(null);
  const [interimText, setInterimText] = useState('');

  const { isListening, start: startDictation, stop: stopDictation, error: dictationError, isSupported: sttSupported, onFinal, onInterim } =
    useFieldDictation(language);

  const step = STEPS[currentStep];
  const visibleFields = step.fields.filter(f => !f.condition || f.condition(formData));
  const totalSteps = STEPS.length;
  const progress = Math.round(((currentStep + 1) / totalSteps) * 100);

  const lang = (en, dag) => language === 'dag' ? dag : en;

  const applyFormData = useCallback((next) => {
    formRef.current = next;
    setFormData(next);
  }, []);

  const handleChange = (name, value) => {
    formRef.current = { ...formRef.current, [name]: value };
    setFormData(formRef.current);
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }));
  };

  // ---- Dictation -------------------------------------------------------
  // Speech fills the field the mother is looking at, and nothing else. It
  // never navigates the form or submits, so a misheard word can cost a field
  // but never the whole profile.

  const readFieldValue = useCallback((target) => {
    const data = formRef.current;
    if (!target) return '';
    if (target.childIndex !== undefined) {
      return data.children_list?.[target.childIndex]?.[target.field] || '';
    }
    return data[target.name] || '';
  }, []);

  const writeFieldValue = useCallback((target, value) => {
    const data = formRef.current;
    if (target.childIndex !== undefined) {
      const children = (data.children_list || []).map((child, i) =>
        i === target.childIndex ? { ...child, [target.field]: value } : child
      );
      applyFormData({ ...data, children_list: children });
      return;
    }
    applyFormData({ ...data, [target.name]: value });
    if (errors[target.name]) setErrors(prev => ({ ...prev, [target.name]: null }));
  }, [applyFormData, errors]);

  const commitDictation = useCallback((target, speech) => {
    const field = target.childIndex !== undefined
      ? CHILD_FIELDS.find(f => f.name === target.field)
      : step.fields.find(f => f.name === target.name);

    const value = fieldValueFromSpeech(field, speech);
    if (value === null) return;

    // Never silently destroy something she already typed or that came from
    // Amina. Anything unclear goes to a confirm step instead.
    const existing = readFieldValue(target);
    if (existing && existing !== value) {
      setPendingOverwrite({ target, value, existing, speech });
      return;
    }
    writeFieldValue(target, value);
  }, [readFieldValue, writeFieldValue, step.fields]);

  const stopDictationNow = useCallback(() => {
    stopDictation();
    setDictateTarget(null);
    setInterimText('');
  }, [stopDictation]);

  const toggleDictation = useCallback((target) => {
    setPendingOverwrite(null);
    if (isListening) {
      stopDictationNow();
      return;
    }
    setInterimText('');
    setDictateTarget(target);
    startDictation();
  }, [isListening, startDictation, stopDictationNow]);

  useEffect(() => {
    onInterim((text) => setInterimText(text || ''));
  }, [onInterim]);

  useEffect(() => {
    onFinal((text) => {
      const target = dictateTarget;
      if (!target || !text?.trim()) return;
      commitDictation(target, text);
      stopDictationNow();
    });
  }, [onFinal, dictateTarget, commitDictation, stopDictationNow]);

  // Leaving the step stops the mic so it can never listen to another field.
  useEffect(() => () => { stopDictation(); }, [stopDictation]);

  useEffect(() => {
    if (pendingOverwrite) stopDictation();
  }, [pendingOverwrite, stopDictation]);

  const validateStep = () => {
    const newErrors = {};
    const data = formRef.current;
    const fieldsToCheck = step.fields.filter(f => !f.condition || f.condition(data));
    for (const field of fieldsToCheck) {
      if (field.required && !data[field.name]?.toString().trim()) {
        newErrors[field.name] = lang(
          `${field.label} is required`,
          `${field.labelDag || field.label} a buƙatar`
        );
      }
    }
    // Child names live in the repeater, not in the step's field list, so the
    // loop above never saw them — a child could be saved with no name at all.
    if (step.id === 'children' && data.has_children === 'Yes') {
      (data.children_list || []).forEach((child, i) => {
        if (!child?.name?.trim()) {
          newErrors[`child_${i}`] = lang(
            `Child ${i + 1} needs a name`,
            `Yaro ${i + 1} yana buƙatar suna`
          );
        }
      });
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
    setIsSaving(true);
    setErrors({});

    try {
      // One save path for both setup routes. The form used to write the mother,
      // pregnancy and children records itself, which meant it skipped
      // claim_mother (so a mother who registered via voice and then filled this
      // form got two records), the community health worker lookup, the welcome
      // journal entry and the welcome notification.
      const draftToSave = draftFromFormData(formRef.current);
      const result = await confirmAndSave(true, {
        profileId: profile?.id,
        userId: profile?.id || user?.id,
        phone: user?.phone || profile?.phone,
      }, draftToSave);

      if (!result?.success) {
        setErrors({ submit: result?.error || 'Failed to save your profile. Please try again.' });
        return;
      }

      clearDraft();
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
    const target = { name: field.name };
    const isDictating = isListening && dictateTarget?.name === field.name && dictateTarget?.childIndex === undefined;

    const inputProps = {
      label,
      name: field.name,
      value,
      onChange: (e) => handleChange(field.name, e.target.value),
      error,
      required: field.required,
      // edd is derived from the last menstrual period, never typed.
      readOnly: !!field.readOnly,
    };

    let control;
    if (field.type === 'select') {
      control = <Input {...inputProps} type="select" options={field.options} />;
    } else if (field.type === 'textarea') {
      control = <Input {...inputProps} type="textarea" placeholder={field.placeholder} />;
    } else if (field.type === 'date') {
      control = <Input {...inputProps} type="date" />;
    } else if (field.type === 'number') {
      control = <Input {...inputProps} type="number" min={field.min} />;
    } else {
      control = <Input {...inputProps} type="text" placeholder={field.placeholder} />;
    }

    if (field.readOnly) return <div>{control}</div>;

    return (
      <div>
        {control}
        {sttSupported && (
          <div className={styles.dictateRow}>
            <button
              type="button"
              className={`${styles.dictateBtn} ${isDictating ? styles.dictateBtnActive : ''}`}
              onClick={() => toggleDictation(target)}
              aria-label={lang(`Speak to fill ${field.label}`, `Yi magana don cika ${field.labelDag || field.label}`)}
            >
              {isDictating ? <MicOff size={14} /> : <Mic size={14} />}
              <span>
                {isDictating
                  ? lang('Stop', 'Tsaya')
                  : lang('Speak', 'Yi magana')}
              </span>
            </button>
            {isDictating && (
              <span className={styles.dictateHint}>
                {interimText
                  ? `“${interimText}”`
                  : lang('Listening…', 'Ana saurare…')}
              </span>
            )}
          </div>
        )}
      </div>
    );
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

  const renderChildField = (index, field) => {
    const child = formData.children_list[index] || {};
    const target = { childIndex: index, field: field.name };
    const isDictating = isListening
      && dictateTarget?.childIndex === index
      && dictateTarget?.field === field.name;

    const props = {
      label: lang(field.label, field.labelDag || field.label),
      value: child[field.name] ?? '',
      onChange: (e) => updateChild(index, field.name, e.target.value),
      required: field.required,
      placeholder: field.placeholder,
      error: field.name === 'name' ? errors[`child_${index}`] : undefined,
    };

    let control;
    if (field.type === 'select') {
      control = <Input {...props} type="select" options={field.options} />;
    } else if (field.type === 'date') {
      control = <Input {...props} type="date" />;
    } else if (field.type === 'number') {
      control = <Input {...props} type="number" min={field.min} max={field.max} step={field.step} />;
    } else {
      control = <Input {...props} type="text" />;
    }

    if (!sttSupported) return control;

    return (
      <div>
        {control}
        <div className={styles.dictateRow}>
          <button
            type="button"
            className={`${styles.dictateBtn} ${isDictating ? styles.dictateBtnActive : ''}`}
            onClick={() => toggleDictation(target)}
            aria-label={lang(`Speak to fill ${field.label}`, `Yi magana don cika ${field.labelDag || field.label}`)}
          >
            {isDictating ? <MicOff size={14} /> : <Mic size={14} />}
            <span>
              {isDictating ? lang('Stop', 'Tsaya') : lang('Speak', 'Yi magana')}
            </span>
          </button>
          {isDictating && (
            <span className={styles.dictateHint}>
              {interimText ? `“${interimText}”` : lang('Listening…', 'Ana saurare…')}
            </span>
          )}
        </div>
      </div>
    );
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
                  {CHILD_FIELDS.map(f => (
                    <div key={f.name}>{renderChildField(index, f)}</div>
                  ))}
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
            <h2 className={styles.headerTitle}>
              {fromVoice
                ? lang('Check Your Details', 'Duba Bayananka')
                : lang('Health Profile Setup', 'Kirkira Littafin Lafiya')}
            </h2>
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

        {dictationError && (
          <div className={styles.dictateError}>{dictationError}</div>
        )}

        {/* Progress bar */}
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>

        {/* Arrived from Amina: these answers were spoken, so invite a check */}
        {fromVoice && (
          <div className={styles.reviewBanner}>
            <span className={styles.reviewBadge}>{lang('From Amina', 'Daga Amina')}</span>
            <span>
              {lang(
                'Amina filled these in from your conversation. Check anything that looks wrong, then save.',
                'Amina cika waƙannan daga magayarka. Ka duba abin da ba daidai ba, sannan ka ajiye.'
              )}
            </span>
          </div>
        )}

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

        {/* Overwrite confirmation — speech must never destroy an existing answer */}
        <AnimatePresence>
          {pendingOverwrite && (
            <motion.div
              className={styles.overwriteOverlay}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className={styles.overwriteCard}>
                <div className={styles.overwriteTitle}>
                  <AlertTriangle size={18} />
                  {lang('Replace what is already here?', 'Sanya wannan sabo?')}
                </div>
                <p className={styles.overwriteBody}>
                  {lang('This field already has an answer.', 'Wannan fildin yana da amsa.')}
                </p>
                <div className={styles.overwriteValues}>
                  <div>
                    <span>{lang('Currently', 'Yanzu')}</span>
                    <strong>{pendingOverwrite.existing}</strong>
                  </div>
                  <div>
                    <span>{lang('Heard', 'An ji')}</span>
                    <strong>{pendingOverwrite.value}</strong>
                  </div>
                </div>
                <div className={styles.overwriteActions}>
                  <button
                    type="button"
                    className={styles.overwriteKeep}
                    onClick={() => setPendingOverwrite(null)}
                  >
                    {lang('Keep current', 'Ci gaba da wannan')}
                  </button>
                  <button
                    type="button"
                    className={styles.overwriteReplace}
                    onClick={() => {
                      writeFieldValue(pendingOverwrite.target, pendingOverwrite.value);
                      setPendingOverwrite(null);
                    }}
                  >
                    {lang('Use what I said', 'Ka yi amfani da abin da na faɗi')}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
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
