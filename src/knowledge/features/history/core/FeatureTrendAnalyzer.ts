import type { IFeatureTrendAnalyzer } from '../interfaces/IFeatureTrendAnalyzer.js';
import type { FeatureSnapshot } from '../models/FeatureSnapshot.js';
import type { FeatureTimeline } from '../models/FeatureTimeline.js';
import type { FeatureTrend } from '../models/FeatureTrend.js';
import type { FeatureGrowthMetrics, GrowthMetricItem } from '../models/FeatureGrowthMetrics.js';
import type { FeatureMaturity, FeatureMaturityLevel } from '../models/FeatureMaturity.js';
import type { FeatureRegression } from '../models/FeatureRegression.js';
import { createHistoryConfidence } from '../models/FeatureHistoryConfidence.js';

export class FeatureTrendAnalyzer implements IFeatureTrendAnalyzer {
  public calculateGrowthMetrics(
    featureId: string,
    snapshots: FeatureSnapshot[]
  ): FeatureGrowthMetrics {
    const timestamp = Date.now();
    if (snapshots.length < 2) {
      const snap = snapshots[0];
      return {
        featureId,
        timestamp,
        metrics: {
          resourceCount: this.createMetric('resourceCount', snap ? snap.resourceSummary.resourceCount : 0, 0),
          flowCount: this.createMetric('flowCount', snap ? snap.behaviorSummary.flowCount : 0, 0),
          dependencyCount: this.createMetric('dependencyCount', snap ? snap.dependencySummary.dependencyCount : 0, 0),
          dependentCount: this.createMetric('dependentCount', snap ? snap.dependencySummary.dependentCount : 0, 0),
          healthScore: this.createMetric('healthScore', snap ? snap.healthSummary.score : 0, 0),
          riskScore: this.createMetric('riskScore', snap ? snap.riskSummary.score : 0, 0),
        },
      };
    }

    const sorted = [...snapshots].sort((a, b) => a.timestamp - b.timestamp);
    const prev = sorted[sorted.length - 2];
    const curr = sorted[sorted.length - 1];

    if (!prev || !curr) {
      return { featureId, timestamp, metrics: {} };
    }

    return {
      featureId,
      timestamp,
      metrics: {
        resourceCount: this.createMetric('resourceCount', curr.resourceSummary.resourceCount, prev.resourceSummary.resourceCount),
        flowCount: this.createMetric('flowCount', curr.behaviorSummary.flowCount, prev.behaviorSummary.flowCount),
        dependencyCount: this.createMetric('dependencyCount', curr.dependencySummary.dependencyCount, prev.dependencySummary.dependencyCount),
        dependentCount: this.createMetric('dependentCount', curr.dependencySummary.dependentCount, prev.dependencySummary.dependentCount),
        healthScore: this.createMetric('healthScore', curr.healthSummary.score, prev.healthSummary.score),
        riskScore: this.createMetric('riskScore', curr.riskSummary.score, prev.riskSummary.score),
      },
    };
  }

