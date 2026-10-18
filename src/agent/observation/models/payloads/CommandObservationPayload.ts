export interface CommandObservationPayload {
  readonly command: string;
  readonly status: 'STARTED' | 'COMPLETED' | 'FAILED';
  readonly exitCode?: number | undefined;
  readonly durationMs?: number | undefined;
  readonly redactedArgs?: readonly string[] | undefined;
  readonly summary?: string | undefined;
}
