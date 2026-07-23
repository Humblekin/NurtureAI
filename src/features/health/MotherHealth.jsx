import { useState, useEffect } from 'react';
import { Heart, Baby, Calendar, Activity, AlertTriangle, ChevronRight, Plus } from 'lucide-react';
import useAuthStore from '../../stores/authStore';
import useMotherStore from '../../stores/motherStore';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import db from '../../lib/db';

export const MotherHealth = () => {
  const { profile } = useAuthStore();
  const { currentMother, fetchMotherByProfileId, isLoading } = useMotherStore();
  const [pregnancies, setPregnancies] = useState([]);
  const [children, setChildren] = useState([]);
  const [antenatalVisits, setAntenatalVisits] = useState([]);
  const [activeTab, setActiveTab] = useState('pregnancy');

  useEffect(() => {
    if (profile?.id) {
      fetchMotherByProfileId(profile.id);
    }
  }, [profile?.id, fetchMotherByProfileId]);

  useEffect(() => {
    if (currentMother?.id) {
      loadData();
    }
  }, [currentMother?.id]);

  const loadData = async () => {
    try {
      const [pregData, childData, anvData] = await Promise.all([
        db.pregnancies.where('mother_id').equals(currentMother.id).toArray(),
        db.children.where('mother_id').equals(currentMother.id).toArray(),
        db.antenatal_visits.toArray(),
      ]);
      setPregnancies(pregData);
      setChildren(childData);
      // Filter antenatal visits for this mother's pregnancies
      const pregIds = pregData.map(p => p.id);
      setAntenatalVisits(anvData.filter(v => pregIds.includes(v.pregnancy_id)));
    } catch (err) {
      console.error('Failed to load health data:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-center" style={{ padding: 'var(--space-12)' }}>
        <Spinner size={32} />
      </div>
    );
  }

  if (!currentMother) {
    return (
      <div className="page-content fade-in">
        <EmptyState
          title="No health records found"
          description="Your health profile hasn't been set up yet. A health worker will register your information."
        />
      </div>
    );
  }

  const activePregnancy = pregnancies.find(p => p.status === 'active');

  const riskColors = {
    low: 'success',
    medium: 'warning',
    high: 'critical',
    critical: 'critical',
  };

  const tabs = [
    { id: 'pregnancy', label: 'Pregnancy', icon: Heart },
    { id: 'children', label: 'My Children', icon: Baby },
    { id: 'visits', label: 'ANC Visits', icon: Calendar },
  ];

  return (
    <div className="page-content fade-in">
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h1 className="heading-2">My Health</h1>
        <p className="body-md" style={{ color: 'var(--text-secondary)' }}>
          Track your pregnancy, children, and health visits.
        </p>
      </div>

      {/* Risk Level Banner */}
      {activePregnancy && (
        <Card style={{ marginBottom: 'var(--space-6)' }}>
          <CardBody>
            <div className="flex-between">
              <div className="flex gap-3 items-center">
                <Heart size={20} style={{ color: 'var(--color-primary-500)' }} />
                <div>
                  <p className="font-medium">Current Pregnancy</p>
                  <p className="body-sm" style={{ color: 'var(--text-secondary)' }}>
                    {activePregnancy.lmp ? `Started ${new Date(activePregnancy.lmp).toLocaleDateString()}` : 'Date not recorded'}
                    {activePregnancy.edd && ` • Due ${new Date(activePregnancy.edd).toLocaleDateString()}`}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 items-center">
                {activePregnancy.risk_level && (
                  <Badge variant={riskColors[activePregnancy.risk_level] || 'info'} solid>
                    {activePregnancy.risk_level === 'high' && <AlertTriangle size={12} style={{ marginRight: '4px' }} />}
                    {activePregnancy.risk_level} risk
                  </Badge>
                )}
                {activePregnancy.gravida && (
                  <Badge variant="neutral">G{activePregnancy.gravida}P{activePregnancy.para}</Badge>
                )}
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-2" style={{ marginBottom: 'var(--space-6)' }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex gap-2 items-center ${activeTab === tab.id ? 'font-semibold' : ''}`}
              style={{
                padding: 'var(--space-2) var(--space-4)',
                borderRadius: 'var(--radius-lg)',
                border: activeTab === tab.id ? '2px solid var(--color-primary-500)' : '2px solid var(--border-default)',
                background: activeTab === tab.id ? 'var(--color-primary-50)' : 'transparent',
                color: activeTab === tab.id ? 'var(--color-primary-700)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: 'var(--text-sm)',
              }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'pregnancy' && (
        <div className="grid grid-2" style={{ gap: 'var(--space-6)' }}>
          <Card>
            <CardHeader title="Pregnancy Details" icon={<Heart size={18} />} />
            <CardBody className="flex-col gap-3">
              <div className="flex-between">
                <span className="body-sm" style={{ color: 'var(--text-secondary)' }}>Status</span>
                <Badge variant={activePregnancy?.status === 'active' ? 'success' : 'neutral'}>
                  {activePregnancy?.status || 'Unknown'}
                </Badge>
              </div>
              <div className="flex-between">
                <span className="body-sm" style={{ color: 'var(--text-secondary)' }}>Blood Group</span>
                <span className="font-medium">{currentMother.blood_group || 'Not recorded'}</span>
              </div>
              <div className="flex-between">
                <span className="body-sm" style={{ color: 'var(--text-secondary)' }}>Last Menstrual Period</span>
                <span className="font-medium">{activePregnancy?.lmp ? new Date(activePregnancy.lmp).toLocaleDateString() : 'Not recorded'}</span>
              </div>
              <div className="flex-between">
                <span className="body-sm" style={{ color: 'var(--text-secondary)' }}>Expected Due Date</span>
                <span className="font-medium">{activePregnancy?.edd ? new Date(activePregnancy.edd).toLocaleDateString() : 'Not recorded'}</span>
              </div>
              <div className="flex-between">
                <span className="body-sm" style={{ color: 'var(--text-secondary)' }}>Gravida / Para</span>
                <span className="font-medium">
                  {activePregnancy?.gravida != null ? `G${activePregnancy.gravida}` : '—'} / {activePregnancy?.para != null ? `P${activePregnancy.para}` : '—'}
                </span>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Medical History" icon={<Activity size={18} />} />
            <CardBody>
              <p className="body-sm" style={{ color: 'var(--text-secondary)' }}>
                {currentMother.medical_history || 'No medical history recorded.'}
              </p>
            </CardBody>
          </Card>
        </div>
      )}

      {activeTab === 'children' && (
        <div>
          {children.length > 0 ? (
            <div className="grid grid-2">
              {children.map((child) => (
                <Card key={child.id} hoverable>
                  <CardBody className="flex-col gap-3">
                    <div className="flex-between">
                      <div>
                        <h3 className="heading-5">{child.full_name}</h3>
                        <p className="body-sm" style={{ color: 'var(--text-secondary)' }}>
                          {child.date_of_birth ? new Date(child.date_of_birth).toLocaleDateString() : 'DOB unknown'} • {child.gender}
                        </p>
                      </div>
                      <Badge variant={child.gender === 'male' ? 'info' : 'primary'}>
                        {child.gender}
                      </Badge>
                    </div>
                    {child.birth_weight && (
                      <p className="body-sm" style={{ color: 'var(--text-tertiary)' }}>
                        Birth weight: {child.birth_weight} kg
                      </p>
                    )}
                  </CardBody>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No children registered"
              description="Your children's records will appear here once registered by a health worker."
            />
          )}
        </div>
      )}

      {activeTab === 'visits' && (
        <div>
          {antenatalVisits.length > 0 ? (
            <div className="grid grid-2">
              {antenatalVisits.sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date)).map((visit) => (
                <Card key={visit.id}>
                  <CardBody className="flex-col gap-3">
                    <div className="flex-between">
                      <div className="flex gap-2 items-center">
                        <Calendar size={16} style={{ color: 'var(--color-primary-500)' }} />
                        <span className="font-medium">{new Date(visit.visit_date).toLocaleDateString()}</span>
                      </div>
                      {visit.visit_number && (
                        <Badge variant="info">Visit #{visit.visit_number}</Badge>
                      )}
                    </div>
                    <div className="grid grid-2" style={{ gap: 'var(--space-2)' }}>
                      {visit.weight && (
                        <p className="body-sm"><span style={{ color: 'var(--text-tertiary)' }}>Weight:</span> {visit.weight} kg</p>
                      )}
                      {visit.blood_pressure && (
                        <p className="body-sm"><span style={{ color: 'var(--text-tertiary)' }}>BP:</span> {visit.blood_pressure}</p>
                      )}
                      {visit.gestational_age && (
                        <p className="body-sm"><span style={{ color: 'var(--text-tertiary)' }}>GA:</span> {visit.gestational_age} weeks</p>
                      )}
                      {visit.fetal_heart_rate && (
                        <p className="body-sm"><span style={{ color: 'var(--text-tertiary)' }}>FHR:</span> {visit.fetal_heart_rate} bpm</p>
                      )}
                    </div>
                    {visit.symptoms && (
                      <p className="body-sm" style={{ color: 'var(--text-secondary)' }}>
                        Symptoms: {visit.symptoms}
                      </p>
                    )}
                    {visit.assessed_risk_level && (
                      <Badge variant={riskColors[visit.assessed_risk_level] || 'info'}>
                        Risk: {visit.assessed_risk_level}
                      </Badge>
                    )}
                  </CardBody>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No ANC visits recorded"
              description="Your antenatal care visits will appear here."
            />
          )}
        </div>
      )}
    </div>
  );
};

export default MotherHealth;
