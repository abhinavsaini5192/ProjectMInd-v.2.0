export type TestRunStatus = 'PASSED' | 'FAILED' | 'SKIPPED' | 'BLOCKED' | 'UNKNOWN';

export interface TestObservationPayload {
  readonly testRunId?: string | undefined;
  readonly suite?: string | undefined;
  readonly testName?: string | undefined;
  readonly status: TestRunStatus;
  readonly durationMs?: number | undefined;
  readonly testsPassed?: number | undefined;
  readonly testsFailed?: number | undefined;
  readonly testsSkipped?: number | undefined;
  readonly summary?: string | undefined;
  readonly diagnostics?: readonly string[] | undefined;
}
