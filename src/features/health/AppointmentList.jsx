import { useState, useEffect } from 'react';
import { Calendar, Clock, User, Search, AlertTriangle } from 'lucide-react';
import useVisitStore from '../../stores/visitStore';
import useAuthStore from '../../stores/authStore';
import { Card, CardBody } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';

export const AppointmentList = () => {
  const { profile } = useAuthStore();
  const { visits, fetchAllVisits, isLoading } = useVisitStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const [viewMode, setViewMode] = useState('today');

  useEffect(() => {
    fetchAllVisits();
  }, [fetchAllVisits]);

  const today = new Date().toISOString().split('T')[0];

  const filteredVisits = visits.filter(visit => {
    const matchesSearch = visit.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          visit.patient_id?.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesFilter = true;
    if (viewMode === 'today') {
      matchesFilter = visit.visit_date === today;
    } else if (viewMode === 'upcoming') {
      matchesFilter = visit.visit_date > today;
    } else if (viewMode === 'past') {
      matchesFilter = visit.visit_date < today;
    }
    
    const matchesType = filter === 'all' || visit.visit_type === filter;
    return matchesSearch && matchesFilter && matchesType;
  });

  const visitTypeColors = {
    home: 'info',
    facility: 'success',
    follow_up: 'warning',
    emergency: 'critical',
  };

  const todayCount = visits.filter(v => v.visit_date === today).length;
  const urgentCount = visits.filter(v => v.visit_type === 'emergency' && v.visit_date >= today).length;
  const thisWeekCount = visits.filter(v => {
    const d = new Date(v.visit_date);
    const now = new Date();
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() + 7);
    return d >= now && d <= weekEnd;
  }).length;

  return (
    <div className="page-content fade-in">
      <div className="flex-between" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 className="heading-2">Appointments</h1>
          <p className="body-md" style={{ color: 'var(--text-secondary)' }}>
            View and manage patient appointments.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-3" style={{ marginBottom: 'var(--space-6)' }}>
        <Card>
          <CardBody>
            <div className="flex-between">
              <span className="body-sm" style={{ color: 'var(--text-secondary)' }}>Today's Visits</span>
              <Calendar size={16} style={{ color: 'var(--color-primary-500)' }} />
            </div>
            <h2 className="heading-2" style={{ marginTop: 'var(--space-2)' }}>{todayCount}</h2>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex-between">
              <span className="body-sm" style={{ color: 'var(--text-secondary)' }}>This Week</span>
              <Clock size={16} style={{ color: 'var(--color-info-500)' }} />
            </div>
            <h2 className="heading-2" style={{ marginTop: 'var(--space-2)' }}>{thisWeekCount}</h2>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="flex-between">
              <span className="body-sm" style={{ color: 'var(--text-secondary)' }}>Urgent</span>
              <AlertTriangle size={16} style={{ color: 'var(--color-danger-500)' }} />
            </div>
            <h2 className="heading-2" style={{ marginTop: 'var(--space-2)', color: urgentCount > 0 ? 'var(--color-danger-600)' : undefined }}>{urgentCount}</h2>
          </CardBody>
        </Card>
      </div>

      {/* View Tabs + Filters */}
      <Card style={{ marginBottom: 'var(--space-6)' }}>
        <CardBody className="flex gap-4 items-end">
          <div className="flex gap-2">
            {['today', 'upcoming', 'past', 'all'].map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                style={{
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  border: viewMode === mode ? '2px solid var(--color-primary-500)' : '1px solid var(--border-default)',
                  background: viewMode === mode ? 'var(--color-primary-50)' : 'transparent',
                  color: viewMode === mode ? 'var(--color-primary-700)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: 'var(--text-sm)',
                  fontWeight: viewMode === mode ? '600' : '400',
                  textTransform: 'capitalize',
                }}
              >
                {mode}
              </button>
            ))}
          </div>
          <div style={{ flex: 1 }}>
            <Input
              placeholder="Search appointments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search size={18} />}
              style={{ marginBottom: 0 }}
            />
          </div>
          <div>
            <select
              className="input-base"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{ height: '44px', paddingRight: 'var(--space-8)' }}
            >
              <option value="all">All Types</option>
              <option value="home">Home</option>
              <option value="facility">Facility</option>
              <option value="follow_up">Follow-up</option>
              <option value="emergency">Emergency</option>
            </select>
          </div>
        </CardBody>
      </Card>

      {/* Visit List */}
      {isLoading ? (
        <div className="flex-center" style={{ padding: 'var(--space-12)' }}>
          <Spinner size={32} />
        </div>
      ) : filteredVisits.length > 0 ? (
        <div className="grid grid-2">
          {filteredVisits.sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date)).map((visit) => (
            <Card key={visit.id} hoverable>
              <CardBody>
                <div className="flex-between" style={{ marginBottom: 'var(--space-3)' }}>
                  <div className="flex gap-2 items-center">
                    <Calendar size={16} style={{ color: 'var(--color-primary-500)' }} />
                    <span className="font-medium">{new Date(visit.visit_date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant={visitTypeColors[visit.visit_type] || 'info'} solid>
                      {visit.visit_type?.replace('_', ' ')}
                    </Badge>
                    {visit.visit_date === today && (
                      <Badge variant="success" solid>Today</Badge>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 items-center" style={{ marginBottom: 'var(--space-2)' }}>
                  <User size={14} style={{ color: 'var(--text-tertiary)' }} />
                  <span className="body-sm" style={{ color: 'var(--text-secondary)' }}>
                    Patient: {visit.patient_id?.slice(0, 8)}... ({visit.patient_type})
                  </span>
                </div>
                {visit.notes && (
                  <p className="body-sm" style={{ color: 'var(--text-tertiary)' }}>
                    {visit.notes.length > 120 ? visit.notes.slice(0, 120) + '...' : visit.notes}
                  </p>
                )}
                {visit.findings && (
                  <p className="body-sm" style={{ color: 'var(--color-primary-600)', marginTop: 'var(--space-2)' }}>
                    Findings: {visit.findings.length > 100 ? visit.findings.slice(0, 100) + '...' : visit.findings}
                  </p>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No appointments found"
          description={searchTerm ? "Try adjusting your search filters." : viewMode === 'today' ? "No visits scheduled for today." : "No appointments match this view."}
        />
      )}
    </div>
  );
};

export default AppointmentList;
