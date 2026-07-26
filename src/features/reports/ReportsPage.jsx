import { useState, useEffect } from 'react';
import { BarChart3, Users, Baby, AlertTriangle, Activity, TrendingUp, Calendar, FileText } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import useAuthStore from '../../stores/authStore';
import db from '../../lib/db';

export const ReportsPage = () => {
  const { profile } = useAuthStore();
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, [profile?.id, profile?.role, profile?.facility_id]);

  const loadStats = async () => {
    try {
      const isAdminOrDistrict = profile?.role === 'admin' || profile?.role === 'district_officer';
      const isNurseOrDoctor = profile?.role === 'nurse' || profile?.role === 'doctor';

      // Scope queries by facility for nurse/doctor, all for admin/district
      let mothersQuery = db.mothers.filter(m => !m.deleted_at);
      let pregnanciesQuery = db.pregnancies.filter(p => !p.deleted_at);
      let childrenQuery = db.children.filter(c => !c.deleted_at);
      let visitsQuery = db.visits.filter(v => !v.deleted_at);
      let referralsQuery = db.referrals;
      let vaccinationsQuery = db.vaccinations;

      if (isNurseOrDoctor && profile?.facility_id) {
        mothersQuery = mothersQuery.filter(m => m.facility_id === profile.facility_id);
        pregnanciesQuery = pregnanciesQuery.filter(p => {
          return mothersQuery; // We'll filter after fetching
        });
        // For simplicity, fetch mothers first then filter related records by mother_id
      }

      const [mothers, pregnancies, children, visits, referrals, vaccinations] = await Promise.all([
        mothersQuery.toArray(),
        pregnanciesQuery.toArray(),
        childrenQuery.toArray(),
        visitsQuery.toArray(),
        referralsQuery.toArray(),
        vaccinationsQuery.toArray(),
      ]);

      // For nurse/doctor: filter pregnancies/children to only those belonging to scoped mothers
      const scopedMotherIds = isNurseOrDoctor && profile?.facility_id
        ? mothers.map(m => m.id)
        : null;
      const scopedPregnancies = scopedMotherIds
        ? pregnancies.filter(p => scopedMotherIds.includes(p.mother_id))
        : pregnancies;
      const scopedChildren = scopedMotherIds
        ? children.filter(c => scopedMotherIds.includes(c.mother_id))
        : children;

      const activePregnancies = scopedPregnancies.filter(p => p.status === 'active');
      const highRiskMothers = mothers.filter(m => m.risk_level === 'high' || m.risk_level === 'critical');
      const pendingReferrals = referrals.filter(r => r.status === 'pending');
      const urgentReferrals = referrals.filter(r => r.urgency === 'urgent' || r.urgency === 'emergency');

      const thisMonth = new Date().toISOString().slice(0, 7);
      const thisMonthVisits = visits.filter(v => v.visit_date?.startsWith(thisMonth));
      const thisMonthVaccinations = vaccinations.filter(v => v.date_given?.startsWith(thisMonth));

      // Visit type breakdown
      const visitTypes = visits.reduce((acc, v) => {
        acc[v.visit_type] = (acc[v.visit_type] || 0) + 1;
        return acc;
      }, {});

      // Referral status breakdown
      const referralStatuses = referrals.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
      }, {});

      setStats({
        totalMothers: mothers.length,
        activePregnancies: activePregnancies.length,
        highRiskMothers: highRiskMothers.length,
        totalChildren: scopedChildren.length,
        totalVisits: visits.length,
        thisMonthVisits: thisMonthVisits.length,
        totalReferrals: referrals.length,
        pendingReferrals: pendingReferrals.length,
        urgentReferrals: urgentReferrals.length,
        totalVaccinations: vaccinations.length,
        thisMonthVaccinations: thisMonthVaccinations.length,
        visitTypes,
        referralStatuses,
      });
    } catch (err) {
      console.error('Failed to load report stats:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-center" style={{ padding: 'var(--space-12)' }}>
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <div className="page-content fade-in">
      <div className="flex-between" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 className="heading-2">Reports & Analytics</h1>
          <p className="body-md" style={{ color: 'var(--text-secondary)' }}>
            Overview of maternal and child health metrics.
          </p>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-4" style={{ marginBottom: 'var(--space-6)' }}>
        <Card>
          <CardBody>
            <div className="flex-between">
              <span className="body-sm" style={{ color: 'var(--text-secondary)' }}>Active Pregnancies</span>
              <Activity size={16} style={{ color: 'var(--color-primary-500)' }} />
            </div>
            <h2 className="heading-2" style={{ marginTop: 'var(--space-2)' }}>{stats?.activePregnancies || 0}</h2>
            <p className="body-sm" style={{ color: 'var(--text-tertiary)' }}>of {stats?.totalMothers || 0} mothers</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex-between">
              <span className="body-sm" style={{ color: 'var(--text-secondary)' }}>High Risk</span>
              <AlertTriangle size={16} style={{ color: 'var(--color-danger-500)' }} />
            </div>
            <h2 className="heading-2" style={{ marginTop: 'var(--space-2)', color: stats?.highRiskMothers > 0 ? 'var(--color-danger-600)' : undefined }}>
              {stats?.highRiskMothers || 0}
            </h2>
            <p className="body-sm" style={{ color: 'var(--text-tertiary)' }}>mothers flagged</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex-between">
              <span className="body-sm" style={{ color: 'var(--text-secondary)' }}>Total Children</span>
              <Baby size={16} style={{ color: 'var(--color-accent-500)' }} />
            </div>
            <h2 className="heading-2" style={{ marginTop: 'var(--space-2)' }}>{stats?.totalChildren || 0}</h2>
            <p className="body-sm" style={{ color: 'var(--text-tertiary)' }}>registered</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex-between">
              <span className="body-sm" style={{ color: 'var(--text-secondary)' }}>Pending Referrals</span>
              <FileText size={16} style={{ color: 'var(--color-warning-500)' }} />
            </div>
            <h2 className="heading-2" style={{ marginTop: 'var(--space-2)' }}>{stats?.pendingReferrals || 0}</h2>
            <p className="body-sm" style={{ color: 'var(--text-tertiary)' }}>{stats?.urgentReferrals || 0} urgent</p>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-2" style={{ gap: 'var(--space-6)' }}>
        {/* Visit Summary */}
        <Card>
          <CardHeader title="Visit Summary" icon={<Calendar size={18} />} />
          <CardBody className="flex-col gap-3">
            <div className="flex-between">
              <span className="body-sm" style={{ color: 'var(--text-secondary)' }}>Total Visits</span>
              <span className="font-medium">{stats?.totalVisits || 0}</span>
            </div>
            <div className="flex-between">
              <span className="body-sm" style={{ color: 'var(--text-secondary)' }}>This Month</span>
              <span className="font-medium">{stats?.thisMonthVisits || 0}</span>
            </div>
            <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
              <p className="body-sm font-medium" style={{ marginBottom: 'var(--space-2)' }}>By Type</p>
              {Object.entries(stats?.visitTypes || {}).map(([type, count]) => (
                <div key={type} className="flex-between" style={{ marginBottom: 'var(--space-1)' }}>
                  <span className="body-sm" style={{ color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>{type.replace('_', ' ')}</span>
                  <span className="body-sm font-medium">{count}</span>
                </div>
              ))}
              {Object.keys(stats?.visitTypes || {}).length === 0 && (
                <p className="body-sm" style={{ color: 'var(--text-tertiary)' }}>No visits recorded</p>
              )}
            </div>
          </CardBody>
        </Card>

        {/* Referral Summary */}
        <Card>
          <CardHeader title="Referral Summary" icon={<BarChart3 size={18} />} />
          <CardBody className="flex-col gap-3">
            <div className="flex-between">
              <span className="body-sm" style={{ color: 'var(--text-secondary)' }}>Total Referrals</span>
              <span className="font-medium">{stats?.totalReferrals || 0}</span>
            </div>
            <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
              <p className="body-sm font-medium" style={{ marginBottom: 'var(--space-2)' }}>By Status</p>
              {Object.entries(stats?.referralStatuses || {}).map(([status, count]) => {
                const statusColors = { pending: 'warning', accepted: 'info', completed: 'success', rejected: 'critical' };
                return (
                  <div key={status} className="flex-between" style={{ marginBottom: 'var(--space-1)' }}>
                    <Badge variant={statusColors[status] || 'neutral'}>{status}</Badge>
                    <span className="body-sm font-medium">{count}</span>
                  </div>
                );
              })}
              {Object.keys(stats?.referralStatuses || {}).length === 0 && (
                <p className="body-sm" style={{ color: 'var(--text-tertiary)' }}>No referrals recorded</p>
              )}
            </div>
          </CardBody>
        </Card>

        {/* Vaccination Summary */}
        <Card>
          <CardHeader title="Vaccination Summary" icon={<TrendingUp size={18} />} />
          <CardBody className="flex-col gap-3">
            <div className="flex-between">
              <span className="body-sm" style={{ color: 'var(--text-secondary)' }}>Total Vaccinations</span>
              <span className="font-medium">{stats?.totalVaccinations || 0}</span>
            </div>
            <div className="flex-between">
              <span className="body-sm" style={{ color: 'var(--text-secondary)' }}>This Month</span>
              <span className="font-medium">{stats?.thisMonthVaccinations || 0}</span>
            </div>
          </CardBody>
        </Card>

        {/* Risk Distribution */}
        <Card>
          <CardHeader title="Risk Distribution" icon={<AlertTriangle size={18} />} />
          <CardBody className="flex-col gap-3">
            <div className="flex-between">
              <Badge variant="success">Low Risk</Badge>
              <span className="body-sm font-medium">
                {(stats?.totalMothers || 0) - (stats?.highRiskMothers || 0)}
              </span>
            </div>
            <div className="flex-between">
              <Badge variant="critical">High / Critical Risk</Badge>
              <span className="body-sm font-medium">{stats?.highRiskMothers || 0}</span>
            </div>
            <div className="flex-between">
              <Badge variant="warning">Pending Referrals</Badge>
              <span className="body-sm font-medium">{stats?.pendingReferrals || 0}</span>
            </div>
            <div className="flex-between">
              <Badge variant="critical">Urgent Referrals</Badge>
              <span className="body-sm font-medium">{stats?.urgentReferrals || 0}</span>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
};

export default ReportsPage;
