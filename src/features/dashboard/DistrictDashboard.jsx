import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Users, Activity, TrendingUp, MapPin, FileText } from 'lucide-react';
import useAuthStore from '../../stores/authStore';
import useMotherStore from '../../stores/motherStore';
import useReferralStore from '../../stores/referralStore';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import supabase, { isSupabaseConfigured } from '../../lib/supabase';

export const DistrictDashboard = () => {
  const { profile } = useAuthStore();
  const { mothers, fetchMothers, isLoading } = useMotherStore();
  const { referrals, fetchOutgoingReferrals } = useReferralStore();
  const [facilityCount, setFacilityCount] = useState(0);
  const [workerCount, setWorkerCount] = useState(0);

  useEffect(() => {
    fetchMothers();
    if (profile?.id) {
      fetchOutgoingReferrals(profile.id);
    }
    if (isSupabaseConfigured()) {
      supabase.from('facilities').select('id').is('deleted_at', null)
        .then(({ data }) => setFacilityCount(data?.length || 0))
        .catch(() => setFacilityCount(0));
      supabase.from('profiles').select('id').in('role', ['chw', 'nurse', 'doctor'])
        .then(({ data }) => setWorkerCount(data?.length || 0))
        .catch(() => setWorkerCount(0));
    }
  }, [profile?.id, fetchMothers, fetchOutgoingReferrals]);

  const highRisk = mothers.filter(m => m.risk_level === 'high' || m.risk_level === 'critical');
  const pendingReferrals = referrals.filter(r => r.status === 'pending');

  const coverageStats = [
    { label: 'Total Mothers', value: mothers.length, icon: Users, color: 'var(--color-primary-500)' },
    { label: 'High-Risk Cases', value: highRisk.length, icon: Activity, color: 'var(--color-danger-500)' },
    { label: 'Facilities', value: facilityCount, icon: Building2, color: 'var(--color-info-500)' },
    { label: 'Health Workers', value: workerCount, icon: TrendingUp, color: 'var(--color-success-500)' },
  ];

  if (isLoading) return <div className="flex-center" style={{ padding: 'var(--space-12)' }}><Spinner size={32} /></div>;

  return (
    <div className="page-content fade-in">
      <div className="flex-between" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 className="heading-2">District Health Overview</h1>
          <p className="body-lg" style={{ color: 'var(--text-secondary)' }}>
            {profile?.community || 'District'} • Regional health performance
          </p>
        </div>
        <Link to="/district/reports">
          <Button variant="outline" leftIcon={<FileText size={18} />}>View Reports</Button>
        </Link>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 'var(--space-6)' }}>
        {coverageStats.map(s => (
          <Card key={s.label}>
            <CardBody>
              <div className="flex-between">
                <span className="body-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{s.label}</span>
                <s.icon size={16} style={{ color: s.color }} />
              </div>
              <h2 className="heading-2" style={{ marginTop: 'var(--space-2)' }}>{s.value}</h2>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="grid grid-2" style={{ gap: 'var(--space-6)' }}>
        <Card>
          <CardHeader title="Facility Coverage" description="Health facilities in your district" />
          <CardBody>
            <div className="flex-between" style={{ marginBottom: 'var(--space-4)' }}>
              <span className="body-sm" style={{ color: 'var(--text-secondary)' }}>Active facilities</span>
              <span className="font-medium">{facilityCount}</span>
            </div>
            <div className="flex-between" style={{ marginBottom: 'var(--space-4)' }}>
              <span className="body-sm" style={{ color: 'var(--text-secondary)' }}>Health workers deployed</span>
              <span className="font-medium">{workerCount}</span>
            </div>
            <div className="flex-between">
              <span className="body-sm" style={{ color: 'var(--text-secondary)' }}>Communities served</span>
              <span className="font-medium">{mothers.length > 0 ? new Set(mothers.map(m => m.community).filter(Boolean)).size : 0}</span>
            </div>
            <Link to="/district/facilities" style={{ marginTop: 'var(--space-4)', display: 'inline-block' }}>
              <Button size="sm" variant="outline" leftIcon={<MapPin size={14} />}>Manage Facilities</Button>
            </Link>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Referral Trends" description="Pending referrals across facilities" />
          <CardBody style={{ padding: 0 }}>
            {pendingReferrals.length > 0 ? (
              pendingReferrals.slice(0, 5).map(r => (
                <div key={r.id} className="flex-between" style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--border-default)' }}>
                  <div>
                    <p className="font-medium">{r.patient_type} referral</p>
                    <p className="body-sm" style={{ color: 'var(--text-secondary)' }}>{r.reason?.slice(0, 60) || 'No reason'}</p>
                  </div>
                  <Badge variant={r.urgency === 'emergency' ? 'critical' : r.urgency === 'urgent' ? 'warning' : 'info'} solid>
                    {r.urgency}
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
      </div>
    </div>
  );
};

export default DistrictDashboard;
