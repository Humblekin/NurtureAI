import { useEffect, useState } from 'react';
import { Activity, Users, MapPin, Database } from 'lucide-react';
import { Card, CardBody } from '../../components/ui/Card';
import supabase, { isSupabaseConfigured } from '../../lib/supabase';

export const AdminDashboard = () => {
  const [totalUsers, setTotalUsers] = useState(0);
  const [activeFacilities, setActiveFacilities] = useState(0);
  const [aiInteractions, setAiInteractions] = useState(0);
  const [totalDataRecords, setTotalDataRecords] = useState(0);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    supabase.from('profiles').select('id').then(({ data }) => setTotalUsers(data?.length || 0)).catch(() => {});
    supabase.from('facilities').select('id').is('deleted_at', null)
      .then(({ data }) => setActiveFacilities(data?.length || 0)).catch(() => {});
    supabase.from('ai_conversations').select('id').then(({ data }) => setAiInteractions(data?.length || 0)).catch(() => {});

    Promise.all([
      supabase.from('mothers').select('id').is('deleted_at', null),
      supabase.from('pregnancies').select('id').is('deleted_at', null),
      supabase.from('children').select('id').is('deleted_at', null),
      supabase.from('visits').select('id').is('deleted_at', null),
      supabase.from('referrals').select('id').is('deleted_at', null),
    ])
      .then((results) => {
        const total = results.reduce((sum, { data }) => sum + (data?.length || 0), 0);
        setTotalDataRecords(total);
      })
      .catch(() => {});
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
              <span className="body-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Total Records</span>
              <Database size={16} style={{ color: 'var(--color-success-500)' }} />
            </div>
            <h2 className="heading-2" style={{ marginTop: 'var(--space-2)' }}>{totalDataRecords}</h2>
          </CardBody>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
