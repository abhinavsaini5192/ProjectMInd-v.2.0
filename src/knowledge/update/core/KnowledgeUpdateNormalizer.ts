import { randomUUID, createHash } from 'crypto';
import type { KnowledgeUpdate, CreateKnowledgeUpdateParams } from '../models/KnowledgeUpdate.js';
import type { KnowledgeUpdateType } from '../models/KnowledgeUpdateType.js';
import type { KnowledgeUpdateProvenance } from '../models/KnowledgeUpdateProvenance.js';
import type { KnowledgeArea } from '../models/KnowledgeArea.js';
import type { KnowledgeUpdateReference } from '../models/KnowledgeUpdateReference.js';

export class KnowledgeUpdateNormalizer {
  public normalize(params: CreateKnowledgeUpdateParams): KnowledgeUpdate {
    const updateId = params.updateId?.trim() || randomUUID();
    const repositoryId = params.repositoryId.trim();
    const workspaceId = params.workspaceId?.trim() || undefined;
    const taskId = params.taskId?.trim() || undefined;
    const agentSessionId = params.agentSessionId?.trim() || undefined;
    const source = params.source;
    const updateType: KnowledgeUpdateType = params.updateType || 'RESOURCE_CHANGED';

    const provenance: KnowledgeUpdateProvenance =
      params.provenance || (source === 'VERIFICATION_EVIDENCE' ? 'SYSTEM_VERIFIED' : 'AGENT_REPORTED');

    const status = params.status || 'RECEIVED';
    const requestedAt = params.requestedAt ?? Date.now();
    const observedAt = params.observedAt ?? requestedAt;
    const retryCount = params.retryCount ?? 0;

    // Normalize and deduplicate affected resources
    const affectedResources = this.normalizeResources(params.affectedResources || []);

    // Normalize and deduplicate affected features
    const affectedFeatures = this.normalizeFeatures(params.affectedFeatures || []);

    // Normalize knowledge areas
    const affectedKnowledgeAreas = this.normalizeAreas(
      params.affectedKnowledgeAreas || [],
      updateType
    );

    // Normalize references
    const evidenceReferences = params.evidenceReferences ? [...params.evidenceReferences] : [];

    // Compute deterministic idempotency key if not supplied
    const idempotencyKey =
      params.idempotencyKey?.trim() ||
      this.computeIdempotencyKey(
        repositoryId,
        params.sourceEventId,
        updateType,
        affectedResources,
        affectedFeatures,
        requestedAt
      );

    const confidence =
      typeof params.confidence === 'number'
        ? Math.max(0.0, Math.min(1.0, params.confidence))
        : 0.85;

    const metadata: Record<string, unknown> = params.metadata ? { ...params.metadata } : {};

    return {
      updateId,
      batchId: params.batchId?.trim() || undefined,
      sourceEventId: params.sourceEventId?.trim() || undefined,
      repositoryId,
      workspaceId,
      taskId,
      agentSessionId,
      source,
      provenance,
      updateType,
      status,
      affectedResources,
      affectedFeatures,
      affectedKnowledgeAreas,
      evidenceReferences,
      previousKnowledgeVersion: params.previousKnowledgeVersion?.trim() || undefined,
      requestedAt,
      observedAt,
      idempotencyKey,
      confidence,
      retryCount,
      lastFailureReason: params.lastFailureReason,
      metadata,
    };
  }

  private normalizeResources(resources: readonly string[]): string[] {
    const normalized = new Set<string>();
    for (const res of resources) {
      if (!res || typeof res !== 'string') continue;
      // Convert backslashes to forward slashes, trim
      let cleaned = res.replace(/\\/g, '/').trim();
      const isSystemPath = /^\/(etc|var|proc|sys|dev|tmp|usr|bin|sbin|opt|windows)[\/]/i.test(cleaned);
      if (!isSystemPath && cleaned.startsWith('/')) {
        cleaned = cleaned.slice(1);
      }
      if (cleaned.endsWith('/') && cleaned.length > 1) {
        cleaned = cleaned.slice(0, -1);
      }
      if (cleaned) normalized.add(cleaned);
    }
    return Array.from(normalized).sort();
  }

  private normalizeFeatures(features: readonly string[]): string[] {
    const normalized = new Set<string>();
    for (const f of features) {
      if (!f || typeof f !== 'string') continue;
      const cleaned = f.trim();
      if (cleaned) normalized.add(cleaned);
    }
    return Array.from(normalized).sort();
  }

  private normalizeAreas(areas: readonly KnowledgeArea[], type: KnowledgeUpdateType): KnowledgeArea[] {
    const areaSet = new Set<KnowledgeArea>(areas);
    if (areaSet.size === 0) {
      // Default area inference
      if (type === 'VERIFICATION_CHANGED') {
        areaSet.add('VERIFICATION');
        areaSet.add('FEATURE_HEALTH');
      } else if (type.startsWith('FEATURE_')) {
        areaSet.add('FEATURE_MAPPING');
      } else {
        areaSet.add('RESOURCE_METADATA');
      }
    }
    return Array.from(areaSet).sort();
  }

  private computeIdempotencyKey(
    repositoryId: string,
    sourceEventId: string | undefined,
    updateType: KnowledgeUpdateType,
    resources: readonly string[],
    features: readonly string[],
    timestamp: number
  ): string {
    if (sourceEventId) {
      return createHash('sha256')
        .update(`${repositoryId}:${sourceEventId}:${updateType}`)
        .digest('hex');
    }
    // 5-second window bucket to deduplicate rapid duplicate events
    const timeWindow = Math.floor(timestamp / 5000);
    const content = `${repositoryId}:${updateType}:${resources.join(',')}:${features.join(',')}:${timeWindow}`;
    return createHash('sha256').update(content).digest('hex');
  }
}
