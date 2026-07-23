import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, Baby, Calendar } from 'lucide-react';
import useChildStore from '../../stores/childStore';
import { Card, CardBody } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';

export const ChildList = () => {
  const { children, isLoading, error } = useChildStore();
  const [searchTerm, setSearchTerm] = useState('');

  // Ideally, this should fetch all children, not just by mother ID, but our store currently fetches by motherId.
  // For a CHW view, we would add a `fetchAllChildren` method to the store. 
  // For the sake of this component, let's assume `children` state is populated correctly.

  const filteredChildren = children.filter(child => {
    return child.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="page-content fade-in">
      <div className="flex-between" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 className="heading-2">Children Register</h1>
          <p className="body-md" style={{ color: 'var(--text-secondary)' }}>
            Monitor growth and vaccination schedules.
          </p>
        </div>
        <Link to="/children/new">
          <Button leftIcon={<Plus size={18} />}>Register Child</Button>
        </Link>
      </div>

      <Card style={{ marginBottom: 'var(--space-6)' }}>
        <CardBody className="flex gap-4 items-end">
          <div style={{ flex: 1 }}>
            <Input
              placeholder="Search by child's name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search size={18} />}
              style={{ marginBottom: 0 }}
            />
          </div>
        </CardBody>
      </Card>

      {isLoading ? (
        <div className="flex-center" style={{ padding: 'var(--space-12)' }}>
          <Spinner size={32} />
        </div>
      ) : filteredChildren.length > 0 ? (
        <div className="grid grid-4">
          {filteredChildren.map((child) => (
            <Link to={`/children/${child.id}`} key={child.id} style={{ textDecoration: 'none' }}>
              <Card hoverable className="h-full flex-col">
                <CardBody className="flex-col h-full items-center text-center gap-3">
                  <div style={{ 
                    width: 56, height: 56, borderRadius: '50%', 
                    background: 'var(--color-primary-50)', color: 'var(--color-primary-600)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <Baby size={32} />
                  </div>
                  <div>
                    <h3 className="heading-5" style={{ color: 'var(--text-primary)' }}>{child.full_name}</h3>
                    <p className="caption" style={{ color: 'var(--text-secondary)' }}>
                      {child.gender} • Born: {new Date(child.date_of_birth).toLocaleDateString()}
                    </p>
                  </div>
                  <div style={{ marginTop: 'auto', paddingTop: 'var(--space-3)', width: '100%' }}>
                    <Button variant="outline" size="sm" fullWidth>View Health Record</Button>
                  </div>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState 
          title="No children found" 
          description={searchTerm ? "Try adjusting your search." : "No children registered yet."}
          action={!searchTerm && (
            <Link to="/children/new">
              <Button variant="outline">Register First Child</Button>
            </Link>
          )}
        />
      )}
    </div>
  );
};

export default ChildList;
