import { forwardRef, useState } from 'react';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import styles from './Input.module.css';

/**
 * NurtureAI Input Component
 * 
 * Supports text, password (with toggle), textarea, and select.
 * Includes label, helper text, error state, and icon slots.
 */
const Input = forwardRef(({
  label,
  type = 'text',
  error,
  helperText,
  required = false,
  leftIcon,
  rightIcon,
  size = 'md',
  className = '',
  id,
  options,  // for select type
  ...props
}, ref) => {
  const [showPassword, setShowPassword] = useState(false);
  const inputId = id || `input-${label?.toLowerCase().replace(/\s/g, '-')}`;
  const isTextarea = type === 'textarea';
  const isSelect = type === 'select';
  const inputType = type === 'password' ? (showPassword ? 'text' : 'password') : type;

  const wrapperClasses = [
    styles.inputWrapper,
    styles[size],
    error && styles.error,
    className,
  ].filter(Boolean).join(' ');

  const inputClasses = [
    styles.input,
    leftIcon && styles.hasLeftIcon,
    (rightIcon || type === 'password') && styles.hasRightIcon,
    isTextarea && styles.textarea,
    isSelect && styles.select,
  ].filter(Boolean).join(' ');

  const renderInput = () => {
    if (isTextarea) {
      return (
        <textarea
          ref={ref}
          id={inputId}
          className={inputClasses}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : undefined}
          {...props}
        />
      );
    }

    if (isSelect) {
      return (
        <select
          ref={ref}
          id={inputId}
          className={inputClasses}
          aria-invalid={!!error}
          {...props}
        >
          {(!props.value || props.value === '') && (
            <option value="" disabled>
              {props.placeholder || 'Select...'}
            </option>
          )}
          {options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    }

    return (
      <input
        ref={ref}
        id={inputId}
        type={inputType}
        className={inputClasses}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-error` : undefined}
        {...props}
      />
    );
  };

  return (
    <div className={wrapperClasses}>
      {label && (
        <label htmlFor={inputId} className={styles.label}>
          {label}
          {required && <span className={styles.required}>*</span>}
        </label>
      )}
      <div className={styles.inputContainer}>
        {leftIcon && <span className={styles.leftIcon}>{leftIcon}</span>}
        {renderInput()}
        {type === 'password' && (
          <button
            type="button"
            className={`${styles.rightIcon} ${styles.clickableIcon}`}
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
        {rightIcon && type !== 'password' && (
          <span className={styles.rightIcon}>{rightIcon}</span>
        )}
      </div>
      {error && (
        <span id={`${inputId}-error`} className={styles.errorMessage} role="alert">
          <AlertCircle size={12} />
          {error}
        </span>
      )}
      {helperText && !error && (
        <span className={styles.helperText}>{helperText}</span>
      )}
    </div>
  );
});

Input.displayName = 'Input';
export default Input;
