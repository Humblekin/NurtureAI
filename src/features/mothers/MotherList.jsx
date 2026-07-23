import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, Filter, AlertTriangle } from 'lucide-react';
import useMotherStore from '../../stores/motherStore';
import { Card, CardBody } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';

export const MotherList = () => {
  const { mothers, fetchMothers, isLoading } = useMotherStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all'); // all, high-risk

  useEffect(() => {
    fetchMothers();
  }, [fetchMothers]);

  const filteredMothers = mothers.filter(mother => {
    const matchesSearch = mother.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          mother.phone?.includes(searchTerm);
    const matchesFilter = filter === 'all' || (filter === 'high-risk' && mother.risk_level === 'high');
    
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="page-content fade-in">
      <div className="flex-between" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 className="heading-2">Registered Mothers</h1>
          <p className="body-md" style={{ color: 'var(--text-secondary)' }}>
            Manage and monitor expecting mothers in your community.
          </p>
        </div>
        <Link to="/mothers/new">
          <Button leftIcon={<Plus size={18} />}>Register Mother</Button>
        </Link>
      </div>

      <Card style={{ marginBottom: 'var(--space-6)' }}>
        <CardBody className="flex gap-4 items-end">
          <div style={{ flex: 1 }}>
            <Input
              placeholder="Search by name or phone..."
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
              <option value="all">All Mothers</option>
              <option value="high-risk">High Risk Only</option>
            </select>
          </div>
        </CardBody>
      </Card>

      {isLoading ? (
        <div className="flex-center" style={{ padding: 'var(--space-12)' }}>
          <Spinner size={32} />
        </div>
      ) : filteredMothers.length > 0 ? (
        <div className="grid grid-3">
          {filteredMothers.map((mother) => (
            <Link to={`/mothers/${mother.profile_id}`} key={mother.id} style={{ textDecoration: 'none' }}>
              <Card hoverable className="h-full">
                <CardBody className="flex-col h-full gap-3">
                  <div className="flex-between align-start">
                    <div>
                      <h3 className="heading-5" style={{ color: 'var(--text-primary)' }}>{mother.full_name}</h3>
                      <p className="body-sm" style={{ color: 'var(--text-secondary)' }}>{mother.community || 'Unknown Community'}</p>
                    </div>
                    {mother.risk_level === 'high' && (
                      <Badge variant="critical" solid title="High Risk Pregnancy">
                        <AlertTriangle size={12} style={{ marginRight: '4px' }} />
                        High Risk
                      </Badge>
                    )}
                  </div>
                  
                  <div style={{ marginTop: 'auto', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--border-default)' }}>
                    <p className="body-sm flex-between">
                      <span style={{ color: 'var(--text-tertiary)' }}>EDD:</span>
                      <span className="font-medium">{mother.edd ? new Date(mother.edd).toLocaleDateString() : 'Unknown'}</span>
                    </p>
                  </div>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState 
          title="No mothers found" 
          description={searchTerm ? "Try adjusting your search filters." : "You haven't registered any mothers yet."}
          action={!searchTerm && (
            <Link to="/mothers/new">
              <Button variant="outline">Register First Mother</Button>
            </Link>
          )}
        />
      )}
    </div>
  );
};

export default MotherList;
