import { useState, useEffect } from 'react';
import { MapPin, Search, Plus, Building2, Phone, Map } from 'lucide-react';
import supabase, { isSupabaseConfigured } from '../../lib/supabase';
import { Card, CardBody } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import Modal from '../../components/ui/Modal';
import db from '../../lib/db';

export const AdminFacilities = () => {
  const [facilities, setFacilities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newFacility, setNewFacility] = useState({ name: '', type: 'clinic', phone: '', address: '' });

  useEffect(() => {
    loadFacilities();
  }, []);

  const loadFacilities = async () => {
    setIsLoading(true);
    try {
      if (isSupabaseConfigured()) {
        const { data, error } = await supabase
          .from('facilities')
          .select('*')
          .order('name');
        if (error) throw error;
        setFacilities(data || []);
      } else {
        const local = await db.facilities.toArray();
        setFacilities(local);
      }
    } catch (err) {
      console.error('Failed to load facilities:', err);
      const local = await db.facilities.toArray();
      setFacilities(local);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddFacility = async () => {
    if (!newFacility.name) return;
    try {
      if (isSupabaseConfigured()) {
        const { error } = await supabase.from('facilities').insert({
          name: newFacility.name,
          type: newFacility.type,
          phone: newFacility.phone,
          address: newFacility.address,
        });
        if (error) throw error;
      } else {
        const id = crypto.randomUUID();
        await db.facilities.put({ id, ...newFacility, created_at: new Date().toISOString() });
      }
      setNewFacility({ name: '', type: 'clinic', phone: '', address: '' });
      setShowAddModal(false);
      loadFacilities();
    } catch (err) {
      console.error('Failed to add facility:', err);
    }
  };

  const filteredFacilities = facilities.filter(f => {
    const matchesSearch = f.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          f.address?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === 'all' || f.type === filter;
    return matchesSearch && matchesFilter;
  });

  const typeLabels = {
    hospital: 'Hospital',
    clinic: 'Clinic',
    chps: 'CHPS Compound',
    health_post: 'Health Post',
  };

  const typeColors = {
    hospital: 'critical',
    clinic: 'info',
    chps: 'success',
    health_post: 'warning',
  };

  // Count by type
  const typeCounts = facilities.reduce((acc, f) => {
    acc[f.type] = (acc[f.type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="page-content fade-in">
      <div className="flex-between" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 className="heading-2">Facility Management</h1>
          <p className="body-md" style={{ color: 'var(--text-secondary)' }}>
            Manage health facilities in the system.
          </p>
        </div>
        <Button leftIcon={<Plus size={18} />} onClick={() => setShowAddModal(true)}>
          Add Facility
        </Button>
      </div>

      {/* Type Stats */}
      <div className="grid grid-4" style={{ marginBottom: 'var(--space-6)' }}>
        {Object.entries(typeCounts).map(([type, count]) => (
          <Card key={type}>
            <CardBody>
              <div className="flex-between">
                <span className="body-sm" style={{ color: 'var(--text-secondary)' }}>{typeLabels[type] || type}</span>
                <Building2 size={16} style={{ color: 'var(--color-primary-500)' }} />
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
              placeholder="Search facilities..."
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
              <option value="all">All Types</option>
              <option value="hospital">Hospital</option>
              <option value="clinic">Clinic</option>
              <option value="chps">CHPS</option>
              <option value="health_post">Health Post</option>
            </select>
          </div>
        </CardBody>
      </Card>

      {/* Facility List */}
      {isLoading ? (
        <div className="flex-center" style={{ padding: 'var(--space-12)' }}>
          <Spinner size={32} />
        </div>
      ) : filteredFacilities.length > 0 ? (
        <div className="grid grid-2">
          {filteredFacilities.map((facility) => (
            <Card key={facility.id} hoverable>
              <CardBody className="flex-col gap-3">
                <div className="flex-between">
                  <div className="flex gap-3 items-center">
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: 'var(--radius-lg)',
                      background: 'var(--color-primary-100)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Building2 size={18} style={{ color: 'var(--color-primary-600)' }} />
                    </div>
                    <div>
                      <h3 className="heading-5">{facility.name}</h3>
                      <p className="body-sm" style={{ color: 'var(--text-secondary)' }}>{facility.address || 'No address'}</p>
                    </div>
                  </div>
                  <Badge variant={typeColors[facility.type] || 'neutral'} solid>
                    {typeLabels[facility.type] || facility.type}
                  </Badge>
                </div>
                {facility.phone && (
                  <div className="flex gap-2 items-center" style={{ borderTop: '1px solid var(--border-default)', paddingTop: 'var(--space-3)' }}>
                    <Phone size={12} style={{ color: 'var(--text-tertiary)' }} />
                    <span className="body-sm" style={{ color: 'var(--text-tertiary)' }}>{facility.phone}</span>
                  </div>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No facilities found"
          description={searchTerm ? "Try adjusting your search filters." : "No facilities registered yet."}
          action={!searchTerm && (
            <Button variant="outline" onClick={() => setShowAddModal(true)}>Add First Facility</Button>
          )}
        />
      )}

      {/* Add Facility Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Facility"
      >
        <div className="flex-col gap-4">
          <Input
            label="Facility Name"
            value={newFacility.name}
            onChange={(e) => setNewFacility({ ...newFacility, name: e.target.value })}
            placeholder="e.g. Tamale Central Hospital"
            required
          />
          <div>
            <label className="body-sm font-medium" style={{ display: 'block', marginBottom: 'var(--space-1)' }}>Type</label>
            <select
              className="input-base"
              value={newFacility.type}
              onChange={(e) => setNewFacility({ ...newFacility, type: e.target.value })}
              style={{ width: '100%', height: '44px' }}
            >
              <option value="hospital">Hospital</option>
              <option value="clinic">Clinic</option>
              <option value="chps">CHPS Compound</option>
              <option value="health_post">Health Post</option>
            </select>
          </div>
          <Input
            label="Phone"
            value={newFacility.phone}
            onChange={(e) => setNewFacility({ ...newFacility, phone: e.target.value })}
            placeholder="Phone number"
          />
          <Input
            label="Address"
            value={newFacility.address}
            onChange={(e) => setNewFacility({ ...newFacility, address: e.target.value })}
            placeholder="Physical address"
          />
          <div className="flex gap-3" style={{ marginTop: 'var(--space-4)' }}>
            <Button variant="secondary" fullWidth onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button fullWidth onClick={handleAddFacility}>Add Facility</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminFacilities;
