import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Phone, MapPin, Calendar, HeartPulse, 
  ArrowLeft, AlertTriangle, Baby, Activity, FileText, Plus, Share2, Pencil, Trash2,
  Stethoscope, Syringe, TrendingUp, Scale, Bell, UserCheck
} from 'lucide-react';
import useMotherStore from '../../stores/motherStore';
import usePregnancyStore from '../../stores/pregnancyStore';
import useChildStore from '../../stores/childStore';
import useVisitStore from '../../stores/visitStore';
import useReferralStore from '../../stores/referralStore';
import useAuthStore from '../../stores/authStore';
import useAppStore from '../../stores/appStore';
import supabase, { isSupabaseConfigured } from '../../lib/supabase';
import { calculateWeeksFromLMP, pregnancyStatusLabel, pregnancyStatusVariant } from '../../lib/pregnancy';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import VerificationBadge from '../../components/VerificationBadge';
import PregnancyForm from '../pregnancies/PregnancyForm';
import AntenatalVisitForm from '../pregnancies/AntenatalVisitForm';
import HealthJourneyTimeline from '../timeline/HealthJourneyTimeline';

const REPORT_TYPE_LABELS = {
  note: 'Health Note',
  symptom: 'Symptom',
  measurement: 'Measurement',
  medication: 'Medication',
  emergency: 'Emergency',
};

const STATUS_COLORS = {
  pending: 'warning',
  accepted: 'info',
  completed: 'success',
  rejected: 'critical',
};

