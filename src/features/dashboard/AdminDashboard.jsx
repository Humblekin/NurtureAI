import { useState, useEffect } from 'react';
import { Activity, Users, MapPin, Database } from 'lucide-react';
import { Card, CardBody } from '../../components/ui/Card';
import db from '../../lib/db';

export const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeFacilities: 0,
    aiInteractions: 0,
    syncHealth: 0,
  });

  useEffect(() => {
    async function fetchStats() {
      try {
        const [users, facilities, conversations, syncQueue] = await Promise.all([
          db.profiles.count(),
          db.facilities.count(),
          db.ai_conversations.count(),
          db.sync_queue.count(),
        ]);

        const totalRecords = await Promise.all([
          db.mothers.count(),
          db.pregnancies.count(),
          db.children.count(),
          db.visits.count(),
          db.referrals.count(),
        ]);

        const totalDataRecords = totalRecords.reduce((sum, c) => sum + c, 0);

        const syncHealth = totalDataRecords > 0
          ? Math.max(0, 100 - (syncQueue / totalDataRecords * 100))
          : 100;

        setStats({
          totalUsers: users,
          activeFacilities: facilities,
          aiInteractions: conversations,
          syncHealth: Math.min(100, Math.round(syncHealth * 10) / 10),
        });
      } catch (err) {
        console.error('Failed to fetch admin stats:', err);
      }
    }

    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

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
            <h2 className="heading-2" style={{ marginTop: 'var(--space-2)' }}>{stats.totalUsers}</h2>
          </CardBody>
        </Card>
        
        <Card>
          <CardBody>
            <div className="flex-between">
              <span className="body-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Active Facilities</span>
              <MapPin size={16} style={{ color: 'var(--color-info-500)' }} />
            </div>
            <h2 className="heading-2" style={{ marginTop: 'var(--space-2)' }}>{stats.activeFacilities}</h2>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex-between">
              <span className="body-sm font-medium" style={{ color: 'var(--text-secondary)' }}>AI Interactions</span>
              <Activity size={16} style={{ color: 'var(--color-accent-500)' }} />
            </div>
            <h2 className="heading-2" style={{ marginTop: 'var(--space-2)' }}>{stats.aiInteractions}</h2>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex-between">
              <span className="body-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Sync Health</span>
              <Database size={16} style={{ color: stats.syncHealth > 90 ? 'var(--color-success-500)' : stats.syncHealth > 50 ? 'var(--color-warning-500)' : 'var(--color-danger-500)' }} />
            </div>
            <h2 className="heading-2" style={{ marginTop: 'var(--space-2)' }}>{stats.syncHealth}%</h2>
          </CardBody>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
