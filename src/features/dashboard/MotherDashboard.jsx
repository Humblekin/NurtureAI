import { useEffect } from 'react';
import { Heart, Calendar, Baby, MessageCircle, AlertTriangle } from 'lucide-react';
import useAuthStore from '../../stores/authStore';
import usePregnancyStore from '../../stores/pregnancyStore';
import useChildStore from '../../stores/childStore';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { Link } from 'react-router-dom';

function calculateWeek(lastMenstrualDate) {
  if (!lastMenstrualDate) return null;
  const lmp = new Date(lastMenstrualDate);
  const today = new Date();
  const diffDays = Math.floor((today - lmp) / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays / 7);
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

function getSexLabel(sex) {
  if (!sex) return '';
  return sex === 'male' ? 'Male' : 'Female';
}

function hasVaccineDue(childId, vaccinations) {
  const vax = vaccinations?.[childId] || [];
  return vax.some(v => v.status === 'due' || v.status === 'overdue');
}

export const MotherDashboard = () => {
  const { profile } = useAuthStore();
  const { activePregnancy, antenatalVisits, fetchPregnanciesByMotherId } = usePregnancyStore();
  const { children, vaccinations, fetchChildrenByMotherId } = useChildStore();

  useEffect(() => {
    if (profile?.id) {
      fetchPregnanciesByMotherId(profile.id);
      fetchChildrenByMotherId(profile.id);
    }
  }, [profile?.id, fetchPregnanciesByMotherId, fetchChildrenByMotherId]);

  const pregnancyWeek = activePregnancy?.last_menstrual_period
    ? calculateWeek(activePregnancy.last_menstrual_period)
    : null;
  const trimester = getTrimester(pregnancyWeek);
  const riskLevel = activePregnancy?.risk_level || 'low';

  const nextVisit = antenatalVisits?.length > 0
    ? antenatalVisits
        .filter(v => new Date(v.visit_date) > new Date())
        .sort((a, b) => new Date(a.visit_date) - new Date(b.visit_date))[0]
    : null;

  const dueVaccines = children?.filter(child => hasVaccineDue(child.id, vaccinations)).length || 0;

  return (
    <div className="page-content fade-in">
      <div className="flex-between" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 className="heading-2">Hello, {profile?.full_name?.split(' ')[0] || 'Mother'}</h1>
          <p className="body-lg" style={{ color: 'var(--text-secondary)' }}>
            Here is your health summary for today.
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
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
              <Link to="/mother/pregnancy">
                <Button size="sm" variant="outline">Register Pregnancy</Button>
              </Link>
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
                    {nextVisit.visit_type === 'anc1' ? 'ANC Booking' : nextVisit.visit_type === 'anc2' ? 'ANC Visit' : nextVisit.visit_type === 'anc3' ? 'ANC Visit' : nextVisit.visit_type === 'anc4' ? 'ANC Visit' : 'Antenatal Checkup'}
                  </p>
                </>
              ) : (
                <>
                  <p className="body-sm" style={{ color: 'var(--text-tertiary)' }}>No visits scheduled</p>
                </>
              )}
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
                    <h3 className="heading-5">{child.name || 'Unnamed Child'}</h3>
                    <p className="body-sm" style={{ color: 'var(--text-secondary)' }}>
                      {calculateAge(child.date_of_birth)} • {getSexLabel(child.sex)}
                    </p>
                  </div>
                  <div>
                    {hasVaccineDue(child.id, vaccinations) ? (
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
    </div>
  );
};

export default MotherDashboard;
