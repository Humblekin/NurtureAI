import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search, AlertTriangle, ShieldCheck } from 'lucide-react';
import useAuthStore from '../../stores/authStore';
import { searchPatients } from '../../services/patientSearch';
import { Card, CardBody } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import VerificationBadge from '../../components/VerificationBadge';

const SCOPE_LABELS = {
  chw: 'Showing only mothers assigned to you.',
  nurse: 'Showing mothers registered at your facility.',
  doctor: 'Showing all registered mothers.',
  admin: 'Showing all registered mothers.',
};

export const PatientSearch = () => {
  const { profile } = useAuthStore();
  const role = profile?.role || 'chw';
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef(null);

  const runSearch = useCallback(async (term) => {
    setIsSearching(true);
    setError(null);

    const { mothers, error: searchError } = await searchPatients({ query: term, limit: 25 });

    setIsSearching(false);
    setResults(mothers);
    setSearched(true);

    if (searchError) {
      setError(searchError);
      setResults([]);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setSearched(false);
      setError(null);
      setIsSearching(false);
      return;
    }

    debounceRef.current = setTimeout(() => runSearch(term), 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  const profilePath = (mother) => `/${role}/mothers/${mother.id}`;

  return (
    <div className="page-content fade-in">
      <div className="flex-between" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 className="heading-2">Patient Search</h1>
          <p className="body-md" style={{ color: 'var(--text-secondary)' }}>
            Find registered mothers in your catchment area.
          </p>
        </div>
      </div>

      <Card style={{ marginBottom: 'var(--space-6)' }}>
        <CardBody className="flex gap-4 items-end">
          <div style={{ flex: 1 }}>
            <Input
              placeholder="Search by name, phone, community, or Patient ID (NRT-…)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              leftIcon={<Search size={18} />}
              style={{ marginBottom: 0 }}
              autoFocus
            />
          </div>
        </CardBody>
      </Card>

      <div className="flex gap-2 items-center" style={{ marginBottom: 'var(--space-4)' }}>
        <ShieldCheck size={16} style={{ color: 'var(--color-primary-500)' }} />
        <span className="body-sm" style={{ color: 'var(--text-secondary)' }}>
          {SCOPE_LABELS[role] || SCOPE_LABELS.doctor}
        </span>
      </div>

      {error && (
        <Card variant="outlined" style={{ marginBottom: 'var(--space-6)' }}>
          <CardBody className="flex items-center gap-3">
            <AlertTriangle size={18} style={{ color: 'var(--color-danger-500)' }} />
            <span className="body-md">{error}</span>
          </CardBody>
        </Card>
      )}

      {isSearching ? (
        <div className="flex-center" style={{ padding: 'var(--space-12)' }}>
          <Spinner size={32} />
        </div>
      ) : results.length > 0 ? (
        <div className="grid grid-3">
          {results.map((mother) => (
            <Card key={mother.id} hoverable className="h-full flex-col">
              <CardBody className="flex-col h-full gap-3">
                <div className="flex-between align-start">
                  <div>
                    <h3 className="heading-5" style={{ color: 'var(--text-primary)' }}>
                      <Link to={profilePath(mother)} style={{ textDecoration: 'none', color: 'inherit' }}>
                        {mother.full_name || 'Unnamed Mother'}
                      </Link>
                    </h3>
                    <p className="body-sm" style={{ color: 'var(--text-secondary)' }}>
                      {mother.community || 'Unknown Community'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {mother.risk_level === 'high' && (
                      <Badge variant="critical" solid title="High Risk Pregnancy">
                        <AlertTriangle size={12} style={{ marginRight: '4px' }} />
                        High Risk
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
                  <VerificationBadge row={mother} />
                  {mother.data_source && (
                    <Badge variant="neutral">{mother.data_source}</Badge>
                  )}
                </div>

                <div style={{ marginTop: 'auto', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--border-default)' }}>
                  <p className="body-sm flex-between">
                    <span style={{ color: 'var(--text-tertiary)' }}>Patient ID:</span>
                    <span className="font-medium">{mother.patient_code || '—'}</span>
                  </p>
                  <p className="body-sm flex-between" style={{ marginTop: '4px' }}>
                    <span style={{ color: 'var(--text-tertiary)' }}>EDD:</span>
                    <span className="font-medium">
                      {mother.edd ? new Date(mother.edd).toLocaleDateString() : 'Unknown'}
                    </span>
                  </p>
                  {mother.phone && (
                    <p className="body-sm flex-between" style={{ marginTop: '4px' }}>
                      <span style={{ color: 'var(--text-tertiary)' }}>Phone:</span>
                      <span className="font-medium">{mother.phone}</span>
                    </p>
                  )}
                </div>

                <div className="flex gap-2" style={{ marginTop: 'var(--space-4)' }}>
                  <Link to={profilePath(mother)} style={{ flex: '1 1 auto', textDecoration: 'none' }}>
                    <Button variant="outline" fullWidth size="sm">Profile</Button>
                  </Link>
                  <Link to={`/${role}/visits/new?patientId=${mother.id}&patientType=mother`} style={{ flex: '1 1 auto', textDecoration: 'none' }}>
                    <Button fullWidth size="sm">Record Visit</Button>
                  </Link>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      ) : searched && !error ? (
        <EmptyState
          title="No patients found"
          description={query.trim().length >= 2 ? "Try a different name, phone number, or community." : "Type at least 2 characters to start searching."}
        />
      ) : !searched ? (
        <EmptyState
          icon={Search}
          title="Search your patients"
          description="Search by full name, phone number, or community. Results respect your access level."
        />
      ) : null}

      {!error && searched && results.length > 0 && (
        <div className="flex-center" style={{ marginTop: 'var(--space-6)' }}>
          <Link to={`/${role}/mothers`}>
            <Button variant="outline">View all mothers</Button>
          </Link>
        </div>
      )}
    </div>
  );
};

export default PatientSearch;
