import type { IFeatureHealthScorer } from '../interfaces/IFeatureHealthScorer.js';
import type { HealthContext, HealthConfiguration } from '../interfaces/IFeatureHealthSignal.js';
import { DEFAULT_HEALTH_CONFIGURATION } from '../interfaces/IFeatureHealthSignal.js';
import type { HealthSignal } from '../models/HealthSignal.js';
import type { FeatureRisk } from '../models/FeatureRisk.js';
import type { FeatureRiskSeverity } from '../models/FeatureRiskSeverity.js';
import type { FeatureHealthDimension, FeatureHealthDimensionResult } from '../models/FeatureHealthDimension.js';
import { FEATURE_HEALTH_DIMENSIONS } from '../models/FeatureHealthDimension.js';
import type { FeatureHealthScore } from '../models/FeatureHealthScore.js';
import type { FeatureHealthStatus } from '../models/FeatureHealthStatus.js';
import type { RiskAssessment } from '../models/RiskAssessment.js';
import type { FeatureCriticality, FeatureCriticalityLevel } from '../models/FeatureCriticality.js';
import type { FeatureStability, FeatureStabilityLevel } from '../models/FeatureStability.js';
import type { VerificationQuality, VerificationLevel } from '../models/VerificationQuality.js';
import { HealthSignalHelper } from '../signals/HealthSignalHelper.js';
import { RiskDetectorHelper } from '../risks/RiskDetectorHelper.js';

export class FeatureHealthScorer implements IFeatureHealthScorer {
  public scoreDimensions(
    signals: HealthSignal[],
    config: HealthConfiguration = DEFAULT_HEALTH_CONFIGURATION
  ): Record<FeatureHealthDimension, FeatureHealthDimensionResult> {
    const results = {} as Record<FeatureHealthDimension, FeatureHealthDimensionResult>;

    // Map signal types to dimensions
    const dimensionSignals: Record<FeatureHealthDimension, HealthSignal[]> = {
      STRUCTURAL_HEALTH: [],
      DEPENDENCY_HEALTH: [],
      BEHAVIOR_HEALTH: [],
      VERIFICATION_HEALTH: [],
      ARCHITECTURE_HEALTH: [],
      STABILITY_HEALTH: [],
      INTEGRATION_HEALTH: [],
      SECURITY_HEALTH: [],
      COMPLEXITY_HEALTH: [],
      CONFIDENCE_HEALTH: []
    };

    for (const signal of signals) {
      const dim = this.mapSignalToDimension(signal);
      dimensionSignals[dim].push(signal);
    }

    for (const dimension of FEATURE_HEALTH_DIMENSIONS) {
      const dimSigList = dimensionSignals[dimension];
      const weight = config.dimensionWeights[dimension] ?? 0.1;

      let score = 100;
      let totalConfidence = 0;

      for (const sig of dimSigList) {
        let penalty = 10;
        switch (sig.severity) {
          case 'CRITICAL':
            penalty = 50;
            break;
          case 'HIGH':
            penalty = 30;
            break;
          case 'MEDIUM':
            penalty = 15;
            break;
          case 'LOW':
            penalty = 5;
            break;
          case 'INFO':
            penalty = 2;
            break;
        }

        const normalizedFactor = sig.normalizedValue > 0 ? sig.normalizedValue / 100 : 1;
        score -= penalty * normalizedFactor;
        totalConfidence += sig.confidence;
      }

      score = Math.max(0, Math.min(100, Math.round(score)));
      const confidence =
        dimSigList.length > 0 ? Number((totalConfidence / dimSigList.length).toFixed(2)) : 0.9;

      results[dimension] = {
        dimension,
        score,
        confidence,
        weight,
        signalCount: dimSigList.length,
        contributingSignals: dimSigList.map((s) => s.signalId),
        description: `Dimension ${dimension} scored ${score}/100 based on ${dimSigList.length} signal(s).`
      };
    }

    return results;
  }

