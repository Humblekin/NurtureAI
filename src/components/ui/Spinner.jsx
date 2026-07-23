import { Loader2 } from 'lucide-react';

export const Spinner = ({
  size = 24,
  color = 'var(--color-primary-500)',
  className = '',
  fullScreen = false
}) => {
  if (fullScreen) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        width: '100vw',
        background: 'var(--surface-base)'
      }}>
        <Loader2 
          size={size * 2} 
          color={color} 
          className={`animate-spin ${className}`} 
          style={{ animation: 'spin 1s linear infinite' }}
        />
      </div>
    );
  }

  return (
    <Loader2 
      size={size} 
      color={color} 
      className={`animate-spin ${className}`} 
      style={{ animation: 'spin 1s linear infinite' }}
    />
  );
};

export default Spinner;
