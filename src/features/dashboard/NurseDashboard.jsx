import { useEffect } from 'react';
import { AlertCircle, Users, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';
import useAuthStore from '../../stores/authStore';
import useMotherStore from '../../stores/motherStore';
import useReferralStore from '../../stores/referralStore';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';

export const NurseDashboard = () => {
  const { profile } = useAuthStore();
  const { mothers, fetchMothers } = useMotherStore();
  const { referrals, fetchIncomingReferrals } = useReferralStore();

  useEffect(() => {
    fetchMothers();
    if (profile?.facility_id) {
      fetchIncomingReferrals(profile.facility_id);
    }
  }, [profile?.facility_id, fetchMothers, fetchIncomingReferrals]);

  const highRiskMothers = mothers.filter(m => m.risk_level === 'high' || m.risk_level === 'critical');
  const pendingReferrals = referrals.filter(r => r.status === 'pending');

  return (
    <div className="page-content fade-in">
      <div className="flex-between" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 className="heading-2">Clinical Dashboard</h1>
          <p className="body-lg" style={{ color: 'var(--text-secondary)' }}>
            Overview of facility patients and incoming referrals.
          </p>
        </div>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 'var(--space-6)' }}>
        <Card>
          <CardBody>
            <div className="flex-between">
              <span className="body-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Incoming Referrals</span>
              <AlertCircle size={16} style={{ color: 'var(--color-danger-500)' }} />
            </div>
            <h2 className="heading-2" style={{ marginTop: 'var(--space-2)' }}>{pendingReferrals.length}</h2>
          </CardBody>
        </Card>
        
        <Card>
          <CardBody>
            <div className="flex-between">
              <span className="body-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Total Patients</span>
              <Users size={16} style={{ color: 'var(--color-info-500)' }} />
            </div>
            <h2 className="heading-2" style={{ marginTop: 'var(--space-2)' }}>{mothers.length}</h2>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex-between">
              <span className="body-sm font-medium" style={{ color: 'var(--text-secondary)' }}>High Risk Cases</span>
              <Activity size={16} style={{ color: 'var(--color-warning-500)' }} />
            </div>
            <h2 className="heading-2" style={{ marginTop: 'var(--space-2)' }}>{highRiskMothers.length}</h2>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-2">
        <Card>
          <CardHeader title="Pending Referrals" description="Patients referred to this facility" />
          <CardBody style={{ padding: 0 }}>
            {pendingReferrals.length > 0 ? (
              pendingReferrals.slice(0, 5).map((referral) => (
                <div key={referral.id} style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--border-default)' }} className="flex-between">
                  <div>
                    <p className="font-medium">{referral.patient_id?.slice(0, 8)}...</p>
                    <p className="body-sm" style={{ color: 'var(--text-secondary)' }}>{referral.reason || 'No reason specified'}</p>
                  </div>
                  <Badge variant={referral.urgency === 'emergency' ? 'critical' : referral.urgency === 'urgent' ? 'warning' : 'info'} solid>
                    {referral.urgency}
                  </Badge>
                </div>
              ))
            ) : (
              <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
                <p className="body-sm" style={{ color: 'var(--text-tertiary)' }}>No pending referrals</p>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Quick Actions" />
          <CardBody className="flex-col gap-3">
            <Link to="/mothers" style={{ textDecoration: 'none' }}>
              <Button variant="outline" leftIcon={<Users size={18} />} fullWidth style={{ justifyContent: 'flex-start' }}>
                View All Patients
              </Button>
            </Link>
            <Link to="/referrals" style={{ textDecoration: 'none' }}>
              <Button variant="outline" leftIcon={<AlertCircle size={18} />} fullWidth style={{ justifyContent: 'flex-start' }}>
                Manage Referrals
              </Button>
            </Link>
          </CardBody>
        </Card>
      </div>
    </div>
  );
};

export default NurseDashboard;
