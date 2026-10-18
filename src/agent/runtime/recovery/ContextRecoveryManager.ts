import type { IAgentContextSessionManager } from '../../context/interfaces/IAgentContextSessionManager.js';

export interface ContextRecoveryResult {
  readonly invalidatedSessions: readonly string[];
  readonly failedSessions: readonly string[];
  readonly warnings: readonly string[];
}

export class ContextRecoveryManager {
  constructor(private readonly contextSessionManager?: IAgentContextSessionManager | undefined) {}

  public async invalidateSessionsForRecovery(
    contextSessionIds: readonly string[]
  ): Promise<ContextRecoveryResult> {
    const invalidated: string[] = [];
    const failed: string[] = [];
    const warnings: string[] = [];

    if (!this.contextSessionManager) {
      return {
        invalidatedSessions: [],
        failedSessions: [],
        warnings: ['Context session manager not available; skipping context invalidation.'],
      };
    }

    for (const sessionId of contextSessionIds) {
      try {
        await this.contextSessionManager.markContextStale(sessionId, 'CONTEXT_INVALIDATED');
        invalidated.push(sessionId);
      } catch (err: unknown) {
        failed.push(sessionId);
        warnings.push(
          `Failed to mark context session '${sessionId}' as stale: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    return {
      invalidatedSessions: invalidated,
      failedSessions: failed,
      warnings,
    };
  }
}
