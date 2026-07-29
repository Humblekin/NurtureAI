import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Check, Heart, ChevronLeft, ChevronRight, Baby, Moon, Apple, Droplets, Activity, Pill, Edit3 } from 'lucide-react';
import useAuthStore from '../../stores/authStore';
import useMotherStore from '../../stores/motherStore';
import usePregnancyStore from '../../stores/pregnancyStore';
import useWeeklyJournalStore from '../../stores/weeklyJournalStore';
import { calculateWeeksFromLMP } from '../../services/timelineService';
import styles from './WeeklyTrack.module.css';

const FEELINGS = [
  { value: 'good', label: 'Good', emoji: '😊', color: 'var(--color-success-500)' },
  { value: 'okay', label: 'Okay', emoji: '😐', color: 'var(--color-warning-500)' },
  { value: 'concerned', label: 'Concerned', emoji: '😟', color: 'var(--color-danger-500)' },
];

function getTrimester(week) {
  if (!week) return null;
  if (week <= 13) return 1;
  if (week <= 27) return 2;
  return 3;
}

function getTrimesterLabel(week) {
  const t = getTrimester(week);
  if (!t) return '';
  return ['1st Trimester', '2nd Trimester', '3rd Trimester'][t - 1];
}

function getWeekStatusStyle(status) {
  switch (status) {
    case 'completed': return { background: 'var(--color-success-50)', borderColor: 'var(--color-success-300)', color: 'var(--color-success-700)' };
    case 'current': return { background: 'var(--color-primary-50)', borderColor: 'var(--color-primary-300)', color: 'var(--color-primary-700)' };
    default: return { background: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' };
  }
}

function EntryCard({ entry, onEdit }) {
  return (
    <motion.div
      className={styles.entryCard}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      layout
    >
      <div className={styles.entryCardHeader}>
        <div className={styles.entryCardTitle}>
          <Check size={16} className={styles.entryCheck} />
          <span>Week {entry.week_number} Check-in</span>
        </div>
        <span className={styles.entryDate}>
          {new Date(entry.entry_date || entry.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
      </div>
      {entry.mother_feeling && (
        <div className={styles.entryFeeling}>
          {FEELINGS.find(f => f.value === entry.mother_feeling)?.emoji || ''}
          <span>{entry.mother_feeling}</span>
        </div>
      )}
      <div className={styles.entryDetails}>
        {entry.baby_movement && <span>Movement: {entry.baby_movement}</span>}
        {entry.symptoms && <span>Symptoms: {entry.symptoms}</span>}
      </div>
      <button className={styles.editBtn} onClick={() => onEdit(entry)}>
        <Edit3 size={14} /> Edit
      </button>
    </motion.div>
  );
}

function CheckInForm({ weekNumber, initialData, onSave, onCancel, isSaving }) {
  const [form, setForm] = useState({
    mother_feeling: '',
    baby_movement: '',
    symptoms: '',
    mood: '',
    sleep_quality: '',
    nutrition_notes: '',
    water_intake: '',
    exercise_notes: '',
    medication_notes: '',
    weight: '',
    blood_pressure: '',
    additional_notes: '',
    ...(initialData || {}),
  });

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  const isValid = form.mother_feeling || form.baby_movement || form.symptoms || form.mood || form.nutrition_notes;

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <h3 className={styles.formTitle}>How are you feeling this week?</h3>

      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel}>Your overall feeling</label>
        <div className={styles.feelingRow}>
          {FEELINGS.map(f => (
            <button
              key={f.value}
              type="button"
              className={`${styles.feelingBtn} ${form.mother_feeling === f.value ? styles.feelingBtnActive : ''}`}
              onClick={() => handleChange('mother_feeling', form.mother_feeling === f.value ? '' : f.value)}
              style={form.mother_feeling === f.value ? { borderColor: f.color, background: `${f.color}15` } : {}}
            >
              <span className={styles.feelingEmoji}>{f.emoji}</span>
              <span className={styles.feelingLabel}>{f.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.formGrid}>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}><Baby size={14} /> Baby movement</label>
          <textarea
            className={styles.fieldInput}
            value={form.baby_movement}
            onChange={(e) => handleChange('baby_movement', e.target.value)}
            placeholder="Any kicks or movements?"
            rows={2}
          />
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}><Activity size={14} /> Symptoms</label>
          <textarea
            className={styles.fieldInput}
            value={form.symptoms}
            onChange={(e) => handleChange('symptoms', e.target.value)}
            placeholder="Any discomfort or symptoms?"
            rows={2}
          />
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}><Heart size={14} /> Mood</label>
          <textarea
            className={styles.fieldInput}
            value={form.mood}
            onChange={(e) => handleChange('mood', e.target.value)}
            placeholder="How is your mood this week?"
            rows={2}
          />
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}><Moon size={14} /> Sleep quality</label>
          <textarea
            className={styles.fieldInput}
            value={form.sleep_quality}
            onChange={(e) => handleChange('sleep_quality', e.target.value)}
            placeholder="How well have you been sleeping?"
            rows={2}
          />
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}><Apple size={14} /> Nutrition</label>
          <textarea
            className={styles.fieldInput}
            value={form.nutrition_notes}
            onChange={(e) => handleChange('nutrition_notes', e.target.value)}
            placeholder="What have you been eating?"
            rows={2}
          />
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}><Droplets size={14} /> Water intake</label>
          <textarea
            className={styles.fieldInput}
            value={form.water_intake}
            onChange={(e) => handleChange('water_intake', e.target.value)}
            placeholder="Glasses per day?"
            rows={2}
          />
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}><Activity size={14} /> Exercise</label>
          <textarea
            className={styles.fieldInput}
            value={form.exercise_notes}
            onChange={(e) => handleChange('exercise_notes', e.target.value)}
            placeholder="Any physical activity?"
            rows={2}
          />
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}><Pill size={14} /> Medications</label>
          <textarea
            className={styles.fieldInput}
            value={form.medication_notes}
            onChange={(e) => handleChange('medication_notes', e.target.value)}
            placeholder="Any medications or supplements?"
            rows={2}
          />
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>Weight (kg)</label>
          <input
            type="number"
            className={styles.fieldInput}
            value={form.weight}
            onChange={(e) => handleChange('weight', e.target.value)}
            placeholder="e.g. 65"
            step="0.1"
          />
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>Blood pressure</label>
          <input
            type="text"
            className={styles.fieldInput}
            value={form.blood_pressure}
            onChange={(e) => handleChange('blood_pressure', e.target.value)}
            placeholder="e.g. 120/80"
          />
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel}>Additional notes</label>
        <textarea
          className={styles.fieldInput}
          value={form.additional_notes}
          onChange={(e) => handleChange('additional_notes', e.target.value)}
          placeholder="Anything else you'd like to share with Amina?"
          rows={3}
        />
      </div>

      <div className={styles.formActions}>
        {onCancel && (
          <button type="button" className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
        )}
        <button type="submit" className={styles.submitBtn} disabled={!isValid || isSaving}>
          {isSaving ? 'Saving...' : initialData ? 'Update Check-in' : 'Save Check-in'}
        </button>
      </div>
    </form>
  );
}

