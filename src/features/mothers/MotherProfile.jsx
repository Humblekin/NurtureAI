import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  User, Phone, MapPin, Calendar, HeartPulse, 
  ArrowLeft, AlertTriangle, Baby, Activity, FileText, Plus, Share2, Pencil, Trash2
} from 'lucide-react';
import useMotherStore from '../../stores/motherStore';
import usePregnancyStore from '../../stores/pregnancyStore';
import useChildStore from '../../stores/childStore';
import useAuthStore from '../../stores/authStore';
import useAppStore from '../../stores/appStore';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import PregnancyForm from '../pregnancies/PregnancyForm';
import AntenatalVisitForm from '../pregnancies/AntenatalVisitForm';

export const MotherProfile = () => {
  const { id } = useParams();
  const { profile } = useAuthStore();
  const { fetchMotherByProfileId, currentMother, softDelete: deleteMother, isLoading: isMotherLoading } = useMotherStore();
  const { fetchPregnanciesByMotherId, pregnancyHistory, activePregnancy, antenatalVisits, softDelete: deletePregnancy, deleteAntenatalVisit, isLoading: isPregnancyLoading } = usePregnancyStore();
  const { fetchChildrenByMotherId, children, isLoading: isChildrenLoading } = useChildStore();
  const addToast = useAppStore((state) => state.addToast);

  const [isPregnancyModalOpen, setPregnancyModalOpen] = useState(false);
  const [editingPregnancy, setEditingPregnancy] = useState(null);
  const [isANCModalOpen, setANCModalOpen] = useState(false);
  const [editingANC, setEditingANC] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    if (id) {
      fetchMotherByProfileId(id).then((mother) => {
        if (mother) {
          fetchPregnanciesByMotherId(mother.id);
          fetchChildrenByMotherId(mother.id);
        }
      });
    }
  }, [id, fetchMotherByProfileId, fetchPregnanciesByMotherId, fetchChildrenByMotherId]);

  if (isMotherLoading) {
    return (
      <div className="flex-center" style={{ padding: 'var(--space-12)' }}>
        <Spinner size={32} />
      </div>
    );
  }

  if (!currentMother) {
    return (
      <div className="page-content text-center">
        <h2 className="heading-3">Mother not found</h2>
        <Link to={`/${profile?.role === 'mother' ? 'mother' : profile?.role}/mothers`}>
          <Button variant="secondary" style={{ marginTop: 'var(--space-4)' }}>Back to list</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="page-content fade-in">
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <Link to={`/${profile?.role === 'mother' ? 'mother' : profile?.role}/mothers`} className="flex items-center gap-2" style={{ color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: 'var(--space-4)', display: 'inline-flex' }}>
          <ArrowLeft size={16} /> Back to list
        </Link>
        <div className="flex-between align-start">
          <div>
            <h1 className="heading-2">{currentMother.full_name}</h1>
            <p className="body-lg" style={{ color: 'var(--text-secondary)' }}>
              {currentMother.community || 'Unknown Community'}
            </p>
          </div>
          <div className="flex gap-2">
            <Link to={`/mothers/${currentMother.id}/edit`}>
              <Button variant="outline" leftIcon={<FileText size={18} />}>Edit Profile</Button>
            </Link>
            <Link to={`/referrals/new?patientId=${currentMother.id}&patientType=mother`}>
              <Button variant="outline" leftIcon={<Share2 size={18} />}>Refer</Button>
            </Link>
            {activePregnancy && (
              <Button leftIcon={<Activity size={18} />} onClick={() => setANCModalOpen(true)}>
                Log ANC Visit
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 'var(--space-6)' }}>
        {/* Main Profile Info */}
        <Card style={{ gridColumn: 'span 2' }}>
          <CardHeader title="Personal Information" />
          <CardBody className="grid grid-2" style={{ gap: 'var(--space-4)' }}>
            <div className="flex items-center gap-3">
              <div style={{ color: 'var(--color-primary-500)' }}><Phone size={20} /></div>
              <div>
                <p className="caption text-secondary">Phone</p>
                <p className="font-medium">{currentMother.phone}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div style={{ color: 'var(--color-primary-500)' }}><Calendar size={20} /></div>
              <div>
                <p className="caption text-secondary">Date of Birth</p>
                <p className="font-medium">{currentMother.date_of_birth || 'Not provided'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div style={{ color: 'var(--color-primary-500)' }}><MapPin size={20} /></div>
              <div>
                <p className="caption text-secondary">Address</p>
                <p className="font-medium">{currentMother.community || 'Not provided'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div style={{ color: 'var(--color-primary-500)' }}><HeartPulse size={20} /></div>
              <div>
                <p className="caption text-secondary">Blood Group</p>
                <p className="font-medium">{currentMother.blood_group || 'Unknown'}</p>
              </div>
            </div>
            <div style={{ gridColumn: 'span 2', marginTop: 'var(--space-2)' }}>
              <p className="caption text-secondary" style={{ marginBottom: 'var(--space-1)' }}>Medical History / Notes</p>
              <div className="body-sm p-3" style={{ background: 'var(--surface-sunken)', borderRadius: 'var(--radius-md)' }}>
                {currentMother.medical_history || 'No significant medical history recorded.'}
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Current Status */}
        <Card>
          <CardHeader title="Current Status" />
          <CardBody className="flex-col gap-4">
            <div>
              <p className="caption text-secondary" style={{ marginBottom: 'var(--space-1)' }}>Risk Assessment</p>
              {currentMother.risk_level === 'high' ? (
                <Badge variant="critical" solid size="lg" className="w-full justify-center">
                  <AlertTriangle size={16} style={{ marginRight: '8px' }} />
                  HIGH RISK
                </Badge>
              ) : currentMother.risk_level === 'medium' ? (
                <Badge variant="warning" solid size="lg" className="w-full justify-center">MEDIUM RISK</Badge>
              ) : (
                <Badge variant="success" solid size="lg" className="w-full justify-center">LOW RISK</Badge>
              )}
            </div>

            <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: 'var(--space-4)' }}>
              <p className="caption text-secondary" style={{ marginBottom: 'var(--space-1)' }}>Estimated Delivery</p>
              <p className="heading-4 text-primary">
                {activePregnancy?.edd ? new Date(activePregnancy.edd).toLocaleDateString(undefined, { dateStyle: 'long' }) : 
                 currentMother.edd ? new Date(currentMother.edd).toLocaleDateString(undefined, { dateStyle: 'long' }) : 'Not set'}
              </p>
            </div>

            <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: 'var(--space-4)' }}>
              <p className="caption text-secondary" style={{ marginBottom: 'var(--space-1)' }}>Last ANC Visit</p>
              <p className="font-medium">
                {antenatalVisits?.length > 0 ? new Date(antenatalVisits[0].visit_date).toLocaleDateString() : 'No visits logged yet'}
              </p>
            </div>
            
            {antenatalVisits?.length > 0 && (
              <div style={{ marginTop: 'var(--space-2)' }}>
                <p className="caption text-secondary" style={{ marginBottom: 'var(--space-2)' }}>Recent Visits</p>
                <div className="flex-col gap-2">
                  {antenatalVisits.slice(0, 3).map(visit => (
                    <div key={visit.id} className="flex-between p-2" style={{ background: 'var(--surface-sunken)', borderRadius: 'var(--radius-sm)' }}>
                      <span className="body-sm font-medium">{new Date(visit.visit_date).toLocaleDateString()}</span>
                      <div className="flex items-center gap-1">
                        <span className="caption text-secondary">{visit.gestational_age ? `Wk ${visit.gestational_age}` : '—'}</span>
                        <button className="icon-btn-xs" onClick={() => { setEditingANC(visit); setANCModalOpen(true); }} title="Edit"><Pencil size={12} /></button>
                        <button className="icon-btn-xs danger" onClick={() => setDeleteTarget({ type: 'anc', id: visit.id, name: `ANC Visit (${new Date(visit.visit_date).toLocaleDateString()})` })} title="Delete"><Trash2 size={12} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-2" style={{ gap: 'var(--space-6)' }}>
        {/* Pregnancies */}
        <Card>
          <div className="flex-between" style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--border-default)' }}>
            <h3 className="heading-5" style={{ margin: 0 }}>Pregnancy History</h3>
            {!activePregnancy && (
              <Button size="sm" variant="outline" leftIcon={<Plus size={16} />} onClick={() => setPregnancyModalOpen(true)}>
                Record
              </Button>
            )}
          </div>
          <CardBody style={{ padding: 0 }}>
            {isPregnancyLoading ? (
              <div className="p-6 flex-center"><Spinner size={24} /></div>
            ) : pregnancyHistory.length > 0 ? (
              <div className="flex-col">
                {pregnancyHistory.map((preg) => (
                  <div key={preg.id} className="flex-between p-4" style={{ borderBottom: '1px solid var(--border-default)' }}>
                    <div>
                      <p className="font-medium">Pregnancy ({new Date(preg.created_at).getFullYear()})</p>
                      <p className="caption text-secondary">EDD: {preg.edd ? new Date(preg.edd).toLocaleDateString() : 'Unknown'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={preg.status === 'active' ? 'primary' : 'neutral'}>
                        {preg.status === 'active' ? 'Current' : 'Completed'}
                      </Badge>
                      <button className="icon-btn-sm" onClick={() => { setEditingPregnancy(preg); setPregnancyModalOpen(true); }} title="Edit"><Pencil size={14} /></button>
                      <button className="icon-btn-sm danger" onClick={() => setDeleteTarget({ type: 'pregnancy', id: preg.id, name: `Pregnancy (${new Date(preg.created_at).getFullYear()})` })} title="Delete"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center">
                <p className="body-sm text-secondary">No pregnancy records found.</p>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Children */}
        <Card>
          <div className="flex-between" style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--border-default)' }}>
            <h3 className="heading-5" style={{ margin: 0 }}>Children</h3>
            <Link to="/children/new">
              <Button size="sm" variant="outline" leftIcon={<Plus size={16} />}>Add Child</Button>
            </Link>
          </div>
          <CardBody style={{ padding: 0 }}>
            {isChildrenLoading ? (
              <div className="p-6 flex-center"><Spinner size={24} /></div>
            ) : children.length > 0 ? (
              <div className="flex-col">
                {children.map((child) => (
                  <div key={child.id} className="flex-between p-4" style={{ borderBottom: '1px solid var(--border-default)' }}>
                    <div className="flex items-center gap-3">
                      <div className="flex-center" style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-accent-100)', color: 'var(--color-accent-700)' }}>
                        <Baby size={20} />
                      </div>
                      <div>
                        <p className="font-medium">{child.full_name}</p>
                        <p className="caption text-secondary">
                          {child.gender} • {child.date_of_birth ? new Date(child.date_of_birth).toLocaleDateString() : 'DOB Unknown'}
                        </p>
                      </div>
                    </div>
                    <Link to={`/children/${child.id}`}>
                      <Button size="sm" variant="ghost">View</Button>
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center">
                <p className="body-sm text-secondary">No children registered yet.</p>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
      <Modal 
        isOpen={isPregnancyModalOpen} 
        onClose={() => { setPregnancyModalOpen(false); setEditingPregnancy(null); }}
        title={editingPregnancy ? 'Edit Pregnancy' : 'Record New Pregnancy'}
      >
        <PregnancyForm 
          motherId={currentMother.id}
          initialData={editingPregnancy}
          onSuccess={() => {
            setPregnancyModalOpen(false);
            setEditingPregnancy(null);
            fetchPregnanciesByMotherId(currentMother.id);
          }}
          onCancel={() => { setPregnancyModalOpen(false); setEditingPregnancy(null); }}
        />
      </Modal>

      <Modal 
        isOpen={isANCModalOpen} 
        onClose={() => { setANCModalOpen(false); setEditingANC(null); }}
        title={editingANC ? 'Edit ANC Visit' : 'Log Antenatal Visit'}
      >
        <AntenatalVisitForm 
          pregnancyId={activePregnancy?.id}
          initialData={editingANC}
          onSuccess={() => {
            setANCModalOpen(false);
            setEditingANC(null);
            fetchPregnanciesByMotherId(currentMother.id);
          }}
          onCancel={() => { setANCModalOpen(false); setEditingANC(null); }}
        />
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete ${deleteTarget?.type === 'pregnancy' ? 'Pregnancy' : 'ANC Visit'}`}
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        onConfirm={async () => {
          if (deleteTarget.type === 'pregnancy') {
            await deletePregnancy(deleteTarget.id);
          } else if (deleteTarget.type === 'anc') {
            await deleteAntenatalVisit(deleteTarget.id);
          }
          addToast({ type: 'success', message: 'Record deleted.' });
          setDeleteTarget(null);
          fetchPregnanciesByMotherId(currentMother.id);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default MotherProfile;
