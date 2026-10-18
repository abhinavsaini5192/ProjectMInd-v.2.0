import type { IFeatureHealthSignal, HealthContext } from '../interfaces/IFeatureHealthSignal.js';
import type { HealthSignal } from '../models/HealthSignal.js';
import type { HealthSignalType } from '../models/HealthSignalType.js';
import { HealthSignalHelper } from './HealthSignalHelper.js';

export class DependencyHealthSignal implements IFeatureHealthSignal {
  public readonly id = 'DependencyHealthSignal';
  public readonly signalType: HealthSignalType = 'CIRCULAR_FEATURE_DEPENDENCY';

  public async compute(context: HealthContext): Promise<HealthSignal[]> {
    const signals: HealthSignal[] = [];
    const cycles = context.cycles || [];
    const featureId = context.feature.featureId;

    // Check for circular dependencies involving this feature
    const involvedCycles = cycles.filter((c) => (c.cyclePath ?? c.features ?? []).includes(featureId));
    if (involvedCycles.length > 0) {
      for (const cycle of involvedCycles) {
        const cyclePath = cycle.cyclePath ?? cycle.features ?? [];
        signals.push(
          HealthSignalHelper.createSignal({
            featureId,
            signalType: 'CIRCULAR_FEATURE_DEPENDENCY',
            severity: 'CRITICAL',
            value: cyclePath.join(' -> '),
            normalizedValue: 100,
            description: `Circular dependency detected involving this feature: ${cyclePath.join(' -> ')}`,
            evidence: [
              HealthSignalHelper.createEvidence({
                sourceType: 'CYCLE_DETECTION',
                sourceId: cycle.cycleId,
                evidenceType: 'CIRCULAR_DEPENDENCY_PATH',
                description: `Cycle path contains features: ${cyclePath.join(', ')}`,
                strength: 1.0,
                confidence: 0.98,
                metadata: { cycleLength: cycle.length ?? cyclePath.length, cyclePath }
              })
            ],
            source: this.id,
            confidence: 0.98
          })
        );
      }
    }

    // Excessive dependencies
    const dependencies = context.dependencies || [];
    if (dependencies.length > 15) {
      signals.push(
        HealthSignalHelper.createSignal({
          featureId,
          signalType: 'EXCESSIVE_DEPENDENCIES',
          severity: dependencies.length > 25 ? 'CRITICAL' : 'HIGH',
          value: dependencies.length,
          normalizedValue: Math.min(100, dependencies.length * 4),
          description: `Feature has excessive number of direct dependencies (${dependencies.length}).`,
          evidence: [
            HealthSignalHelper.createEvidence({
              sourceType: 'DEPENDENCY_GRAPH',
              sourceId: featureId,
              evidenceType: 'DEPENDENCY_COUNT',
              description: `Outgoing dependencies count is ${dependencies.length}.`,
              confidence: 0.95
            })
          ],
          source: this.id,
          confidence: 0.95
        })
      );
    }

    // Inspect package/library dependencies from mappings metadata
    for (const mapping of context.mappings || []) {
      const meta = (mapping as unknown as { metadata?: Record<string, unknown> }).metadata || {};
      if (meta.isDeprecated === true) {
        signals.push(
          HealthSignalHelper.createSignal({
            featureId,
            signalType: 'DEPRECATED_DEPENDENCY',
            severity: 'HIGH',
            value: mapping.resourceId,
            normalizedValue: 80,
            description: `Resource "${mapping.resourceId}" uses or references a deprecated dependency.`,
            evidence: [
              HealthSignalHelper.createEvidence({
                sourceType: 'MAPPING_RESOURCE',
                sourceId: mapping.resourceId,
                evidenceType: 'DEPRECATION_FLAG',
                description: `Dependency marked deprecated in metadata.`,
                confidence: 0.9
              })
            ],
            source: this.id,
            confidence: 0.9
          })
        );
      }

      if (meta.isUnpinned === true) {
        signals.push(
          HealthSignalHelper.createSignal({
            featureId,
            signalType: 'UNPINNED_DEPENDENCY',
            severity: 'LOW',
            value: mapping.resourceId,
            normalizedValue: 30,
            description: `Resource "${mapping.resourceId}" relies on unpinned version range.`,
            evidence: [
              HealthSignalHelper.createEvidence({
                sourceType: 'MAPPING_RESOURCE',
                sourceId: mapping.resourceId,
                evidenceType: 'VERSION_SPEC',
                description: `Unpinned version dependency.`,
                confidence: 0.85
              })
            ],
            source: this.id,
            confidence: 0.85
          })
        );
      }
    }

    return signals;
  }
}
