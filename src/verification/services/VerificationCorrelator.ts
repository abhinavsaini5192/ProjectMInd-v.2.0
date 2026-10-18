import type { VerificationRecord } from '../models/VerificationRecord.js';
import type {
  IVerificationCorrelator,
  VerificationCorrelationResult,
} from '../interfaces/IVerificationCorrelator.js';

export class VerificationCorrelator implements IVerificationCorrelator {
  public async correlate(
    record: VerificationRecord,
    existingRecords?: readonly VerificationRecord[] | undefined
  ): Promise<VerificationCorrelationResult> {
    const records = existingRecords ?? [];

    // 1. Explicit task ID priority
    if (record.taskId) {
      return {
        correlatedRecord: record,
        correlationStrategy: 'EXPLICIT_TASK',
        correlatedTaskId: record.taskId,
        correlatedSessionId: record.agentSessionId,
        correlatedResourceIds: record.scope.targetFiles ?? [],
        correlatedFeatureIds: record.scope.featureIds ?? [],
      };
    }

    // 2. Report ID / correlation ID priority
    if (record.correlationId) {
      const match = records.find(
        (r) => r.correlationId === record.correlationId || r.verificationId === record.correlationId
      );
      if (match && match.taskId) {
        return {
          correlatedRecord: {
            ...record,
            taskId: match.taskId,
            contextSessionId: record.contextSessionId ?? match.contextSessionId,
            agentSessionId: record.agentSessionId ?? match.agentSessionId,
          },
          correlationStrategy: 'REPORT_ID',
          correlatedTaskId: match.taskId,
          correlatedSessionId: match.agentSessionId,
          correlatedResourceIds: record.scope.targetFiles ?? [],
          correlatedFeatureIds: record.scope.featureIds ?? [],
        };
      }
    }

    // 3. Operation ID priority
    if (record.operationId) {
      const match = records.find((r) => r.operationId === record.operationId);
      if (match && match.taskId) {
        return {
          correlatedRecord: {
            ...record,
            taskId: match.taskId,
            contextSessionId: record.contextSessionId ?? match.contextSessionId,
            agentSessionId: record.agentSessionId ?? match.agentSessionId,
          },
          correlationStrategy: 'OPERATION_ID',
          correlatedTaskId: match.taskId,
          correlatedSessionId: match.agentSessionId,
          correlatedResourceIds: record.scope.targetFiles ?? [],
          correlatedFeatureIds: record.scope.featureIds ?? [],
        };
      }
    }

    // 4. Repository State match (commitId or changeSetId)
    if (record.repositoryState.commitId || record.repositoryState.changeSetId) {
      const match = records.find(
        (r) =>
          r.taskId &&
          ((record.repositoryState.commitId &&
            r.repositoryState.commitId === record.repositoryState.commitId) ||
            (record.repositoryState.changeSetId &&
              r.repositoryState.changeSetId === record.repositoryState.changeSetId))
      );
      if (match && match.taskId) {
        return {
          correlatedRecord: {
            ...record,
            taskId: match.taskId,
          },
          correlationStrategy: 'REPO_STATE',
          correlatedTaskId: match.taskId,
          correlatedSessionId: match.agentSessionId,
          correlatedResourceIds: record.scope.targetFiles ?? [],
          correlatedFeatureIds: record.scope.featureIds ?? [],
        };
      }
    }

    // 5. Resource references match
    if (record.scope.targetFiles && record.scope.targetFiles.length > 0) {
      const targetSet = new Set(record.scope.targetFiles);
      const match = records.find(
        (r) =>
          r.taskId &&
          r.scope.targetFiles &&
          r.scope.targetFiles.some((f) => targetSet.has(f))
      );
      if (match && match.taskId) {
        return {
          correlatedRecord: {
            ...record,
            taskId: match.taskId,
          },
          correlationStrategy: 'RESOURCE_MATCH',
          correlatedTaskId: match.taskId,
          correlatedSessionId: match.agentSessionId,
          correlatedResourceIds: record.scope.targetFiles,
          correlatedFeatureIds: record.scope.featureIds ?? [],
        };
      }
    }

    // 6. Feature references match
    if (record.scope.featureIds && record.scope.featureIds.length > 0) {
      const featSet = new Set(record.scope.featureIds);
      const match = records.find(
        (r) =>
          r.taskId &&
          r.scope.featureIds &&
          r.scope.featureIds.some((f) => featSet.has(f))
      );
      if (match && match.taskId) {
        return {
          correlatedRecord: {
            ...record,
            taskId: match.taskId,
          },
          correlationStrategy: 'FEATURE_MATCH',
          correlatedTaskId: match.taskId,
          correlatedSessionId: match.agentSessionId,
          correlatedResourceIds: record.scope.targetFiles ?? [],
          correlatedFeatureIds: record.scope.featureIds,
        };
      }
    }

    // 7. Session proximity match (never correlate solely by timestamp!)
    if (record.agentSessionId) {
      const match = records.find((r) => r.agentSessionId === record.agentSessionId && r.taskId);
      if (match && match.taskId) {
        return {
          correlatedRecord: {
            ...record,
            taskId: match.taskId,
          },
          correlationStrategy: 'SESSION_PROXIMITY',
          correlatedTaskId: match.taskId,
          correlatedSessionId: record.agentSessionId,
          correlatedResourceIds: record.scope.targetFiles ?? [],
          correlatedFeatureIds: record.scope.featureIds ?? [],
        };
      }
    }

    // Unbound
    return {
      correlatedRecord: record,
      correlationStrategy: 'UNBOUND',
      correlatedResourceIds: record.scope.targetFiles ?? [],
      correlatedFeatureIds: record.scope.featureIds ?? [],
    };
  }
}
