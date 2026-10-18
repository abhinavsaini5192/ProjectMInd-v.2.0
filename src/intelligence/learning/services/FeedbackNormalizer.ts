import { createHash } from 'node:crypto';
import type { IFeedbackNormalizer } from '../interfaces/IFeedbackNormalizer.js';
import type { Feedback, RawFeedbackInput } from '../models/Feedback.js';
import type { FeedbackSignal } from '../models/FeedbackSignal.js';
import type { FeedbackType } from '../models/FeedbackType.js';
import type { LearningAuthority } from '../models/LearningAuthority.js';
import type { LearningScopeRef, ScopeLevel } from '../models/LearningScope.js';
import {
  FeedbackValidationError,
  FeedbackPoisoningError,
  ScopeViolationError,
} from '../errors/LearningError.js';

export class FeedbackNormalizer implements IFeedbackNormalizer {
  private static readonly INJECTION_PATTERNS = [
    /ignore\s+(all\s+)?previous\s+instructions/i,
    /system\s*:\s*you\s+are\s+now/i,
    /<\|im_start\|>/i,
    /<\|endoftext\|>/i,
    /drop\s+table/i,
    /sudo\s+rm\s+-rf/i,
  ];

  public async normalize(input: RawFeedbackInput): Promise<Feedback> {
    // 1. Mandatory Fields Validation
    if (!input.workspaceId || typeof input.workspaceId !== 'string') {
      throw new FeedbackValidationError('Feedback requires a valid non-empty workspaceId.');
    }
    if (!input.projectId || typeof input.projectId !== 'string') {
      throw new FeedbackValidationError('Feedback requires a valid non-empty projectId.');
    }
    if (!input.sourceType) {
      throw new FeedbackValidationError('Feedback requires a valid sourceType.');
    }
    if (!input.sourceId) {
      throw new FeedbackValidationError('Feedback requires a valid sourceId.');
    }
    if (!input.feedbackType) {
      throw new FeedbackValidationError('Feedback requires a valid feedbackType.');
    }
    if (!input.targetType || !input.targetId) {
      throw new FeedbackValidationError('Feedback requires targetType and targetId.');
    }

    // 2. Security & Poisoning Detection (untoward prompt injection in metadata or references)
    this.detectPoisoning(input);

    // 3. Resolve Authority & Provenance
    const isExplicit = input.provenance?.isExplicit ?? input.sourceType === 'USER';
    const authority = this.resolveAuthority(input.sourceType, isExplicit, input.provenance?.authority);

    // 4. Resolve Scope (Default toward narrowest valid scope; never allow unauthorized GLOBAL)
    const scope = this.resolveScope(input, authority);

    // 5. Derive Directional Signal & Normalized Value
    const signal = input.signal ?? this.deriveSignalFromType(input.feedbackType);
    const value = this.normalizeValue(input.value, signal);

    // 6. Assign Confidence
    const confidence = this.computeConfidence(input.confidence, authority, isExplicit);

    // 7. Deduplication Key
    const deduplicationKey = this.generateDeduplicationKey(input);

    // 8. Assemble Canonical Feedback
    const now = Date.now();
    const id = `fb_${now}_${createHash('sha256').update(deduplicationKey + Math.random()).digest('hex').slice(0, 10)}`;

    return {
      id,
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      repositoryIds: input.repositoryIds ?? [],
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      feedbackType: input.feedbackType,
      targetType: input.targetType,
      targetId: input.targetId,
      signal,
      value,
      confidence,
      provenance: {
        origin: input.provenance?.origin ?? `source:${input.sourceType.toLowerCase()}`,
        isExplicit,
        authority,
        actorId: input.provenance?.actorId ?? input.sourceId,
        actorRole: input.provenance?.actorRole,
        verificationId: input.provenance?.verificationId,
        verificationPassed: input.provenance?.verificationPassed,
        sessionId: input.sessionReference ?? input.provenance?.sessionId,
        correlationId: input.provenance?.correlationId,
      },
      scope,
      timestamp: now,
      contextReference: input.contextReference,
      taskReference: input.taskReference,
      sessionReference: input.sessionReference,
      planReference: input.planReference,
      evidenceReferences: input.evidenceReferences ?? [],
      metadata: input.metadata ? { ...input.metadata } : {},
      deduplicationKey,
    };
  }

  private detectPoisoning(input: RawFeedbackInput): void {
    const rawToCheck: string[] = [input.targetId];
    if (input.metadata) {
      for (const val of Object.values(input.metadata)) {
        if (typeof val === 'string') rawToCheck.push(val);
      }
    }

    for (const text of rawToCheck) {
      for (const pattern of FeedbackNormalizer.INJECTION_PATTERNS) {
        if (pattern.test(text)) {
          throw new FeedbackPoisoningError(
            `Malicious or adversarial prompt pattern detected in feedback: ${pattern}`,
            { text }
          );
        }
      }
    }
  }

