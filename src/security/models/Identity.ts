import type { IdentityType } from './IdentityType.js';

export type IdentityStatus = 'ACTIVE' | 'DISABLED' | 'SUSPENDED';

export interface Identity {
  readonly identityId: string;
  readonly type: IdentityType;
  readonly status: IdentityStatus;
  readonly metadata?: Record<string, unknown> | undefined;
  readonly createdAt: string;
  readonly updatedAt: string;
}
