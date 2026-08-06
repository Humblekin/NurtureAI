import { useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart, Baby, Sparkles, Stethoscope, Syringe, TrendingUp,
  AlertTriangle, MessageCircle, Calendar, Scale, Ear, Shield,
  Sun, Gift, UserCheck, ArrowRightCircle, Apple, Cake, Check
} from 'lucide-react';
import useTimelineStore from '../../stores/timelineStore';
import useAuthStore from '../../stores/authStore';
import { formatDate } from '../../services/timelineService';
import styles from './HealthJourneyTimeline.module.css';

const ICON_MAP = {
  Heart, Baby, Sparkles, Stethoscope, Syringe, TrendingUp,
  AlertTriangle, MessageCircle, Calendar, Scale, Ear, Shield,
  Sun, Gift, UserCheck, ArrowRightCircle, Apple, Cake, Check
};

const COLOR_MAP = {
  primary: { bg: 'var(--color-primary-50)', border: 'var(--color-primary-300)', icon: 'var(--color-primary-600)', glow: 'var(--color-primary-200)' },
  secondary: { bg: 'var(--color-secondary-50)', border: 'var(--color-secondary-300)', icon: 'var(--color-secondary-600)', glow: 'var(--color-secondary-200)' },
  accent: { bg: 'var(--color-accent-50)', border: 'var(--color-accent-300)', icon: 'var(--color-accent-600)', glow: 'var(--color-accent-200)' },
  success: { bg: 'var(--color-success-50)', border: 'var(--color-success-300)', icon: 'var(--color-success-600)', glow: 'var(--color-success-200)' },
  warning: { bg: 'var(--color-warning-50)', border: 'var(--color-warning-300)', icon: 'var(--color-warning-600)', glow: 'var(--color-warning-200)' },
  danger: { bg: 'var(--color-danger-50)', border: 'var(--color-danger-300)', icon: 'var(--color-danger-600)', glow: 'var(--color-danger-200)' },
  info: { bg: 'var(--color-info-50)', border: 'var(--color-info-300)', icon: 'var(--color-info-600)', glow: 'var(--color-info-200)' },
};

const FILTER_OPTIONS = [
  { key: 'all', label: 'All Events' },
  { key: 'pregnancy', label: 'Pregnancy' },
  { key: 'anc', label: 'ANC Visits' },
  { key: 'vaccination', label: 'Vaccinations' },
  { key: 'growth', label: 'Growth' },
  { key: 'visit', label: 'CHW Visits' },
  { key: 'ai', label: 'AI Insights' },
  { key: 'overdue', label: 'Action Needed' },
];

