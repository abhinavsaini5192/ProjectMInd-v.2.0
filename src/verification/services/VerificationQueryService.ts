import type { VerificationRecord } from '../models/VerificationRecord.js';
import type { VerificationSummary } from '../models/VerificationSummary.js';
import type { VerificationTimeline } from '../models/VerificationTimeline.js';
import type { VerificationConflict } from '../models/VerificationConflict.js';
import type {
  CompletionEvidence,
  RequiredVerificationCondition,
  ActualVerificationEvidenceItem,
} from '../models/CompletionEvidence.js';
import type { VerificationFreshness } from '../models/VerificationFreshness.js';
import type { VerificationType } from '../models/VerificationType.js';
import type {
  IVerificationQueryService,
  LatestVerificationResult,
} from '../interfaces/IVerificationQueryService.js';
import type { IVerificationStore, VerificationQueryParams } from '../interfaces/IVerificationStore.js';
import type {
  IVerificationFreshnessEvaluator,
  FreshnessEvaluationParams,
} from '../interfaces/IVerificationFreshnessEvaluator.js';
import type { VerificationPolicy } from '../policies/VerificationPolicy.js';
import { DEFAULT_VERIFICATION_POLICY } from '../policies/VerificationPolicy.js';
import { VerificationTimelineBuilder } from './VerificationTimelineBuilder.js';
import { VerificationSummaryGenerator } from './VerificationSummaryGenerator.js';
import { VerificationFreshnessEvaluator } from './VerificationFreshnessEvaluator.js';
import { isTrustedVerification } from '../models/VerificationProvenance.js';

export class VerificationQueryService implements IVerificationQueryService {
  private readonly timelineBuilder = new VerificationTimelineBuilder();
  private readonly summaryGenerator = new VerificationSummaryGenerator();
  private readonly freshnessEvaluator: IVerificationFreshnessEvaluator;

  constructor(
    private readonly store: IVerificationStore,
    freshnessEvaluator?: IVerificationFreshnessEvaluator
  ) {
    this.freshnessEvaluator = freshnessEvaluator ?? new VerificationFreshnessEvaluator();
  }

  public async getVerification(verificationId: string): Promise<VerificationRecord | undefined> {
    return this.store.getVerification(verificationId);
  }

  public async getVerifications(params: VerificationQueryParams): Promise<VerificationRecord[]> {
    return this.store.listVerifications(params);
  }

  public async getTaskVerifications(taskId: string): Promise<VerificationRecord[]> {
    return this.store.listVerifications({ taskId, limit: 200 });
  }

  public async getFeatureVerifications(featureId: string): Promise<VerificationRecord[]> {
    return this.store.listVerifications({ featureId, limit: 200 });
  }

  public async getResourceVerifications(resourcePath: string): Promise<VerificationRecord[]> {
    return this.store.listVerifications({ resourceId: resourcePath, limit: 200 });
  }

  public async getVerificationSummary(
    taskId: string,
    workspaceId: string = 'default-workspace',
    repositoryId: string = 'default-repo'
  ): Promise<VerificationSummary> {
    const records = await this.getTaskVerifications(taskId);
    const conflicts = await this.store.listConflicts(taskId);

    const latest = records[0];
    const freshness = latest
      ? this.freshnessEvaluator.evaluateFreshness(latest)
      : { status: 'UNKNOWN' as const, evaluatedAt: new Date().toISOString() };

    return this.summaryGenerator.generateSummary(
      records,
      conflicts,
      freshness,
      workspaceId,
      repositoryId,
      taskId
    );
  }

  public async getVerificationTimeline(taskId: string): Promise<VerificationTimeline> {
    const records = await this.getTaskVerifications(taskId);
    return this.timelineBuilder.buildTimeline(taskId, records);
  }

  public async getVerificationConflicts(taskId?: string | undefined): Promise<VerificationConflict[]> {
    return this.store.listConflicts(taskId);
  }

  public async getLatestVerification(
    taskId: string,
    type?: VerificationType | undefined
  ): Promise<LatestVerificationResult> {
    const record = await this.store.getLatestVerification(taskId, type);
    if (!record) {
      return {
        record: undefined,
        freshness: undefined,
        conflicts: [],
      };
    }

    const freshness = this.freshnessEvaluator.evaluateFreshness(record);
    const conflicts = await this.store.listConflicts(taskId);

    return {
      record,
      freshness,
      conflicts,
    };
  }

