import type { FeatureSnapshot } from '../../../../src/knowledge/features/history/models/FeatureSnapshot.js';
import type { FeatureHistoryEvent } from '../../../../src/knowledge/features/history/models/FeatureHistoryEvent.js';
import { createHistoryConfidence } from '../../../../src/knowledge/features/history/models/FeatureHistoryConfidence.js';

export class HistoryTestHelper {
  public static createSnapshot(
    featureId: string,
    options: {
      snapshotId?: string;
      timestamp?: number;
      version?: number;
      resourceCount?: number;
      resources?: string[];
      mappedCount?: number;
      primaryPath?: string;
      dependencyCount?: number;
      dependentCount?: number;
      dependencies?: string[];
      dependents?: string[];
      flowCount?: number;
      flows?: string[];
      entryPointCount?: number;
      entryPoints?: string[];
      healthScore?: number;
      riskScore?: number;
      criticalityScore?: number;
      criticalityLevel?: string;
      status?: string;
    } = {}
  ): FeatureSnapshot {
    const timestamp = options.timestamp || Date.now();
    const resources = options.resources || (options.resourceCount ? Array.from({ length: options.resourceCount }, (_, i) => `src/res_${i}.ts`) : ['src/auth/AuthService.ts']);
    const flows = options.flows || (options.flowCount ? Array.from({ length: options.flowCount }, (_, i) => `flow_${i}`) : ['login_flow']);
    const entryPoints = options.entryPoints || (options.entryPointCount ? Array.from({ length: options.entryPointCount }, (_, i) => `entry_${i}`) : ['/login']);
    const dependencies = options.dependencies || (options.dependencyCount ? Array.from({ length: options.dependencyCount }, (_, i) => `dep_${i}`) : []);
    const dependents = options.dependents || (options.dependentCount ? Array.from({ length: options.dependentCount }, (_, i) => `feat_${i}`) : []);

    return {
      snapshotId: options.snapshotId || `snap_${featureId}_${timestamp}`,
      featureId,
      timestamp,
      version: options.version || 1,
      metadata: { name: featureId },
      resourceSummary: {
        resourceCount: resources.length,
        resources,
      },
      mappingSummary: {
        mappedCount: options.mappedCount ?? resources.length,
        primaryPath: options.primaryPath || resources[0],
        roles: { PRIMARY: resources.length },
      },
      dependencySummary: {
        dependencyCount: dependencies.length,
        dependentCount: dependents.length,
        dependencies,
        dependents,
      },
      behaviorSummary: {
        flowCount: flows.length,
        entryPointCount: entryPoints.length,
        flows,
        entryPoints,
      },
      healthSummary: {
        score: options.healthScore ?? 80,
        status: options.healthScore && options.healthScore >= 70 ? 'HEALTHY' : 'DEGRADED',
      },
      riskSummary: {
        score: options.riskScore ?? 20,
        riskCount: options.riskScore && options.riskScore > 30 ? 2 : 0,
      },
      criticalitySummary: {
        score: options.criticalityScore ?? 30,
        level: options.criticalityLevel ?? 'LOW',
      },
      architectureSummary: {
        layer: 'Domain',
      },
      status: options.status || 'ACTIVE',
      confidence: createHistoryConfidence('HIGH', 0.9, ['Synthetic test snapshot']),
      knowledgeVersion: '1.0.0',
    };
  }

  public static createEvent(
    featureId: string,
    options: {
      eventId?: string;
      eventType?: any;
      evolutionType?: any;
      timestamp?: number;
      sourceSystem?: any;
      provenance?: any;
      dimensions?: string[];
      confidenceScore?: number;
      metadata?: Record<string, any>;
      description?: string;
    } = {}
  ): FeatureHistoryEvent {
    const timestamp = options.timestamp || Date.now();
    const eventType = options.eventType || 'FEATURE_CREATED';
    const evolutionType = options.evolutionType || 'CREATION';

    return {
      eventId: options.eventId || `ev_${featureId}_${timestamp}_${Math.random().toString(36).substring(2, 6)}`,
      featureId,
      eventType,
      evolutionType,
      timestamp,
      source: {
        system: options.sourceSystem || 'LIFECYCLE',
        provenance: options.provenance || 'OBSERVED',
        referenceId: featureId,
      },
      sourceReference: `test:${featureId}`,
      changedDimensions: options.dimensions || ['identity'],
      evidence: [
        {
          type: 'TEST_EVIDENCE',
          description: options.description || `Test event ${eventType}`,
          confidence: options.confidenceScore ?? 0.9,
        },
      ],
      confidence: createHistoryConfidence(
        (options.confidenceScore ?? 0.9) >= 0.85 ? 'VERY_HIGH' : 'HIGH',
        options.confidenceScore ?? 0.9,
        ['Test evidence']
      ),
      knowledgeVersion: '1.0.0',
      metadata: options.metadata,
    };
  }
}
