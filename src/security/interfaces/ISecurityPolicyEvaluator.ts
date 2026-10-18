import type { AuthorizationRequest } from './IAuthorizer.js';
import type { SecurityPolicy } from '../models/SecurityPolicy.js';
import type { AuthorizationResult } from '../models/AuthorizationResult.js';

export interface ISecurityPolicyEvaluator {
  evaluatePolicy(request: AuthorizationRequest, policy: SecurityPolicy): AuthorizationResult;
}
