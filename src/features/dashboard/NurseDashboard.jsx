import { useState, useEffect, useRef, useCallback } from 'react';
import { AlertCircle, Users, Activity, AlertTriangle, Search, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
import useAuthStore from '../../stores/authStore';
import useMotherStore from '../../stores/motherStore';
import useVisitStore from '../../stores/visitStore';
import useChildStore from '../../stores/childStore';
import useReferralStore from '../../stores/referralStore';
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

export const NurseDashboard = () => {
  const { profile } = useAuthStore();
  const { mothers, fetchMothers } = useMotherStore();
  const { children, fetchChildrenList } = useChildStore();
  const { visits, fetchRecentVisits } = useVisitStore();
  const { referrals, fetchIncomingReferrals } = useReferralStore();
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
  }, [profile?.facility_id, fetchMothers, fetchChildrenList, fetchRecentVisits, fetchIncomingReferrals]);

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
  const highRiskMothers = mothers.filter(m => m.risk_level === 'high' || m.risk_level === 'critical');
  const pendingReferrals = referrals.filter(r => r.status === 'pending');
  const pendingVerification = mothers.filter(m => !m.verified && (m.data_source === 'mother_registered' || m.data_source === 'mother_reported'));
  const today = new Date().toISOString().split('T')[0];
  const todayVisits = visits.filter(v => v.visit_date === today);
  const visitsToShow = todayVisits.length > 0 ? todayVisits : visits;
  const patientNameOf = buildPatientNameLookup(mothers, children);

  const renderVisitRow = (visit) => {
    const nameInfo = patientNameOf(visit.patient_id);
    return (
      <div key={visit.id} className="flex-between p-4" style={{ borderBottom: '1px solid var(--border-default)' }}>
        <div>
          <div className="flex items-center gap-2">
            <Calendar size={16} style={{ color: 'var(--color-primary-500)' }} />
            <span className="font-medium">{nameInfo ? nameInfo.name : visit.patient_id?.slice(0, 8)}</span>
          </div>
          {visit.notes && <p className="body-sm" style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>{visit.notes.slice(0, 50)}{visit.notes.length > 50 ? '...' : ''}</p>}
        </div>
        <div className="flex items-center gap-2" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Badge variant={VISIT_TYPE_COLORS[visit.visit_type] || 'info'} solid>
            {visit.visit_type?.replace('_', ' ')}
          </Badge>
          {!visit.verified && (
            <Badge variant="neutral" dot>Unverified</Badge>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="page-content fade-in">
      <div className="flex-between align-start" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 className="heading-2">Clinical Dashboard</h1>
          <p className="body-lg" style={{ color: 'var(--text-secondary)' }}>
            Overview of facility patients and incoming referrals.
          </p>
        </div>
        <div className="flex gap-3" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Link to="/nurse/mothers/new" style={{ textDecoration: 'none' }}>
            <Button variant="outline" leftIcon={<Users size={18} />}>
              Register Mother
            </Button>
          </Link>
          <Link to="/nurse/visits/new" style={{ textDecoration: 'none' }}>
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
            <h2 className="heading-2" style={{ marginTop: 'var(--space-2)' }}>{totalPatients}</h2>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex-between">
              <span className="body-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Pending Verification</span>
              <Activity size={16} style={{ color: 'var(--color-warning-500)' }} />
            </div>
            <h2 className="heading-2" style={{ marginTop: 'var(--space-2)' }}>{pendingVerification.length}</h2>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex-between">
              <span className="body-sm font-medium" style={{ color: 'var(--text-secondary)' }}>High Risk Cases</span>
              <AlertTriangle size={16} style={{ color: 'var(--color-danger-500)' }} />
            </div>
            <h2 className="heading-2" style={{ marginTop: 'var(--space-2)' }}>{highRiskMothers.length}</h2>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-2" style={{ gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
        {/* Find Mother */}
        <Card>
          <CardHeader title="Find Mother" description="Search patients registered at this facility" />
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
                    to={`/nurse/mothers/${mother.id}`}
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
          <CardHeader title="Recent Visits" description="Latest recorded visits" />
          <CardBody style={{ padding: 0 }}>
            {visitsToShow.length > 0 ? (
              visitsToShow.slice(0, 5).map(renderVisitRow)
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
          <CardHeader title="Pending Referrals" description="Patients referred to this facility" />
          <CardBody style={{ padding: 0 }}>
            {pendingReferrals.length > 0 ? (
              pendingReferrals.slice(0, 5).map((referral) => {
                const nameInfo = patientNameOf(referral.patient_id);
                return (
                  <Link to={`/nurse/mothers/${referral.patient_id}`} key={referral.id} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--border-default)' }} className="flex-between hover-bg-light">
                      <div>
                        <p className="font-medium">{nameInfo ? nameInfo.name : referral.patient_id?.slice(0, 8)}</p>
                        <p className="body-sm" style={{ color: 'var(--text-secondary)' }}>{referral.reason || 'No reason specified'}</p>
                      </div>
                      <Badge variant={referral.urgency === 'emergency' ? 'critical' : referral.urgency === 'urgent' ? 'warning' : 'info'} solid>
                        {referral.urgency}
                      </Badge>
                    </div>
                  </Link>
                );
              })
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
            <Link to="/nurse/patients" style={{ textDecoration: 'none' }}>
              <Button variant="outline" leftIcon={<Search size={18} />} fullWidth style={{ justifyContent: 'flex-start' }}>
                Search Directory
              </Button>
            </Link>
            <Link to="/nurse/mothers" style={{ textDecoration: 'none' }}>
              <Button variant="outline" leftIcon={<Users size={18} />} fullWidth style={{ justifyContent: 'flex-start' }}>
                View All Patients
              </Button>
            </Link>
            <Link to="/nurse/referrals" style={{ textDecoration: 'none' }}>
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
