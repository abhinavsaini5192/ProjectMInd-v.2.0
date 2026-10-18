import { describe, it, expect, beforeEach } from 'vitest';
import { AuthenticationService } from '../../src/security/core/AuthenticationService.js';
import { PrincipalResolver } from '../../src/security/core/PrincipalResolver.js';
import { IdentityResolver } from '../../src/security/core/IdentityResolver.js';
import { NodeEventBus } from '../../src/workspace/events/NodeEventBus.js';
import { SECURITY_EVENTS } from '../../src/security/events/SecurityEvents.js';
import type { SecurityPrincipal } from '../../src/security/models/SecurityPrincipal.js';

describe('Phase 8.2 Security — AuthenticationService', () => {
  let identityResolver: IdentityResolver;
  let principalResolver: PrincipalResolver;
  let eventBus: NodeEventBus;
  let authService: AuthenticationService;

  beforeEach(() => {
    eventBus = new NodeEventBus();
    identityResolver = new IdentityResolver(eventBus);
    principalResolver = new PrincipalResolver(identityResolver);
    authService = new AuthenticationService(
      principalResolver,
      identityResolver,
      undefined,
      eventBus,
      {
        authRequired: true,
        authMode: 'api_key',
        allowUnsafeDevDefaults: false,
        environment: 'production',
      }
    );
  });

  it('authenticates valid API_KEY principal and emits event', async () => {
    const principal: SecurityPrincipal = {
      principalId: 'key_12345',
      type: 'AGENT',
      identityId: 'agent_cursor_1',
      status: 'ACTIVE',
      authenticationMethod: 'API_KEY',
      createdAt: new Date().toISOString(),
    };
    await principalResolver.savePrincipal(principal);

    let eventEmitted = false;
    eventBus.subscribe(SECURITY_EVENTS.AUTHENTICATION_SUCCEEDED, (event: any) => {
      expect(event.payload.principal.principalId).toBe('key_12345');
      eventEmitted = true;
    });

    const result = await authService.authenticate({
      method: 'API_KEY',
      apiKey: 'key_12345',
    });

    expect(result.success).toBe(true);
    expect(result.principal?.principalId).toBe('key_12345');
    expect(result.principal?.type).toBe('AGENT');
    expect(eventEmitted).toBe(true);
  });

  it('fails authentication on missing or invalid API key', async () => {
    let failureEmitted = false;
    eventBus.subscribe(SECURITY_EVENTS.AUTHENTICATION_FAILED, () => {
      failureEmitted = true;
    });

    const missingResult = await authService.authenticate({
      method: 'API_KEY',
    });
    expect(missingResult.success).toBe(false);
    expect(missingResult.errorCode).toBe('MISSING_API_KEY');

    const invalidResult = await authService.authenticate({
      method: 'API_KEY',
      apiKey: 'non_existent_key',
    });
    expect(invalidResult.success).toBe(false);
    expect(invalidResult.errorCode).toBe('INVALID_CREDENTIALS');
    expect(failureEmitted).toBe(true);
  });

  it('rejects authentication if principal is disabled', async () => {
    const principal: SecurityPrincipal = {
      principalId: 'disabled_key',
      type: 'USER',
      identityId: 'user_disabled_1',
      status: 'DISABLED',
      authenticationMethod: 'API_KEY',
      createdAt: new Date().toISOString(),
    };
    await principalResolver.savePrincipal(principal);

    const result = await authService.authenticate({
      method: 'API_KEY',
      apiKey: 'disabled_key',
    });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('IDENTITY_DISABLED');
  });

  it('rejects LOCAL_DEVELOPMENT mode in production environment', async () => {
    const result = await authService.authenticate({
      method: 'LOCAL_DEVELOPMENT',
      developmentPrincipalId: 'dev_user',
    });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('PROD_DEV_AUTH_FORBIDDEN');
  });

  it('allows LOCAL_DEVELOPMENT in development mode with warnings', async () => {
    const devAuthService = new AuthenticationService(
      principalResolver,
      identityResolver,
      undefined,
      eventBus,
      {
        authRequired: true,
        authMode: 'development',
        allowUnsafeDevDefaults: true,
        environment: 'development',
      }
    );

    const result = await devAuthService.authenticate({
      method: 'LOCAL_DEVELOPMENT',
      developmentPrincipalId: 'dev_local_1',
    });

    expect(result.success).toBe(true);
    expect(result.principal?.principalId).toBe('dev_local_1');
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('LOCAL_DEVELOPMENT');
  });

  it('rejects external requests claiming SYSTEM method directly', async () => {
    const result = await authService.authenticate({
      method: 'SYSTEM',
    });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('SYSTEM_AUTH_REJECTED');
  });
});
