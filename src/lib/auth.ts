/**
 * @deprecated Import from '@/server/auth' instead.
 * This file is a re-export shim maintained for backward compatibility
 * during the transition to the new src/server/ directory structure.
 */
export {
  createToken,
  verifyToken,
  getAuthUser,
  authError,
} from '@/server/auth';

export type { JWTPayload } from '@/server/auth';
