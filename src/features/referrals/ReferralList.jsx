import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Plus, Search, Filter, Trash2 } from 'lucide-react';
import useReferralStore from '../../stores/referralStore';
import useAuthStore from '../../stores/authStore';
import useAppStore from '../../stores/appStore';
import { Card, CardBody } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import ConfirmDialog from '../../components/ui/ConfirmDialog';

export const ReferralList = () => {
  const { referrals, fetchOutgoingReferrals, softDelete, isLoading } = useReferralStore();
  const { profile } = useAuthStore();
  const addToast = useAppStore((state) => state.addToast);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    const userId = profile?.id || profile?.facility_id;
    if (userId) {
      fetchOutgoingReferrals(userId);
    }
  }, [fetchOutgoingReferrals, profile]);

  const filteredReferrals = referrals.filter(referral => {
    const matchesSearch = referral.reason?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          referral.patient_id?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === 'all' || referral.status === filter;
    return matchesSearch && matchesFilter;
  });

  const statusColors = {
    pending: 'warning',
    accepted: 'info',
    completed: 'success',
    rejected: 'critical',
  };

  const urgencyColors = {
    routine: 'info',
    soon: 'warning',
    urgent: 'critical',
    emergency: 'critical',
  };

  return (
    <div className="page-content fade-in">
      <div className="flex-between" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 className="heading-2">Referrals</h1>
          <p className="body-md" style={{ color: 'var(--text-secondary)' }}>
            Manage patient referrals between facilities.
          </p>
        </div>
        <Link to="/referrals/new">
          <Button leftIcon={<Plus size={18} />}>New Referral</Button>
        </Link>
      </div>

      <Card style={{ marginBottom: 'var(--space-6)' }}>
        <CardBody className="flex gap-4 items-end">
          <div style={{ flex: 1 }}>
            <Input
              placeholder="Search referrals..."
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
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="completed">Completed</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </CardBody>
      </Card>

      {isLoading ? (
        <div className="flex-center" style={{ padding: 'var(--space-12)' }}>
          <Spinner size={32} />
        </div>
      ) : filteredReferrals.length > 0 ? (
        <div className="grid grid-2">
          {filteredReferrals.map((referral) => (
            <Card key={referral.id} hoverable>
              <CardBody>
                <div className="flex-between" style={{ marginBottom: 'var(--space-3)' }}>
                  <div className="flex gap-2 items-center">
                    <Activity size={16} style={{ color: 'var(--color-primary-500)' }} />
                    <span className="font-medium">{new Date(referral.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex gap-2 items-center">
                    <Badge variant={urgencyColors[referral.urgency] || 'info'} solid>
                      {referral.urgency}
                    </Badge>
                    <Badge variant={statusColors[referral.status] || 'info'}>
                      {referral.status}
                    </Badge>
                    <button
                      className="icon-btn-sm danger"
                      onClick={(e) => { e.preventDefault(); setDeleteTarget({ id: referral.id, name: `Referral to ${referral.to_facility_id || 'unknown'}` }); }}
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <p className="body-sm" style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
                  Patient: {referral.patient_id?.slice(0, 8)}... ({referral.patient_type})
                </p>
                {referral.reason && (
                  <p className="body-sm" style={{ color: 'var(--text-tertiary)' }}>
                    {referral.reason.length > 100 ? referral.reason.slice(0, 100) + '...' : referral.reason}
                  </p>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState 
          title="No referrals found" 
          description={searchTerm ? "Try adjusting your search filters." : "No referrals have been created yet."}
          action={!searchTerm && (
            <Link to="/referrals/new">
              <Button variant="outline">Create First Referral</Button>
            </Link>
          )}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Referral"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        onConfirm={async () => {
          await softDelete(deleteTarget.id);
          addToast({ type: 'success', message: 'Referral deleted.' });
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default ReferralList;
