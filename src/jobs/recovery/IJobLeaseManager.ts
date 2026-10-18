export interface JobLease {
  readonly jobId: string;
  readonly workerId: string;
  readonly acquiredAtMs: number;
  expiresAtMs: number;
}

export interface IJobLeaseManager {
  acquireLease(jobId: string, workerId: string, ttlMs: number): Promise<boolean>;
  renewLease(jobId: string, workerId: string, ttlMs: number): Promise<boolean>;
  releaseLease(jobId: string, workerId: string): Promise<boolean>;
  getLeaseHolder(jobId: string): Promise<string | null>;
  getExpiredJobIds(): Promise<readonly string[]>;
  clear(): Promise<void>;
}

export const IJobLeaseManagerToken = Symbol('IJobLeaseManager');