function TimelineProgress({ progress }) {
  if (!progress || progress.currentWeek === null) return null;

  return (
    <motion.div
      className={styles.progressSection}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className={styles.progressHeader}>
        <div className={styles.progressTitle}>
          <span className={styles.progressLabel}>Pregnancy Progress</span>
          <span className={styles.progressTrimester}>Trimester {progress.trimester}</span>
        </div>
        <div className={styles.progressWeeks}>
          <span className={styles.progressWeekNumber}>Week {progress.currentWeek}</span>
          <span className={styles.progressPercent}>{progress.percentage}%</span>
        </div>
      </div>
      <div className={styles.progressBarOuter}>
        <motion.div
          className={styles.progressBarInner}
          initial={{ width: 0 }}
          animate={{ width: `${progress.percentage}%` }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
        />
        <div className={styles.progressMilestones}>
          {[12, 20, 28, 36].map(week => (
            <div
              key={week}
              className={`${styles.progressMilestone} ${progress.currentWeek >= week ? styles.progressMilestoneReached : ''}`}
              style={{ left: `${(week / progress.totalWeeks) * 100}%` }}
            />
          ))}
        </div>
      </div>
      <div className={styles.trimesterLabels}>
        {['1st', '2nd', '3rd'].map((label, i) => (
          <span
            key={label}
            className={`${styles.trimesterLabel} ${progress.trimester === i + 1 ? styles.trimesterLabelActive : ''}`}
          >
            {label} Trimester
          </span>
        ))}
      </div>
    </motion.div>
  );
}

function MilestoneCard({ event, isExpanded, onToggle }) {
  const colors = COLOR_MAP[event.color] || COLOR_MAP.primary;
  const IconComponent = ICON_MAP[event.icon] || Heart;

  return (
    <motion.div
      className={`${styles.eventCard} ${event.isAI ? styles.aiInsightCard : ''} ${event.type === 'overdue' ? styles.overdueCard : ''} ${event.subtype === 'care_missed' ? styles.careMissedCard : ''} ${isExpanded ? styles.eventCardExpanded : ''}`}
      style={event.subtype === 'care_missed' ? {
        '--card-accent': 'var(--color-warning-400)',
        '--card-bg': 'var(--color-warning-50)',
      } : event.isAI ? {
        '--card-accent': 'var(--color-accent-400)',
        '--card-bg': 'var(--color-accent-50)',
      } : event.type === 'overdue' ? {
        '--card-accent': colors.border,
        '--card-bg': colors.bg,
      } : {
        '--card-accent': colors.border,
        '--card-bg': colors.bg,
      }}
      layout
      onClick={onToggle}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
    >
      <div className={styles.eventCardContent}>
        <div className={styles.eventCardHeader}>
          <div className={styles.eventCardLeft}>
            <div
              className={`${styles.eventIconSmall} ${event.completed ? styles.eventIconSmallCompleted : ''} ${event.isAI ? styles.aiIconSmall : ''}`}
              style={{
                background: event.subtype === 'care_missed' ? 'var(--color-warning-100)' : event.isAI ? 'var(--color-accent-100)' : colors.bg,
                color: event.subtype === 'care_missed' ? 'var(--color-warning-600)' : event.isAI ? 'var(--color-accent-600)' : colors.icon,
              }}
            >
              {event.isAI ? <MessageCircle size={16} /> : <IconComponent size={16} />}
            </div>
            <div className={styles.eventCardInfo}>
              <h4 className={styles.eventCardLabel}>{event.label}</h4>
              {event.description && (
                <p className={styles.eventCardDesc}>{event.description}</p>
              )}
              {event.actions?.length > 0 && (
                <ul className={styles.careActionList}>
                  {event.actions.map((action, i) => (
                    <li key={i} className={styles.careActionItem}>
                      <Check size={12} className={styles.careActionCheck} />
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className={styles.eventCardMeta}>
                {event.date && (
                  <span className={styles.eventCardDate}>{formatDate(event.date)}</span>
                )}
                {event.week !== undefined && event.week !== null && (
                  <span className={styles.eventCardBadge}>Week {event.week}</span>
                )}
                {event.ageWeeks !== undefined && event.ageWeeks !== null && (
                  <span className={styles.eventCardBadge}>
                    {event.ageWeeks === 0 ? 'At birth' : `${event.ageWeeks}w`}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className={styles.eventCardRight}>
            {event.completed && (
              <div className={styles.checkMark}>
                <Check size={12} />
              </div>
            )}
            {event.type === 'overdue' && (
              <motion.div
                className={styles.overdueDot}
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
              />
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function TimelineNode({ event, isExpanded, onToggle, isFirst, isLast }) {
  const colors = COLOR_MAP[event.color] || COLOR_MAP.primary;
  const isCurrent = event.current || event.type === 'overdue';

  return (
    <motion.div
      className={`${styles.timelineNode} ${isFirst ? styles.timelineNodeFirst : ''} ${isLast ? styles.timelineNodeLast : ''}`}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className={styles.timelineLeft}>
        <div className={styles.timelineTrack}>
          {!isFirst && (
            <div
              className={`${styles.timelineLine} ${event.completed ? styles.timelineLineCompleted : ''}`}
              style={event.completed ? { background: colors.border } : {}}
            />
          )}
          <motion.div
            className={`${styles.timelineDot} ${event.completed ? styles.timelineDotCompleted : ''} ${isCurrent ? styles.timelineDotCurrent : ''} ${event.type === 'overdue' ? styles.timelineDotOverdue : ''}`}
            style={event.completed ? { background: colors.icon, borderColor: colors.border } : {}}
            whileHover={{ scale: 1.2 }}
            animate={isCurrent ? {
              boxShadow: [
                `0 0 0 0px ${colors.glow}`,
                `0 0 0 8px transparent`,
              ],
            } : {}}
            transition={isCurrent ? { repeat: Infinity, duration: 2 } : {}}
          >
            {event.completed && <Check size={10} color="white" />}
          </motion.div>
          {!isLast && (
            <div
              className={`${styles.timelineLine} ${event.completed ? styles.timelineLineCompleted : ''}`}
              style={event.completed ? { background: colors.border } : {}}
            />
          )}
        </div>
      </div>

      <div className={styles.timelineRight}>
        <MilestoneCard
          event={event}
          isExpanded={isExpanded}
          onToggle={() => onToggle(event.id)}
        />
      </div>
    </motion.div>
  );
}

function TimelineFilters() {
  const { activeFilter, setFilter } = useTimelineStore();

  return (
    <motion.div
      className={styles.filterBar}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
    >
      <div className={styles.filterScroll}>
        {FILTER_OPTIONS.map(opt => (
          <button
            key={opt.key}
            className={`${styles.filterChip} ${activeFilter === opt.key ? styles.filterChipActive : ''}`}
            onClick={() => setFilter(opt.key)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

function TimelineEmpty() {
  const navigate = useNavigate();

  return (
    <motion.div
      className={styles.emptyState}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className={styles.emptyIcon}>
        <Heart size={48} />
      </div>
      <h3 className={styles.emptyTitle}>Your Health Journey Awaits</h3>
      <p className={styles.emptyDesc}>
        Register your pregnancy or add a child record to begin your personalized health journey timeline.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginTop: 'var(--space-4)', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <button
            onClick={() => navigate('/mother/pregnancy/amina')}
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
            <MessageCircle size={16} />
            Talk to Amina
          </button>
          <button
            onClick={() => navigate('/mother/pregnancy/new')}
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
            Fill the Form
          </button>
        </div>
        <button
          onClick={() => navigate('/mother/children/new')}
          style={{
            padding: 'var(--space-3) var(--space-5)',
            background: 'transparent',
            color: 'var(--text-tertiary, var(--text-secondary))',
            border: 'none',
            borderRadius: 'var(--radius-lg)',
            cursor: 'pointer',
            fontSize: 'var(--text-sm)',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}
        >
          <Baby size={16} />
          Add Child Record
        </button>
      </div>
    </motion.div>
  );
}

function CelebrationOverlay({ event, onDismiss }) {
  return (
    <motion.div
      className={styles.celebrationOverlay}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onDismiss}
    >
      <motion.div
        className={styles.celebrationCard}
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.5, opacity: 0 }}
        transition={{ type: 'spring', damping: 15, stiffness: 300 }}
        onClick={e => e.stopPropagation()}
      >
        <div className={styles.confetti}>
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.div
              key={i}
              className={styles.confettiPiece}
              style={{
                left: `${Math.random() * 100}%`,
                background: ['var(--color-primary-400)', 'var(--color-secondary-400)', 'var(--color-accent-400)', 'var(--color-success-400)'][i % 4],
              }}
              animate={{
                y: [0, -200 - Math.random() * 200],
                x: [(Math.random() - 0.5) * 100, (Math.random() - 0.5) * 200],
                rotate: [0, 360 * (Math.random() > 0.5 ? 1 : -1)],
                opacity: [1, 0],
              }}
              transition={{
                duration: 1.5 + Math.random(),
                delay: Math.random() * 0.3,
                ease: 'easeOut',
              }}
            />
          ))}
        </div>
        <div className={styles.celebrationContent}>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.2 }}
            className={styles.celebrationEmoji}
          >
            🎉
          </motion.div>
          <h3 className={styles.celebrationTitle}>Milestone Reached!</h3>
          <p className={styles.celebrationLabel}>{event?.label}</p>
          <p className={styles.celebrationMessage}>
            Congratulations on this wonderful milestone in your health journey!
          </p>
          <button className={styles.celebrationBtn} onClick={onDismiss}>
            Continue Journey
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function HealthJourneyTimeline({ profileId, childIds = [] }) {
  const timelineRef = useRef(null);
  const {
    allEvents, pregnancyProgress, isLoading,
    expandedEventId, toggleExpandEvent,
    showCelebration, celebrationEvent, dismissCelebration,
    buildAllTimelines, buildPregnancyTimeline
  } = useTimelineStore();
  const { profile } = useAuthStore();
  const role = profile?.role || 'mother';

  const childIdsKey = childIds.join(',');
  const childCount = childIds.length;
  useEffect(() => {
    if (profileId) {
      if (childCount > 0) {
        buildAllTimelines(profileId, childIds);
      } else {
        buildPregnancyTimeline(profileId);
      }
    }
  }, [profileId, childIdsKey, childCount, buildAllTimelines, buildPregnancyTimeline]);

  const scrollToCurrent = useCallback(() => {
    if (timelineRef.current) {
      const currentEl = timelineRef.current.querySelector(`.${styles.timelineDotCurrent}`);
      if (currentEl) {
        currentEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, []);

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingDots}>
          <motion.div className={styles.loadingDot} animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} />
          <motion.div className={styles.loadingDot} animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.15 }} />
          <motion.div className={styles.loadingDot} animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.3 }} />
        </div>
        <p className={styles.loadingText}>Building your health journey...</p>
      </div>
    );
  }

  if (allEvents.length === 0) {
    return <TimelineEmpty />;
  }

  const visibleEvents = allEvents.filter(e => {
    if (e.isRiskFlag && role === 'mother') return false;
    return true;
  });

  return (
    <div className={styles.timelineWrapper}>
      <div className={styles.timelineHeader}>
        <div className={styles.timelineHeaderLeft}>
          <h2 className={styles.timelineTitle}>Your Health Journey</h2>
          <p className={styles.timelineSubtitle}>
            {visibleEvents.length} events recorded
          </p>
        </div>
        <button className={styles.jumpToCurrent} onClick={scrollToCurrent}>
          Jump to Now
        </button>
      </div>

      <TimelineProgress progress={pregnancyProgress} />
      <TimelineFilters />

      <div className={styles.timelineContainer} ref={timelineRef}>
        <AnimatePresence mode="popLayout">
          {visibleEvents.map((event, index) => (
            <TimelineNode
              key={event.id}
              event={event}
              isExpanded={expandedEventId === event.id}
              onToggle={toggleExpandEvent}
              isFirst={index === 0}
              isLast={index === visibleEvents.length - 1}
            />
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showCelebration && (
          <CelebrationOverlay event={celebrationEvent} onDismiss={dismissCelebration} />
        )}
      </AnimatePresence>
    </div>
  );
}