  public calculateOverallHealth(
    dimensionScores: Record<FeatureHealthDimension, FeatureHealthDimensionResult>
  ): FeatureHealthScore {
    let weightedSum = 0;
    let totalWeight = 0;
    let totalConfidence = 0;

    for (const dimension of FEATURE_HEALTH_DIMENSIONS) {
      const dimResult = dimensionScores[dimension];
      weightedSum += dimResult.score * dimResult.weight;
      totalWeight += dimResult.weight;
      totalConfidence += dimResult.confidence;
    }

    const overallScore =
      totalWeight > 0 ? Math.max(0, Math.min(100, Math.round(weightedSum / totalWeight))) : 80;
    const confidence = Number((totalConfidence / FEATURE_HEALTH_DIMENSIONS.length).toFixed(2));

    let status: FeatureHealthStatus = 'HEALTHY';
    if (overallScore >= 85) {
      status = 'HEALTHY';
    } else if (overallScore >= 70) {
      status = 'STABLE';
    } else if (overallScore >= 50) {
      status = 'ATTENTION_REQUIRED';
    } else if (overallScore >= 35) {
      status = 'DEGRADED';
    } else if (overallScore >= 20) {
      status = 'HIGH_RISK';
    } else {
      status = 'CRITICAL';
    }

    // If critical security or circular dependency dimension is low (< 40), degrade health status
    if (
      dimensionScores.SECURITY_HEALTH.score < 40 ||
      dimensionScores.DEPENDENCY_HEALTH.score < 30
    ) {
      if (status === 'HEALTHY' || status === 'STABLE') {
        status = 'ATTENTION_REQUIRED';
      }
    }

    return {
      overallScore,
      status,
      confidence,
      dimensionScores,
      computedAt: Date.now()
    };
  }

  public assessRisks(risks: FeatureRisk[]): RiskAssessment {
    if (risks.length === 0) {
      return {
        overallRiskScore: 0,
        highestRiskSeverity: 'INFO',
        risks: [],
        riskCount: 0,
        confidence: 1.0,
        evaluatedAt: Date.now()
      };
    }

    let highestSeverity: FeatureRiskSeverity = 'INFO';
    let maxRiskScore = 0;
    let sumScore = 0;
    let sumConfidence = 0;

    for (const risk of risks) {
      if (RiskDetectorHelper.getSeverityRank(risk.severity) > RiskDetectorHelper.getSeverityRank(highestSeverity)) {
        highestSeverity = risk.severity;
      }
      if (risk.score > maxRiskScore) {
        maxRiskScore = risk.score;
      }
      sumScore += risk.score;
      sumConfidence += risk.confidence;
    }

    const avgScore = sumScore / risks.length;
    // Blend max risk score (60%) with average risk score (40%) to avoid single outliers dominating completely while honoring worst-case
    const overallRiskScore = Math.max(0, Math.min(100, Math.round(maxRiskScore * 0.6 + avgScore * 0.4)));
    const confidence = Number((sumConfidence / risks.length).toFixed(2));

    return {
      overallRiskScore,
      highestRiskSeverity: highestSeverity,
      risks,
      riskCount: risks.length,
      confidence,
      evaluatedAt: Date.now()
    };
  }

  public calculateCriticality(context: HealthContext): FeatureCriticality {
    const feature = context.feature;
    const dependents = context.dependents || [];
    const mappings = context.mappings || [];

    const dependentCount = dependents.length;
    const exportCount = mappings.filter((m) => m.resourceType === 'SYMBOL').length;
    const endpointCount = mappings.filter(
      (m) => m.resourceType === 'ENDPOINT' || /endpoint|routes|api/i.test(m.resourceId)
    ).length;
    const entryPointCount = mappings.filter((m) => m.role === 'ENTRY_POINT').length;
    const coreDomain =
      (feature.type as any) === 'CORE' ||
      feature.type === 'PLATFORM' ||
      /auth|payment|billing|core|order|security/i.test(feature.name);

    // Score calculation
    let rawScore = dependentCount * 10 + exportCount * 2 + endpointCount * 12 + entryPointCount * 15;
    if (coreDomain) rawScore += 40;

    const score = Math.max(0, Math.min(100, Math.round(rawScore)));

    let level: FeatureCriticalityLevel = 'LOW';
    if (score >= 75) {
      level = 'CRITICAL';
    } else if (score >= 50) {
      level = 'HIGH';
    } else if (score >= 25) {
      level = 'MEDIUM';
    }

    const evidence = [
      HealthSignalHelper.createEvidence({
        sourceType: 'CRITICALITY_EVALUATION',
        sourceId: feature.featureId,
        evidenceType: 'CENTRALITY_METRICS',
        description: `Dependents: ${dependentCount}, Endpoints: ${endpointCount}, EntryPoints: ${entryPointCount}, CoreDomain: ${coreDomain}`,
        confidence: 0.95
      })
    ];

    return {
      score,
      level,
      metrics: {
        dependentCount,
        exportCount,
        endpointCount,
        entryPointCount,
        coreDomain
      },
      confidence: 0.95,
      evidence
    };
  }

