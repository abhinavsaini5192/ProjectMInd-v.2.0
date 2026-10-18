import type { VerificationRecord } from '../models/VerificationRecord.js';

export interface VerificationScopeContext {
  readonly workspaceId: string;
  readonly repositoryId: string;
  readonly agentSessionId?: string | undefined;
  readonly taskId?: string | undefined;
}

export interface VerificationValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly string[];
}

export interface IVerificationValidator {
  validate(
    record: VerificationRecord,
    scopeContext?: VerificationScopeContext | undefined
  ): Promise<VerificationValidationResult>;
  validatePayloadSize(payload: unknown): void;
}
