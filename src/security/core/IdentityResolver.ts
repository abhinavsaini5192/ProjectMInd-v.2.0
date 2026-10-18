import type { IIdentityResolver } from '../interfaces/IIdentityResolver.js';
import type { Identity } from '../models/Identity.js';
import { IdentityNotFoundError } from '../errors/SecurityError.js';
import type { IEventBus } from '../../events/index.js';
import { SECURITY_EVENTS } from '../events/SecurityEvents.js';

export class IdentityResolver implements IIdentityResolver {
  private readonly identities = new Map<string, Identity>();

  constructor(private readonly eventBus?: IEventBus | undefined) {}

  public async getIdentity(identityId: string): Promise<Identity | null> {
    return this.identities.get(identityId) ?? null;
  }

  public async saveIdentity(identity: Identity): Promise<void> {
    const isNew = !this.identities.has(identity.identityId);
    this.identities.set(identity.identityId, identity);

    if (isNew && this.eventBus) {
      this.eventBus.publish(SECURITY_EVENTS.IDENTITY_CREATED, {
        identityId: identity.identityId,
        type: identity.type,
        timestamp: new Date().toISOString(),
      });
    }
  }

  public async disableIdentity(identityId: string, reason: string): Promise<void> {
    const identity = this.identities.get(identityId);
    if (!identity) {
      throw new IdentityNotFoundError(`Identity '${identityId}' not found`);
    }

    const disabled: Identity = {
      ...identity,
      status: 'DISABLED',
      updatedAt: new Date().toISOString(),
    };
    this.identities.set(identityId, disabled);

    if (this.eventBus) {
      this.eventBus.publish(SECURITY_EVENTS.IDENTITY_DISABLED, {
        identityId,
        reason,
        disabledBy: 'SYSTEM',
        timestamp: new Date().toISOString(),
      });
    }
  }
}
