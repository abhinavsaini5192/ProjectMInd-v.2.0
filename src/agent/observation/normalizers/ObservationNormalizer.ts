import type { ExecutionObservation } from '../models/ExecutionObservation.js';
import type { ObservationSource } from '../models/ObservationSource.js';
import type { ObservationType } from '../models/ObservationType.js';
import type { ObservationProvenance } from '../models/ObservationProvenance.js';
import type { ObservationConfidence } from '../models/ObservationConfidence.js';
import type {
  IObservationNormalizer,
  RawObservationInput,
} from '../interfaces/IObservationNormalizer.js';
import type { ScopeValidationParams } from '../interfaces/IObservationValidator.js';
import { ObservationValidator } from '../validators/ObservationValidator.js';
import { ObservationSecurityValidator } from '../security/ObservationSecurityValidator.js';
import { DEFAULT_OBSERVATION_KNOWLEDGE_POLICY } from '../models/ObservationKnowledgePolicy.js';

export class ObservationNormalizer implements IObservationNormalizer {
  constructor(private readonly validator: ObservationValidator = new ObservationValidator()) {}

  public normalize(input: RawObservationInput, scope?: ScopeValidationParams): ExecutionObservation {
    this.validator.validateRawObservation(input, scope);

    const timestamp = input.timestamp
      ? new Date(input.timestamp).toISOString()
      : new Date().toISOString();

    const observationId =
      input.observationId ?? `obs_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const source: ObservationSource = input.source ?? 'AGENT';
    const type: ObservationType = (input.type as ObservationType) ?? 'TASK_PROGRESS';

    const reportedBy = input.agentSessionId ?? scope?.agentSessionId ?? 'system';
    const provenance = (input as any).provenance ?? this.determineProvenance(source, reportedBy, timestamp);
    const confidence = this.determineConfidence(source, type);

    const rule = DEFAULT_OBSERVATION_KNOWLEDGE_POLICY.rules[type];
    const retention = rule ? rule.defaultRetention : 'TASK_SCOPED';

    // Sanitize metadata to strip hidden reasoning
    const sanitizedMetadata = input.metadata
      ? ObservationSecurityValidator.sanitizeHiddenReasoning(input.metadata, false)
      : {};

    // Sanitize payload
    const sanitizedPayload = this.sanitizePayload(input.payload);

    const workspaceId =
      typeof input.workspaceId === 'string' && input.workspaceId.length > 0
        ? input.workspaceId
        : scope?.workspaceId || 'default-workspace';

    const repositoryId =
      typeof input.repositoryId === 'string' && input.repositoryId.length > 0
        ? input.repositoryId
        : scope?.repositoryId || 'default-repo';

    const summary =
      input.summary ??
      (input.payload && typeof (input.payload as any)['summary'] === 'string'
        ? (input.payload as any)['summary']
        : undefined);

    return {
      observationId,
      taskId: input.taskId ?? scope?.taskId,
      contextSessionId: input.contextSessionId,
      agentSessionId: input.agentSessionId ?? scope?.agentSessionId,
      workspaceId,
      repositoryId,
      source,
      type,
      status: 'NORMALIZED',
      timestamp,
      observedAt: timestamp,
      payload: sanitizedPayload,
      confidence,
      provenance,
      orderingStatus: 'ORDERED',
      ordering: 'ORDERED',
      retention,
      operationId: input.operationId,
      correlationId: input.correlationId,
      metadata: sanitizedMetadata,
      summary,
      sequenceNumber: input.sequenceNumber,
      affectedResources: input.affectedResources,
      parentObservationId: input.parentObservationId,
      category: input.category,
    };
  }

  private determineProvenance(
    source: ObservationSource,
    _reportedBy: string,
    _timestamp: string
  ): string {
    switch (source) {
      case 'VERIFICATION':
        return 'SYSTEM_VERIFIED';
      case 'SYSTEM':
      case 'REPOSITORY':
        return 'SYSTEM_OBSERVED';
      case 'AGENT':
      case 'TOOL':
      case 'MCP':
        return 'AGENT_REPORTED';
      case 'UNKNOWN':
      default:
        return 'UNVERIFIED';
    }
  }

  private determineConfidence(source: ObservationSource, type: ObservationType): ObservationConfidence {
    if (source === 'VERIFICATION') return 'CONFIRMED';
    if (source === 'SYSTEM' || source === 'REPOSITORY') return 'HIGH';
    if (source === 'AGENT') {
      if (type.startsWith('FILE_') || type.startsWith('TEST_') || type.startsWith('BUILD_')) {
        return 'HIGH';
      }
      return 'MEDIUM';
    }
    return 'LOW';
  }

  private sanitizePayload(payload: unknown): Record<string, unknown> {
    if (!payload || typeof payload !== 'object') {
      return {};
    }
    return ObservationSecurityValidator.sanitizePayload(payload);
  }
}
