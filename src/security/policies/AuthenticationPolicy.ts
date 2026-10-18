import type { AuthenticationMethod } from '../models/SecurityPrincipal.js';
import { AuthenticationError } from '../errors/SecurityError.js';

export interface AuthenticationPolicyConfig {
  readonly authRequired: boolean;
  readonly authMode: string;
  readonly allowUnsafeDevDefaults: boolean;
  readonly sessionTimeoutMs: number;
  readonly tokenClockSkewMs: number;
}

export const DEFAULT_AUTH_POLICY_CONFIG: AuthenticationPolicyConfig = {
  authRequired: true,
  authMode: 'api_key',
  allowUnsafeDevDefaults: false,
  sessionTimeoutMs: 86400000, // 24 hours
  tokenClockSkewMs: 30000, // 30 seconds
};

export class AuthenticationPolicy {
  constructor(private readonly config: AuthenticationPolicyConfig = DEFAULT_AUTH_POLICY_CONFIG) {}

  public validateMethodAllowed(method: AuthenticationMethod): void {
    if (method === 'LOCAL_DEVELOPMENT') {
      if (!this.config.allowUnsafeDevDefaults && this.config.authMode !== 'development') {
        throw new AuthenticationError(
          'Local development authentication is prohibited in production or when allowUnsafeDevDefaults is false',
          { code: 'PROD_DEV_AUTH_FORBIDDEN' }
        );
      }
    }
  }

  public validateExpiration(expiresAt?: string, now: Date = new Date()): void {
    if (!expiresAt) {
      return;
    }
    const expirationTime = new Date(expiresAt).getTime();
    if (now.getTime() - this.config.tokenClockSkewMs > expirationTime) {
      throw new AuthenticationError('Authentication credential has expired');
    }
  }
}
