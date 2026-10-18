import type { SecurityPrincipal } from '../models/SecurityPrincipal.js';
import type { PermissionAction } from '../models/PermissionAction.js';
import type { ResourceType } from '../models/ResourceType.js';
import type { ResourceScope } from '../models/ResourceScope.js';
import type { SecurityContext } from '../models/SecurityContext.js';
import type { AuthorizationResult } from '../models/AuthorizationResult.js';

export interface AuthorizationRequest {
  readonly principal: SecurityPrincipal;
  readonly action: PermissionAction;
  readonly resourceType: ResourceType;
  readonly resourceId?: string | undefined;
  readonly scope: ResourceScope;
  readonly context?: SecurityContext | undefined;
}

export interface IAuthorizer {
  authorize(request: AuthorizationRequest): Promise<AuthorizationResult>;
}
