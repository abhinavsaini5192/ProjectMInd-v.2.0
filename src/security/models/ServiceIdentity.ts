import type { Identity } from './Identity.js';

export interface ServiceIdentity extends Identity {
  readonly type: 'SERVICE';
  readonly serviceId: string;
  readonly serviceName: string;
  readonly allowedScopes: readonly string[];
  readonly permissions: readonly string[];
}

export function isServiceIdentity(identity: Identity): identity is ServiceIdentity {
  return identity.type === 'SERVICE' && typeof (identity as ServiceIdentity).serviceId === 'string';
}
