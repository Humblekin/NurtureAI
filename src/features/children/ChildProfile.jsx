import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Baby, FileText, Syringe, TrendingUp, Plus, Share2, ExternalLink, Pencil, Trash2 } from 'lucide-react';
import useChildStore from '../../stores/childStore';
import useMotherStore from '../../stores/motherStore';
import useAuthStore from '../../stores/authStore';
import useAppStore from '../../stores/appStore';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import VaccineForm from './VaccineForm';
import GrowthForm from './GrowthForm';

export const ChildProfile = () => {
  const { id } = useParams();
  const { profile } = useAuthStore();
  const { currentMother, fetchMotherByProfileId } = useMotherStore();
  const addToast = useAppStore((state) => state.addToast);
  const { 
    children, 
    fetchVaccinations, 
    fetchGrowthRecords, 
    deleteVaccination,
    deleteGrowthRecord,
    vaccinations, 
    growthRecords 
  } = useChildStore();

  const [isLoading, setIsLoading] = useState(true);
  const [isVaccineModalOpen, setVaccineModalOpen] = useState(false);
  const [editingVax, setEditingVax] = useState(null);
  const [isGrowthModalOpen, setGrowthModalOpen] = useState(false);
  const [editingGrowth, setEditingGrowth] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const child = children.find(c => c.id === id);
  const childVax = vaccinations[id] || [];
  const childGrowth = growthRecords[id] || [];

  // Fetch mother record for ownership check
  useEffect(() => {
    if (profile?.role === 'mother' && profile?.id) {
      fetchMotherByProfileId(profile.id);
    }
  }, [profile?.role, profile?.id, fetchMotherByProfileId]);

  useEffect(() => {
    if (id) {
      Promise.all([
        fetchVaccinations(id),
        fetchGrowthRecords(id)
      ]).finally(() => setIsLoading(false));
    }
  }, [id, fetchVaccinations, fetchGrowthRecords]);

  // Mother ownership guard
  const isMotherUser = profile?.role === 'mother';
  const isChildOwned = !isMotherUser || (child && currentMother && child.mother_id === currentMother.id);

  if (!child || !isChildOwned) {
    return (
      <div className="page-content text-center">
        <h2 className="heading-3">{!child ? 'Child record not found' : 'Access denied'}</h2>
        <Link to={`/${profile?.role === 'mother' ? 'mother' : profile?.role}/children`}>
          <Button variant="secondary" style={{ marginTop: 'var(--space-4)' }}>Back to list</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="page-content fade-in">
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <Link to={`/${profile?.role === 'mother' ? 'mother' : profile?.role}/children`} className="flex items-center gap-2" style={{ color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: 'var(--space-4)', display: 'inline-flex' }}>
          <ArrowLeft size={16} /> Back to list
        </Link>
        <div className="flex-between align-start">
          <div className="flex items-center gap-4">
            <div style={{ 
              width: 64, height: 64, borderRadius: '50%', 
              background: 'var(--color-primary-50)', color: 'var(--color-primary-600)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Baby size={32} />
            </div>
            <div>
              <h1 className="heading-2">{child.full_name}</h1>
              <p className="body-lg" style={{ color: 'var(--text-secondary)' }}>
                {child.gender} • Born {new Date(child.date_of_birth).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link to={`/${profile.role === 'mother' ? 'mother' : profile.role === 'chw' ? 'chw' : 'admin'}/children/${child.id}/edit`}>
              <Button variant="outline" leftIcon={<Pencil size={18} />}>Edit Record</Button>
            </Link>
            <Link to={`/${profile.role === 'mother' ? 'mother' : profile.role === 'chw' ? 'chw' : 'admin'}/referrals/new?patientId=${child.id}&patientType=child&motherId=${child.mother_id || ''}`}>
              <Button variant="outline" leftIcon={<Share2 size={18} />}>Refer</Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-3" style={{ gap: 'var(--space-6)' }}>
        <div className="flex-col gap-6" style={{ gridColumn: 'span 1' }}>
          <Card>
            <CardHeader title="Birth Details" />
            <CardBody className="flex-col gap-3">
              <div className="flex-between">
                <span className="text-secondary body-sm">Birth Weight</span>
                <span className="font-medium">{child.birth_weight ? `${child.birth_weight} kg` : 'N/A'}</span>
              </div>
              <div className="flex-between">
                <span className="text-secondary body-sm">Place of Birth</span>
                <span className="font-medium">{child.birth_facility || 'N/A'}</span>
              </div>
              <div className="flex-between">
                <span className="text-secondary body-sm">Mother ID</span>
                {child.mother_id ? (
                  <Link to={`/mothers/${child.mother_id}`} className="flex items-center gap-1" style={{ color: 'var(--color-primary-600)', textDecoration: 'none', fontWeight: 500 }}>
                    View Mother <ExternalLink size={12} />
                  </Link>
                ) : (
                  <span className="font-medium">Not linked</span>
                )}
              </div>
              {child.notes && (
                <div style={{ marginTop: 'var(--space-2)', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--border-default)' }}>
                  <p className="text-secondary body-sm mb-1">Notes</p>
                  <p className="body-sm">{child.notes}</p>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="flex-col gap-6" style={{ gridColumn: 'span 2' }}>
          <Card>
            <div className="flex-between" style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--border-default)' }}>
              <div className="flex items-center gap-2">
                <Syringe size={20} style={{ color: 'var(--color-primary-500)' }} />
                <h3 className="heading-5" style={{ margin: 0 }}>Vaccinations</h3>
              </div>
              <Button size="sm" variant="outline" leftIcon={<Plus size={16} />} onClick={() => setVaccineModalOpen(true)}>
                Log Vaccine
              </Button>
            </div>
            <CardBody style={{ padding: 0 }}>
              {isLoading ? (
                <div className="p-6 flex-center"><Spinner size={24} /></div>
              ) : childVax.length > 0 ? (
                <div className="flex-col">
                  {childVax.map((vax) => (
                    <div key={vax.id} className="flex-between p-4" style={{ borderBottom: '1px solid var(--border-default)' }}>
                      <div>
                        <p className="font-medium">{vax.vaccine_name}</p>
                        <p className="caption text-secondary">Given: {new Date(vax.date_given).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="success" solid>Administered</Badge>
                        <button className="icon-btn-sm" onClick={() => { setEditingVax(vax); setVaccineModalOpen(true); }} title="Edit"><Pencil size={14} /></button>
                        <button className="icon-btn-sm danger" onClick={() => setDeleteTarget({ type: 'vax', id: vax.id, childId: id, name: vax.vaccine_name })} title="Delete"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center">
                  <p className="body-sm text-secondary">No vaccinations recorded yet.</p>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <div className="flex-between" style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--border-default)' }}>
              <div className="flex items-center gap-2">
                <TrendingUp size={20} style={{ color: 'var(--color-info-500)' }} />
                <h3 className="heading-5" style={{ margin: 0 }}>Growth Monitoring</h3>
              </div>
              <Button size="sm" variant="outline" leftIcon={<Plus size={16} />} onClick={() => setGrowthModalOpen(true)}>
                Log Measurement
              </Button>
            </div>
            <CardBody style={{ padding: 0 }}>
              {isLoading ? (
                <div className="p-6 flex-center"><Spinner size={24} /></div>
              ) : childGrowth.length > 0 ? (
                <div className="flex-col">
                  {childGrowth.map((record) => (
                    <div key={record.id} className="flex-between p-4" style={{ borderBottom: '1px solid var(--border-default)' }}>
                      <div>
                        <p className="font-medium">{record.weight || record.weight_kg} kg • {record.height || record.height_cm} cm</p>
                        <p className="caption text-secondary">Date: {new Date(record.recorded_date).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="icon-btn-sm" onClick={() => { setEditingGrowth(record); setGrowthModalOpen(true); }} title="Edit"><Pencil size={14} /></button>
                        <button className="icon-btn-sm danger" onClick={() => setDeleteTarget({ type: 'growth', id: record.id, childId: id, name: `Growth (${new Date(record.recorded_date).toLocaleDateString()})` })} title="Delete"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center">
                  <p className="body-sm text-secondary">No growth records logged yet.</p>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <Modal 
        isOpen={isVaccineModalOpen} 
        onClose={() => { setVaccineModalOpen(false); setEditingVax(null); }}
        title={editingVax ? 'Edit Vaccination' : 'Log Vaccination'}
      >
        <VaccineForm 
          childId={id}
          initialData={editingVax}
          onSuccess={() => {
            setVaccineModalOpen(false);
            setEditingVax(null);
            fetchVaccinations(id);
          }}
          onCancel={() => { setVaccineModalOpen(false); setEditingVax(null); }}
        />
      </Modal>

      <Modal 
        isOpen={isGrowthModalOpen} 
        onClose={() => { setGrowthModalOpen(false); setEditingGrowth(null); }}
        title={editingGrowth ? 'Edit Growth Measurement' : 'Log Growth Measurement'}
      >
        <GrowthForm 
          childId={id}
          initialData={editingGrowth}
          onSuccess={() => {
            setGrowthModalOpen(false);
            setEditingGrowth(null);
            fetchGrowthRecords(id);
          }}
          onCancel={() => { setGrowthModalOpen(false); setEditingGrowth(null); }}
        />
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete ${deleteTarget?.type === 'vax' ? 'Vaccination' : 'Growth Record'}`}
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        onConfirm={async () => {
          if (deleteTarget.type === 'vax') {
            await deleteVaccination(deleteTarget.id, deleteTarget.childId);
          } else if (deleteTarget.type === 'growth') {
            await deleteGrowthRecord(deleteTarget.id, deleteTarget.childId);
          }
          addToast({ type: 'success', message: 'Record deleted.' });
          setDeleteTarget(null);
          fetchVaccinations(id);
          fetchGrowthRecords(id);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default ChildProfile;
