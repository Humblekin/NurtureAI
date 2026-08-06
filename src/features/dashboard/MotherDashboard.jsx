import { useState, useEffect, useRef, useCallback } from 'react';
import { Heart, Calendar, Baby, MessageCircle, Map, ClipboardList } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../stores/authStore';
import useMotherStore from '../../stores/motherStore';
import usePregnancyStore from '../../stores/pregnancyStore';
import useChildStore from '../../stores/childStore';
import useWeeklyJournalStore from '../../stores/weeklyJournalStore';
import { Card, CardBody } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { Link } from 'react-router-dom';
import PregnancyChoiceModal from '../pregnancies/PregnancyChoiceModal';
import { getMotherProfile, getMotherPregnancies, getMotherChildren } from '../../services/motherProfileService';
import { findOverdueVaccine } from '../../constants/vaccinationSchedule';
import { GHANA_ANC_PROTOCOL } from '../../constants/ancProtocol';
import { calculateWeeksFromLMP } from '../../lib/pregnancy';

function calculateWeek(lastMenstrualDate) {
  return calculateWeeksFromLMP(lastMenstrualDate);
}

function getTrimester(week) {
  if (!week) return null;
  if (week <= 13) return 1;
  if (week <= 27) return 2;
  return 3;
}

function calculateAge(birthDate) {
  if (!birthDate) return '';
  const birth = new Date(birthDate);
  const now = new Date();
  const months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (months < 1) return `${Math.floor((now - birth) / (1000 * 60 * 60 * 24))} days`;
  if (months < 12) return `${months} months`;
  const years = Math.floor(months / 12);
  return years === 1 ? '1 year' : `${years} years`;
}

function getAgeMonths(birthDate) {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const now = new Date();
  return Math.max(0, (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth()));
}

function getSexLabel(sex) {
  if (!sex) return '';
  return sex === 'male' ? 'Male' : 'Female';
}

function hasVaccineDue(child, vaccinations) {
  if (!child?.date_of_birth) return false;
  const vax = vaccinations?.[child.id] || [];
  const vaxNames = new Set(vax.map(v => v.vaccine_name));
  const ageMonths = getAgeMonths(child.date_of_birth);
  if (ageMonths === null) return false;
  return !!findOverdueVaccine(ageMonths, vaxNames);
}

