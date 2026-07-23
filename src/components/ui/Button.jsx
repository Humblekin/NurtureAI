import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import styles from './Button.module.css';

/**
 * NurtureAI Button Component
 * 
 * @param {object} props
 * @param {'primary'|'secondary'|'ghost'|'danger'|'accent'|'outline'} variant
 * @param {'sm'|'md'|'lg'} size
 * @param {boolean} loading
 * @param {boolean} fullWidth
 * @param {boolean} iconOnly
 * @param {React.ReactNode} leftIcon
 * @param {React.ReactNode} rightIcon
 */
const Button = forwardRef(({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  iconOnly = false,
  leftIcon,
  rightIcon,
  className = '',
  type = 'button',
  ...props
}, ref) => {
  const classNames = [
    styles.button,
    styles[variant],
    styles[size],
    fullWidth && styles.fullWidth,
    iconOnly && styles.iconOnly,
    loading && styles.loading,
    className,
  ].filter(Boolean).join(' ');

  return (
    <motion.button
      ref={ref}
      type={type}
      className={classNames}
      disabled={disabled || loading}
      whileTap={{ scale: disabled ? 1 : 0.97 }}
      {...props}
    >
      {loading ? (
        <Loader2 className={styles.spinner} size={size === 'sm' ? 14 : 18} />
      ) : leftIcon ? (
        leftIcon
      ) : null}
      {!iconOnly && children}
      {!loading && rightIcon}
    </motion.button>
  );
});

Button.displayName = 'Button';
export default Button;
