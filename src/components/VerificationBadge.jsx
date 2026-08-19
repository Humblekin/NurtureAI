import { getVerificationStatus } from '../lib/verification';
import Badge from './ui/Badge';

/**
 * NurtureAI — Verification Badge
 *
 * Renders the verification status (Verified / Pending Verification /
 * Needs Review / Unverified) for any record carrying `verified` and
 * `data_source` provenance fields.
 */
export const VerificationBadge = ({ row, showDot = true, className = '', ...props }) => {
  const status = getVerificationStatus(row);
  return (
    <Badge variant={status.variant} dot={showDot} className={className} {...props}>
      {status.label}
    </Badge>
  );
};

export default VerificationBadge;