  private resolveAuthority(
    sourceType: string,
    isExplicit: boolean,
    declaredAuthority?: LearningAuthority
  ): LearningAuthority {
    if (declaredAuthority === 'APPROVED' || declaredAuthority === 'DEPLOYED') {
      // Must not be self-declared from untrusted input
      return sourceType === 'USER' ? 'USER_REPORTED' : 'DERIVED';
    }

    if (sourceType === 'USER') {
      return 'USER_REPORTED';
    }
    if (sourceType === 'VERIFICATION') {
      return 'VERIFIED';
    }
    if (sourceType === 'AGENT' || sourceType === 'CONTEXT' || sourceType === 'RETRIEVAL' || sourceType === 'PLAN') {
      return isExplicit ? 'AGENT_REPORTED' : (declaredAuthority ?? 'OBSERVED');
    }
    return declaredAuthority ?? 'OBSERVED';
  }

  private resolveScope(input: RawFeedbackInput, authority: LearningAuthority): LearningScopeRef {
    let level: ScopeLevel = input.scope?.level ?? 'RESOURCE';

    // Prevent unauthorized GLOBAL scope promotion from automated agents
    if (level === 'GLOBAL' && authority !== 'USER_REPORTED' && authority !== 'APPROVED') {
      throw new ScopeViolationError(
        'Automated or untrusted feedback cannot declare GLOBAL scope. Scope must be bounded to PROJECT or narrower.'
      );
    }

    // Default scope value
    const value = input.scope?.value ?? input.targetId;

    return {
      level,
      value,
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      repositoryId: input.scope?.repositoryId ?? input.repositoryIds?.[0],
    };
  }

  private deriveSignalFromType(type: FeedbackType): FeedbackSignal {
    switch (type) {
      case 'CONTEXT_USEFUL':
      case 'RETRIEVAL_RELEVANT':
      case 'PLAN_GOOD':
      case 'TASK_ASSIGNMENT_GOOD':
      case 'TASK_PRIORITY_GOOD':
      case 'VERIFICATION_SUFFICIENT':
      case 'AGENT_HANDOFF_GOOD':
      case 'FEATURE_MAPPING_CORRECT':
      case 'MEMORY_USEFUL':
      case 'EXPLANATION_USEFUL':
        return 'POSITIVE';

      case 'CONTEXT_IRRELEVANT':
      case 'CONTEXT_MISSING':
      case 'CONTEXT_TOO_LARGE':
      case 'CONTEXT_TOO_SMALL':
      case 'RETRIEVAL_IRRELEVANT':
      case 'RETRIEVAL_MISSED':
      case 'PLAN_BAD':
      case 'PLAN_INCOMPLETE':
      case 'PLAN_OVER_DECOMPOSED':
      case 'PLAN_UNDER_DECOMPOSED':
      case 'TASK_ASSIGNMENT_BAD':
      case 'TASK_PRIORITY_BAD':
      case 'VERIFICATION_INSUFFICIENT':
      case 'AGENT_HANDOFF_BAD':
      case 'FEATURE_MAPPING_INCORRECT':
      case 'MEMORY_IRRELEVANT':
      case 'EXPLANATION_UNCLEAR':
        return 'NEGATIVE';

      case 'USER_CORRECTION':
      case 'ERROR_CORRECTED':
        return 'CORRECTION';

      default:
        return 'NEUTRAL';
    }
  }

  private normalizeValue(declaredValue?: number, signal?: FeedbackSignal): number {
    if (declaredValue !== undefined) {
      return Math.min(1.0, Math.max(-1.0, declaredValue));
    }
    if (signal === 'POSITIVE') return 1.0;
    if (signal === 'NEGATIVE') return -1.0;
    if (signal === 'CORRECTION') return 0.5;
    return 0.0;
  }

  private computeConfidence(
    declaredConfidence: number | undefined,
    authority: LearningAuthority,
    isExplicit: boolean
  ): number {
    if (declaredConfidence !== undefined) {
      return Math.min(1.0, Math.max(0.0, declaredConfidence));
    }

    // Default confidence based on authority and explicit vs implicit
    switch (authority) {
      case 'USER_REPORTED':
        return isExplicit ? 0.95 : 0.85;
      case 'VERIFIED':
        return 0.90;
      case 'AGENT_REPORTED':
        return isExplicit ? 0.70 : 0.50;
      case 'OBSERVED':
      default:
        return isExplicit ? 0.60 : 0.40;
    }
  }

  private generateDeduplicationKey(input: RawFeedbackInput): string {
    const raw = `${input.workspaceId}:${input.projectId}:${input.sourceType}:${input.sourceId}:${input.feedbackType}:${input.targetType}:${input.targetId}:${input.contextReference ?? ''}:${input.taskReference ?? ''}`;
    return createHash('sha256').update(raw).digest('hex').slice(0, 32);
  }
}
