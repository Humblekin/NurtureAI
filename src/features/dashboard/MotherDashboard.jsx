import { Heart, Calendar, Baby, MessageCircle } from 'lucide-react';
import useAuthStore from '../../stores/authStore';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { Link } from 'react-router-dom';

export const MotherDashboard = () => {
  const { profile } = useAuthStore();

  return (
    <div className="page-content fade-in">
      <div className="flex-between" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 className="heading-2">Hello, {profile?.full_name?.split(' ')[0] || 'Mother'}</h1>
          <p className="body-lg" style={{ color: 'var(--text-secondary)' }}>
            Here is your health summary for today.
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p className="body-sm" style={{ color: 'var(--text-tertiary)' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 'var(--space-6)' }}>
        <Card variant="elevated" className="gradient-primary" style={{ color: 'white' }}>
          <CardBody className="flex-col gap-4">
            <div className="flex-between">
              <span className="heading-4">Pregnancy</span>
              <Heart size={24} />
            </div>
            <div>
              <p className="heading-2" style={{ marginBottom: 0 }}>Week 24</p>
              <p className="body-sm" style={{ opacity: 0.8 }}>Trimester 2</p>
            </div>
            <div className="flex gap-2">
              <Badge variant="success" solid size="sm">Low Risk</Badge>
            </div>
          </CardBody>
        </Card>

        <Card variant="elevated" style={{ borderLeft: '4px solid var(--color-warning-500)' }}>
          <CardBody className="flex-col gap-4">
            <div className="flex-between">
              <span className="heading-4" style={{ color: 'var(--text-primary)' }}>Next Visit</span>
              <Calendar size={24} style={{ color: 'var(--text-tertiary)' }} />
            </div>
            <div>
              <p className="heading-3" style={{ marginBottom: 0, color: 'var(--text-primary)' }}>Oct 15</p>
              <p className="body-sm" style={{ color: 'var(--text-secondary)' }}>Antenatal Checkup</p>
            </div>
            <Link to="/health">
              <Button size="sm" variant="outline" fullWidth>View Details</Button>
            </Link>
          </CardBody>
        </Card>

        <Card variant="elevated" className="gradient-warm" style={{ color: 'white' }}>
          <CardBody className="flex-col gap-4">
            <div className="flex-between">
              <span className="heading-4">Talk to Amina</span>
              <MessageCircle size={24} />
            </div>
            <div>
              <p className="body-sm" style={{ opacity: 0.9 }}>
                Have a health question? Amina is here to help 24/7.
              </p>
            </div>
            <Link to="/amina">
              <Button size="sm" style={{ background: 'white', color: 'var(--color-secondary-700)' }} fullWidth>
                Chat Now
              </Button>
            </Link>
          </CardBody>
        </Card>
      </div>

      <h2 className="heading-3" style={{ marginBottom: 'var(--space-4)' }}>My Children</h2>
      <div className="grid grid-2">
        <Card hoverable clickable>
          <CardBody className="flex gap-4 items-center">
            <div style={{ 
              width: 48, height: 48, borderRadius: '50%', 
              background: 'var(--color-accent-100)', color: 'var(--color-accent-700)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Baby size={24} />
            </div>
            <div style={{ flex: 1 }}>
              <h3 className="heading-5">Kwame Mensah</h3>
              <p className="body-sm" style={{ color: 'var(--text-secondary)' }}>14 Months • Male</p>
            </div>
            <div>
              <Badge variant="warning" dot>Vaccine Due</Badge>
            </div>
          </CardBody>
        </Card>

        <Card hoverable clickable className="flex-center" style={{ borderStyle: 'dashed', background: 'transparent' }}>
          <CardBody className="flex-col items-center gap-2 text-center" style={{ color: 'var(--text-secondary)' }}>
            <Baby size={24} style={{ opacity: 0.5 }} />
            <span className="font-medium">Add Child Record</span>
          </CardBody>
        </Card>
      </div>
    </div>
  );
};

export default MotherDashboard;
