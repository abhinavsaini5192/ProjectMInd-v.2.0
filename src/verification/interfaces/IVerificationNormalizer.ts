import type { VerificationRecord } from '../models/VerificationRecord.js';
import type { VerificationScopeContext } from './IVerificationValidator.js';

export interface RawVerificationInput {
  readonly verificationId?: string | undefined;
  readonly taskId?: string | undefined;
  readonly contextSessionId?: string | undefined;
  readonly agentSessionId?: string | undefined;
  readonly workspaceId?: string | undefined;
  readonly repositoryId?: string | undefined;
  readonly verificationType?: string | undefined;
  readonly status?: string | undefined;
  readonly passed?: boolean | undefined;
  readonly source?: string | undefined;
  readonly reportedBy?: string | undefined;
  readonly sourceId?: string | undefined;
  readonly confidence?: string | undefined;
  readonly repositoryState?: Record<string, unknown> | undefined;
  readonly scope?: Record<string, unknown> | undefined;
  readonly startedAt?: string | undefined;
  readonly completedAt?: string | undefined;
  readonly duration?: number | undefined;
  readonly summary?: string | undefined;
  readonly diagnostics?: readonly string[] | undefined;
  readonly evidence?: Record<string, unknown> | undefined;
  readonly testResults?: readonly Record<string, unknown>[] | undefined;
  readonly buildPassed?: boolean | undefined;
  readonly correlationId?: string | undefined;
  readonly operationId?: string | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
}

export interface IVerificationNormalizer {
  normalize(
    input: RawVerificationInput,
    scopeContext?: VerificationScopeContext | undefined
  ): VerificationRecord;
}
