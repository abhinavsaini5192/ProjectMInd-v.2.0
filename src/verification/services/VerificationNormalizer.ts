import { randomUUID } from 'crypto';
import type { VerificationRecord } from '../models/VerificationRecord.js';

import type { VerificationType } from '../models/VerificationType.js';
import type { VerificationStatus } from '../models/VerificationStatus.js';
import type { VerificationSource } from '../models/VerificationSource.js';
import type { VerificationConfidence } from '../models/VerificationConfidence.js';
import type { VerificationRepositoryState } from '../models/VerificationRepositoryState.js';
import type { VerificationScopeDefinition } from '../models/VerificationScope.js';
import type { VerificationEvidence } from '../models/VerificationEvidence.js';
import type { TestVerificationResult } from '../models/results/TestVerificationResult.js';
import type { BuildVerificationResult } from '../models/results/BuildVerificationResult.js';
import type {
  IVerificationNormalizer,
  RawVerificationInput,
} from '../interfaces/IVerificationNormalizer.js';
import type { VerificationScopeContext } from '../interfaces/IVerificationValidator.js';
import type { IVerificationSourceTrustRegistry } from '../interfaces/IVerificationSourceTrustRegistry.js';
import { VerificationSourceTrustRegistry } from './VerificationSourceTrustRegistry.js';
import { VerificationSecurityValidator } from './VerificationSecurityValidator.js';
import { VERIFICATION_TYPES } from '../models/VerificationType.js';
import { VERIFICATION_STATUSES } from '../models/VerificationStatus.js';
import { VERIFICATION_SOURCES } from '../models/VerificationSource.js';

export class VerificationNormalizer implements IVerificationNormalizer {
  private readonly trustRegistry: IVerificationSourceTrustRegistry;

  constructor(trustRegistry?: IVerificationSourceTrustRegistry) {
    this.trustRegistry = trustRegistry ?? new VerificationSourceTrustRegistry();
  }