  public calculateStability(context: HealthContext, signals: HealthSignal[]): FeatureStability {
    const feature = context.feature;
    const meta = (feature.metadata || {}) as Record<string, unknown>;

    const commitCount = typeof meta.commitCount === 'number' ? meta.commitCount : 0;
    const churnScore = typeof meta.churnScore === 'number' ? meta.churnScore : 0;
    const authorCount = typeof meta.authorCount === 'number' ? meta.authorCount : 1;
    const ageInDays = typeof meta.ageInDays === 'number' ? meta.ageInDays : 30;
    const recentChangesCount = typeof meta.recentChangesCount === 'number' ? meta.recentChangesCount : 0;

    // Stability score: starts at 100, decreased by high churn and recent changes
    let score = 100 - Math.min(60, churnScore * 2.5) - Math.min(30, recentChangesCount * 2);
    if (meta.recentBreakingChange === true) score -= 25;

    score = Math.max(0, Math.min(100, Math.round(score)));

    let level: FeatureStabilityLevel = 'STABLE';
    if (score >= 80) {
      level = 'STABLE';
    } else if (score >= 60) {
      level = 'MOSTLY_STABLE';
    } else if (score >= 35) {
      level = 'UNSTABLE';
    } else {
      level = 'HIGHLY_UNSTABLE';
    }

    const evidence = [
      HealthSignalHelper.createEvidence({
        sourceType: 'STABILITY_EVALUATION',
        sourceId: feature.featureId,
        evidenceType: 'CHURN_HISTORY',
        description: `Commits: ${commitCount}, ChurnScore: ${churnScore}, RecentChanges: ${recentChangesCount}`,
        confidence: 0.9
      })
    ];

    return {
      score,
      level,
      metrics: {
        commitCount,
        churnScore,
        authorCount,
        ageInDays,
        recentChangesCount
      },
      confidence: 0.9,
      evidence
    };
  }

  public calculateVerificationQuality(context: HealthContext, signals: HealthSignal[]): VerificationQuality {
    const mappings = context.mappings || [];
    const feature = context.feature;

    const testMappings = mappings.filter((m) => {
      const isTestRole = m.role === 'TEST';
      const isTestPath = /test|spec|\.test\.|\.spec\./i.test(m.resourceId);
      return isTestRole || isTestPath;
    });

    const hasUnitTests = testMappings.some((m) => /unit|\.test\.|\.spec\./i.test(m.resourceId));
    const hasIntegrationTests = testMappings.some((m) => /integration|e2e|api\.test/i.test(m.resourceId));
    const hasE2ETests = testMappings.some((m) => /e2e|system|cypress|playwright/i.test(m.resourceId));

    const totalResources = mappings.length;
    const testRatio = totalResources > 0 ? Number((testMappings.length / totalResources).toFixed(2)) : 0;

    let verifiedFlowCount = 0;
    let unverifiedFlowCount = 0;

    if (context.behavior && context.behavior.flows) {
      for (const flow of context.behavior.flows) {
        const isVerified = (flow as unknown as { isVerified?: boolean }).isVerified;
        if (isVerified === true || (isVerified === undefined && testMappings.length > 0)) {
          verifiedFlowCount++;
        } else {
          unverifiedFlowCount++;
        }
      }
    }

    // Verification score
    let score = testRatio * 50;
    if (hasUnitTests) score += 20;
    if (hasIntegrationTests) score += 20;
    if (hasE2ETests) score += 10;
    if (unverifiedFlowCount > 0) score -= unverifiedFlowCount * 10;

    score = Math.max(0, Math.min(100, Math.round(score)));

    let level: VerificationLevel = 'NONE';
    if (score >= 80) {
      level = 'COMPREHENSIVE';
    } else if (score >= 50) {
      level = 'MODERATE';
    } else if (score >= 20) {
      level = 'MINIMAL';
    } else {
      level = 'NONE';
    }

    const evidence = [
      HealthSignalHelper.createEvidence({
        sourceType: 'VERIFICATION_EVALUATION',
        sourceId: feature.featureId,
        evidenceType: 'TEST_RESOURCES_AUDIT',
        description: `Test resources: ${testMappings.length}/${totalResources}, Unit: ${hasUnitTests}, Integration: ${hasIntegrationTests}`,
        confidence: 0.95
      })
    ];

    return {
      score,
      level,
      hasUnitTests,
      hasIntegrationTests,
      hasE2ETests,
      testFileCount: testMappings.length,
      verifiedFlowCount,
      unverifiedFlowCount,
      testRatio,
      confidence: 0.95,
      evidence
    };
  }

