import type { AgentTrustLevel } from '../models/AgentTrustLevel.js';
import type { AgentOperationType } from '../models/AgentOperation.js';
import { AgentScopeError } from '../errors/AgentScopeError.js';

export class AgentTrustModel {
  private static readonly UNTRUSTED_OPS: Set<AgentOperationType> = new Set([
    'GET_CONTEXT',
    'GET_FEATURE',
    'EXPLAIN_CONTEXT',
  ]);

  private static readonly LIMITED_OPS: Set<AgentOperationType> = new Set([
    'GET_CONTEXT',
    'GET_FEATURE',
    'GET_FEATURE_CONTEXT',
    'GET_IMPACT',
    'GET_ARCHITECTURE',
    'GET_HISTORY',
    'GET_HEALTH',
    'EXPLAIN_CONTEXT',
  ]);

  private static readonly TRUSTED_OPS: Set<AgentOperationType> = new Set([
    'GET_CONTEXT',
    'GET_FEATURE',
    'GET_FEATURE_CONTEXT',
    'GET_IMPACT',
    'GET_ARCHITECTURE',
    'GET_HISTORY',
    'GET_HEALTH',
    'EXPLAIN_CONTEXT',
    'REFRESH_CONTEXT',
    'REPORT_EXECUTION',
    'REPORT_VERIFICATION',
  ]);

  /**
   * Evaluates whether an operation is permissible under the given trust level.
   */
  public static isOperationAllowed(trustLevel: AgentTrustLevel, operation: AgentOperationType): boolean {
    switch (trustLevel) {
      case 'UNTRUSTED':
        return this.UNTRUSTED_OPS.has(operation);
      case 'LIMITED':
        return this.LIMITED_OPS.has(operation);
      case 'TRUSTED':
        return this.TRUSTED_OPS.has(operation);
      case 'SYSTEM':
        return true; // All operations permitted
      default:
        return false;
    }
  }

  /**
   * Asserts trust level permission or throws an AgentScopeError.
   */
  public static assertAllowed(trustLevel: AgentTrustLevel, operation: AgentOperationType, agentId?: string): void {
    if (!this.isOperationAllowed(trustLevel, operation)) {
      throw new AgentScopeError(
        `Operation '${operation}' is not permitted for agent '${agentId ?? 'unknown'}' with trust level '${trustLevel}'`,
        { agentId, trustLevel, operation }
      );
    }
  }
}