  public analyzeTrends(
    featureId: string,
    snapshots: FeatureSnapshot[],
    timeline: FeatureTimeline
  ): FeatureTrend[] {
    // Trends must be based on multiple observations where possible (Section 19)
    if (snapshots.length < 2) {
      return [
        {
          trendType: 'UNKNOWN',
          direction: 'NEUTRAL',
          description: 'Insufficient historical observations to establish feature trends',
          confidence: createHistoryConfidence('LOW', 0.3, ['Single snapshot observation']),
          evidence: ['Only 1 snapshot available'],
          observationCount: snapshots.length,
          metricsInvolved: [],
        },
      ];
    }

    const sorted = [...snapshots].sort((a, b) => a.timestamp - b.timestamp);
    const trends: FeatureTrend[] = [];
    const observationCount = sorted.length;

    const first = sorted[0];
    const latest = sorted[sorted.length - 1];
    if (!first || !latest) return trends;

    // 1. Growth trend (resources & flows)
    const resourceDelta = latest.resourceSummary.resourceCount - first.resourceSummary.resourceCount;
    if (resourceDelta > 0) {
      trends.push({
        trendType: 'GROWING',
        direction: 'UP',
        description: `Feature is growing: +${resourceDelta} resources observed across ${observationCount} snapshots`,
        confidence: createHistoryConfidence('HIGH', 0.85, ['Resource count trajectory']),
        evidence: [`Resources expanded from ${first.resourceSummary.resourceCount} to ${latest.resourceSummary.resourceCount}`],
        observationCount,
        metricsInvolved: ['resourceCount'],
      });
    } else if (resourceDelta < 0) {
      trends.push({
        trendType: 'SHRINKING',
        direction: 'DOWN',
        description: `Feature is shrinking: ${resourceDelta} resources observed`,
        confidence: createHistoryConfidence('HIGH', 0.85, ['Resource count reduction']),
        evidence: [`Resources contracted from ${first.resourceSummary.resourceCount} to ${latest.resourceSummary.resourceCount}`],
        observationCount,
        metricsInvolved: ['resourceCount'],
      });
    } else {
      trends.push({
        trendType: 'STABLE',
        direction: 'STABLE',
        description: 'Resource footprint is stable',
        confidence: createHistoryConfidence('HIGH', 0.88, ['Consistent resource count']),
        evidence: [`Consistent resource count of ${latest.resourceSummary.resourceCount}`],
        observationCount,
        metricsInvolved: ['resourceCount'],
      });
    }

    // 2. Health trend
    const healthDelta = latest.healthSummary.score - first.healthSummary.score;
    if (healthDelta >= 10) {
      trends.push({
        trendType: 'IMPROVING_HEALTH',
        direction: 'UP',
        description: `Health score improved by +${healthDelta} points`,
        confidence: createHistoryConfidence('HIGH', 0.88, ['Health trajectory improvement']),
        evidence: [`Health increased from ${first.healthSummary.score} to ${latest.healthSummary.score}`],
        observationCount,
        metricsInvolved: ['healthScore'],
      });
    } else if (healthDelta <= -10) {
      trends.push({
        trendType: 'DECLINING_HEALTH',
        direction: 'DOWN',
        description: `Health score declined by ${healthDelta} points`,
        confidence: createHistoryConfidence('HIGH', 0.88, ['Health trajectory decline']),
        evidence: [`Health declined from ${first.healthSummary.score} to ${latest.healthSummary.score}`],
        observationCount,
        metricsInvolved: ['healthScore'],
      });
    }

    // 3. Risk trend
    const riskDelta = latest.riskSummary.score - first.riskSummary.score;
    if (riskDelta >= 10) {
      trends.push({
        trendType: 'INCREASING_RISK',
        direction: 'UP',
        description: `Risk score elevated by +${riskDelta} points`,
        confidence: createHistoryConfidence('HIGH', 0.85, ['Risk escalation observed']),
        evidence: [`Risk elevated from ${first.riskSummary.score} to ${latest.riskSummary.score}`],
        observationCount,
        metricsInvolved: ['riskScore'],
      });
    } else if (riskDelta <= -10) {
      trends.push({
        trendType: 'DECLINING_RISK',
        direction: 'DOWN',
        description: `Risk score reduced by ${Math.abs(riskDelta)} points`,
        confidence: createHistoryConfidence('HIGH', 0.85, ['Risk mitigation observed']),
        evidence: [`Risk mitigated from ${first.riskSummary.score} to ${latest.riskSummary.score}`],
        observationCount,
        metricsInvolved: ['riskScore'],
      });
    }

    // 4. Criticality trend
    if (latest.criticalitySummary.level !== first.criticalitySummary.level) {
      const isHigher =
        (latest.criticalitySummary.level === 'CRITICAL' && first.criticalitySummary.level !== 'CRITICAL') ||
        (latest.criticalitySummary.level === 'HIGH' && (first.criticalitySummary.level === 'LOW' || first.criticalitySummary.level === 'MEDIUM'));

      if (isHigher) {
        trends.push({
          trendType: 'INCREASING_CRITICALITY',
          direction: 'UP',
          description: `Feature criticality escalated from ${first.criticalitySummary.level} to ${latest.criticalitySummary.level}`,
          confidence: createHistoryConfidence('HIGH', 0.9, ['Criticality level shift']),
          evidence: [`Criticality level shifted from ${first.criticalitySummary.level} to ${latest.criticalitySummary.level}`],
          observationCount,
          metricsInvolved: ['criticalityLevel'],
        });
      }
    }

    // 5. Verification quality trend
    const hasTestEvidence = timeline.events.some(
      (e) => e.changedDimensions.includes('test') || e.changedDimensions.includes('verification')
    );
    if (hasTestEvidence && healthDelta > 0) {
      trends.push({
        trendType: 'INCREASING_VERIFICATION',
        direction: 'UP',
        description: 'Verification coverage and test quality are improving',
        confidence: createHistoryConfidence('HIGH', 0.85, ['Test addition evidence']),
        evidence: ['Verification events and positive health delta observed'],
        observationCount,
        metricsInvolved: ['healthScore', 'tests'],
      });
    }

    return trends;
  }