export default function WeeklyTrackPage() {
  const { profile } = useAuthStore();
  const { fetchMotherByProfileId } = useMotherStore();
  const { activePregnancy, fetchPregnanciesByMotherId } = usePregnancyStore();
  const {
    journals, currentJournal,
    fetchJournalsByPregnancy, fetchCurrentWeek,
    saveJournal, updateJournal, requeueUnsynced,
  } = useWeeklyJournalStore();

  const [isSaving, setIsSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editEntry, setEditEntry] = useState(null);
  const [motherId, setMotherId] = useState(null);

  useEffect(() => {
    if (profile?.id) {
      fetchMotherByProfileId(profile.id).then((mother) => {
        if (mother) {
          setMotherId(mother.id);
          fetchPregnanciesByMotherId(mother.id);
        }
      });
    }
  }, [profile?.id, fetchMotherByProfileId, fetchPregnanciesByMotherId]);

  const pregnancyWeek = activePregnancy?.lmp
    ? calculateWeeksFromLMP(activePregnancy.lmp)
    : null;
  const trimester = getTrimester(pregnancyWeek);

  useEffect(() => {
    if (activePregnancy?.id && pregnancyWeek) {
      fetchJournalsByPregnancy(activePregnancy.id);
      fetchCurrentWeek(activePregnancy.id, pregnancyWeek);
      requeueUnsynced();
    }
  }, [activePregnancy?.id, pregnancyWeek, fetchJournalsByPregnancy, fetchCurrentWeek, requeueUnsynced]);

  const currentCompleted = !!currentJournal;

  const handleSave = useCallback(async (formData) => {
    if (!activePregnancy || !pregnancyWeek) return;
    setIsSaving(true);

    const journalData = {
      user_id: profile.id,
      pregnancy_id: activePregnancy.id,
      week_number: pregnancyWeek,
      entry_date: new Date().toISOString(),
      ...formData,
    };

    if (editEntry) {
      await updateJournal(editEntry.id, journalData);
    } else {
      await saveJournal(journalData);
    }

    setIsSaving(false);
    setShowForm(false);
    setEditEntry(null);
    fetchCurrentWeek(activePregnancy.id, pregnancyWeek);
    fetchJournalsByPregnancy(activePregnancy.id);
  }, [activePregnancy, pregnancyWeek, profile, editEntry, saveJournal, updateJournal, fetchCurrentWeek, fetchJournalsByPregnancy]);

  const handleEdit = useCallback((entry) => {
    setEditEntry(entry);
    setShowForm(true);
  }, []);

  const handleNew = useCallback(() => {
    setEditEntry(null);
    setShowForm(true);
  }, []);

  if (!activePregnancy) {
    return (
      <div className="page-content fade-in">
        <div className={styles.emptyState}>
          <Heart size={48} className={styles.emptyIcon} />
          <h3>No Active Pregnancy</h3>
          <p>Register your pregnancy to start tracking your weekly health journey.</p>
        </div>
      </div>
    );
  }

  const weekStatus = currentCompleted ? 'completed' : 'current';
  const weekStyle = getWeekStatusStyle(weekStatus);

  return (
    <div className="page-content fade-in">
      <div className={styles.header}>
        <div>
          <h1 className="heading-2">Weekly Check-in</h1>
          <p className="body-sm" style={{ color: 'var(--text-secondary)' }}>
            Track how you and your baby are doing each week
          </p>
        </div>
        <div className={styles.weekBadge}>
          <span>Week {pregnancyWeek}</span>
          <span className={styles.trimesterLabel}>{getTrimesterLabel(pregnancyWeek)}</span>
        </div>
      </div>

      <motion.div
        className={styles.currentWeekCard}
        style={weekStyle}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className={styles.currentWeekTop}>
          <div>
            <span className={styles.currentWeekLabel}>
              Week {pregnancyWeek} Check-in
            </span>
            <span className={styles.currentWeekStatus}>
              {currentCompleted
                ? 'Completed — great job!'
                : 'Not yet completed'
              }
            </span>
          </div>
          <div className={styles.currentWeekIcon}>
            {currentCompleted ? <Check size={24} /> : <Heart size={24} />}
          </div>
        </div>
        {currentCompleted ? (
          <button className={styles.actionBtnSecondary} onClick={handleNew}>
            <Edit3 size={16} /> Update this week
          </button>
        ) : (
          <button className={styles.actionBtn} onClick={handleNew}>
            Complete Week {pregnancyWeek} Check-in
          </button>
        )}
      </motion.div>

      {showForm && (
        <motion.div
          className={styles.formSection}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
        >
          {editEntry ? (
            <div className={styles.formSectionHeader}>
              <h3>Edit Week {editEntry.week_number} Check-in</h3>
            </div>
          ) : (
            <div className={styles.formSectionHeader}>
              <h3>Week {pregnancyWeek} Check-in</h3>
              <p>Share how you've been feeling this week. This helps Amina give you personalized support.</p>
            </div>
          )}
          <CheckInForm
            weekNumber={pregnancyWeek}
            initialData={editEntry || null}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditEntry(null); }}
            isSaving={isSaving}
          />
        </motion.div>
      )}

      <div className={styles.historySection}>
        <h3 className={styles.historyTitle}>Previous Entries</h3>
        {journals.length === 0 ? (
          <div className={styles.historyEmpty}>
            <p>No previous entries. Complete your first check-in above!</p>
          </div>
        ) : (
          <div className={styles.historyList}>
            {journals
              .filter(j => !currentCompleted || j.id !== currentJournal.id)
              .sort((a, b) => b.week_number - a.week_number)
              .slice(0, 10)
              .map(entry => (
                <EntryCard key={entry.id} entry={entry} onEdit={handleEdit} />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
