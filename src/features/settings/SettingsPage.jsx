import { useState } from 'react';
import { User, Shield, Palette, Globe } from 'lucide-react';
import useAuthStore from '../../stores/authStore';
import useAppStore from '../../stores/appStore';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import Button from '../../components/ui/Button';

export const SettingsPage = () => {
  const { profile, signOut } = useAuthStore();
  const { theme, toggleTheme } = useAppStore();
  const [notifications, setNotifications] = useState(true);

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
                Your data is stored locally and syncs when online.
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" size="sm">Force Sync</Button>
              <Button variant="outline" size="sm">Export Data</Button>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Security" icon={<Shield size={18} />} />
          <CardBody className="flex-col gap-4">
            <Button variant="outline" fullWidth>Change Password</Button>
            <Button variant="danger" fullWidth onClick={signOut}>Sign Out</Button>
          </CardBody>
        </Card>
      </div>
    </div>
  );
};

export default SettingsPage;
