import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Users, AlertTriangle, ClipboardList, Activity, ArrowRight, Search, Calendar } from 'lucide-react';
import useAuthStore from '../../stores/authStore';
import useMotherStore from '../../stores/motherStore';
import useChildStore from '../../stores/childStore';
import useReferralStore from '../../stores/referralStore';
import useVisitStore from '../../stores/visitStore';
import { buildPatientNameLookup } from '../../services/patientNames';
import { searchPatients } from '../../services/patientSearch';
import VerificationBadge from '../../components/VerificationBadge';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Spinner from '../../components/ui/Spinner';

const VISIT_TYPE_COLORS = {
  home: 'info',
  facility: 'success',
  follow_up: 'warning',
  emergency: 'critical',
};

export const DoctorDashboard = () => {
  const { profile } = useAuthStore();
  const { mothers, fetchMothers, isLoading } = useMotherStore();
  const { children, fetchChildrenList } = useChildStore();
  const { referrals, fetchIncomingReferrals } = useReferralStore();
  const { visits, fetchRecentVisits } = useVisitStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    fetchMothers();
    fetchChildrenList();
    fetchRecentVisits(10);
    if (profile?.facility_id) {
      fetchIncomingReferrals(profile.facility_id);
    }
  }, [profile?.facility_id, fetchMothers, fetchChildrenList, fetchIncomingReferrals, fetchRecentVisits]);

  const runSearch = useCallback(async (term) => {
    setIsSearching(true);
    const { mothers: m, error } = await searchPatients({ query: term, limit: 10 });
    setIsSearching(false);
    if (error) {
      setResults([]);
    } else {
      setResults(m || []);
    }
    setSearched(true);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    debounceRef.current = setTimeout(() => runSearch(term), 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  const totalPatients = mothers.length;
  const highRisk = mothers.filter(m => m.risk_level === 'high' || m.risk_level === 'critical');
  const pendingReferrals = referrals.filter(r => r.status === 'pending');
  const urgentReferrals = pendingReferrals.filter(r => r.urgency === 'urgent' || r.urgency === 'emergency');
  const pendingVerification = mothers.filter(m => !m.verified && (m.data_source === 'mother_registered' || m.data_source === 'mother_reported'));
  const today = new Date().toISOString().split('T')[0];
  const todayVisits = visits.filter(v => v.visit_date === today);
  const patientNameOf = buildPatientNameLookup(mothers, children);
  const visitsToShow = todayVisits.length > 0 ? todayVisits : visits.slice(0, 5);

  if (isLoading) return <div className="flex-center" style={{ padding: 'var(--space-12)' }}><Spinner size={32} /></div>;

  return (
    <div className="page-content fade-in">
      <div className="flex-between align-start" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 className="heading-2">Doctor Dashboard</h1>
          <p className="body-lg" style={{ color: 'var(--text-secondary)' }}>
            Clinical decisions and patient oversight.
          </p>
        </div>
        <div className="flex gap-3" style={{ flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
          <p className="body-sm" style={{ color: 'var(--text-tertiary)', marginRight: 'var(--space-4)' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <Link to="/doctor/mothers" style={{ textDecoration: 'none' }}>
            <Button variant="outline" leftIcon={<Users size={18} />}>
              View All Patients
            </Button>
          </Link>
          <Link to="/doctor/visits/new" style={{ textDecoration: 'none' }}>
            <Button leftIcon={<Activity size={18} />}>
              Record Health Visit
            </Button>
          </Link>
        </div>
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
            <span className="body-sm" style={{ color: pendingVerification.length > 0 ? 'var(--color-warning-500)' : 'var(--text-tertiary)' }}>
              {pendingVerification.length > 0 ? `${pendingVerification.length} pending verification` : 'All records verified'}
            </span>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-2" style={{ gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
        {/* Find Mother */}
        <Card>
          <CardHeader title="Find Mother" description="Search all registered mothers" />
          <CardBody className="flex-col gap-3">
            <Input
              placeholder="Search by name, phone, community, or ID..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              leftIcon={<Search size={18} />}
            />
            {isSearching && (
              <div className="flex items-center gap-2">
                <Spinner size={16} />
                <span className="body-sm text-secondary">Searching...</span>
              </div>
            )}
            {!isSearching && results.length > 0 && (
              <div className="flex-col" style={{ maxHeight: '220px', overflowY: 'auto' }}>
                {results.map((mother) => (
                  <Link
                    to={`/doctor/mothers/${mother.id}`}
                    key={mother.id}
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    <div className="flex-between p-3" style={{ borderBottom: '1px solid var(--border-default)' }}>
                      <div>
                        <p className="font-medium">{mother.full_name}</p>
                        <p className="body-sm" style={{ color: 'var(--text-secondary)' }}>
                          {mother.patient_code || 'ID Unknown'} • {mother.community || 'Unknown Community'}{mother.phone ? ` • ${mother.phone}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <VerificationBadge row={mother} />
                        {mother.risk_level === 'high' && <Badge variant="critical" solid>High Risk</Badge>}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
            {!isSearching && searched && results.length === 0 && (
              <p className="body-sm" style={{ color: 'var(--text-tertiary)' }}>
                No matching patients found.
              </p>
            )}
          </CardBody>
        </Card>

        {/* Today's Visits */}
        <Card>
          <CardHeader title="Today's Visits" description="Visits recorded today" />
          <CardBody style={{ padding: 0 }}>
            {(todayVisits.length > 0 ? todayVisits : visits.slice(0, 5)).length > 0 ? (
              visitsToShow.map((visit) => {
                const nameInfo = patientNameOf(visit.patient_id);
                return (
                  <div key={visit.id} className="flex-between p-4" style={{ borderBottom: '1px solid var(--border-default)' }}>
                    <div className="flex items-center gap-2">
                      <Calendar size={16} style={{ color: 'var(--color-primary-500)' }} />
                      <span className="font-medium">{nameInfo ? nameInfo.name : visit.patient_id?.slice(0, 8)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={VISIT_TYPE_COLORS[visit.visit_type] || 'info'} solid>
                        {visit.visit_type?.replace('_', ' ')}
                      </Badge>
                      {!visit.verified && (
                        <Badge variant="neutral" dot>Unverified</Badge>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
                <p className="body-sm" style={{ color: 'var(--text-tertiary)' }}>No recent visits.</p>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-2" style={{ gap: 'var(--space-6)' }}>
        <Card>
          <CardHeader title="Urgent Referrals" description="Cases requiring immediate attention" />
          <CardBody style={{ padding: 0 }}>
            {urgentReferrals.length > 0 ? (
              urgentReferrals.slice(0, 5).map(r => {
                const nameInfo = patientNameOf(r.patient_id);
                return (
                  <Link to={`/doctor/mothers/${r.patient_id}`} key={r.id} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div className="flex-between hover-bg-light" style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--border-default)' }}>
                      <div>
                        <p className="font-medium">{nameInfo ? nameInfo.name : `Patient ${r.patient_id?.slice(0, 8)}`}</p>
                        <p className="body-sm" style={{ color: 'var(--text-secondary)' }}>{r.reason || 'No reason specified'}</p>
                      </div>
                      <Badge variant={r.urgency === 'emergency' ? 'critical' : 'warning'} solid>{r.urgency}</Badge>
                    </div>
                  </Link>
                );
              })
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
                <Link to={`/doctor/mothers/${m.id}`} key={m.id} style={{ textDecoration: 'none', color: 'inherit' }}>
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
