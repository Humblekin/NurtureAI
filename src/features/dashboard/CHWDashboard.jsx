import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Users, Activity, AlertTriangle, CheckCircle2, Baby, Search, Calendar } from 'lucide-react';
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

export const CHWDashboard = () => {
  const { profile } = useAuthStore();
  const { mothers, fetchMothers } = useMotherStore();
  const { children, fetchChildrenList } = useChildStore();
  const { visits, fetchVisitsByWorker } = useVisitStore();
  const { referrals, fetchReferralsByWorker } = useReferralStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (profile?.id) {
      fetchMothers();
      fetchChildrenList();
      fetchVisitsByWorker(profile.id);
      fetchReferralsByWorker(profile.id);
    }
  }, [profile?.id, fetchMothers, fetchChildrenList, fetchVisitsByWorker, fetchReferralsByWorker]);

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
  const totalVisits = visits.length;
  const highRiskMothers = mothers.filter(m => m.risk_level === 'high' || m.risk_level === 'critical');
  const today = new Date().toISOString().split('T')[0];
  const todayVisits = visits.filter(v => v.visit_date === today);
  const urgentReferrals = referrals.filter(r => r.status === 'pending' && (r.urgency === 'urgent' || r.urgency === 'emergency'));
  const assignedMothers = mothers.filter(m => m.assigned_worker_id === profile?.id);
  const pendingVerification = mothers.filter(m => !m.verified && (m.data_source === 'mother_registered' || m.data_source === 'mother_reported'));
  const patientNameOf = buildPatientNameLookup(mothers, children);

  return (
    <div className="page-content fade-in">
      <div className="flex-between align-start" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 className="heading-2">CHW Dashboard</h1>
          <p className="body-lg" style={{ color: 'var(--text-secondary)' }}>
            {profile?.community || 'Your Area'} • {new Date().toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-3" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Link to="/chw/mothers/new" style={{ textDecoration: 'none' }}>
            <Button variant="outline" leftIcon={<Users size={18} />}>
              Register Mother
            </Button>
          </Link>
          <Link to="/chw/visits/new" style={{ textDecoration: 'none' }}>
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
              <span className="body-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Today's Visits</span>
              <Activity size={16} style={{ color: 'var(--color-info-500)' }} />
            </div>
            <h2 className="heading-2" style={{ marginTop: 'var(--space-2)' }}>{todayVisits.length}</h2>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex-between">
              <span className="body-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Assigned to Me</span>
              <Users size={16} style={{ color: 'var(--color-primary-500)' }} />
            </div>
            <h2 className="heading-2" style={{ marginTop: 'var(--space-2)' }}>{assignedMothers.length}</h2>
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
              <span className="body-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Total Patients</span>
              <CheckCircle2 size={16} style={{ color: 'var(--color-success-500)' }} />
            </div>
            <h2 className="heading-2" style={{ marginTop: 'var(--space-2)' }}>{totalPatients}</h2>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-2" style={{ gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
        {/* Find Mother */}
        <Card>
          <CardHeader title="Find Mother" description="Search your registered patients to open or record a visit" />
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
                    to={`/chw/mothers/${mother.id}`}
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
            {todayVisits.length > 0 ? (
              todayVisits.slice(0, 5).map((visit) => {
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
                <p className="body-sm" style={{ color: 'var(--text-tertiary)' }}>No visits recorded today yet.</p>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-4" style={{ gap: 'var(--space-6)' }}>
        <Card>
          <CardHeader title="Needs Attention" description="High-risk mothers and urgent referrals" />
          <CardBody style={{ padding: 0 }}>
            {(urgentReferrals.length > 0 || highRiskMothers.length > 0) ? (
              [...urgentReferrals, ...highRiskMothers].slice(0, 5).map((item) => {
                const isReferral = !!item.from_worker_id;
                const nameInfo = isReferral ? patientNameOf(item.patient_id) : null;
                return (
                  <Link to={isReferral ? `/chw/referrals` : `/chw/mothers/${item.id}`}
                    key={item.id}
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--border-default)' }} className="flex-between">
                      <div>
                        <p className="font-medium">{isReferral ? (nameInfo?.name || 'Patient') : item.full_name}</p>
                        <p className="body-sm" style={{ color: 'var(--text-secondary)' }}>
                          {isReferral ? `Referral — ${item.urgency}` : (item.community || 'Unknown Community')}
                        </p>
                      </div>
                      <Badge variant={isReferral ? (item.urgency === 'emergency' ? 'critical' : 'warning') : 'critical'} solid>
                        {isReferral ? (item.urgency === 'emergency' ? 'Emergency' : 'Urgent') : 'High Risk'}
                      </Badge>
                    </div>
                  </Link>
                );
              })
            ) : (
              <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
                <p className="body-sm" style={{ color: 'var(--text-tertiary)' }}>Nothing urgent right now</p>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="My Assigned Mothers" description="Mothers assigned to you" />
          <CardBody style={{ padding: 0 }}>
            {assignedMothers.length > 0 ? (
              assignedMothers.slice(0, 5).map((mother) => (
                <Link to={`/chw/mothers/${mother.id}`}
                  key={mother.id}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--border-default)' }} className="flex-between">
                    <div>
                      <p className="font-medium">{mother.full_name}</p>
                      <p className="body-sm" style={{ color: 'var(--text-secondary)' }}>{mother.community || 'Unknown Community'}</p>
                    </div>
                    {(mother.risk_level === 'high' || mother.risk_level === 'critical') && (
                      <Badge variant="critical" solid>High Risk</Badge>
                    )}
                  </div>
                </Link>
              ))
            ) : (
              <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
                <p className="body-sm" style={{ color: 'var(--text-tertiary)' }}>No mothers assigned to you</p>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Pending Verification" description="Self-registered mothers awaiting review" />
          <CardBody style={{ padding: 0 }}>
            {pendingVerification.length > 0 ? (
              pendingVerification.slice(0, 5).map((mother) => (
                <Link to={`/chw/mothers/${mother.id}`}
                  key={mother.id}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--border-default)' }} className="flex-between">
                    <div>
                      <p className="font-medium">{mother.full_name}</p>
                      <p className="body-sm" style={{ color: 'var(--text-secondary)' }}>{mother.patient_code || 'ID Unknown'}</p>
                    </div>
                    <VerificationBadge row={mother} />
                  </div>
                </Link>
              ))
            ) : (
              <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
                <p className="body-sm" style={{ color: 'var(--text-tertiary)' }}>All records verified</p>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Quick Actions" />
          <CardBody className="flex-col gap-3">
            <Link to="/chw/children/new" style={{ textDecoration: 'none' }}>
              <Button variant="outline" leftIcon={<Baby size={18} />} fullWidth style={{ justifyContent: 'flex-start' }}>
                Register New Child
              </Button>
            </Link>
            <Link to="/chw/patients" style={{ textDecoration: 'none' }}>
              <Button variant="outline" leftIcon={<Search size={18} />} fullWidth style={{ justifyContent: 'flex-start' }}>
                Search Directory
              </Button>
            </Link>
          </CardBody>
        </Card>
      </div>
    </div>
  );
};

export default CHWDashboard;
