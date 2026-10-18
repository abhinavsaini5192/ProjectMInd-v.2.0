import type { CredentialReference } from '../models/CredentialReference.js';
import type { SecurityPrincipal } from '../models/SecurityPrincipal.js';
import type { AuthenticationInput } from './IAuthenticator.js';

export interface ICredentialProvider {
  getCredentialReference(credentialId: string): Promise<CredentialReference | null>;
  verifyCredential(input: AuthenticationInput): Promise<SecurityPrincipal | null>;
  registerCredential(credential: CredentialReference, secretVerifier: (secret: string) => boolean): Promise<void>;
  revokeCredential(credentialId: string): Promise<void>;
}
