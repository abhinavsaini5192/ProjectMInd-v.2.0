import type { ContextRelevance, RelevanceBreakdown } from '../models/ContextRelevance.js';

export class ContextRelevanceScorer {
  public static scoreFeature(
    isDirect: boolean,
    taskText?: string,
    featureName?: string,
    featureDescription?: string,
    criticalityScore: number = 0.5,
    confidence: number = 1.0
  ): ContextRelevance {
    const directness = isDirect ? 1.0 : 0.5;
    let taskAlignment = 0.5;

    if (taskText && featureName) {
      const tLower = taskText.toLowerCase();
      const nLower = featureName.toLowerCase();
      if (tLower.includes(nLower)) {
        taskAlignment = 1.0;
      } else if (featureDescription && tLower.includes(featureDescription.toLowerCase().slice(0, 20))) {
        taskAlignment = 0.8;
      }
    }

    const roleImportance = isDirect ? 1.0 : 0.6;
    const flowParticipation = 0.7;
    const criticality = Math.max(0, Math.min(1, criticalityScore));

    const breakdown: RelevanceBreakdown = {
      directness,
      taskAlignment,
      roleImportance,
      flowParticipation,
      criticality,
    };

    const score = Number(
      (
        directness * 0.35 +
        taskAlignment * 0.25 +
        roleImportance * 0.2 +
        flowParticipation * 0.1 +
        criticality * 0.1
      ).toFixed(3)
    );

    const reasons: string[] = [];
    if (isDirect) {
      reasons.push('Directly requested or matched to task intent.');
    } else {
      reasons.push('Resolved via dependency graph.');
    }
    if (taskAlignment >= 0.8) {
      reasons.push(`High task alignment with keyword matches in feature name '${featureName}'.`);
    }

    return {
      score,
      confidence: Math.max(0, Math.min(1, confidence)),
      importance: Number(((roleImportance + directness) / 2).toFixed(3)),
      directness: isDirect,
      reasons,
      breakdown,
    };
  }

  public static scoreResource(
    isChanged: boolean,
    role: string,
    parentRelevance: ContextRelevance,
    isEntryPoint: boolean = false
  ): ContextRelevance {
    const directness = isChanged ? 1.0 : parentRelevance.directness ? 0.8 : 0.4;
    let roleWeight = 0.5;

    const rUpper = role.toUpperCase();
    if (rUpper === 'PRIMARY' || isEntryPoint) {
      roleWeight = 1.0;
    } else if (rUpper === 'SECONDARY' || rUpper === 'ENTRY_POINT') {
      roleWeight = 0.8;
    } else if (rUpper === 'TEST') {
      roleWeight = 0.6;
    } else if (rUpper === 'CONFIG' || rUpper === 'SUPPORTING') {
      roleWeight = 0.4;
    }

    const taskAlignment = isChanged ? 1.0 : parentRelevance.score;
    const flowParticipation = isEntryPoint ? 0.9 : 0.6;
    const criticality = parentRelevance.breakdown?.criticality ?? 0.5;

    const breakdown: RelevanceBreakdown = {
      directness,
      taskAlignment,
      roleImportance: roleWeight,
      flowParticipation,
      criticality,
    };

    const score = Number(
      (
        directness * 0.4 +
        taskAlignment * 0.25 +
        roleWeight * 0.2 +
        flowParticipation * 0.1 +
        criticality * 0.05
      ).toFixed(3)
    );

    const reasons: string[] = [];
    if (isChanged) {
      reasons.push('Resource was explicitly modified or changed.');
    }
    if (isEntryPoint) {
      reasons.push('Resource serves as a primary feature entry point.');
    }
    if (rUpper === 'PRIMARY') {
      reasons.push('Resource is a primary implementation unit for the feature.');
    }

    return {
      score,
      confidence: parentRelevance.confidence,
      importance: roleWeight,
      directness: isChanged || parentRelevance.directness,
      reasons,
      breakdown,
    };
  }
}
