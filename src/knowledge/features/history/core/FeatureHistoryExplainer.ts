import type { IFeatureHistoryExplainer } from '../interfaces/IFeatureHistoryExplainer.js';
import type { FeatureHistory } from '../models/FeatureHistory.js';
import type { FeatureSnapshot } from '../models/FeatureSnapshot.js';
import type { FeatureEvolutionSummary } from '../models/FeatureEvolutionSummary.js';
import type { FeatureComparison } from '../models/FeatureComparison.js';
import { createHistoryConfidence } from '../models/FeatureHistoryConfidence.js';

export class FeatureHistoryExplainer implements IFeatureHistoryExplainer {
  public explainEvolution(featureId: string, history: FeatureHistory): FeatureEvolutionSummary {
    const featureName = history.currentState?.metadata?.name || featureId;
    const firstSeenAt = history.firstSeenAt;
    const lastUpdatedAt = history.lastUpdatedAt;
    const currentMaturity = history.maturity;
    const majorMilestones = history.milestones.filter(
      (m) => m.importance === 'HIGH' || m.importance === 'CRITICAL'
    );
    const currentTrends = history.trends;

    const historicalRisks = history.regressions.map((r) => r.description);
    if (history.currentState.riskSummary.topRisks) {
      historicalRisks.push(...history.currentState.riskSummary.topRisks);
    }

    const textSummary = this.generateSummaryText(
      featureName,
      firstSeenAt,
      majorMilestones,
      currentTrends,
      currentMaturity.level,
      historicalRisks,
      history.confidence.level
    );

    return {
      featureId,
      featureName,
      firstSeenAt,
      lastUpdatedAt,
      currentMaturity,
      majorMilestones,
      currentTrends,
      historicalRisks: Array.from(new Set(historicalRisks)),
      overallConfidence: history.confidence,
      textSummary,
    };
  }

  public explainCriticalityChange(featureId: string, history: FeatureHistory): string {
    const critLevel = history.currentState.criticalitySummary.level;
    const dependentCount = history.currentState.dependencySummary.dependentCount;
    const dependents = history.currentState.dependencySummary.dependents.join(', ') || 'none';

    return `Feature ${featureId} is currently ${critLevel} criticality primarily because it is depended upon by ${dependentCount} feature(s): [${dependents}].`;
  }

  public explainRiskChange(featureId: string, history: FeatureHistory): string {
    const riskScore = history.currentState.riskSummary.score;
    const regressions = history.regressions.filter((r) => r.regressionType === 'RISK_ESCALATION');
    if (regressions.length > 0) {
      const recent = regressions[regressions.length - 1];
      return `Feature ${featureId} risk elevated (score: ${riskScore}) due to: ${recent?.description}`;
    }
    return `Feature ${featureId} has risk score ${riskScore} with stable risk metrics.`;
  }

  public compareSnapshots(
    featureId: string,
    before: FeatureSnapshot,
    after: FeatureSnapshot
  ): FeatureComparison {
    const mappingsAdded = after.mappingSummary.primaryPath && after.mappingSummary.primaryPath !== before.mappingSummary.primaryPath
      ? [after.mappingSummary.primaryPath]
      : [];
    const mappingsRemoved = before.mappingSummary.primaryPath && before.mappingSummary.primaryPath !== after.mappingSummary.primaryPath
      ? [before.mappingSummary.primaryPath]
      : [];

    const dependenciesAdded = after.dependencySummary.dependencies.filter(
      (d) => !before.dependencySummary.dependencies.includes(d)
    );
    const dependenciesRemoved = before.dependencySummary.dependencies.filter(
      (d) => !after.dependencySummary.dependencies.includes(d)
    );

    const flowsAdded = after.behaviorSummary.flows.filter(
      (f) => !before.behaviorSummary.flows.includes(f)
    );
    const flowsRemoved = before.behaviorSummary.flows.filter(
      (f) => !after.behaviorSummary.flows.includes(f)
    );

    const entryPointsAdded = after.behaviorSummary.entryPoints.filter(
      (ep) => !before.behaviorSummary.entryPoints.includes(ep)
    );
    const entryPointsRemoved = before.behaviorSummary.entryPoints.filter(
      (ep) => !after.behaviorSummary.entryPoints.includes(ep)
    );

    const healthDelta = {
      before: before.healthSummary.score,
      after: after.healthSummary.score,
      delta: after.healthSummary.score - before.healthSummary.score,
    };

    const riskDelta = {
      before: before.riskSummary.score,
      after: after.riskSummary.score,
      delta: after.riskSummary.score - before.riskSummary.score,
    };

    const criticalityChange = {
      beforeLevel: before.criticalitySummary.level,
      afterLevel: after.criticalitySummary.level,
    };

    const architectureChanges: string[] = [];
    if (after.architectureSummary.layer !== before.architectureSummary.layer) {
      architectureChanges.push(
        `Layer moved from ${before.architectureSummary.layer || 'unspecified'} to ${after.architectureSummary.layer || 'unspecified'}`
      );
    }

    return {
      featureId,
      beforeTarget: {
        type: 'SNAPSHOT',
        id: before.snapshotId,
        timestamp: before.timestamp,
      },
      afterTarget: {
        type: 'SNAPSHOT',
        id: after.snapshotId,
        timestamp: after.timestamp,
      },
      mappingsAdded,
      mappingsRemoved,
      dependenciesAdded,
      dependenciesRemoved,
      flowsAdded,
      flowsRemoved,
      entryPointsAdded,
      entryPointsRemoved,
      healthDelta,
      riskDelta,
      criticalityChange,
      architectureChanges,
      milestonesCrossed: [],
      confidence: createHistoryConfidence('HIGH', 0.9, ['Direct snapshot comparison']),
      timestamp: Date.now(),
    };
  }

  private generateSummaryText(
    name: string,
    created: number,
    milestones: any[],
    trends: any[],
    maturity: string,
    risks: string[],
    confidence: string
  ): string {
    const createdDate = new Date(created).toISOString().split('T')[0];
    const msLines = milestones.map((m) => `- ${m.title}: ${m.description}`).join('\n') || '- None recorded';
    const trendLines = trends.map((t) => `- ${t.trendType} (${t.direction})`).join('\n') || '- Stable';
    const riskLines = risks.map((r) => `- ${r}`).join('\n') || '- None';

    return `${name}:

Created:
${createdDate}

Major milestones:
${msLines}

Current trends:
${trendLines}

Current maturity:
${maturity}

Historical risk:
${riskLines}

Current confidence:
${confidence}`;
  }
}
