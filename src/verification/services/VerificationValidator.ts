import type { VerificationRecord } from '../models/VerificationRecord.js';
import type {
  IVerificationValidator,
  VerificationScopeContext,
  VerificationValidationResult,
} from '../interfaces/IVerificationValidator.js';
import { VerificationSecurityValidator } from './VerificationSecurityValidator.js';
import {
  VerificationScopeError,
  VerificationValidationError,
} from '../errors/VerificationError.js';
import { VERIFICATION_TYPES } from '../models/VerificationType.js';
import { VERIFICATION_STATUSES } from '../models/VerificationStatus.js';
import { VERIFICATION_SOURCES } from '../models/VerificationSource.js';

export class VerificationValidator implements IVerificationValidator {
  public async validate(
    record: VerificationRecord,
    scopeContext?: VerificationScopeContext | undefined
  ): Promise<VerificationValidationResult> {
    const errors: string[] = [];

    // 1. Validate payload size
    try {
      this.validatePayloadSize(record);
    } catch (err) {
      if (err instanceof Error) {
        errors.push(err.message);
      }
    }

    // 2. Validate tenant isolation (workspaceId and repositoryId)
    if (!record.workspaceId || typeof record.workspaceId !== 'string') {
      errors.push('VerificationRecord requires a valid non-empty workspaceId');
    }
    if (!record.repositoryId || typeof record.repositoryId !== 'string') {
      errors.push('VerificationRecord requires a valid non-empty repositoryId');
    }

    if (scopeContext) {
      if (scopeContext.workspaceId && record.workspaceId !== scopeContext.workspaceId) {
        errors.push(
          `Tenant violation: record workspaceId '${record.workspaceId}' does not match context workspaceId '${scopeContext.workspaceId}'`
        );
      }
      if (scopeContext.repositoryId && record.repositoryId !== scopeContext.repositoryId) {
        errors.push(
          `Tenant violation: record repositoryId '${record.repositoryId}' does not match context repositoryId '${scopeContext.repositoryId}'`
        );
      }
      if (
        scopeContext.taskId &&
        record.taskId &&
        record.taskId !== scopeContext.taskId
      ) {
        errors.push(
          `Task mismatch: record taskId '${record.taskId}' does not match expected taskId '${scopeContext.taskId}'`
        );
      }
      if (
        scopeContext.agentSessionId &&
        record.agentSessionId &&
        record.agentSessionId !== scopeContext.agentSessionId
      ) {
        errors.push(
          `Session mismatch: record agentSessionId '${record.agentSessionId}' does not match expected agentSessionId '${scopeContext.agentSessionId}'`
        );
      }
    }

    // 3. Validate enum types
    if (!VERIFICATION_TYPES.includes(record.verificationType)) {
      errors.push(`Invalid verificationType: '${record.verificationType}'`);
    }

    if (!VERIFICATION_STATUSES.includes(record.status)) {
      errors.push(`Invalid verification status: '${record.status}'`);
    }

    if (!VERIFICATION_SOURCES.includes(record.source)) {
      errors.push(`Invalid verification source: '${record.source}'`);
    }

    // 4. Validate provenance
    if (!record.provenance) {
      errors.push('VerificationRecord requires provenance');
    } else {
      if (!record.provenance.reportedBy) {
        errors.push('Verification provenance requires non-empty reportedBy');
      }
      if (!record.provenance.receivedAt) {
        errors.push('Verification provenance requires receivedAt timestamp');
      }
    }

    // 5. Validate timestamps
    if (isNaN(Date.parse(record.receivedAt))) {
      errors.push(`Invalid receivedAt timestamp: '${record.receivedAt}'`);
    }
    if (record.startedAt && isNaN(Date.parse(record.startedAt))) {
      errors.push(`Invalid startedAt timestamp: '${record.startedAt}'`);
    }
    if (record.completedAt && isNaN(Date.parse(record.completedAt))) {
      errors.push(`Invalid completedAt timestamp: '${record.completedAt}'`);
    }

    // 6. Validate scope & repository state
    if (!record.scope || !record.scope.scopeType) {
      errors.push('VerificationRecord requires a valid scope with scopeType');
    }
    if (!record.repositoryState || !record.repositoryState.status) {
      errors.push('VerificationRecord requires repositoryState with status');
    }

    // 7. Check for path traversal in target files
    if (record.scope?.targetFiles) {
      for (const file of record.scope.targetFiles) {
        try {
          VerificationSecurityValidator.sanitizeResourcePath(file);
        } catch (err) {
          if (err instanceof Error) {
            errors.push(err.message);
          }
        }
      }
    }

    if (errors.length > 0) {
      const isTenantError = errors.some((e) => e.includes('Tenant violation'));
      if (isTenantError) {
        throw new VerificationScopeError(
          errors.join('; '),
          scopeContext ? `${scopeContext.workspaceId}/${scopeContext.repositoryId}` : 'unknown',
          `${record.workspaceId}/${record.repositoryId}`
        );
      }
      throw new VerificationValidationError(
        `Verification validation failed with ${errors.length} errors: ${errors.join('; ')}`,
        errors
      );
    }

    return {
      isValid: true,
      errors: [],
    };
  }

  public validatePayloadSize(payload: unknown): void {
    VerificationSecurityValidator.validatePayloadSize(payload);
  }
}
