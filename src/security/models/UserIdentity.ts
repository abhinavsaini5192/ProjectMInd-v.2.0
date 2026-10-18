import type { Identity, IdentityStatus } from './Identity.js';

export interface ExternalIdentityReference {
  readonly provider: string;
  readonly externalId: string;
  readonly linkedAt: string;
}

export interface UserIdentity extends Identity {
  readonly type: 'USER';
  readonly userId: string;
  readonly username?: string | undefined;
  readonly email?: string | undefined;
  readonly externalIdentityReferences?: readonly ExternalIdentityReference[] | undefined;
}

export function isUserIdentity(identity: Identity): identity is UserIdentity {
  return identity.type === 'USER' && typeof (identity as UserIdentity).userId === 'string';
}
