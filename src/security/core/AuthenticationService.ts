import type { IAuthenticator, AuthenticationInput } from '../interfaces/IAuthenticator.js';
import type { AuthenticationResult } from '../models/AuthenticationResult.js';
import type { SecurityPrincipal } from '../models/SecurityPrincipal.js';
import { createAuthSuccess, createAuthFailure } from '../models/AuthenticationResult.js';
import { AuthenticationPolicy, DEFAULT_AUTH_POLICY_CONFIG } from '../policies/AuthenticationPolicy.js';
import type { IPrincipalResolver } from '../interfaces/IPrincipalResolver.js';
import type { IIdentityResolver } from '../interfaces/IIdentityResolver.js';
import type { ICredentialProvider } from '../interfaces/ICredentialProvider.js';
import type { IEventBus } from '../../events/index.js';
import { SECURITY_EVENTS } from '../events/SecurityEvents.js';

import type { SessionManager } from '../session/SessionManager.js';
import type { CredentialLifecycleManager } from '../governance/CredentialLifecycle.js';

export interface AuthenticationServiceConfig {
  readonly authRequired?: boolean | undefined;
  readonly authMode?: string | undefined;
  readonly allowUnsafeDevDefaults?: boolean | undefined;
  readonly environment?: 'development' | 'production' | 'test' | 'staging' | undefined;
  readonly sessionTimeoutMs?: number | undefined;
}

export class AuthenticationService implements IAuthenticator {
  private readonly policy: AuthenticationPolicy;
  private readonly config: AuthenticationServiceConfig;

  constructor(
    private readonly principalResolver: IPrincipalResolver,
    private readonly identityResolver?: IIdentityResolver | undefined,
    private readonly credentialProvider?: ICredentialProvider | undefined,
    private readonly eventBus?: IEventBus | undefined,
    config?: AuthenticationServiceConfig,
    private readonly sessionManager?: SessionManager | undefined,
    private readonly credentialLifecycleManager?: CredentialLifecycleManager | undefined
  ) {
    this.config = config ?? {};
    this.policy = new AuthenticationPolicy({
      ...DEFAULT_AUTH_POLICY_CONFIG,
      authRequired: this.config.authRequired ?? true,
      authMode: this.config.authMode ?? 'api_key',
      allowUnsafeDevDefaults: this.config.allowUnsafeDevDefaults ?? false,
      sessionTimeoutMs: this.config.sessionTimeoutMs ?? DEFAULT_AUTH_POLICY_CONFIG.sessionTimeoutMs,
    });
  }

  public async authenticate(input: AuthenticationInput): Promise<AuthenticationResult> {
    try {
      // 1. Policy check on the requested authentication method
      this.policy.validateMethodAllowed(input.method);

      // 2. Dispatch authentication by method
      let principal: SecurityPrincipal | null = null;
      const warnings: string[] = [];

      switch (input.method) {
        case 'LOCAL_DEVELOPMENT': {
          const isProductionLike =
            this.config.environment === 'production' ||
            this.config.environment === 'staging' ||
            process.env.NODE_ENV === 'production' ||
            process.env.NODE_ENV === 'staging';

          if (isProductionLike) {
            return this.fail('PROD_DEV_AUTH_FORBIDDEN', 'Local development authentication is strictly prohibited in production and staging environments');
          }

          if (!this.config.allowUnsafeDevDefaults && this.config.environment !== 'development' && this.config.environment !== 'test' && process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test') {
            return this.fail('PROD_DEV_AUTH_FORBIDDEN', 'Local development authentication is prohibited in non-development environments');
          }

          warnings.push('Authenticated using LOCAL_DEVELOPMENT mode. This must not be used in production.');
          principal = {
            principalId: input.developmentPrincipalId ?? 'dev_principal_default',
            type: 'USER',
            identityId: 'dev_user_default',
            displayName: 'Local Developer',
            status: 'ACTIVE',
            authenticationMethod: 'LOCAL_DEVELOPMENT',
            createdAt: new Date().toISOString(),
          };
          break;
        }

        case 'API_KEY': {
          if (!input.apiKey) {
            return this.fail('MISSING_API_KEY', 'API key is required for API_KEY authentication');
          }

          if (this.credentialLifecycleManager) {
            const credCheck = this.credentialLifecycleManager.validateCredential(input.apiKey);
            if (!credCheck.isValid && credCheck.state !== 'UNKNOWN') {
              return this.fail('CREDENTIAL_INVALID', credCheck.reason ?? 'API key credential is invalid, expired, or revoked');
            }
          }

          if (this.credentialProvider) {
            principal = await this.credentialProvider.verifyCredential(input);
          } else {
            // Default credential lookup via principal resolver
            principal = await this.principalResolver.getPrincipal(input.apiKey);
          }
          break;
        }

        case 'SESSION': {
          if (!input.sessionId) {
            return this.fail('MISSING_SESSION_ID', 'Session ID is required for SESSION authentication');
          }

          if (this.sessionManager) {
            const sessionCheck = this.sessionManager.validateSession(input.sessionId);
            if (!sessionCheck.isValid) {
              return this.fail('SESSION_INVALID', sessionCheck.reason ?? 'Session is not valid or expired');
            }
          }

          principal = await this.principalResolver.getPrincipal(input.sessionId);
          break;
        }

        case 'SERVICE_CREDENTIAL': {
          if (!input.serviceId) {
            return this.fail('MISSING_SERVICE_ID', 'Service ID is required for SERVICE_CREDENTIAL authentication');
          }
          principal = await this.principalResolver.getPrincipal(input.serviceId);
          break;
        }

        case 'SYSTEM': {
          return this.fail('SYSTEM_AUTH_REJECTED', 'External requests cannot authenticate with SYSTEM credentials directly');
        }

        default: {
          return this.fail('UNSUPPORTED_AUTH_METHOD', `Authentication method '${input.method}' is not supported`);
        }
      }

      // 3. Verify principal resolution and active status
      if (!principal) {
        return this.fail('INVALID_CREDENTIALS', 'Invalid authentication credentials provided');
      }

      if (principal.status !== 'ACTIVE') {
        return this.fail('IDENTITY_DISABLED', `Principal '${principal.principalId}' is ${principal.status.toLowerCase()}`);
      }

      // Check linked identity status if identity resolver exists
      if (this.identityResolver) {
        const identity = await this.identityResolver.getIdentity(principal.identityId);
        if (identity && identity.status !== 'ACTIVE') {
          return this.fail('IDENTITY_DISABLED', `Identity '${principal.identityId}' is ${identity.status.toLowerCase()}`);
        }
      }

      // 4. Success emission
      if (this.eventBus) {
        this.eventBus.publish(SECURITY_EVENTS.AUTHENTICATION_SUCCEEDED, {
          principal,
          authenticationMethod: input.method,
          timestamp: new Date().toISOString(),
        });
      }

      return createAuthSuccess(principal, input.method, { warnings });
    } catch (err: any) {
      const code = err.code ?? 'AUTHENTICATION_ERROR';
      return this.fail(code, err.message ?? 'Authentication error');
    }
  }

  private async fail(code: string, message: string): Promise<AuthenticationResult> {
    if (this.eventBus) {
      this.eventBus.publish(SECURITY_EVENTS.AUTHENTICATION_FAILED, {
        reason: message,
        timestamp: new Date().toISOString(),
      });
    }
    return createAuthFailure(code, message);
  }
}
