import { useState, useEffect } from 'react';
import { Users, Search, Filter, UserCheck, Shield, Mail, Phone } from 'lucide-react';
import supabase, { isSupabaseConfigured } from '../../lib/supabase';
import { Card, CardBody } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';

export const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      if (!isSupabaseConfigured()) {
        setIsLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          user.phone?.includes(searchTerm) ||
                          user.community?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === 'all' || user.role === filter;
    return matchesSearch && matchesFilter;
  });

  const roleColors = {
    mother: 'primary',
    chw: 'info',
    nurse: 'success',
    doctor: 'success',
    district_officer: 'warning',
    admin: 'critical',
  };

  const roleLabels = {
    mother: 'Mother',
    chw: 'CHW',
    nurse: 'Nurse',
    doctor: 'Doctor',
    district_officer: 'District Officer',
    admin: 'Admin',
  };

  // Count by role
  const roleCounts = users.reduce((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="page-content fade-in">
      <div className="flex-between" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 className="heading-2">User Management</h1>
          <p className="body-md" style={{ color: 'var(--text-secondary)' }}>
            Manage system users and their roles.
          </p>
        </div>
      </div>

      {/* Role Stats */}
      <div className="grid grid-4" style={{ marginBottom: 'var(--space-6)' }}>
        {Object.entries(roleCounts).map(([role, count]) => (
          <Card key={role}>
            <CardBody>
              <div className="flex-between">
                <span className="body-sm" style={{ color: 'var(--text-secondary)' }}>{roleLabels[role] || role}</span>
                <Shield size={16} style={{ color: 'var(--color-primary-500)' }} />
              </div>
              <h2 className="heading-2" style={{ marginTop: 'var(--space-2)' }}>{count}</h2>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Search + Filter */}
      <Card style={{ marginBottom: 'var(--space-6)' }}>
        <CardBody className="flex gap-4 items-end">
          <div style={{ flex: 1 }}>
            <Input
              placeholder="Search by name, phone, or community..."
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
              <option value="all">All Roles</option>
              <option value="mother">Mothers</option>
              <option value="chw">CHWs</option>
              <option value="nurse">Nurses</option>
              <option value="doctor">Doctors</option>
              <option value="district_officer">District Officers</option>
              <option value="admin">Admins</option>
            </select>
          </div>
        </CardBody>
      </Card>

      {/* User List */}
      {isLoading ? (
        <div className="flex-center" style={{ padding: 'var(--space-12)' }}>
          <Spinner size={32} />
        </div>
      ) : filteredUsers.length > 0 ? (
        <div className="grid grid-2">
          {filteredUsers.map((user) => (
            <Card key={user.id} hoverable>
              <CardBody className="flex-col gap-3">
                <div className="flex-between">
                  <div className="flex gap-3 items-center">
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: 'var(--radius-full)',
                      background: 'var(--color-primary-100)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <UserCheck size={18} style={{ color: 'var(--color-primary-600)' }} />
                    </div>
                    <div>
                      <h3 className="heading-5">{user.full_name || 'Unknown'}</h3>
                      <p className="body-sm" style={{ color: 'var(--text-secondary)' }}>{user.community || 'No community'}</p>
                    </div>
                  </div>
                  <Badge variant={roleColors[user.role] || 'neutral'} solid>
                    {roleLabels[user.role] || user.role}
                  </Badge>
                </div>
                <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: 'var(--space-3)' }}>
                  {user.phone && (
                    <div className="flex gap-2 items-center" style={{ marginBottom: 'var(--space-1)' }}>
                      <Phone size={12} style={{ color: 'var(--text-tertiary)' }} />
                      <span className="body-sm" style={{ color: 'var(--text-tertiary)' }}>{user.phone}</span>
                    </div>
                  )}
                  {user.created_at && (
                    <p className="body-sm" style={{ color: 'var(--text-tertiary)' }}>
                      Joined: {new Date(user.created_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No users found"
          description={searchTerm ? "Try adjusting your search filters." : "No users registered yet."}
        />
      )}
    </div>
  );
};

export default AdminUsers;
