import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import styles from './Card.module.css';

/**
 * NurtureAI Card Component
 */
export const Card = forwardRef(({
  children,
  variant = 'elevated', // elevated, outlined, ghost, glass, accent
  padding = 'normal',   // compact, normal, spacious
  hoverable = false,
  clickable = false,
  className = '',
  onClick,
  ...props
}, ref) => {
  const classNames = [
    styles.card,
    styles[variant],
    styles[padding],
    hoverable && styles.hoverable,
    (clickable || onClick) && styles.clickable,
    className
  ].filter(Boolean).join(' ');

  const Element = onClick || clickable ? motion.div : 'div';
  const motionProps = onClick || clickable ? {
    whileHover: { y: -2 },
    whileTap: { scale: 0.98 }
  } : {};

  return (
    <Element
      ref={ref}
      className={classNames}
      onClick={onClick}
      {...motionProps}
      {...props}
    >
      {children}
    </Element>
  );
});

Card.displayName = 'Card';

export const CardHeader = ({ title, description, action, className = '', children, ...props }) => (
  <div className={`${styles.cardHeader} ${className}`} {...props}>
    {(title || description) ? (
      <div>
        {title && <h3 className={styles.cardTitle}>{title}</h3>}
        {description && <p className={styles.cardDescription}>{description}</p>}
      </div>
    ) : (
      children
    )}
    {action && <div>{action}</div>}
  </div>
);

export const CardBody = ({ className = '', children, ...props }) => (
  <div className={`${styles.cardBody} ${className}`} {...props}>
    {children}
  </div>
);

export const CardFooter = ({ className = '', children, ...props }) => (
  <div className={`${styles.cardFooter} ${className}`} {...props}>
    {children}
  </div>
);
