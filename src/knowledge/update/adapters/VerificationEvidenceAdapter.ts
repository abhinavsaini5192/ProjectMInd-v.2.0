import type { VerificationRecord } from '../../../verification/models/VerificationRecord.js';
import type { CreateKnowledgeUpdateParams } from '../models/KnowledgeUpdate.js';
import type { KnowledgeUpdateSource } from '../models/KnowledgeUpdateSource.js';
import type { KnowledgeUpdateProvenance } from '../models/KnowledgeUpdateProvenance.js';
import type { KnowledgeArea } from '../models/KnowledgeArea.js';
import type { KnowledgeUpdateReference } from '../models/KnowledgeUpdateReference.js';

export class VerificationEvidenceAdapter {
  public toUpdateParams(record: VerificationRecord): CreateKnowledgeUpdateParams {
    const source: KnowledgeUpdateSource = 'VERIFICATION_EVIDENCE';
    const provenance = this.mapVerificationProvenance(record.provenance.trustLevel);
    const affectedResources = record.scope.targetFiles ? [...record.scope.targetFiles] : [];
    const affectedFeatures = record.scope.featureIds ? [...record.scope.featureIds] : [];
    const affectedKnowledgeAreas: KnowledgeArea[] = [
      'VERIFICATION',
      'FEATURE_HEALTH',
      'FEATURE_RISK',
      'FEATURE_HISTORY',
    ];

    const timestamp = record.completedAt
      ? new Date(record.completedAt).getTime()
      : new Date(record.receivedAt).getTime();

    const ref: KnowledgeUpdateReference = {
      referenceType: 'VERIFICATION',
      referenceId: record.verificationId,
      description: `Verification ${record.verificationType} with status ${record.status}`,
      timestamp,
      metadata: {
        verificationType: record.verificationType,
        status: record.status,
        commitId: record.repositoryState.commitId,
        source: record.source,
      },
    };

    const confidenceScore =
      record.confidence === 'CONFIRMED'
        ? 1.0
        : record.confidence === 'HIGH'
        ? 0.85
        : record.confidence === 'MEDIUM'
        ? 0.65
        : 0.4;

    return {
      sourceEventId: record.verificationId,
      repositoryId: record.repositoryId,
      workspaceId: record.workspaceId,
      taskId: record.taskId,
      agentSessionId: record.agentSessionId ?? record.contextSessionId,
      source,
      provenance,
      updateType: 'VERIFICATION_CHANGED',
      affectedResources,
      affectedFeatures,
      affectedKnowledgeAreas,
      evidenceReferences: [ref],
      requestedAt: Date.now(),
      observedAt: timestamp,
      confidence: confidenceScore,
      metadata: {
        verificationType: record.verificationType,
        verificationStatus: record.status,
        commitId: record.repositoryState.commitId,
        evidence: record.evidence,
      },
    };
  }

  public batchToUpdateParams(records: readonly VerificationRecord[]): CreateKnowledgeUpdateParams[] {
    return records.map((r) => this.toUpdateParams(r));
  }

  private mapVerificationProvenance(trustLevel: string): KnowledgeUpdateProvenance {
    switch (trustLevel) {
      case 'AUTHORITATIVE':
      case 'TRUSTED':
        return 'SYSTEM_VERIFIED';
      case 'SEMI_TRUSTED':
      case 'AGENT_CONFIRMED':
        return 'AGENT_REPORTED';
      case 'UNTRUSTED':
      default:
        return 'UNKNOWN';
    }
  }
}
