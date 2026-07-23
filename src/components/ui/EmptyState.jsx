import { FileBox } from 'lucide-react';

export const EmptyState = ({
  icon: Icon = FileBox,
  title = 'No items found',
  description = 'There is nothing to display here right now.',
  action,
  className = ''
}) => {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center ${className}`} style={{ minHeight: '200px' }}>
      <div style={{ 
        background: 'var(--surface-sunken)', 
        padding: 'var(--space-4)', 
        borderRadius: '50%',
        marginBottom: 'var(--space-4)',
        color: 'var(--text-tertiary)'
      }}>
        <Icon size={48} strokeWidth={1.5} />
      </div>
      <h3 className="heading-4" style={{ marginBottom: 'var(--space-2)' }}>{title}</h3>
      <p className="body-sm" style={{ color: 'var(--text-secondary)', marginBottom: action ? 'var(--space-6)' : 0, maxWidth: '400px' }}>
        {description}
      </p>
      {action && <div>{action}</div>}
    </div>
  );
};

export default EmptyState;
