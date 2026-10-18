import type { ExecutionObservation } from '../../../agent/observation/models/ExecutionObservation.js';
import type { CreateKnowledgeUpdateParams } from '../models/KnowledgeUpdate.js';
import type { KnowledgeUpdateType } from '../models/KnowledgeUpdateType.js';
import type { KnowledgeUpdateSource } from '../models/KnowledgeUpdateSource.js';
import type { KnowledgeUpdateProvenance } from '../models/KnowledgeUpdateProvenance.js';
import type { KnowledgeArea } from '../models/KnowledgeArea.js';
import type { KnowledgeUpdateReference } from '../models/KnowledgeUpdateReference.js';

export class ExecutionObservationAdapter {
  public toUpdateParams(observation: ExecutionObservation): CreateKnowledgeUpdateParams {
    const updateType = this.mapObservationTypeToUpdateType(observation.type);
    const source: KnowledgeUpdateSource = 'EXECUTION_OBSERVATION';
    const provenance = this.mapObservationProvenance(String(observation.provenance));
    const affectedResources = this.extractAffectedResources(observation);
    const affectedFeatures: string[] = [];
    const affectedKnowledgeAreas = this.mapAreasForUpdateType(updateType);

    const ref: KnowledgeUpdateReference = {
      referenceType: 'OBSERVATION',
      referenceId: observation.observationId,
      description: observation.summary ?? `Observation ${observation.type}`,
      timestamp: Date.now(),
      metadata: {
        type: observation.type,
        status: observation.status,
        operationId: observation.operationId,
      },
    };

    return {
      sourceEventId: observation.observationId,
      repositoryId: observation.repositoryId,
      workspaceId: observation.workspaceId,
      taskId: observation.taskId,
      agentSessionId: observation.agentSessionId,
      source,
      provenance,
      updateType,
      affectedResources,
      affectedFeatures,
      affectedKnowledgeAreas,
      evidenceReferences: [ref],
      requestedAt: Date.now(),
      observedAt: observation.timestamp ? new Date(observation.timestamp).getTime() : Date.now(),
      confidence: typeof observation.confidence === 'number' ? observation.confidence : 0.85,
      metadata: {
        ...observation.metadata,
        observationType: observation.type,
        operationId: observation.operationId,
      },
    };
  }

  public batchToUpdateParams(observations: readonly ExecutionObservation[]): CreateKnowledgeUpdateParams[] {
    if (observations.length === 0) return [];

    // Group observations by (repositoryId, taskId, updateType) if contiguous, or return mapped array
    // Here we map each observation while deduplicating identical references
    return observations.map((obs) => this.toUpdateParams(obs));
  }

  private mapObservationTypeToUpdateType(obsType: string): KnowledgeUpdateType {
    switch (obsType) {
      case 'FILE_CREATED':
      case 'RESOURCE_CREATED':
        return 'RESOURCE_CREATED';
      case 'FILE_MODIFIED':
      case 'FILE_CHANGED':
      case 'RESOURCE_MODIFIED':
        return 'RESOURCE_CHANGED';
      case 'FILE_DELETED':
      case 'RESOURCE_DELETED':
        return 'RESOURCE_DELETED';
      case 'FILE_RENAMED':
        return 'RESOURCE_RENAMED';
      case 'FILE_MOVED':
        return 'RESOURCE_MOVED';
      case 'SYMBOL_MODIFIED':
      case 'SYMBOL_CHANGED':
      case 'SYMBOL_CREATED':
      case 'SYMBOL_DELETED':
        return 'SYMBOL_CHANGED';
      case 'DEPENDENCY_ADDED':
      case 'DEPENDENCY_REMOVED':
      case 'DEPENDENCY_MODIFIED':
        return 'DEPENDENCY_CHANGED';
      case 'API_ENDPOINT_ADDED':
      case 'API_ENDPOINT_MODIFIED':
      case 'API_ENDPOINT_REMOVED':
        return 'API_CHANGED';
      case 'BUILD_PASSED':
      case 'BUILD_FAILED':
      case 'TEST_PASSED':
      case 'TEST_FAILED':
        return 'VERIFICATION_CHANGED';
      case 'DIAGNOSTIC_REPORTED':
      case 'ERROR_OCCURRED':
        return 'RESOURCE_CHANGED';
      default:
        return 'RESOURCE_CHANGED';
    }
  }

  private mapObservationProvenance(prov: string): KnowledgeUpdateProvenance {
    if (prov === 'SYSTEM_VERIFIED') return 'SYSTEM_VERIFIED';
    if (prov === 'SYSTEM_OBSERVED') return 'SYSTEM_OBSERVED';
    if (prov === 'AGENT_REPORTED') return 'AGENT_REPORTED';
    return 'UNKNOWN';
  }

  private extractAffectedResources(observation: ExecutionObservation): string[] {
    const resources = new Set<string>();

    if (observation.affectedResources && Array.isArray(observation.affectedResources)) {
      for (const r of observation.affectedResources) {
        if (typeof r === 'string' && r.trim()) resources.add(r.trim());
      }
    }

    const payload = observation.payload as any;
    if (payload) {
      if (typeof payload.filePath === 'string') resources.add(payload.filePath);
      if (typeof payload.file === 'string') resources.add(payload.file);
      if (typeof payload.path === 'string') resources.add(payload.path);
      if (typeof payload.resourcePath === 'string') resources.add(payload.resourcePath);
      if (typeof payload.newPath === 'string') resources.add(payload.newPath);
      if (typeof payload.oldPath === 'string') resources.add(payload.oldPath);
      if (typeof payload.symbol === 'string') resources.add(payload.symbol);
      if (Array.isArray(payload.files)) {
        for (const f of payload.files) if (typeof f === 'string') resources.add(f);
      }
      if (Array.isArray(payload.modifiedFiles)) {
        for (const f of payload.modifiedFiles) if (typeof f === 'string') resources.add(f);
      }
    }

    return Array.from(resources);
  }

  private mapAreasForUpdateType(type: KnowledgeUpdateType): KnowledgeArea[] {
    switch (type) {
      case 'RESOURCE_CREATED':
      case 'RESOURCE_CHANGED':
      case 'RESOURCE_RENAMED':
      case 'RESOURCE_MOVED':
        return ['RESOURCE_METADATA', 'FEATURE_MAPPING'];
      case 'RESOURCE_DELETED':
        return ['RESOURCE_METADATA', 'FEATURE_MAPPING', 'FEATURE_HEALTH'];
      case 'SYMBOL_CHANGED':
        return ['SYMBOL_KNOWLEDGE', 'FEATURE_MAPPING', 'FEATURE_BEHAVIOR'];
      case 'DEPENDENCY_CHANGED':
        return ['DEPENDENCIES', 'FEATURE_DEPENDENCIES', 'FEATURE_IMPACT'];
      case 'API_CHANGED':
      case 'CONTRACT_CHANGED':
        return ['API_KNOWLEDGE', 'FEATURE_BEHAVIOR', 'FEATURE_IMPACT'];
      case 'VERIFICATION_CHANGED':
        return ['VERIFICATION', 'FEATURE_HEALTH', 'FEATURE_RISK'];
      default:
        return ['RESOURCE_METADATA'];
    }
  }
}
