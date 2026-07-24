import { useState, useEffect } from 'react';
import { Archive, RotateCcw, Baby, Users, Activity, RefreshCw } from 'lucide-react';
import useMotherStore from '../../stores/motherStore';
import useChildStore from '../../stores/childStore';
import useReferralStore from '../../stores/referralStore';
import useAppStore from '../../stores/appStore';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import ConfirmDialog from '../../components/ui/ConfirmDialog';

const TABS = [
  { key: 'mothers', label: 'Mothers', icon: Users },
  { key: 'children', label: 'Children', icon: Baby },
  { key: 'referrals', label: 'Referrals', icon: Activity },
];

export const AdminArchive = () => {
  const [activeTab, setActiveTab] = useState('mothers');
  const [archived, setArchived] = useState({ mothers: [], children: [], referrals: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const addToast = useAppStore((state) => state.addToast);

  const motherStore = useMotherStore();
  const childStore = useChildStore();
  const referralStore = useReferralStore();

  const fetchArchived = async () => {
    setIsLoading(true);
    const [mothers, children, referrals] = await Promise.all([
      motherStore.fetchArchived(),
      childStore.fetchArchived(),
      referralStore.fetchArchived(),
    ]);
    setArchived({ mothers, children, referrals });
    setIsLoading(false);
  };

  useEffect(() => {
    fetchArchived();
  }, []);

  const handleRestore = async () => {
    if (!restoreTarget) return;
    const { type, id, name } = restoreTarget;
    let result;
    if (type === 'mothers') result = await motherStore.restore(id);
    else if (type === 'children') result = await childStore.restore(id);
    else if (type === 'referrals') result = await referralStore.restore(id);

    if (result?.success) {
      addToast({ type: 'success', message: `${name} restored.` });
      fetchArchived();
    }
    setRestoreTarget(null);
  };

  const renderList = (items, type) => {
    if (isLoading) {
      return <div className="p-6 flex-center"><Spinner size={24} /></div>;
    }
    if (items.length === 0) {
      return (
        <div className="p-6">
          <EmptyState title="No archived records" description="Nothing has been archived yet." />
        </div>
      );
    }
    return (
      <div className="flex-col">
        {items.map((item) => (
          <div key={item.id} className="flex-between p-4" style={{ borderBottom: '1px solid var(--border-default)' }}>
            <div>
              <p className="font-medium">{item.full_name || item.reason?.slice(0, 60) || 'Record'}</p>
              <p className="caption text-secondary">
                Archived: {item.deleted_at ? new Date(item.deleted_at).toLocaleDateString() : 'Unknown'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="neutral">Archived</Badge>
              <Button
                size="sm"
                variant="outline"
                leftIcon={<RotateCcw size={14} />}
                onClick={() => setRestoreTarget({ type, id: item.id, name: item.full_name || 'Record' })}
              >
                Restore
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const currentItems = archived[activeTab] || [];

  return (
    <div className="page-content fade-in">
      <div className="flex-between" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 className="heading-2">Archived Records</h1>
          <p className="body-md" style={{ color: 'var(--text-secondary)' }}>
            View and restore soft-deleted records.
          </p>
        </div>
        <Button variant="outline" leftIcon={<RefreshCw size={18} />} onClick={fetchArchived}>
          Refresh
        </Button>
      </div>

      <Card>
        <div className="flex" style={{ borderBottom: '1px solid var(--border-default)', padding: '0 var(--space-5)' }}>
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`tab-trigger ${activeTab === key ? 'active' : ''}`}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: 'var(--space-3) var(--space-4)',
                borderBottom: activeTab === key ? '2px solid var(--color-primary-500)' : '2px solid transparent',
                color: activeTab === key ? 'var(--color-primary-600)' : 'var(--text-secondary)',
                fontWeight: activeTab === key ? 600 : 400,
                cursor: 'pointer', background: 'none', border: 'none',
                borderBottomWidth: '2px', borderBottomStyle: 'solid',
                borderBottomColor: activeTab === key ? 'var(--color-primary-500)' : 'transparent',
              }}
            >
              <Icon size={16} />
              {label}
              <Badge variant="neutral" size="sm">{(archived[key] || []).length}</Badge>
            </button>
          ))}
        </div>
        <CardBody style={{ padding: 0 }}>
          {renderList(currentItems, activeTab)}
        </CardBody>
      </Card>

      <ConfirmDialog
        open={!!restoreTarget}
        title="Restore Record"
        message={`Restore "${restoreTarget?.name}"? This will make it visible again across the app.`}
        confirmLabel="Restore"
        danger={false}
        onConfirm={handleRestore}
        onCancel={() => setRestoreTarget(null)}
      />
    </div>
  );
};

export default AdminArchive;
