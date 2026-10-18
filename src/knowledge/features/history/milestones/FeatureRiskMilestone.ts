import type { FeatureMilestone } from '../models/FeatureMilestone.js';
import { createHistoryConfidence } from '../models/FeatureHistoryConfidence.js';

export class FeatureRiskMilestone {
  public static create(
    featureId: string,
    timestamp: number,
    isRiskReduction: boolean,
    relatedEventIds: string[] = [],
    details?: string
  ): FeatureMilestone {
    const desc = details || (isRiskReduction ? 'Feature risk reduced significantly' : 'Feature risk increased due to changes');
    return {
      milestoneId: `ms_risk_${featureId}_${timestamp}`,
      featureId,
      milestoneType: isRiskReduction ? 'FEATURE_RISK_REDUCED' : 'FEATURE_RISK_INCREASED',
      title: isRiskReduction ? 'Risk Reduced' : 'Risk Elevated',
      description: desc,
      timestamp,
      evidence: [
        {
          type: 'RISK_EVALUATION',
          description: desc,
        },
      ],
      confidence: createHistoryConfidence('HIGH', 0.88, ['Risk assessment delta']),
      relatedEventIds,
      importance: isRiskReduction ? 'MEDIUM' : 'HIGH',
    };
  }
}