  public normalize(
    input: RawVerificationInput,
    scopeContext?: VerificationScopeContext | undefined
  ): VerificationRecord {
    // 1. Determine tenant IDs
    const workspaceId =
      input.workspaceId ?? scopeContext?.workspaceId ?? 'default-workspace';
    const repositoryId =
      input.repositoryId ?? scopeContext?.repositoryId ?? 'default-repo';
    const agentSessionId =
      input.agentSessionId ?? scopeContext?.agentSessionId;
    const taskId = input.taskId ?? scopeContext?.taskId;

    // 2. Normalize Source & Provenance
    const rawSource = (input.source ?? 'AGENT').toUpperCase();
    const source: VerificationSource = VERIFICATION_SOURCES.includes(rawSource as any)
      ? (rawSource as VerificationSource)
      : 'UNKNOWN';

    // Anti-forging check (Section 48)
    VerificationSecurityValidator.assertNoForgedProvenance(
      (input as Record<string, unknown>) ?? {},
      source
    );

    const provenance = this.trustRegistry.resolveProvenance(
      source,
      input.reportedBy ?? source,
      input.sourceId,
      input.startedAt ?? input.completedAt
    );

    // 3. Normalize Verification Type
    const rawType = (input.verificationType ?? 'TEST').toUpperCase();
    const verificationType: VerificationType = VERIFICATION_TYPES.includes(rawType as any)
      ? (rawType as VerificationType)
      : 'UNKNOWN';

    // 4. Normalize Status (Never infer PASSED from completion)
    const status = this.normalizeStatus(input);

    // 5. Normalize Confidence
    const rawConf = (input.confidence ?? 'MEDIUM').toUpperCase();
    const confidence: VerificationConfidence = (
      ['CONFIRMED', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'].includes(rawConf)
        ? rawConf
        : 'UNKNOWN'
    ) as VerificationConfidence;

    // 6. Normalize Repository State
    const repositoryState: VerificationRepositoryState = this.normalizeRepositoryState(
      input.repositoryState
    );

    // 7. Normalize Scope
    const scope: VerificationScopeDefinition = this.normalizeScope(input.scope, taskId);

    // 8. Normalize Timestamps & Duration
    const receivedAt = new Date().toISOString();
    const startedAt = input.startedAt
      ? new Date(input.startedAt).toISOString()
      : undefined;
    const completedAt = input.completedAt
      ? new Date(input.completedAt).toISOString()
      : startedAt;
    const duration =
      typeof input.duration === 'number' && input.duration >= 0
        ? input.duration
        : startedAt && completedAt
          ? Math.max(0, new Date(completedAt).getTime() - new Date(startedAt).getTime())
          : undefined;

    // 9. Sanitize Summary & Diagnostics
    const summary = VerificationSecurityValidator.sanitizeText(
      input.summary ?? `${verificationType} reported by ${source}: ${status}`
    );
    const diagnostics = VerificationSecurityValidator.sanitizeDiagnostics(
      input.diagnostics ?? []
    );

    // 10. Normalize Evidence
    const evidence = this.normalizeEvidence(input, status, summary, repositoryState, provenance);

    // 11. Sanitize Metadata & Hidden Reasoning
    const sanitizedMeta = VerificationSecurityValidator.sanitizeHiddenReasoning(
      (input.metadata as Record<string, unknown>) ?? {},
      false
    );

    return {
      verificationId: input.verificationId ?? `verif_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
      taskId,

      contextSessionId: input.contextSessionId,
      agentSessionId,
      workspaceId,
      repositoryId,
      verificationType,
      status,
      source,
      provenance,
      confidence,
      repositoryState,
      scope,
      startedAt,
      completedAt,
      receivedAt,
      duration,
      summary,
      diagnostics,
      evidence,
      correlationId: input.correlationId,
      operationId: input.operationId,
      metadata: sanitizedMeta,
    };
  }

  private normalizeStatus(input: RawVerificationInput): VerificationStatus {
    // If explicit passed boolean is provided
    if (typeof input.passed === 'boolean') {
      return input.passed ? 'PASSED' : 'FAILED';
    }

    if (typeof input.buildPassed === 'boolean') {
      return input.buildPassed ? 'PASSED' : 'FAILED';
    }

    if (input.status) {
      const upper = input.status.toUpperCase();
      if (VERIFICATION_STATUSES.includes(upper as any)) {
        return upper as VerificationStatus;
      }
      if (upper === 'SUCCESS' || upper === 'PASS') return 'PASSED';
      if (upper === 'FAILURE' || upper === 'FAIL' || upper === 'ERROR') return 'FAILED';
      if (upper === 'SKIP') return 'SKIPPED';
      if (upper === 'CANCEL') return 'CANCELLED';
      if (upper === 'IN_PROGRESS' || upper === 'RUNNING') return 'RUNNING';
    }

    // Never infer PASSED when only completion is stated
    return 'UNKNOWN';
  }

  private normalizeRepositoryState(
    raw?: Record<string, unknown>
  ): VerificationRepositoryState {
    if (!raw || typeof raw !== 'object') {
      return { status: 'UNKNOWN' };
    }

    const commitId = typeof raw['commitId'] === 'string' ? raw['commitId'] : undefined;
    const branch = typeof raw['branch'] === 'string' ? raw['branch'] : undefined;
    const workingTreeHash =
      typeof raw['workingTreeHash'] === 'string' ? raw['workingTreeHash'] : undefined;
    const contextVersion =
      typeof raw['contextVersion'] === 'number' ? raw['contextVersion'] : undefined;
    const knowledgeVersion =
      typeof raw['knowledgeVersion'] === 'number' ? raw['knowledgeVersion'] : undefined;
    const changeSetId =
      typeof raw['changeSetId'] === 'string' ? raw['changeSetId'] : undefined;

    const isBound = Boolean(commitId || workingTreeHash || changeSetId);

    return {
      status: isBound ? 'BOUND' : 'UNKNOWN',
      commitId,
      branch,
      workingTreeHash,
      contextVersion,
      knowledgeVersion,
      changeSetId,
    };
  }

  private normalizeScope(
    raw: Record<string, unknown> | undefined,
    taskId?: string
  ): VerificationScopeDefinition {
    if (!raw || typeof raw !== 'object') {
      return {
        scopeType: taskId ? 'TASK' : 'REPOSITORY',
        targetIds: taskId ? [taskId] : [],
        targetFiles: [],
      };
    }

    const scopeType = (
      typeof raw['scopeType'] === 'string' ? raw['scopeType'].toUpperCase() : taskId ? 'TASK' : 'REPOSITORY'
    ) as any;

    const targetFiles = Array.isArray(raw['targetFiles'])
      ? (raw['targetFiles'] as string[]).map((f) =>
          VerificationSecurityValidator.sanitizeResourcePath(f)
        )
      : [];

    const targetIds = Array.isArray(raw['targetIds'])
      ? (raw['targetIds'] as string[])
      : taskId
        ? [taskId]
        : [];

    return {
      scopeType: scopeType ?? 'TASK',
      targetIds,
      targetFiles,
      featureIds: Array.isArray(raw['featureIds']) ? (raw['featureIds'] as string[]) : undefined,
      symbolNames: Array.isArray(raw['symbolNames']) ? (raw['symbolNames'] as string[]) : undefined,
    };
  }

  private normalizeEvidence(
    input: RawVerificationInput,
    status: VerificationStatus,
    summary: string,
    repositoryState: VerificationRepositoryState,
    provenance: any
  ): VerificationEvidence {
    const rawEvidence = (input.evidence as Record<string, unknown>) ?? {};

    // Normalize test results if present
    let testResults: TestVerificationResult[] | undefined;
    if (Array.isArray(input.testResults)) {
      testResults = input.testResults.map((tr) => ({
        testName: String(tr['testName'] ?? tr['name'] ?? 'unnamed_test'),
        suite: tr['suite'] ? String(tr['suite']) : undefined,
        status: (tr['status'] ? String(tr['status']).toUpperCase() : status) as any,
        duration: typeof tr['duration'] === 'number' ? tr['duration'] : undefined,
        failureSummary: tr['failureSummary'] ? String(tr['failureSummary']) : undefined,
        repositoryState,
        provenance,
      }));
    }

    // Normalize build result if present
    let buildResult: BuildVerificationResult | undefined;
    if (typeof input.buildPassed === 'boolean' || input.verificationType === 'BUILD') {
      buildResult = {
        buildId: input.operationId ?? `build_${Date.now()}`,
        status: status as any,
        repositoryState,
        provenance,
        diagnostics: input.diagnostics,
      };
    }

    return {
      summary,
      testResults,
      buildResult,
      reportReference: input.correlationId,
      ciRunId: rawEvidence['ciRunId'] ? String(rawEvidence['ciRunId']) : undefined,
      artifactReferences: Array.isArray(rawEvidence['artifactReferences'])
        ? (rawEvidence['artifactReferences'] as string[])
        : undefined,
      resourceMappings: Array.isArray(rawEvidence['resourceMappings'])
        ? (rawEvidence['resourceMappings'] as string[])
        : undefined,
      featureMappings: Array.isArray(rawEvidence['featureMappings'])
        ? (rawEvidence['featureMappings'] as string[])
        : undefined,
      metadata: rawEvidence['metadata'] as Record<string, unknown>,
    };
  }
}
