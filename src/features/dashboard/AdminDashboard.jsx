import { Activity, Users, MapPin, Database } from 'lucide-react';
import { Card, CardBody } from '../../components/ui/Card';

export const AdminDashboard = () => {
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
            <h2 className="heading-2" style={{ marginTop: 'var(--space-2)' }}>1,245</h2>
          </CardBody>
        </Card>
        
        <Card>
          <CardBody>
            <div className="flex-between">
              <span className="body-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Active Facilities</span>
              <MapPin size={16} style={{ color: 'var(--color-info-500)' }} />
            </div>
            <h2 className="heading-2" style={{ marginTop: 'var(--space-2)' }}>12</h2>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex-between">
              <span className="body-sm font-medium" style={{ color: 'var(--text-secondary)' }}>AI Interactions</span>
              <Activity size={16} style={{ color: 'var(--color-accent-500)' }} />
            </div>
            <h2 className="heading-2" style={{ marginTop: 'var(--space-2)' }}>8,432</h2>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex-between">
              <span className="body-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Sync Health</span>
              <Database size={16} style={{ color: 'var(--color-success-500)' }} />
            </div>
            <h2 className="heading-2" style={{ marginTop: 'var(--space-2)' }}>99.9%</h2>
          </CardBody>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