  public async getFreshness(
    verificationId: string,
    currentParams?: FreshnessEvaluationParams | undefined
  ): Promise<VerificationFreshness> {
    const record = await this.store.getVerification(verificationId);
    if (!record) {
      return {
        status: 'UNKNOWN',
        staleReason: `Verification record '${verificationId}' not found`,
        evaluatedAt: new Date().toISOString(),
      };
    }

    return this.freshnessEvaluator.evaluateFreshness(record, currentParams);
  }

  public async getCompletionEvidence(
    taskId: string,
    policy?: VerificationPolicy | undefined,
    currentParams?: FreshnessEvaluationParams | undefined
  ): Promise<CompletionEvidence> {
    const activePolicy: Required<VerificationPolicy> = {
      ...DEFAULT_VERIFICATION_POLICY,
      ...(policy ?? {}),
    };

    const taskRecords = await this.getTaskVerifications(taskId);
    const conflicts = await this.store.listConflicts(taskId);
    const unresolvedConflicts = conflicts.filter((c) => c.resolutionStatus === 'UNRESOLVED');

    const missingConditions: string[] = [];
    const reasons: string[] = [];
    const evaluatedAt = new Date().toISOString();

    const requiredConditions: RequiredVerificationCondition[] = activePolicy.requiredTypes.map(
      (type) => ({
        type,
        trustedRequired: activePolicy.requireTrustedVerification,
      })
    );

    const actualEvidence: ActualVerificationEvidenceItem[] = taskRecords.map((r) => {
      const fresh = this.freshnessEvaluator.evaluateFreshness(r, currentParams);
      return {
        verificationId: r.verificationId,
        type: r.verificationType,
        status: r.status,
        verificationLevel: r.provenance.verificationLevel,
        freshnessStatus: fresh.status,
        scope: r.scope,
        isTrusted: isTrustedVerification(r.provenance),
        verifiedAt: r.completedAt ?? r.receivedAt,
      };
    });

    let hasConflictingEvidence = false;
    let hasStaleEvidence = false;

    // 1. Check for unresolved conflicts
    if (activePolicy.disallowConflicts && unresolvedConflicts.length > 0) {
      hasConflictingEvidence = true;
      missingConditions.push(`Unresolved verification conflicts detected (${unresolvedConflicts.length})`);
      reasons.push(
        `Task has ${unresolvedConflicts.length} conflicting verification report(s) that must be resolved prior to completion.`
      );
    }

    // 2. Check each required verification type
    for (const reqType of activePolicy.requiredTypes) {
      const recordsForType = taskRecords.filter((r) => r.verificationType === reqType);

      if (recordsForType.length === 0) {
        missingConditions.push(`Required verification '${reqType}' is missing`);
        reasons.push(`No verification evidence has been recorded for required type '${reqType}'.`);
        continue;
      }

      // Check latest record for this type
      const latestForType = recordsForType[0]!;

      // Check status
      if (latestForType.status !== 'PASSED') {
        missingConditions.push(
          `Verification '${reqType}' is not PASSED (current: ${latestForType.status})`
        );
        reasons.push(
          `Latest verification for '${reqType}' failed or is inconclusive (${latestForType.status}).`
        );
      }

      // Check freshness
      const fresh = this.freshnessEvaluator.evaluateFreshness(latestForType, currentParams);
      if (activePolicy.disallowStale && fresh.status === 'STALE') {
        hasStaleEvidence = true;
        missingConditions.push(`Verification '${reqType}' is STALE`);
        reasons.push(
          `Verification evidence for '${reqType}' is stale: ${fresh.staleReason ?? 'Repository modified after verification'}.`
        );
      }

      // Check trusted verification requirement
      const isTrusted = isTrustedVerification(latestForType.provenance);
      if (activePolicy.requireTrustedVerification && !isTrusted) {
        missingConditions.push(`Verification '${reqType}' requires trusted verification`);
        reasons.push(
          `Required ${reqType.toLowerCase()} verification exists only as agent-reported evidence and no trusted verification source is available.`
        );
      } else if (!activePolicy.allowAgentReportedOnly && latestForType.provenance.verificationLevel === 'AGENT_REPORTED') {
        missingConditions.push(`Verification '${reqType}' cannot be agent-reported only`);
        reasons.push(
          `Policy does not allow completion with only agent-reported verification for '${reqType}'.`
        );
      }
    }

    const canComplete = missingConditions.length === 0;
    const status = canComplete ? 'READY_TO_COMPLETE' : 'NOT_READY';

    return {
      taskId,
      canComplete,
      status,
      requiredConditions,
      actualEvidence,
      missingConditions,
      reasons,
      confidence: canComplete ? 'HIGH' : 'LOW',
      hasConflictingEvidence,
      hasStaleEvidence,
      evaluatedAt,
    };
  }
}
