import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Stethoscope, Users, AlertTriangle, ClipboardList, Activity, ArrowRight } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import useAuthStore from '../../stores/authStore';
import useMotherStore from '../../stores/motherStore';
import useReferralStore from '../../stores/referralStore';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import db from '../../lib/db';

export const DoctorDashboard = () => {
  const { profile } = useAuthStore();
  const { mothers, fetchMothers, isLoading } = useMotherStore();
  const { referrals, fetchIncomingReferrals } = useReferralStore();

  useEffect(() => {
    fetchMothers();
    if (profile?.facility_id) {
      fetchIncomingReferrals(profile.facility_id);
    }
  }, [profile?.facility_id, fetchMothers, fetchIncomingReferrals]);

  const totalPatients = useLiveQuery(() =>
    db.mothers.filter(m => !m.deleted_at).count()
  ) ?? mothers.length;

  const highRisk = mothers.filter(m => m.risk_level === 'high' || m.risk_level === 'critical');
  const pendingReferrals = referrals.filter(r => r.status === 'pending');
  const urgentReferrals = pendingReferrals.filter(r => r.urgency === 'urgent' || r.urgency === 'emergency');

  if (isLoading) return <div className="flex-center" style={{ padding: 'var(--space-12)' }}><Spinner size={32} /></div>;

  return (
    <div className="page-content fade-in">
      <div className="flex-between" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 className="heading-2">Doctor Dashboard</h1>
          <p className="body-lg" style={{ color: 'var(--text-secondary)' }}>
            Clinical decisions and patient oversight.
          </p>
        </div>
        <p className="body-sm" style={{ color: 'var(--text-tertiary)' }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 'var(--space-6)' }}>
        <Card>
          <CardBody>
            <div className="flex-between">
              <span className="body-sm font-medium" style={{ color: 'var(--text-secondary)' }}>High-Risk Patients</span>
              <AlertTriangle size={16} style={{ color: 'var(--color-danger-500)' }} />
            </div>
            <h2 className="heading-2" style={{ marginTop: 'var(--space-2)' }}>{highRisk.length}</h2>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex-between">
              <span className="body-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Pending Referrals</span>
              <ClipboardList size={16} style={{ color: 'var(--color-warning-500)' }} />
            </div>
            <h2 className="heading-2" style={{ marginTop: 'var(--space-2)' }}>{pendingReferrals.length}</h2>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex-between">
              <span className="body-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Urgent Cases</span>
              <Activity size={16} style={{ color: 'var(--color-danger-500)' }} />
            </div>
            <h2 className="heading-2" style={{ marginTop: 'var(--space-2)' }}>{urgentReferrals.length}</h2>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex-between">
              <span className="body-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Total Patients</span>
              <Users size={16} style={{ color: 'var(--color-primary-500)' }} />
            </div>
            <h2 className="heading-2" style={{ marginTop: 'var(--space-2)' }}>{totalPatients}</h2>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-2" style={{ gap: 'var(--space-6)' }}>
        <Card>
          <CardHeader title="Urgent Referrals" description="Cases requiring immediate attention" />
          <CardBody style={{ padding: 0 }}>
            {urgentReferrals.length > 0 ? (
              urgentReferrals.slice(0, 5).map(r => (
                <div key={r.id} className="flex-between" style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--border-default)' }}>
                  <div>
                    <p className="font-medium">Patient {r.patient_id?.slice(0, 8)}...</p>
                    <p className="body-sm" style={{ color: 'var(--text-secondary)' }}>{r.reason || 'No reason specified'}</p>
                  </div>
                  <Badge variant={r.urgency === 'emergency' ? 'critical' : 'warning'} solid>{r.urgency}</Badge>
                </div>
              ))
            ) : (
              <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
                <p className="body-sm" style={{ color: 'var(--text-tertiary)' }}>No urgent referrals</p>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="High-Risk Patients" description="Pregnancies requiring clinical review" />
          <CardBody style={{ padding: 0 }}>
            {highRisk.length > 0 ? (
              highRisk.slice(0, 5).map(m => (
                <Link to={`/chw/mothers/${m.profile_id || m.id}`} key={m.id} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="flex-between" style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--border-default)' }}>
                    <div>
                      <p className="font-medium">{m.full_name}</p>
                      <p className="body-sm" style={{ color: 'var(--text-secondary)' }}>{m.community}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="critical" solid>High Risk</Badge>
                      <ArrowRight size={14} style={{ color: 'var(--text-tertiary)' }} />
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
                <p className="body-sm" style={{ color: 'var(--text-tertiary)' }}>No high-risk patients</p>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
};

export default DoctorDashboard;
