import { useLiveQuery } from 'dexie-react-hooks';
import { Activity, Users, MapPin, Database } from 'lucide-react';
import { Card, CardBody } from '../../components/ui/Card';
import db from '../../lib/db';

export const AdminDashboard = () => {
  const totalUsers = useLiveQuery(() => db.profiles.count()) ?? 0;
  const activeFacilities = useLiveQuery(() => db.facilities.filter(f => !f.deleted_at).count()) ?? 0;
  const aiInteractions = useLiveQuery(() => db.ai_conversations.count()) ?? 0;

  const syncQueueCount = useLiveQuery(() => db.sync_queue.count()) ?? 0;
  const totalDataRecords = useLiveQuery(async () => {
    const counts = await Promise.all([
      db.mothers.filter(m => !m.deleted_at).count(),
      db.pregnancies.filter(p => !p.deleted_at).count(),
      db.children.filter(c => !c.deleted_at).count(),
      db.visits.filter(v => !v.deleted_at).count(),
      db.referrals.filter(r => !r.deleted_at).count(),
    ]);
    return counts.reduce((sum, c) => sum + c, 0);
  }) ?? 0;

  const syncHealth = totalDataRecords > 0
    ? Math.max(0, 100 - (syncQueueCount / totalDataRecords * 100))
    : 100;

  return (
    <div className="page-content fade-in">
      <div className="flex-between" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 className="heading-2">System Administration</h1>
          <p className="body-lg" style={{ color: 'var(--text-secondary)' }}>
            System overview and health metrics.
          </p>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 'var(--space-6)' }}>
        <Card>
          <CardBody>
            <div className="flex-between">
              <span className="body-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Total Users</span>
              <Users size={16} style={{ color: 'var(--color-primary-500)' }} />
            </div>
            <h2 className="heading-2" style={{ marginTop: 'var(--space-2)' }}>{totalUsers}</h2>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex-between">
              <span className="body-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Active Facilities</span>
              <MapPin size={16} style={{ color: 'var(--color-info-500)' }} />
            </div>
            <h2 className="heading-2" style={{ marginTop: 'var(--space-2)' }}>{activeFacilities}</h2>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex-between">
              <span className="body-sm font-medium" style={{ color: 'var(--text-secondary)' }}>AI Interactions</span>
              <Activity size={16} style={{ color: 'var(--color-accent-500)' }} />
            </div>
            <h2 className="heading-2" style={{ marginTop: 'var(--space-2)' }}>{aiInteractions}</h2>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex-between">
              <span className="body-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Sync Health</span>
              <Database size={16} style={{ color: syncHealth > 90 ? 'var(--color-success-500)' : syncHealth > 50 ? 'var(--color-warning-500)' : 'var(--color-danger-500)' }} />
            </div>
            <h2 className="heading-2" style={{ marginTop: 'var(--space-2)' }}>{Math.min(100, Math.round(syncHealth * 10) / 10)}%</h2>
          </CardBody>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
