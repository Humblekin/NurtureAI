import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, ArrowRight, Sparkles, MessageCircle } from 'lucide-react';
import useAuthStore from '../../stores/authStore';
import useMotherStore from '../../stores/motherStore';
import useChildStore from '../../stores/childStore';
import HealthJourneyTimeline from './HealthJourneyTimeline';
import styles from './HealthJourneyTimeline.module.css';

/**
 * NurtureAI — Health Journey Page
 *
 * Wrapper that connects the timeline to auth + data stores.
 * Fetches mother record and children, then passes IDs to the timeline.
 * Guards against missing mother record (user hasn't completed onboarding).
 */
export default function HealthJourneyPage() {
  const { profile } = useAuthStore();
  const { currentMother, fetchMotherByProfileId, isLoading: motherLoading } = useMotherStore();
  const { children, fetchChildrenByMotherId } = useChildStore();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (profile?.id) {
      setChecking(true);
      fetchMotherByProfileId(profile.id).then((mother) => {
        if (mother) {
          fetchChildrenByMotherId(mother.id);
        }
        setChecking(false);
      }).catch(() => {
        setChecking(false);
      });
    }
  }, [profile?.id, fetchMotherByProfileId, fetchChildrenByMotherId]);

  if (!profile) return null;

  const hasMother = !!currentMother;
  const childIds = children?.map(c => c.id) || [];

  // Still checking for mother record
  if (checking || motherLoading) {
    return (
      <div className="page-content fade-in">
        <div className={styles.loadingContainer}>
          <div className={styles.loadingDots}>
            <motion.div className={styles.loadingDot} animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} />
            <motion.div className={styles.loadingDot} animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.15 }} />
            <motion.div className={styles.loadingDot} animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.3 }} />
          </div>
          <p className={styles.loadingText}>Loading your health journey...</p>
        </div>
      </div>
    );
  }

  // No mother record — user hasn't completed onboarding
  if (!hasMother) {
    return (
      <div className="page-content fade-in">
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <Heart size={48} />
          </div>
          <h3 className={styles.emptyTitle}>Complete Your Health Profile</h3>
          <p className={styles.emptyDesc}>
            Set up your health profile to unlock your personalized pregnancy timeline, vaccination schedules, and AI-powered insights.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
            <button
              onClick={() => navigate('/mother/welcome')}
              style={{
                padding: 'var(--space-3) var(--space-5)',
                background: 'var(--color-primary-500)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-lg)',
                cursor: 'pointer',
                fontSize: 'var(--text-sm)',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
              }}
            >
              <Sparkles size={16} />
              Set Up with Amina
            </button>
            <button
              onClick={() => navigate('/mother/onboarding/form')}
              style={{
                padding: 'var(--space-3) var(--space-5)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-lg)',
                cursor: 'pointer',
                fontSize: 'var(--text-sm)',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
              }}
            >
              <ArrowRight size={16} />
              Fill the Form
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content fade-in">
      <HealthJourneyTimeline
        profileId={profile.id}
        childIds={childIds}
      />
    </div>
  );
}
