import styles from './Badge.module.css';

/**
 * NurtureAI Badge Component
 * Used for status indicators, risk levels, and small counters.
 */
export const Badge = ({
  children,
  variant = 'primary', // neutral, primary, accent, success, warning, danger, critical
  size = 'md',         // sm, md, lg
  solid = false,
  dot = false,
  className = '',
  ...props
}) => {
  const classNames = [
    styles.badge,
    styles[variant],
    styles[size],
    solid && styles.solid,
    dot && styles.dot,
    className
  ].filter(Boolean).join(' ');

  return (
    <span className={classNames} {...props}>
      {children}
    </span>
  );
};

export default Badge;
