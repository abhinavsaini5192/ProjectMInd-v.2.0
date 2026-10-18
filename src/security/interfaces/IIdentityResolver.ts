import type { Identity } from '../models/Identity.js';

export interface IIdentityResolver {
  getIdentity(identityId: string): Promise<Identity | null>;
  saveIdentity(identity: Identity): Promise<void>;
  disableIdentity(identityId: string, reason: string): Promise<void>;
}
