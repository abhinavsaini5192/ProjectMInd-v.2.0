import type { JobStatus } from './JobStatus.js';

export interface JobResult {
  readonly jobId: string;
  readonly status: JobStatus;
  readonly completedAt: string;
  readonly resultReference?: string | undefined;
  readonly affectedResources?: readonly string[] | undefined;
  readonly durationMs?: number | undefined;
  readonly output?: Readonly<Record<string, unknown>> | unknown | undefined;
  readonly warnings?: readonly string[] | undefined;
  readonly metrics?: Readonly<Record<string, number>> | undefined;
  readonly data?: Readonly<Record<string, unknown>> | undefined;
}
