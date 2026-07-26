import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import useAuthStore from '../../stores/authStore';
import useMotherStore from '../../stores/motherStore';
import usePregnancyStore from '../../stores/pregnancyStore';
import PregnancyForm from './PregnancyForm';
import Spinner from '../../components/ui/Spinner';
import styles from './PregnancyRegister.module.css';

const PregnancyRegister = () => {
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const { currentMother, fetchMotherByProfileId, isLoading: motherLoading } = useMotherStore();
  const { fetchPregnanciesByMotherId } = usePregnancyStore();

  useEffect(() => {
    if (profile?.id) {
      fetchMotherByProfileId(profile.id);
    }
  }, [profile?.id, fetchMotherByProfileId]);

  const handleSuccess = () => {
    if (currentMother?.id) {
      fetchPregnanciesByMotherId(currentMother.id);
    }
    navigate('/mother/pregnancy', { replace: true });
  };

  if (motherLoading) {
    return (
      <div className="flex-center" style={{ padding: 'var(--space-12)' }}>
        <Spinner size={32} />
      </div>
    );
  }

  if (!currentMother) {
    return (
      <div className="page-content fade-in">
        <div className={styles.container}>
          <h2 className="heading-3">Profile Required</h2>
          <p className="body-sm" style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
            You need to set up your health profile before registering a pregnancy.
          </p>
          <button className={styles.linkBtn} onClick={() => navigate('/mother/welcome')}>
            Set Up Profile First
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content fade-in">
      <div className={styles.container}>
        <div className={styles.header}>
          <button className={styles.backBtn} onClick={() => navigate('/mother/pregnancy')}>
            <ArrowLeft size={20} />
          </button>
          <h2 className="heading-3">Register Pregnancy</h2>
        </div>
        <PregnancyForm
          motherId={currentMother.id}
          onSuccess={handleSuccess}
          onCancel={() => navigate('/mother/pregnancy')}
        />
      </div>
    </div>
  );
};

export default PregnancyRegister;
