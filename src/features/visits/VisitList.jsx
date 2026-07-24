import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Plus, Search, Filter, Pencil, Trash2 } from 'lucide-react';
import useVisitStore from '../../stores/visitStore';
import useAuthStore from '../../stores/authStore';
import useAppStore from '../../stores/appStore';
import { Card, CardBody } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import ConfirmDialog from '../../components/ui/ConfirmDialog';

export const VisitList = () => {
  const { profile } = useAuthStore();
  const { visits, fetchVisitsByWorker, softDelete, isLoading } = useVisitStore();
  const addToast = useAppStore((state) => state.addToast);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    if (profile?.id) {
      fetchVisitsByWorker(profile.id);
    }
  }, [profile?.id, fetchVisitsByWorker]);

  const filteredVisits = visits.filter(visit => {
    const matchesSearch = visit.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          visit.patient_id?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === 'all' || visit.visit_type === filter;
    return matchesSearch && matchesFilter;
  });

  const visitTypeColors = {
    home: 'info',
    facility: 'success',
    follow_up: 'warning',
    emergency: 'critical',
  };

  return (
    <div className="page-content fade-in">
      <div className="flex-between" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 className="heading-2">Health Visits</h1>
          <p className="body-md" style={{ color: 'var(--text-secondary)' }}>
            Track and manage your health visits.
          </p>
        </div>
        <Link to="/visits/new">
          <Button leftIcon={<Plus size={18} />}>Log Visit</Button>
        </Link>
      </div>

      <Card style={{ marginBottom: 'var(--space-6)' }}>
        <CardBody className="flex gap-4 items-end">
          <div style={{ flex: 1 }}>
            <Input
              placeholder="Search visits..."
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
              <option value="all">All Visits</option>
              <option value="home">Home Visits</option>
              <option value="facility">Facility Visits</option>
              <option value="follow_up">Follow-up</option>
              <option value="emergency">Emergency</option>
            </select>
          </div>
        </CardBody>
      </Card>

      {isLoading ? (
        <div className="flex-center" style={{ padding: 'var(--space-12)' }}>
          <Spinner size={32} />
        </div>
      ) : filteredVisits.length > 0 ? (
        <div className="grid grid-2">
          {filteredVisits.map((visit) => (
            <Card key={visit.id} hoverable>
              <CardBody>
                <div className="flex-between" style={{ marginBottom: 'var(--space-3)' }}>
                  <div className="flex gap-2 items-center">
                    <Calendar size={16} style={{ color: 'var(--color-primary-500)' }} />
                    <span className="font-medium">{new Date(visit.visit_date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={visitTypeColors[visit.visit_type] || 'info'} solid>
                      {visit.visit_type?.replace('_', ' ')}
                    </Badge>
                    <Link to={`/visits/${visit.id}/edit`} onClick={(e) => e.stopPropagation()}>
                      <button className="icon-btn-sm" title="Edit"><Pencil size={14} /></button>
                    </Link>
                    <button
                      className="icon-btn-sm danger"
                      onClick={(e) => { e.preventDefault(); setDeleteTarget({ id: visit.id, name: `Visit (${new Date(visit.visit_date).toLocaleDateString()})` }); }}
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <p className="body-sm" style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
                  Patient: {visit.patient_id?.slice(0, 8)}... ({visit.patient_type})
                </p>
                {visit.notes && (
                  <p className="body-sm" style={{ color: 'var(--text-tertiary)' }}>
                    {visit.notes.length > 100 ? visit.notes.slice(0, 100) + '...' : visit.notes}
                  </p>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState 
          title="No visits found" 
          description={searchTerm ? "Try adjusting your search filters." : "You haven't logged any visits yet."}
          action={!searchTerm && (
            <Link to="/visits/new">
              <Button variant="outline">Log First Visit</Button>
            </Link>
          )}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Visit"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        onConfirm={async () => {
          await softDelete(deleteTarget.id);
          addToast({ type: 'success', message: 'Visit deleted.' });
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default VisitList;