export const MotherProfile = () => {
  const { id } = useParams();
  const { profile } = useAuthStore();
  const rolePrefix = profile?.role || 'chw';
  const isWorker = ['chw', 'nurse', 'doctor', 'admin'].includes(profile?.role);
  const { fetchMotherById, fetchMotherByProfileId, currentMother, verifyMother, isLoading: isMotherLoading } = useMotherStore();
  const { fetchPregnanciesByMotherId, pregnancyHistory, activePregnancy, antenatalVisits, softDelete: deletePregnancy, deleteAntenatalVisit, verifyPregnancy, isLoading: isPregnancyLoading } = usePregnancyStore();
  const { fetchChildrenByMotherId, children, vaccinations, growthRecords, verifyChild, isLoading: isChildrenLoading } = useChildStore();
  const { visits, fetchVisitsByPatient, softDelete: deleteVisit, isLoading: isVisitsLoading } = useVisitStore();
  const { referrals, fetchReferralsByPatient, updateReferralStatus, softDelete: deleteReferral, isLoading: isReferralsLoading } = useReferralStore();
  // RLS only allows nurse/doctor/admin to update referrals.
  const canUpdateReferralStatus = ['nurse', 'doctor', 'admin'].includes(profile?.role);
  const addToast = useAppStore((state) => state.addToast);
  const setCurrentPatient = useAppStore((state) => state.setCurrentPatient);

  const [motherReports, setMotherReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [isPregnancyModalOpen, setPregnancyModalOpen] = useState(false);
  const [editingPregnancy, setEditingPregnancy] = useState(null);
  const [isANCModalOpen, setANCModalOpen] = useState(false);
  const [editingANC, setEditingANC] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [verifyTarget, setVerifyTarget] = useState(null);
  const [verifierName, setVerifierName] = useState(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      let mother = await fetchMotherById(id);
      // Support legacy links that carried the profile_id instead of the record id.
      if (!mother) mother = await fetchMotherByProfileId(id);
      if (mother) {
        // Track the currently open patient so worker-facing Amina stays
        // scoped to this record (privacy by construction).
        setCurrentPatient({ id: mother.id, type: 'mother', name: mother.full_name, patientCode: mother.patient_code });
        fetchPregnanciesByMotherId(mother.id);
        fetchChildrenByMotherId(mother.id);
        fetchVisitsByPatient(mother.id);
        fetchReferralsByPatient(mother.id, 'mother');
        loadMotherReports(mother.id);
        if (mother.verified && mother.verified_by) {
          resolveVerifier(mother.verified_by);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const resolveVerifier = async (workerId) => {
    if (!workerId || !isSupabaseConfigured()) return;
    try {
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', workerId)
        .maybeSingle();
      if (data?.full_name) setVerifierName(data.full_name);
    } catch (error) {
      console.error('Failed to resolve verifier name:', error);
    }
  };

  const runVerify = async () => {
    if (!verifyTarget || verifying) return;
    setVerifying(true);
    let result;
    if (verifyTarget.type === 'mother') {
      result = await verifyMother(verifyTarget.id, profile?.id);
      if (result?.success && profile?.id) resolveVerifier(profile.id);
    } else if (verifyTarget.type === 'pregnancy') {
      result = await verifyPregnancy(verifyTarget.id, profile?.id);
    } else if (verifyTarget.type === 'child') {
      result = await verifyChild(verifyTarget.id, profile?.id);
    }
    setVerifying(false);
    if (result?.success) {
      addToast({ type: 'success', message: `${verifyTarget.name} marked as verified.` });
    } else {
      addToast({ type: 'error', title: 'Verification failed', message: result?.error || 'Unable to verify record.' });
    }
    setVerifyTarget(null);
  };

  const loadMotherReports = async (motherId) => {
    if (!isSupabaseConfigured()) return;
    setReportsLoading(true);
    try {
      const { data, error } = await supabase
        .from('mother_reports')
        .select('*')
        .eq('mother_id', motherId)
        .eq('status', 'pending')
        .is('deleted_at', null)
        .order('reported_at', { ascending: false });
      if (error) throw error;
      setMotherReports(data || []);
    } catch (error) {
      console.error('Failed to fetch mother reports:', error);
      setMotherReports([]);
    }
    setReportsLoading(false);
  };

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
        <Link to={`/${rolePrefix}/mothers`}>
          <Button variant="secondary" style={{ marginTop: 'var(--space-4)' }}>Back to list</Button>
        </Link>
      </div>
    );
  }

  const pregnancyWeek = activePregnancy?.lmp ? calculateWeeksFromLMP(activePregnancy.lmp) : null;
  const highRiskAlerts = [];
  if (currentMother.risk_level === 'high' || currentMother.risk_level === 'critical') {
    highRiskAlerts.push({ label: 'High-risk pregnancy', detail: `Current risk level: ${currentMother.risk_level}` });
  }
  if (pregnancyWeek !== null && pregnancyWeek >= 42) {
    highRiskAlerts.push({ label: 'Pregnancy past due', detail: `Now ${pregnancyWeek} weeks — over 42 weeks requires assessment.` });
  } else if (pregnancyWeek !== null && pregnancyWeek >= 40) {
    highRiskAlerts.push({ label: 'Approaching due date', detail: `Now ${pregnancyWeek} weeks — delivery plan should be in place.` });
  }

  return (
    <div className="page-content fade-in">
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <Link to={`/${rolePrefix}/mothers`} className="flex items-center gap-2" style={{ color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: 'var(--space-4)', display: 'inline-flex' }}>
          <ArrowLeft size={16} /> Back to list
        </Link>

        {isWorker && !currentMother.verified && (
          <div style={{ background: 'var(--color-warning-50)', border: '1px solid var(--color-warning-200)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', marginBottom: 'var(--space-6)' }} className="flex-between align-center">
            <div className="flex gap-3 align-center">
              <AlertTriangle size={24} style={{ color: 'var(--color-warning-600)' }} />
              <div>
                <p className="font-medium" style={{ color: 'var(--color-warning-800)' }}>Unverified Record</p>
                <p className="body-sm" style={{ color: 'var(--color-warning-700)' }}>This information was self-reported and needs clinical verification.</p>
              </div>
            </div>
            <Button leftIcon={<UserCheck size={18} />} onClick={() => setVerifyTarget({ type: 'mother', id: currentMother.id, name: currentMother.full_name })}>
              Verify Now
            </Button>
          </div>
        )}

        <div className="flex-between align-start">
          <div>
            <h1 className="heading-2">{currentMother.full_name}</h1>
            <p className="body-lg" style={{ color: 'var(--text-secondary)' }}>
              {currentMother.community || 'Unknown Community'}
            </p>
            <div className="flex items-center gap-2" style={{ marginTop: 'var(--space-2)' }}>
              <VerificationBadge row={currentMother} size="lg" />
              <Badge variant="neutral">{currentMother.data_source || 'system'}</Badge>
            </div>
            <p className="caption text-secondary" style={{ marginTop: 'var(--space-2)' }}>
              Patient ID: <span className="font-medium">{currentMother.patient_code || '—'}</span>
              {currentMother.verified && currentMother.verified_at
                ? ` • Verified ${new Date(currentMother.verified_at).toLocaleDateString()}` +
                  (isWorker && verifierName ? ` by ${verifierName}` : '')
                : ''}
            </p>
          </div>
          <div className="flex gap-2" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Link to={`/${rolePrefix}/mothers/${currentMother.id}/edit`}>
              <Button variant="outline" leftIcon={<Pencil size={18} />}>Edit Profile</Button>
            </Link>
          </div>
        </div>

        {/* Main Actions Bar */}
        <div className="flex gap-3" style={{ marginTop: 'var(--space-6)', flexWrap: 'wrap' }}>
          <Link to={`/${rolePrefix}/visits/new?patientId=${currentMother.id}&patientType=mother`} style={{ flex: '1 1 auto', textDecoration: 'none', minWidth: '200px' }}>
            <Button fullWidth size="lg" leftIcon={<Activity size={20} />}>Record Health Visit</Button>
          </Link>
          {activePregnancy && (
            <Button size="lg" leftIcon={<Activity size={20} />} onClick={() => setANCModalOpen(true)} style={{ flex: '1 1 auto', minWidth: '200px' }}>
              Log ANC Visit
            </Button>
          )}
          <Link to={`/${rolePrefix}/referrals/new?patientId=${currentMother.id}&patientType=mother`} style={{ flex: '1 1 auto', textDecoration: 'none', minWidth: '200px' }}>
            <Button variant="outline" fullWidth size="lg" leftIcon={<Share2 size={20} />}>Refer Patient</Button>
          </Link>
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
              <p className="caption text-secondary" style={{ marginBottom: 'var(--space-1)' }}>Gestational Age</p>
              <p className="heading-4 text-primary">
                {pregnancyWeek !== null ? `Week ${pregnancyWeek}` : 'Not pregnant / unknown'}
              </p>
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
          </CardBody>
        </Card>
      </div>



      <div className="grid grid-2" style={{ gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
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
                {activePregnancy && (
                  <div className="p-4" style={{ borderBottom: '1px solid var(--border-default)', background: 'var(--surface-sunken)' }}>
                    <div className="flex-between">
                      <div>
                        <p className="font-medium">Current Pregnancy</p>
                        <p className="caption text-secondary">
                          {activePregnancy.edd ? `EDD: ${new Date(activePregnancy.edd).toLocaleDateString()}` : 'EDD: Unknown'}
                          {activePregnancy.gravida ? ` • Gravida ${activePregnancy.gravida}` : ''}
                          {activePregnancy.para ? ` • Para ${activePregnancy.para}` : ''}
                        </p>
                        {activePregnancy.risk_level && activePregnancy.risk_level !== 'low' && (
                          <Badge variant="warning" solid style={{ marginTop: 'var(--space-2)' }}>
                            Risk: {activePregnancy.risk_level}
                          </Badge>
                        )}
                        {activePregnancy.verified === false && activePregnancy.data_source === 'mother_registered' && (
                          <span style={{ marginTop: 'var(--space-2)', display: 'inline-block' }}>
                            <Badge variant="warning" dot>Self-reported — unverified</Badge>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="primary" solid>Current</Badge>
                        {isWorker && activePregnancy.verified !== true && (
                          <button className="icon-btn-sm" title="Verify this pregnancy record" onClick={() => setVerifyTarget({ type: 'pregnancy', id: activePregnancy.id, name: `Pregnancy (${new Date(activePregnancy.created_at).getFullYear()})` })}>
                            <UserCheck size={14} />
                          </button>
                        )}
                        <button className="icon-btn-sm" onClick={() => { setEditingPregnancy(activePregnancy); setPregnancyModalOpen(true); }} title="Edit"><Pencil size={14} /></button>
                        <button className="icon-btn-sm danger" onClick={() => setDeleteTarget({ type: 'pregnancy', id: activePregnancy.id, name: `Pregnancy (${new Date(activePregnancy.created_at).getFullYear()})` })} title="Delete"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  </div>
                )}
                {pregnancyHistory.filter(p => p.id !== activePregnancy?.id).map((preg) => {
                  const statusLabel = pregnancyStatusLabel(preg.status);
                  const statusVariant = pregnancyStatusVariant(preg.status);
                  return (
                    <div key={preg.id} className="flex-between p-4" style={{ borderBottom: '1px solid var(--border-default)' }}>
                      <div>
                        <p className="font-medium">Pregnancy ({new Date(preg.created_at).getFullYear()})</p>
                        <p className="caption text-secondary">EDD: {preg.edd ? new Date(preg.edd).toLocaleDateString() : 'Unknown'}</p>
                        {preg.verified === false && preg.data_source === 'mother_registered' && (
                          <Badge variant="warning" dot>Self-reported — unverified</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={statusVariant}>{statusLabel}</Badge>
                        {isWorker && preg.verified !== true && (
                          <button className="icon-btn-sm" title="Verify this pregnancy record" onClick={() => setVerifyTarget({ type: 'pregnancy', id: preg.id, name: `Pregnancy (${new Date(preg.created_at).getFullYear()})` })}>
                            <UserCheck size={14} />
                          </button>
                        )}
                        <button className="icon-btn-sm" onClick={() => { setEditingPregnancy(preg); setPregnancyModalOpen(true); }} title="Edit"><Pencil size={14} /></button>
                        <button className="icon-btn-sm danger" onClick={() => setDeleteTarget({ type: 'pregnancy', id: preg.id, name: `Pregnancy (${new Date(preg.created_at).getFullYear()})` })} title="Delete"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  );
                })}
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
            <Link to={`/${rolePrefix}/children/new`}>
              <Button size="sm" variant="outline" leftIcon={<Plus size={16} />}>Add Child</Button>
            </Link>
          </div>
          <CardBody style={{ padding: 0 }}>
            {isChildrenLoading ? (
              <div className="p-6 flex-center"><Spinner size={24} /></div>
            ) : children.length > 0 ? (
              <div className="flex-col">
                {children.map((child) => {
                  const vax = vaccinations[child.id] || [];
                  const growth = growthRecords[child.id] || [];
                  const lastGrowth = growth[growth.length - 1];
                  return (
                    <div key={child.id} className="p-4" style={{ borderBottom: '1px solid var(--border-default)' }}>
                      <div className="flex-between">
                        <div className="flex items-center gap-3">
                          <div className="flex-center" style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-accent-100)', color: 'var(--color-accent-700)' }}>
                            <Baby size={20} />
                          </div>
                          <div>
                            <p className="font-medium">{child.full_name}</p>
                            <p className="caption text-secondary">
                              {child.gender} • {child.date_of_birth ? new Date(child.date_of_birth).toLocaleDateString() : 'DOB Unknown'}
                              {child.verified === false && child.data_source === 'mother_registered' ? ' • Self-reported' : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isWorker && child.verified !== true && (
                            <button className="icon-btn-sm" title="Verify this child record" onClick={() => setVerifyTarget({ type: 'child', id: child.id, name: child.full_name })}>
                              <UserCheck size={14} />
                            </button>
                          )}
                          <Link to={`/${rolePrefix}/children/${child.id}`}>
                            <Button size="sm" variant="ghost">View</Button>
                          </Link>
                        </div>
                      </div>
                      <div className="flex gap-3" style={{ marginTop: 'var(--space-3)', flexWrap: 'wrap' }}>
                        <span className="caption flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                          <Syringe size={14} /> {vax.length} vaccination{vax.length !== 1 ? 's' : ''}
                        </span>
                        <span className="caption flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                          <TrendingUp size={14} /> {growth.length} growth check{growth.length !== 1 ? 's' : ''}
                        </span>
                        {lastGrowth && (
                          <span className="caption flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                            <Scale size={14} /> {lastGrowth.weight_kg ? `${lastGrowth.weight_kg} kg` : ''}
                            {lastGrowth.height_cm ? ` • ${lastGrowth.height_cm} cm` : ''}
                            {lastGrowth.muac_cm ? ` • MUAC ${lastGrowth.muac_cm} cm` : ''}
                          </span>
                        )}
                      </div>
                      {lastGrowth?.notes && (
                        <p className="caption text-secondary" style={{ marginTop: 'var(--space-1)' }}>Nutrition: {lastGrowth.notes}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 text-center">
                <p className="body-sm text-secondary">No children registered yet.</p>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-2" style={{ gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
        {/* ANC History */}
        <Card>
          <div className="flex-between" style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--border-default)' }}>
            <h3 className="heading-5" style={{ margin: 0 }}>ANC History</h3>
            {activePregnancy && (
              <Button size="sm" variant="outline" leftIcon={<Plus size={16} />} onClick={() => setANCModalOpen(true)}>
                Log Visit
              </Button>
            )}
          </div>
          <CardBody style={{ padding: 0 }}>
            {isPregnancyLoading ? (
              <div className="p-6 flex-center"><Spinner size={24} /></div>
            ) : antenatalVisits.length > 0 ? (
              <div className="flex-col">
                {antenatalVisits.map(visit => (
                  <div key={visit.id} className="flex-between p-4" style={{ borderBottom: '1px solid var(--border-default)' }}>
                    <div>
                      <p className="font-medium">{new Date(visit.visit_date).toLocaleDateString()}</p>
                      <p className="caption text-secondary">
                        {visit.gestational_age ? `Week ${visit.gestational_age} • ` : ''}
                        {[
                          visit.weight ? `${visit.weight} kg` : '',
                          visit.blood_pressure ? `BP ${visit.blood_pressure}` : '',
                          visit.fundal_height ? `FH ${visit.fundal_height} cm` : '',
                          visit.fetal_heart_rate ? `FHR ${visit.fetal_heart_rate} bpm` : '',
                        ].filter(Boolean).join(' • ') || 'No measurements recorded'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {visit.assessed_risk_level === 'high' && <Badge variant="critical" solid>High Risk</Badge>}
                      <button className="icon-btn-sm" onClick={() => { setEditingANC(visit); setANCModalOpen(true); }} title="Edit"><Pencil size={14} /></button>
                      <button className="icon-btn-sm danger" onClick={() => setDeleteTarget({ type: 'anc', id: visit.id, name: `ANC Visit (${new Date(visit.visit_date).toLocaleDateString()})` })} title="Delete"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center">
                <p className="body-sm text-secondary">No antenatal visits recorded yet.</p>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Health Visits */}
        <Card>
          <div className="flex-between" style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--border-default)' }}>
            <h3 className="heading-5" style={{ margin: 0 }}>Health Visits</h3>
            <Link to={`/${rolePrefix}/visits/new?patientId=${currentMother.id}&patientType=mother`}>
              <Button size="sm" variant="outline" leftIcon={<Plus size={16} />}>Record Visit</Button>
            </Link>
          </div>
          <CardBody style={{ padding: 0 }}>
            {isVisitsLoading ? (
              <div className="p-6 flex-center"><Spinner size={24} /></div>
            ) : visits.length > 0 ? (
              <div className="flex-col">
                {visits.map(visit => (
                  <div key={visit.id} className="p-4" style={{ borderBottom: '1px solid var(--border-default)' }}>
                    <div className="flex-between">
                      <div className="flex items-center gap-2">
                        <Stethoscope size={16} style={{ color: 'var(--color-primary-500)' }} />
                        <span className="font-medium">{new Date(visit.visit_date).toLocaleDateString()}</span>
                        <Badge variant="info" solid>{visit.visit_type?.replace('_', ' ')}</Badge>
                      </div>
                      <button className="icon-btn-sm danger" onClick={() => setDeleteTarget({ type: 'visit', id: visit.id, name: `Visit (${new Date(visit.visit_date).toLocaleDateString()})` })} title="Delete"><Trash2 size={14} /></button>
                    </div>
                    {visit.findings && <p className="body-sm" style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-2)' }}>{visit.findings}</p>}
                    {visit.actions_taken && <p className="caption text-secondary" style={{ marginTop: 'var(--space-1)' }}>Actions: {visit.actions_taken}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center">
                <p className="body-sm text-secondary">No health visits recorded yet.</p>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-2" style={{ gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
        {/* Referrals */}
        <Card>
          <div className="flex-between" style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--border-default)' }}>
            <h3 className="heading-5" style={{ margin: 0 }}>Referrals</h3>
            <Link to={`/${rolePrefix}/referrals/new?patientId=${currentMother.id}&patientType=mother`}>
              <Button size="sm" variant="outline" leftIcon={<Plus size={16} />}>Refer</Button>
            </Link>
          </div>
          <CardBody style={{ padding: 0 }}>
            {isReferralsLoading ? (
              <div className="p-6 flex-center"><Spinner size={24} /></div>
            ) : referrals.length > 0 ? (
              <div className="flex-col">
                {referrals.map(ref => (
                  <div key={ref.id} className="flex-between p-4" style={{ borderBottom: '1px solid var(--border-default)' }}>
                    <div>
                      <p className="font-medium">{ref.reason || 'Referral'}</p>
                      <p className="caption text-secondary">
                        {new Date(ref.created_at).toLocaleDateString()} • {ref.urgency} • to {ref.to_facility_id?.slice(0, 8)}...
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={STATUS_COLORS[ref.status] || 'info'}>{ref.status}</Badge>
                      {canUpdateReferralStatus && (
                        <select
                          className="input-base"
                          value={ref.status}
                          onChange={async (e) => {
                            const { success, error } = await updateReferralStatus(ref.id, e.target.value);
                            if (success) {
                              addToast({ type: 'success', message: `Referral marked as ${e.target.value}.` });
                            } else {
                              addToast({ type: 'error', title: 'Failed to update referral', message: error });
                            }
                          }}
                          title="Update referral status"
                          style={{ height: '32px', fontSize: 'var(--font-size-sm)', padding: '0 var(--space-2)', maxWidth: '140px' }}
                        >
                          <option value="pending">Pending</option>
                          <option value="accepted">Accepted</option>
                          <option value="completed">Completed</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      )}
                      <button className="icon-btn-sm danger" onClick={() => setDeleteTarget({ type: 'referral', id: ref.id, name: `Referral (${new Date(ref.created_at).toLocaleDateString()})` })} title="Delete"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center">
                <p className="body-sm text-secondary">No referrals recorded.</p>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Alerts */}
        <Card>
          <CardHeader title="Alerts" description="Items requiring worker attention" />
          <CardBody style={{ padding: 0 }}>
            <div className="flex-col">
              {highRiskAlerts.map((a, i) => (
                <div key={`alert-${i}`} className="flex items-start gap-3 p-4" style={{ borderBottom: '1px solid var(--border-default)' }}>
                  <div style={{ color: 'var(--color-danger-500)' }}><AlertTriangle size={18} /></div>
                  <div>
                    <p className="font-medium">{a.label}</p>
                    <p className="caption text-secondary">{a.detail}</p>
                  </div>
                </div>
              ))}
              {!reportsLoading && motherReports.map((r) => (
                <div key={r.id} className="flex items-start gap-3 p-4" style={{ borderBottom: '1px solid var(--border-default)' }}>
                  <div style={{ color: 'var(--color-warning-500)' }}><Bell size={18} /></div>
                  <div>
                    <p className="font-medium">{REPORT_TYPE_LABELS[r.report_type] || r.report_type} — pending</p>
                    <p className="caption text-secondary">{r.detail}{r.value ? ` • ${r.value}${r.unit ? ` ${r.unit}` : ''}` : ''}</p>
                    <p className="caption text-secondary">{new Date(r.reported_at).toLocaleString()}</p>
                  </div>
                </div>
              ))}
              {highRiskAlerts.length === 0 && (!reportsLoading && motherReports.length === 0) && (
                <div className="p-6 text-center">
                  <p className="body-sm text-secondary">No active alerts.</p>
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Timeline */}
      {currentMother.profile_id && (
        <Card style={{ marginBottom: 'var(--space-6)' }}>
          <CardHeader title="Health Journey Timeline" description="Longitudinal tracking across pregnancy, ANC, vaccinations, growth and visits" />
          <CardBody>
            <HealthJourneyTimeline profileId={currentMother.profile_id} childIds={children.map(c => c.id)} />
          </CardBody>
        </Card>
      )}

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
        title={`Delete ${deleteTarget?.type === 'pregnancy' ? 'Pregnancy' : deleteTarget?.type === 'visit' ? 'Health Visit' : deleteTarget?.type === 'referral' ? 'Referral' : 'ANC Visit'}`}
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        onConfirm={async () => {
          if (deleteTarget.type === 'pregnancy') {
            await deletePregnancy(deleteTarget.id);
            fetchPregnanciesByMotherId(currentMother.id);
          } else if (deleteTarget.type === 'anc') {
            await deleteAntenatalVisit(deleteTarget.id);
            fetchPregnanciesByMotherId(currentMother.id);
          } else if (deleteTarget.type === 'visit') {
            await deleteVisit(deleteTarget.id);
            fetchVisitsByPatient(currentMother.id);
          } else if (deleteTarget.type === 'referral') {
            await deleteReferral(deleteTarget.id);
            fetchReferralsByPatient(currentMother.id, 'mother');
          }
          addToast({ type: 'success', message: 'Record deleted.' });
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={!!verifyTarget}
        title={`Verify ${verifyTarget?.type === 'mother' ? 'Mother Record' : verifyTarget?.type === 'pregnancy' ? 'Pregnancy Record' : 'Child Record'}`}
        message={`Confirm that you have reviewed "${verifyTarget?.name}". The record will be marked as verified by a healthcare worker and locked against further mother edits.`}
        confirmLabel="Verify"
        danger={false}
        onConfirm={runVerify}
        onCancel={() => setVerifyTarget(null)}
      />
    </div>
  );
};

export default MotherProfile;