  public determineMaturity(
    featureId: string,
    snapshots: FeatureSnapshot[],
    trends: FeatureTrend[]
  ): FeatureMaturity {
    if (snapshots.length === 0) {
      return {
        level: 'UNKNOWN',
        score: 0,
        rationale: 'No snapshot data available to evaluate maturity',
        factors: { ageInDays: 0, stabilityScore: 0, verificationScore: 0, mappingConfidence: 0, dependencyStability: 0 },
        confidence: createHistoryConfidence('LOW', 0.2, ['No snapshots']),
      };
    }

    const sorted = [...snapshots].sort((a, b) => a.timestamp - b.timestamp);
    const latest = sorted[sorted.length - 1];
    const first = sorted[0];

    if (!latest || !first) {
      return {
        level: 'UNKNOWN',
        score: 0,
        rationale: 'Invalid snapshot data',
        factors: { ageInDays: 0, stabilityScore: 0, verificationScore: 0, mappingConfidence: 0, dependencyStability: 0 },
        confidence: createHistoryConfidence('LOW', 0.2),
      };
    }

    if (latest.status === 'DEPRECATED') {
      return {
        level: 'DEPRECATED',
        score: 10,
        rationale: 'Feature is explicitly marked deprecated',
        factors: { ageInDays: 0, stabilityScore: 0, verificationScore: 0, mappingConfidence: 0, dependencyStability: 0 },
        confidence: createHistoryConfidence('VERY_HIGH', 0.98, ['Explicit deprecated status']),
      };
    }

    const ageInDays = Math.max(1, Math.round((latest.timestamp - first.timestamp) / (24 * 3600 * 1000)));
    const verificationScore = latest.healthSummary.score;
    const stabilityScore = Math.max(0, 100 - latest.riskSummary.score);
    const mappingConfidence = latest.confidence.score * 100;
    const dependencyStability = latest.dependencySummary.dependentCount > 0 ? 80 : 50;

    // Weighted score: stability (35%), verification (30%), mapping (20%), dependencies (15%)
    // (Age is NOT the sole determiner of maturity - Section 20)
    const compositeScore = Math.round(
      stabilityScore * 0.35 +
      verificationScore * 0.30 +
      mappingConfidence * 0.20 +
      dependencyStability * 0.15
    );

    let level: FeatureMaturityLevel;
    if (compositeScore >= 80 && sorted.length >= 3) {
      level = 'MATURE';
    } else if (compositeScore >= 65) {
      level = 'ESTABLISHED';
    } else if (compositeScore >= 40) {
      level = 'DEVELOPING';
    } else {
      level = 'NASCENT';
    }

    return {
      level,
      score: compositeScore,
      rationale: `Evaluated maturity based on stability (${stabilityScore}/100), verification (${verificationScore}/100), and topology.`,
      factors: {
        ageInDays,
        stabilityScore,
        verificationScore,
        mappingConfidence,
        dependencyStability,
      },
      confidence: createHistoryConfidence('HIGH', 0.88, ['Multi-factor maturity calculation']),
    };
  }