export const MotherDashboard = () => {
  const { profile } = useAuthStore();
  const { fetchMotherByProfileId } = useMotherStore();
  const { activePregnancy, antenatalVisits, fetchPregnanciesByMotherId } = usePregnancyStore();
  const { children, vaccinations, fetchChildrenByMotherId } = useChildStore();
  const { fetchJournalsByPregnancy, journals } = useWeeklyJournalStore();
  const navigate = useNavigate();
  const [showPregnancyChoice, setShowPregnancyChoice] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [nextVisitDate, setNextVisitDate] = useState(null);
  const [nextVisitLabel, setNextVisitLabel] = useState(null);
  const [currentWeekMissingJournal, setCurrentWeekMissingJournal] = useState(false);

  const loadAllData = useCallback(async (userId) => {
    const mother = await fetchMotherByProfileId(userId);
    if (mother) {
      console.log('[Dashboard] Loaded mother from Supabase:', mother.id);
      await fetchPregnanciesByMotherId(mother.id);
      await fetchChildrenByMotherId(mother.id);
      setDataLoaded(true);
      return;
    }

    // Fallback: query Supabase directly via service
    const { data: remoteMother, error } = await getMotherProfile(userId);
    if (error) {
      console.error('[Dashboard] Supabase query failed:', error);
      return;
    }
    if (remoteMother) {
      console.log('[Dashboard] Loaded mother from Supabase:', remoteMother.id);
      await fetchMotherByProfileId(userId);

      const { data: pregnancies } = await getMotherPregnancies(remoteMother.id);
      if (pregnancies?.length > 0) {
        fetchPregnanciesByMotherId(remoteMother.id);
      }

      const { data: childrenData } = await getMotherChildren(remoteMother.id);
      if (childrenData?.length > 0) {
        fetchChildrenByMotherId(remoteMother.id);
      }
    }

    setDataLoaded(true);
  }, [fetchMotherByProfileId, fetchPregnanciesByMotherId, fetchChildrenByMotherId]);

  useEffect(() => {
    if (profile?.id && !dataLoaded) {
      loadAllData(profile.id);
    }
  }, [profile?.id, dataLoaded, loadAllData]);

  useEffect(() => {
    if (activePregnancy?.id) {
      fetchJournalsByPregnancy(activePregnancy.id);
    }
  }, [activePregnancy?.id, fetchJournalsByPregnancy]);

  const pregnancyWeek = activePregnancy?.lmp
    ? calculateWeek(activePregnancy.lmp)
    : null;
  const trimester = getTrimester(pregnancyWeek);
  const riskLevel = activePregnancy?.risk_level || 'low';

  const nextVisit = nextVisitDate
    ? { visit_date: nextVisitDate, visit_type: nextVisitLabel }
    : antenatalVisits?.length > 0
      ? antenatalVisits
          .filter(v => new Date(v.visit_date) > new Date())
          .sort((a, b) => new Date(a.visit_date) - new Date(b.visit_date))[0]
      : null;

  const dueVaccines = children?.filter(child => hasVaccineDue(child, vaccinations)).length || 0;
  const weeklyTrackingStatus = currentWeekMissingJournal ? 'Missing this week’s check-in' : 'Weekly health tracking up to date';
  const nextVisitType = nextVisit?.visit_type || nextVisitLabel || 'Antenatal Checkup';

  useEffect(() => {
    if (!activePregnancy?.id || pregnancyWeek === null) return;

    const lmp = new Date(activePregnancy.lmp);
    const today = new Date();
    const nextProtocol = GHANA_ANC_PROTOCOL.find((item) => item.week >= pregnancyWeek);

    if (nextProtocol) {
      const nextDate = new Date(lmp);
      nextDate.setDate(nextDate.getDate() + nextProtocol.week * 7);
      if (nextDate > today || nextProtocol.week === pregnancyWeek) {
        setNextVisitDate(nextDate.toISOString());
        setNextVisitLabel(nextProtocol.contact);
      }
    }

    const currentJournal = journals.find((j) => j.week_number === pregnancyWeek);
    setCurrentWeekMissingJournal(!currentJournal);
  }, [activePregnancy?.id, activePregnancy?.lmp, pregnancyWeek, journals]);

  return (
    <div className="page-content fade-in">
      <div className="dashboard-header">
        <div>
          <h1 className="heading-2 dashboard-greeting">
            How am I and my baby doing today, {profile?.full_name?.split(' ')[0] || 'Mother'}?
          </h1>
          <p className="body-lg" style={{ color: 'var(--text-secondary)' }}>
            Here is your health summary for today.
          </p>
        </div>
        <div className="dashboard-date">
          <p className="body-sm" style={{ color: 'var(--text-tertiary)' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 'var(--space-6)' }}>
        {activePregnancy ? (
          <Card variant="elevated" className="gradient-primary" style={{ color: 'white' }}>
            <CardBody className="flex-col gap-4">
              <div className="flex-between">
                <span className="heading-4">Pregnancy</span>
                <Heart size={24} />
              </div>
              <div>
                <p className="heading-2" style={{ marginBottom: 0 }}>
                  {pregnancyWeek ? `Week ${pregnancyWeek}` : 'Active'}
                </p>
                <p className="body-sm" style={{ opacity: 0.8 }}>
                  {trimester ? `Trimester ${trimester}` : 'Ongoing'}
                </p>
              </div>
              <div className="flex gap-2">
                <Badge variant={riskLevel === 'high' ? 'danger' : 'success'} solid size="sm">
                  {riskLevel === 'high' ? 'High Risk' : 'Low Risk'}
                </Badge>
              </div>
            </CardBody>
          </Card>
        ) : (
          <Card variant="elevated" style={{ borderStyle: 'dashed' }}>
            <CardBody className="flex-col gap-4 items-center" style={{ color: 'var(--text-secondary)' }}>
              <Heart size={24} style={{ opacity: 0.5 }} />
              <span className="font-medium">No Active Pregnancy</span>
              <Button size="sm" variant="outline" onClick={() => setShowPregnancyChoice(true)}>
                Register Pregnancy
              </Button>
            </CardBody>
          </Card>
        )}

        <Card variant="elevated" style={{ borderLeft: `4px solid ${nextVisit ? 'var(--color-warning-500)' : 'var(--color-text-tertiary)'}` }}>
          <CardBody className="flex-col gap-4">
            <div className="flex-between">
              <span className="heading-4" style={{ color: 'var(--text-primary)' }}>Next Visit</span>
              <Calendar size={24} style={{ color: 'var(--text-tertiary)' }} />
            </div>
            <div>
              {nextVisit ? (
                <>
                  <p className="heading-3" style={{ marginBottom: 0, color: 'var(--text-primary)' }}>
                    {new Date(nextVisit.visit_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                  <p className="body-sm" style={{ color: 'var(--text-secondary)' }}>
                    {nextVisitType}
                  </p>
                </>
              ) : (
                <>
                  <p className="body-sm" style={{ color: 'var(--text-tertiary)' }}>No scheduled protocol visit available</p>
                </>
              )}
              <p className="body-sm" style={{ marginTop: '0.75rem', color: currentWeekMissingJournal ? 'var(--color-danger-700)' : 'var(--color-success-700)' }}>
                {weeklyTrackingStatus}
              </p>
            </div>
            <Link to="/mother/pregnancy">
              <Button size="sm" variant="outline" fullWidth>View Details</Button>
            </Link>
          </CardBody>
        </Card>

        <Card variant="elevated" className="gradient-warm" style={{ color: 'white' }}>
          <CardBody className="flex-col gap-4">
            <div className="flex-between">
              <span className="heading-4">Talk to Amina</span>
              <MessageCircle size={24} />
            </div>
            <div>
              <p className="body-sm" style={{ opacity: 0.9 }}>
                Have a health question? Amina is here to help 24/7.
              </p>
            </div>
            <Link to="/shared/amina">
              <Button size="sm" style={{ background: 'white', color: 'var(--color-secondary-700)' }} fullWidth>
                Chat Now
              </Button>
            </Link>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 'var(--space-6)' }}>
        <Link to="/mother/timeline" style={{ textDecoration: 'none', display: 'block' }}>
          <Card variant="accent" hoverable clickable>
            <CardBody className="flex gap-4 items-center">
              <div style={{
                width: 56, height: 56, borderRadius: 'var(--radius-xl)',
                background: 'linear-gradient(135deg, var(--color-primary-100), var(--color-accent-100))',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Map size={28} style={{ color: 'var(--color-primary-600)' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 className="heading-4" style={{ marginBottom: 'var(--space-1)' }}>My Health Journey</h3>
                <p className="body-sm" style={{ color: 'var(--text-secondary)' }}>
                  View your complete pregnancy and child health timeline.
                </p>
              </div>
              <Badge variant="primary" solid size="sm">View</Badge>
            </CardBody>
          </Card>
        </Link>
        <Link to="/mother/track" style={{ textDecoration: 'none', display: 'block' }}>
          <Card variant="elevated" hoverable clickable className="gradient-warm" style={{ color: 'white' }}>
            <CardBody className="flex gap-4 items-center">
              <div style={{
                width: 56, height: 56, borderRadius: 'var(--radius-xl)',
                background: 'rgba(255,255,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <ClipboardList size={28} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 className="heading-4" style={{ marginBottom: 'var(--space-1)' }}>Weekly Check-in</h3>
                <p className="body-sm" style={{ opacity: 0.9 }}>
                  Track how you and your baby are doing each week.
                </p>
              </div>
              <Badge variant="secondary" solid size="sm">Check In</Badge>
            </CardBody>
          </Card>
        </Link>
      </div>

      <h2 className="heading-3" style={{ marginBottom: 'var(--space-4)' }}>My Children</h2>
      <div className="grid grid-2">
        {children?.length > 0 ? (
          children.map(child => (
            <Link key={child.id} to={`/mother/children/${child.id}`}>
              <Card hoverable clickable>
                <CardBody className="flex gap-4 items-center">
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%',
                    background: 'var(--color-accent-100)', color: 'var(--color-accent-700)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <Baby size={24} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 className="heading-5">{child.full_name || 'Unnamed Child'}</h3>
                    <p className="body-sm" style={{ color: 'var(--text-secondary)' }}>
                      {calculateAge(child.date_of_birth)} • {getSexLabel(child.gender)}
                    </p>
                  </div>
                  <div>
                    {hasVaccineDue(child, vaccinations) ? (
                      <Badge variant="warning" dot>Vaccine Due</Badge>
                    ) : (
                      <Badge variant="success" solid size="sm">Up to Date</Badge>
                    )}
                  </div>
                </CardBody>
              </Card>
            </Link>
          ))
        ) : (
          <Card hoverable clickable className="flex-center" style={{ borderStyle: 'dashed', background: 'transparent' }}>
            <CardBody className="flex-col items-center gap-2 text-center" style={{ color: 'var(--text-secondary)' }}>
              <Baby size={24} style={{ opacity: 0.5 }} />
              <span className="font-medium">Add Child Record</span>
            </CardBody>
          </Card>
        )}
        <Link to="/mother/children/new">
          <Card hoverable clickable className="flex-center" style={{ borderStyle: 'dashed', background: 'transparent' }}>
            <CardBody className="flex-col items-center gap-2 text-center" style={{ color: 'var(--text-secondary)' }}>
              <Baby size={24} style={{ opacity: 0.5 }} />
              <span className="font-medium">Add Child Record</span>
            </CardBody>
          </Card>
        </Link>
      </div>

      <PregnancyChoiceModal
        isOpen={showPregnancyChoice}
        onClose={() => setShowPregnancyChoice(false)}
        onSelectForm={() => {
          setShowPregnancyChoice(false);
          navigate('/mother/pregnancy/new');
        }}
        onSelectAmina={() => {
          setShowPregnancyChoice(false);
          navigate('/mother/pregnancy/amina');
        }}
      />
    </div>
  );
};

export default MotherDashboard;
