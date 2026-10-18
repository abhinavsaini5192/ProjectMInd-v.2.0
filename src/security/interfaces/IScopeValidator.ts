import type { ResourceScope } from '../models/ResourceScope.js';

export interface IScopeValidator {
  validateScope(requestScope: ResourceScope, authorizedScope: ResourceScope): void;
  isScopeAllowed(requestScope: ResourceScope, authorizedScope: ResourceScope): boolean;
}
