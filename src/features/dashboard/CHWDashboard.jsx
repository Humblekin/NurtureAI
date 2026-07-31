import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, Activity, AlertTriangle, CheckCircle2, Baby } from 'lucide-react';
import useAuthStore from '../../stores/authStore';
import useMotherStore from '../../stores/motherStore';
import useVisitStore from '../../stores/visitStore';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';

export const CHWDashboard = () => {
  const { profile } = useAuthStore();
  const { mothers, fetchMothers } = useMotherStore();
  const { visits, fetchVisitsByWorker } = useVisitStore();

  useEffect(() => {
    if (profile?.id) {
      fetchMothers();
      fetchVisitsByWorker(profile.id);
    }
  }, [profile?.id, fetchMothers, fetchVisitsByWorker]);

  const totalPatients = mothers.length;
  const totalVisits = visits.length;

  const highRiskMothers = mothers.filter(m => m.risk_level === 'high' || m.risk_level === 'critical');
  const today = new Date().toISOString().split('T')[0];
  const todayVisits = visits.filter(v => v.visit_date === today);

  return (
    <div className="page-content fade-in">
      <div className="flex-between" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 className="heading-2">CHW Dashboard</h1>
          <p className="body-lg" style={{ color: 'var(--text-secondary)' }}>
            {profile?.community || 'Your Area'} • {new Date().toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 'var(--space-6)' }}>
        <Card>
          <CardBody>
            <div className="flex-between">
              <span className="body-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Total Patients</span>
              <Users size={16} style={{ color: 'var(--color-primary-500)' }} />
            </div>
            <h2 className="heading-2" style={{ marginTop: 'var(--space-2)' }}>{totalPatients}</h2>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex-between">
              <span className="body-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Today's Visits</span>
              <Activity size={16} style={{ color: 'var(--color-info-500)' }} />
            </div>
            <h2 className="heading-2" style={{ marginTop: 'var(--space-2)' }}>{todayVisits.length}</h2>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex-between">
              <span className="body-sm font-medium" style={{ color: 'var(--text-secondary)' }}>High Risk</span>
              <AlertTriangle size={16} style={{ color: 'var(--color-danger-500)' }} />
            </div>
            <h2 className="heading-2" style={{ marginTop: 'var(--space-2)' }}>{highRiskMothers.length}</h2>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex-between">
              <span className="body-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Total Visits</span>
              <CheckCircle2 size={16} style={{ color: 'var(--color-success-500)' }} />
            </div>
            <h2 className="heading-2" style={{ marginTop: 'var(--space-2)' }}>{totalVisits}</h2>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-2">
        <Card>
          <CardHeader title="Priority Follow-ups" description="Patients requiring immediate attention" />
          <CardBody style={{ padding: 0 }}>
            {highRiskMothers.length > 0 ? (
              highRiskMothers.slice(0, 5).map((mother) => (
                <Link to={`/chw/mothers/${mother.profile_id || mother.id}`}
                  key={mother.id}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--border-default)' }} className="flex-between">
                    <div>
                      <p className="font-medium">{mother.full_name}</p>
                      <p className="body-sm" style={{ color: 'var(--text-secondary)' }}>{mother.community || 'Unknown Community'}</p>
                    </div>
                    <Badge variant="critical" solid>High Risk</Badge>
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

        <Card>
          <CardHeader title="Quick Actions" />
          <CardBody className="flex-col gap-3">
            <Link to="/chw/mothers/new" style={{ textDecoration: 'none' }}>
              <Button variant="outline" leftIcon={<Users size={18} />} fullWidth style={{ justifyContent: 'flex-start' }}>
                Register New Mother
              </Button>
            </Link>
            <Link to="/chw/children/new" style={{ textDecoration: 'none' }}>
              <Button variant="outline" leftIcon={<Baby size={18} />} fullWidth style={{ justifyContent: 'flex-start' }}>
                Register New Child
              </Button>
            </Link>
            <Link to="/chw/visits/new" style={{ textDecoration: 'none' }}>
              <Button variant="outline" leftIcon={<Activity size={18} />} fullWidth style={{ justifyContent: 'flex-start' }}>
                Log Health Visit
              </Button>
            </Link>
          </CardBody>
        </Card>
      </div>
    </div>
  );
};

export default CHWDashboard;