  public detectRegressions(
    featureId: string,
    snapshots: FeatureSnapshot[]
  ): FeatureRegression[] {
    if (snapshots.length < 2) {
      return [];
    }

    const sorted = [...snapshots].sort((a, b) => a.timestamp - b.timestamp);
    const regressions: FeatureRegression[] = [];

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      if (!prev || !curr) continue;

      // 1. Health drop regression (>= 15 points decline)
      const healthDrop = prev.healthSummary.score - curr.healthSummary.score;
      if (healthDrop >= 15) {
        regressions.push({
          regressionId: `reg_health_${featureId}_${curr.timestamp}`,
          featureId,
          regressionType: 'HEALTH_DECLINE',
          description: `Health score dropped by ${healthDrop} points (from ${prev.healthSummary.score} to ${curr.healthSummary.score})`,
          severity: healthDrop >= 30 ? 'HIGH' : 'MEDIUM',
          evidence: [
            {
              type: 'HEALTH_SCORE_DROP',
              description: `Previous score: ${prev.healthSummary.score}, Current score: ${curr.healthSummary.score}`,
            },
          ],
          confidence: createHistoryConfidence('HIGH', 0.9, ['Significant health assessment score degradation']),
          detectedAt: curr.timestamp,
          previousState: { healthScore: prev.healthSummary.score },
          currentState: { healthScore: curr.healthSummary.score },
        });
      }

      // 2. Risk spike regression (>= 20 points increase)
      const riskSpike = curr.riskSummary.score - prev.riskSummary.score;
      if (riskSpike >= 20) {
        regressions.push({
          regressionId: `reg_risk_${featureId}_${curr.timestamp}`,
          featureId,
          regressionType: 'RISK_ESCALATION',
          description: `Risk score spiked by ${riskSpike} points (from ${prev.riskSummary.score} to ${curr.riskSummary.score})`,
          severity: 'HIGH',
          evidence: [
            {
              type: 'RISK_SPIKE',
              description: `Previous risk: ${prev.riskSummary.score}, Current risk: ${curr.riskSummary.score}`,
            },
          ],
          confidence: createHistoryConfidence('HIGH', 0.88, ['Significant risk increase']),
          detectedAt: curr.timestamp,
          previousState: { riskScore: prev.riskSummary.score },
          currentState: { riskScore: curr.riskSummary.score },
        });
      }

      // 3. Missing behavior flow regression (Section 39 Case 7)
      const missingFlows = prev.behaviorSummary.flows.filter(
        (f) => !curr.behaviorSummary.flows.includes(f)
      );
      if (missingFlows.length > 0) {
        regressions.push({
          regressionId: `reg_flow_${featureId}_${curr.timestamp}`,
          featureId,
          regressionType: 'BEHAVIOR_FLOW_REMOVED',
          description: `Previously active behavior flow(s) disappeared unexpectedly: ${missingFlows.join(', ')}`,
          severity: 'HIGH',
          evidence: [
            {
              type: 'MISSING_FLOW',
              description: `Flows removed: ${missingFlows.join(', ')}`,
            },
          ],
          confidence: createHistoryConfidence('VERY_HIGH', 0.95, ['Behavior flow disappearance']),
          detectedAt: curr.timestamp,
          previousState: { flows: prev.behaviorSummary.flows },
          currentState: { flows: curr.behaviorSummary.flows },
        });
      }

      // 4. Criticality increased without verification improvement
      if (
        curr.criticalitySummary.score > prev.criticalitySummary.score &&
        curr.healthSummary.score < prev.healthSummary.score
      ) {
        regressions.push({
          regressionId: `reg_crit_${featureId}_${curr.timestamp}`,
          featureId,
          regressionType: 'UNVERIFIED_CRITICALITY_INCREASE',
          description: 'Feature criticality increased while verification/health score declined',
          severity: 'MEDIUM',
          evidence: [
            {
              type: 'CRITICALITY_MISMATCH',
              description: `Criticality increased to ${curr.criticalitySummary.level} while health dropped to ${curr.healthSummary.score}`,
            },
          ],
          confidence: createHistoryConfidence('HIGH', 0.85, ['Criticality and health diverging']),
          detectedAt: curr.timestamp,
        });
      }
    }

    return regressions;
  }

  private createMetric(metricName: string, curr: number, prev: number): GrowthMetricItem {
    const delta = curr - prev;
    const normalizedDelta = prev === 0 ? (curr > 0 ? 1 : 0) : delta / Math.max(1, prev);
    return {
      metricName,
      currentValue: curr,
      previousValue: prev,
      delta,
      normalizedDelta,
      confidence: 0.9,
      timestamp: Date.now(),
    };
  }
}