  private mapSignalToDimension(signal: HealthSignal): FeatureHealthDimension {
    switch (signal.signalType) {
      case 'HIGH_CYCLOMATIC_COMPLEXITY':
      case 'HIGH_COGNITIVE_COMPLEXITY':
      case 'DEEP_NESTING':
      case 'LARGE_FILE_SIZE':
      case 'LARGE_METHOD_SIZE':
        return 'COMPLEXITY_HEALTH';

      case 'HIGH_AFFERENT_COUPLING':
      case 'HIGH_EFFERENT_COUPLING':
      case 'TIGHT_COUPLING':
      case 'UNBALANCED_COUPLING':
      case 'CIRCULAR_FEATURE_DEPENDENCY':
      case 'DEPRECATED_DEPENDENCY':
      case 'OUTDATED_DEPENDENCY':
      case 'UNPINNED_DEPENDENCY':
      case 'HIDDEN_TRANSITIVE_DEPENDENCY':
      case 'EXCESSIVE_DEPENDENCIES':
        return 'DEPENDENCY_HEALTH';

      case 'COMPLEX_EXECUTION_FLOW':
      case 'DEAD_END_FLOW':
      case 'UNHANDLED_ERROR_PATH':
      case 'ASYNC_RACE_CONDITION':
      case 'UNTERMINATED_FLOW':
      case 'AMBIGUOUS_BEHAVIOR_BRANCH':
        return 'BEHAVIOR_HEALTH';

      case 'MISSING_TESTS':
      case 'LOW_TEST_COVERAGE':
      case 'NO_INTEGRATION_TESTS':
      case 'UNTESTED_CRITICAL_FLOW':
      case 'FLAKY_TEST_HISTORY':
      case 'ASSERTION_FREE_TEST':
        return 'VERIFICATION_HEALTH';

      case 'LAYER_VIOLATION':
      case 'CROSS_DOMAIN_LEAK':
      case 'BYPASSED_ABSTRACTION':
      case 'SHARED_DATABASE_TABLE':
      case 'CIRCULAR_MODULE_REFERENCE':
      case 'ORPHAN_FEATURE_COMPONENT':
        return 'ARCHITECTURE_HEALTH';

      case 'HIGH_CHURN_RATE':
      case 'FREQUENT_BUG_FIXES':
      case 'RECENT_BREAKING_CHANGE':
      case 'HOTSPOT_DETECTED':
      case 'RAPID_SUCCESSIVE_CHANGES':
        return 'STABILITY_HEALTH';

      case 'UNDOCUMENTED_API_ENDPOINT':
      case 'MISSING_TIMEOUT_CONFIGURATION':
      case 'MISSING_CIRCUIT_BREAKER':
      case 'UNVALIDATED_EXTERNAL_INPUT':
      case 'UNRETRYABLE_NETWORK_CALL':
        return 'INTEGRATION_HEALTH';

      case 'EXPOSED_SECRET':
      case 'MISSING_AUTHENTICATION':
      case 'INSECURE_CONFIGURATION':
      case 'PERMISSIVE_CORS':
      case 'UNVALIDATED_INPUT':
      case 'PROMPT_INJECTION_VULNERABILITY':
        return 'SECURITY_HEALTH';

      case 'LOW_DISCOVERY_CONFIDENCE':
      case 'DISPUTED_RESOURCE_MAPPING':
      case 'STALE_KNOWLEDGE':
      case 'LOW_MAPPING_CONFIDENCE':
        return 'CONFIDENCE_HEALTH';

      case 'SINGLE_POINT_OF_FAILURE':
      case 'UNRESOLVED_TODO_CONCENTRATION':
      default:
        return 'STRUCTURAL_HEALTH';
    }
  }
}
