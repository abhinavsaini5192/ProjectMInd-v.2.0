import type { AuthenticationResult } from '../models/AuthenticationResult.js';
import type { AuthenticationMethod } from '../models/SecurityPrincipal.js';

export interface AuthenticationInput {
  readonly method: AuthenticationMethod;
  readonly apiKey?: string | undefined;
  readonly token?: string | undefined;
  readonly sessionId?: string | undefined;
  readonly serviceId?: string | undefined;
  readonly serviceSecret?: string | undefined;
  readonly developmentPrincipalId?: string | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
}

export interface IAuthenticator {
  authenticate(input: AuthenticationInput): Promise<AuthenticationResult>;
}
