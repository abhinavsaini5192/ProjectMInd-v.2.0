export interface SessionRecoveryResult {
  readonly restoredSessionIds: readonly string[];
  readonly expiredSessionIds: readonly string[];
  readonly failedSessionIds: readonly string[];
  readonly warnings: readonly string[];
}

export class SessionRecoveryManager {
  constructor(private readonly sessionTtlMs: number = 3600000) {}

  public reconcileSessions(
    checkpointSessionIds: readonly string[],
    existingSessionIds: ReadonlySet<string>
  ): SessionRecoveryResult {
    const restored: string[] = [];
    const expired: string[] = [];
    const failed: string[] = [];
    const warnings: string[] = [];

    for (const sessionId of checkpointSessionIds) {
      try {
        if (existingSessionIds.has(sessionId)) {
          restored.push(sessionId);
        } else {
          // If session was recorded in checkpoint, mark restored for reconnection
          restored.push(sessionId);
        }
      } catch (err: unknown) {
        failed.push(sessionId);
        warnings.push(
          `Failed to reconcile session '${sessionId}': ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    return {
      restoredSessionIds: restored,
      expiredSessionIds: expired,
      failedSessionIds: failed,
      warnings,
    };
  }
}
