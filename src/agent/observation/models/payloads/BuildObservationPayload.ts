export interface BuildObservationPayload {
  readonly buildId?: string | undefined;
  readonly commandReference?: string | undefined;
  readonly status: 'STARTED' | 'PASSED' | 'FAILED';
  readonly durationMs?: number | undefined;
  readonly summary?: string | undefined;
  readonly diagnostics?: readonly string[] | undefined;
  readonly artifactsCount?: number | undefined;
}
