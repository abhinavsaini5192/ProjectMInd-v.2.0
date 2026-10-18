import type { AgentOperationType } from '../models/AgentOperation.js';
import type { AgentWorkspaceContext } from '../models/AgentWorkspaceContext.js';
import { AgentOperationError } from '../errors/AgentOperationError.js';
import { AgentScopeError } from '../errors/AgentScopeError.js';

/**
 * Validates that requested operations and payloads strictly stay within ProjectMind's integration boundary.
 */
export class AgentBoundary {
  /**
   * Prohibited property keys that suggest arbitrary execution or filesystem escape attempts.
   */
  private static readonly DISALLOWED_PAYLOAD_KEYS = [
    'exec',
    'execSync',
    'spawn',
    'shellCommand',
    'terminalCommand',
    'eval',
    'bypassSecurity',
  ];

  /**
   * Asserts that the operation and its payload conform to the integration boundary.
   */
  public static assertWithinBoundary(operation: AgentOperationType, payload: unknown): void {
    if (payload && typeof payload === 'object') {
      const obj = payload as Record<string, unknown>;
      for (const key of this.DISALLOWED_PAYLOAD_KEYS) {
        if (key in obj) {
          throw new AgentOperationError(
            `Operation '${operation}' rejected: payload contains disallowed execution property '${key}'. ProjectMind does not execute arbitrary commands.`,
            operation,
            { disallowedKey: key }
          );
        }
      }
    }
  }

  /**
   * Asserts that the workspace context is well-formed and bounded.
   */
  public static assertValidWorkspaceScope(context: AgentWorkspaceContext): void {
    if (!context.workspaceId || typeof context.workspaceId !== 'string' || context.workspaceId.trim() === '') {
      throw new AgentScopeError('Workspace context missing valid workspaceId', { context });
    }
    if (!context.repositoryId || typeof context.repositoryId !== 'string' || context.repositoryId.trim() === '') {
      throw new AgentScopeError('Workspace context missing valid repositoryId', { context });
    }
  }
}
