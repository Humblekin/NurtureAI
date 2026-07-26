import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import useAuthStore from '../../stores/authStore';
import useMotherStore from '../../stores/motherStore';
import usePregnancyStore from '../../stores/pregnancyStore';
import PregnancyForm from './PregnancyForm';
import Spinner from '../../components/ui/Spinner';

const PregnancyFormPage = () => {
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const { currentMother, fetchMotherByProfileId, isLoading } = useMotherStore();
  const { activePregnancy } = usePregnancyStore();

  useEffect(() => {
    if (profile?.id) {
      fetchMotherByProfileId(profile.id);
    }
  }, [profile?.id, fetchMotherByProfileId]);

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
        <div className="flex-col gap-4 items-center" style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
          <p className="body-lg" style={{ color: 'var(--text-secondary)' }}>
            Please complete your health profile first before registering a pregnancy.
          </p>
          <button
            onClick={() => navigate('/mother/welcome')}
            style={{
              padding: 'var(--space-3) var(--space-6)',
              background: 'var(--color-primary-500)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-lg)',
              cursor: 'pointer',
              fontSize: 'var(--text-base)',
              fontWeight: 'var(--font-medium)',
            }}
          >
            Set Up Profile
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content fade-in">
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            marginBottom: 'var(--space-4)',
            padding: 0,
          }}
        >
          <ArrowLeft size={18} />
          <span className="body-sm">Back</span>
        </button>
        <h1 className="heading-2">Register Pregnancy</h1>
        <p className="body-md" style={{ color: 'var(--text-secondary)' }}>
          Enter your pregnancy details to begin tracking.
        </p>
      </div>

      <div style={{ maxWidth: 'var(--form-max-width)' }}>
        <PregnancyForm
          motherId={currentMother.id}
          initialData={activePregnancy}
          onSuccess={() => navigate('/mother/pregnancy')}
          onCancel={() => navigate(-1)}
        />
      </div>
    </div>
  );
};

export default PregnancyFormPage;
