export interface StartupCheckResult {
  readonly checkName: string;
  readonly success: boolean;
  readonly message: string;
  readonly durationMs: number;
  readonly details?: Record<string, unknown> | undefined;
}

export interface StartupRecoveryReport {
  readonly success: boolean;
  readonly isReady: boolean;
  readonly startedAt: number;
  readonly completedAt: number;
  readonly checks: readonly StartupCheckResult[];
  readonly recoveredJobsCount: number;
  readonly purgedLeasesCount: number;
  readonly errors: readonly string[];
}

export interface IStartupRecoveryManager {
  /**
   * Runs the complete startup recovery checklist before service becomes ready.
   */
  executeStartupRecovery(): Promise<StartupRecoveryReport>;

  /**
   * Returns true if startup recovery succeeded and the system is ready for traffic.
   */
  isReady(): boolean;
}
