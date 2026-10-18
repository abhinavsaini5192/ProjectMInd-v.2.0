import type { IJobHandler, JobExecutionContext } from '../registry/IJobHandler.js';
import type { Job } from '../models/Job.js';
import type { JobResult } from '../models/JobResult.js';
import { JobError } from '../models/JobError.js';

export interface VerificationJobPayload {
  readonly verificationId: string;
  readonly verificationType: string;
  readonly source: 'AGENT_REPORTED' | 'SYSTEM_VERIFIED' | 'USER_REPORTED' | 'EXTERNAL_TOOL';
  readonly provenance?: Record<string, unknown> | undefined;
  readonly rules?: readonly string[] | undefined;
  readonly repositoryId?: string | undefined;
}

export class VerificationJobHandler implements IJobHandler<VerificationJobPayload> {
  constructor(private readonly verificationService?: { verify: (payload: VerificationJobPayload) => Promise<{ passed: boolean; violations: number }> } | undefined) {}

  public validate(job: Job<VerificationJobPayload>): void {
    if (!job.payload || !job.payload.verificationId) {
      throw new JobError('JOB_PAYLOAD_INVALID', 'Verification job requires verificationId', false);
    }
    // Section 43 Invariant: Never upgrade AGENT_REPORTED to SYSTEM_VERIFIED without verification
    if (job.payload.source === 'AGENT_REPORTED' && (job.payload as any).upgradedToSystemVerified) {
      throw new JobError('JOB_AUTHORIZATION_FAILED', 'Cannot upgrade AGENT_REPORTED verification without system execution', false);
    }
  }

  public async execute(
    job: Job<VerificationJobPayload>,
    context: JobExecutionContext
  ): Promise<Omit<JobResult, 'jobId' | 'status' | 'completedAt'>> {
    if (context.signal.aborted) {
      throw new JobError('JOB_CANCELLED', 'Job cancelled before execution', false);
    }

    await context.updateProgress(25, 100, 'Processing verification rules');

    let passed = true;
    let violations = 0;

    if (this.verificationService) {
      const res = await this.verificationService.verify(job.payload);
      passed = res.passed;
      violations = res.violations;
    }

    await context.updateProgress(100, 100, 'Verification finished');

    return {
      affectedResources: [job.payload.repositoryId || job.repositoryId || 'unknown'],
      data: {
        verificationId: job.payload.verificationId,
        passed,
        violations,
        preservedSource: job.payload.source,
      },
      metrics: {
        violationsCount: violations,
        passed: passed ? 1 : 0,
      },
    };
  }
}
