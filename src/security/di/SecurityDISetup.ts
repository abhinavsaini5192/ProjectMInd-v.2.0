import type { DIContainer } from '../../workspace/di/DIContainer.js';
import { SecurityTokens } from './SecurityTokens.js';
import { IdentityResolver } from '../core/IdentityResolver.js';
import { PrincipalResolver } from '../core/PrincipalResolver.js';
import { RoleResolver } from '../core/RoleResolver.js';
import { PermissionResolver } from '../core/PermissionResolver.js';
import { ScopeValidator } from '../core/ScopeValidator.js';
import { SecurityPolicyEvaluator } from '../core/SecurityPolicyEvaluator.js';
import { AuthenticationService } from '../core/AuthenticationService.js';
import { AuthorizationService } from '../core/AuthorizationService.js';
import { SecurityContextManager } from '../core/SecurityContextManager.js';
import { AuditLogger } from '../core/AuditLogger.js';
import { ToolSecurityAuthorizer } from '../integrations/ToolSecurityAuthorizer.js';
import { CredentialLifecycleManager } from '../governance/CredentialLifecycle.js';
import { SecurityIncidentManager } from '../incident/SecurityIncidentManager.js';
import { SessionManager } from '../session/SessionManager.js';
import type { IEventBus } from '../../events/index.js';

export class SecurityDISetup {
  public static register(container: DIContainer, eventBus?: IEventBus): void {
    // 1. Identity & Principal
    const identityResolver = new IdentityResolver(eventBus);
    const principalResolver = new PrincipalResolver(identityResolver);
    container.registerInstance(SecurityTokens.IdentityResolver, identityResolver);
    container.registerInstance(SecurityTokens.PrincipalResolver, principalResolver);

    // 2. Roles, Permissions, Scope
    const roleResolver = new RoleResolver(eventBus);
    const permissionResolver = new PermissionResolver(roleResolver);
    const scopeValidator = new ScopeValidator(eventBus);
    const policyEvaluator = new SecurityPolicyEvaluator();

    container.registerInstance(SecurityTokens.RoleResolver, roleResolver);
    container.registerInstance(SecurityTokens.PermissionResolver, permissionResolver);
    container.registerInstance(SecurityTokens.ScopeValidator, scopeValidator);
    container.registerInstance(SecurityTokens.SecurityPolicyEvaluator, policyEvaluator);

    // 3. Authentication & Authorization
    const authenticator = new AuthenticationService(
      principalResolver,
      identityResolver,
      undefined,
      eventBus
    );
    const authorizer = new AuthorizationService(
      permissionResolver,
      scopeValidator,
      policyEvaluator,
      undefined,
      eventBus
    );

    container.registerInstance(SecurityTokens.Authenticator, authenticator);
    container.registerInstance(SecurityTokens.Authorizer, authorizer);

    // 4. Context & Audit & Tool Authorizer
    const contextManager = new SecurityContextManager(permissionResolver);
    const auditLogger = new AuditLogger();
    const toolAuthorizer = new ToolSecurityAuthorizer(authorizer);

    container.registerInstance(SecurityTokens.SecurityContextManager, contextManager);
    container.registerInstance(SecurityTokens.AuditLogger, auditLogger);
    container.registerInstance(SecurityTokens.ToolSecurityAuthorizer, toolAuthorizer);

    // 5. Phase 8.9 Governance, Incident & Session
    const credentialManager = new CredentialLifecycleManager();
    const sessionManager = new SessionManager();
    const incidentManager = new SecurityIncidentManager(auditLogger, {
      revokeSession: (sid) => sessionManager.revokeSession(sid, 'contained_due_to_security_incident'),
      disableCredential: (cid) => {
        credentialManager.revokeCredential(cid, 'contained_due_to_security_incident');
        return true;
      },
    });

    container.registerInstance(SecurityTokens.CredentialLifecycleManager, credentialManager);
    container.registerInstance(SecurityTokens.SessionManager, sessionManager);
    container.registerInstance(SecurityTokens.SecurityIncidentManager, incidentManager);
  }
}
