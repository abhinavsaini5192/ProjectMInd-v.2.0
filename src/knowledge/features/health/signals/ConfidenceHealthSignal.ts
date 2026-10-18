import type { IFeatureHealthSignal, HealthContext } from '../interfaces/IFeatureHealthSignal.js';
import type { HealthSignal } from '../models/HealthSignal.js';
import type { HealthSignalType } from '../models/HealthSignalType.js';
import { HealthSignalHelper } from './HealthSignalHelper.js';

export class ConfidenceHealthSignal implements IFeatureHealthSignal {
  public readonly id = 'ConfidenceHealthSignal';
  public readonly signalType: HealthSignalType = 'LOW_DISCOVERY_CONFIDENCE';

  public async compute(context: HealthContext): Promise<HealthSignal[]> {
    const signals: HealthSignal[] = [];
    const feature = context.feature;
    const featureId = feature.featureId;
    const lowConfidenceThreshold = context.config?.lowConfidenceThreshold ?? 0.5;

    // Feature discovery confidence (confidence is string 'HIGH' | 'MEDIUM' | 'LOW' or number)
    const discoveryConfidenceRaw: any = feature.confidence;
    let numericDiscoveryConfidence = 0.8;
    if (typeof discoveryConfidenceRaw === 'number') {
      numericDiscoveryConfidence = discoveryConfidenceRaw;
    } else if (discoveryConfidenceRaw === 'LOW' || discoveryConfidenceRaw?.level === 'LOW') {
      numericDiscoveryConfidence = 0.3;
    } else if (discoveryConfidenceRaw === 'MEDIUM' || discoveryConfidenceRaw?.level === 'MEDIUM') {
      numericDiscoveryConfidence = 0.65;
    } else if (discoveryConfidenceRaw === 'HIGH' || discoveryConfidenceRaw?.level === 'HIGH') {
      numericDiscoveryConfidence = 0.9;
    } else if (typeof discoveryConfidenceRaw?.score === 'number') {
      numericDiscoveryConfidence = discoveryConfidenceRaw.score;
    }

    if (numericDiscoveryConfidence < lowConfidenceThreshold) {
      signals.push(
        HealthSignalHelper.createSignal({
          featureId,
          signalType: 'LOW_DISCOVERY_CONFIDENCE',
          severity: numericDiscoveryConfidence < 0.35 ? 'HIGH' : 'MEDIUM',
          value: numericDiscoveryConfidence,
          normalizedValue: Math.round((1 - numericDiscoveryConfidence) * 100),
          description: `Feature discovery confidence is low (${numericDiscoveryConfidence} < ${lowConfidenceThreshold}).`,
          evidence: [
            HealthSignalHelper.createEvidence({
              sourceType: 'FEATURE_DISCOVERY',
              sourceId: featureId,
              evidenceType: 'LOW_DISCOVERY_SCORE',
              description: `Confidence rating for feature is ${discoveryConfidenceRaw}.`,
              confidence: 0.95
            })
          ],
          source: this.id,
          confidence: 0.95
        })
      );
    }

    // Inspect resource mappings confidence
    const mappings = context.mappings || [];
    let lowConfidenceMappings = 0;
    for (const mapping of mappings) {
      const isLow =
        (mapping.confidence as any) === 'LOW' ||
        (typeof (mapping as unknown as { score?: number }).score === 'number' &&
          ((mapping as unknown as { score?: number }).score ?? 1) < 0.4);

      if (isLow) {
        lowConfidenceMappings++;
      }
    }

    if (mappings.length > 0 && lowConfidenceMappings / mappings.length > 0.4) {
      signals.push(
        HealthSignalHelper.createSignal({
          featureId,
          signalType: 'LOW_MAPPING_CONFIDENCE',
          severity: 'MEDIUM',
          value: `${lowConfidenceMappings}/${mappings.length}`,
          normalizedValue: Math.round((lowConfidenceMappings / mappings.length) * 100),
          description: `Over 40% of feature code mappings have low confidence (${lowConfidenceMappings}/${mappings.length}).`,
          evidence: [
            HealthSignalHelper.createEvidence({
              sourceType: 'FEATURE_MAPPING',
              sourceId: featureId,
              evidenceType: 'MAPPING_CONFIDENCE_RATIO',
              description: `Multiple resources have uncertain association with this feature.`,
              confidence: 0.9
            })
          ],
          source: this.id,
          confidence: 0.9
        })
      );
    }

    // Check for stale knowledge flag
    const meta = (feature.metadata || {}) as Record<string, unknown>;
    if (meta.isStale === true) {
      signals.push(
        HealthSignalHelper.createSignal({
          featureId,
          signalType: 'STALE_KNOWLEDGE',
          severity: 'HIGH',
          value: true,
          normalizedValue: 80,
          description: `Feature health and dependency knowledge is marked stale.`,
          evidence: [
            HealthSignalHelper.createEvidence({
              sourceType: 'FEATURE_METADATA',
              sourceId: featureId,
              evidenceType: 'STALENESS_INDICATOR',
              description: `Knowledge cache requires re-indexing.`,
              confidence: 0.95
            })
          ],
          source: this.id,
          confidence: 0.95
        })
      );
    }

    return signals;
  }
}
