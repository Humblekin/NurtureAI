import { useState } from 'react';
import { User, Shield, Palette, Globe } from 'lucide-react';
import useAuthStore from '../../stores/authStore';
import useAppStore from '../../stores/appStore';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import supabase, { isSupabaseConfigured } from '../../lib/supabase';

export const SettingsPage = () => {
  const { profile, signOut, user } = useAuthStore();
  const { theme, toggleTheme } = useAppStore();
  const [notifications, setNotifications] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const isAdmin = profile?.role === 'admin';

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      if (!isSupabaseConfigured()) {
        setIsExporting(false);
        return;
      }
      const tables = ['mothers', 'pregnancies', 'antenatal_visits', 'children', 'vaccinations', 'growth_records', 'visits', 'referrals'];
      const exportData = {};

      for (const table of tables) {
        const { data } = await supabase.from(table).select('*');
        exportData[table] = data || [];
      }

      exportData.metadata = {
        exportedAt: new Date().toISOString(),
        exportedBy: profile?.full_name || 'Unknown',
        totalRecords: Object.values(exportData).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0),
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nurtureai-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
    setIsExporting(false);
  };

  const handleChangePassword = async () => {
    if (!user?.email) return;
    try {
      const { error } = await import('../../lib/supabase').then(m => m.default.auth.resetPasswordForEmail(user.email));
      if (error) throw error;
      alert('Password reset email sent. Please check your inbox.');
    } catch (err) {
      alert('Failed to send password reset email. Please try again.');
    }
  };

  return (
    <div className="page-content fade-in">
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h1 className="heading-2">Settings</h1>
        <p className="body-md" style={{ color: 'var(--text-secondary)' }}>
          Manage your account and preferences.
        </p>
      </div>

      <div className="grid grid-2" style={{ gap: 'var(--space-6)' }}>
        <Card>
          <CardHeader title="Profile" icon={<User size={18} />} />
          <CardBody className="flex-col gap-4">
            <div>
              <p className="body-sm" style={{ color: 'var(--text-secondary)' }}>Name</p>
              <p className="font-medium">{profile?.full_name || 'Not set'}</p>
            </div>
            <div>
              <p className="body-sm" style={{ color: 'var(--text-secondary)' }}>Email</p>
              <p className="font-medium">{profile?.email || 'Not set'}</p>
            </div>
            <div>
              <p className="body-sm" style={{ color: 'var(--text-secondary)' }}>Role</p>
              <p className="font-medium" style={{ textTransform: 'capitalize' }}>{profile?.role || 'Not set'}</p>
            </div>
            <div>
              <p className="body-sm" style={{ color: 'var(--text-secondary)' }}>Phone</p>
              <p className="font-medium">{profile?.phone || 'Not set'}</p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Preferences" icon={<Palette size={18} />} />
          <CardBody className="flex-col gap-4">
            <div className="flex-between">
              <div>
                <p className="font-medium">Dark Mode</p>
                <p className="body-sm" style={{ color: 'var(--text-secondary)' }}>Toggle dark/light theme</p>
              </div>
              <Button size="sm" variant="outline" onClick={toggleTheme}>
                {theme === 'dark' ? 'Light' : 'Dark'}
              </Button>
            </div>
            <div className="flex-between">
              <div>
                <p className="font-medium">Notifications</p>
                <p className="body-sm" style={{ color: 'var(--text-secondary)' }}>Receive health reminders</p>
              </div>
              <Button 
                size="sm" 
                variant={notifications ? 'primary' : 'outline'} 
                onClick={() => setNotifications(!notifications)}
              >
                {notifications ? 'On' : 'Off'}
              </Button>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Data & Sync" icon={<Globe size={18} />} />
          <CardBody className="flex-col gap-4">
            <div>
              <p className="body-sm" style={{ color: 'var(--text-secondary)' }}>
                Your data is saved directly to the secure cloud database.
              </p>
            </div>
            <div className="flex gap-3">
              {isAdmin ? (
                <Button variant="outline" size="sm" onClick={handleExportData} disabled={isExporting}>
                  {isExporting ? 'Exporting...' : 'Export Data'}
                </Button>
              ) : (
                <p className="body-sm" style={{ color: 'var(--text-secondary)' }}>
                  Only administrators can export the full dataset.
                </p>
              )}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Security" icon={<Shield size={18} />} />
          <CardBody className="flex-col gap-4">
            <Button variant="outline" fullWidth onClick={handleChangePassword}>Change Password</Button>
            <Button variant="danger" fullWidth onClick={signOut}>Sign Out</Button>
          </CardBody>
        </Card>
      </div>
    </div>
  );
};

export default SettingsPage;
