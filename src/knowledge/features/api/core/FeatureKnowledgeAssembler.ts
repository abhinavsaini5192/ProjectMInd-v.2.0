import type { IFeatureKnowledgeAssembler } from '../interfaces/IFeatureKnowledgeAssembler.js';
import type { FeatureKnowledgeProfile } from '../models/FeatureKnowledgeProfile.js';
import type { FeatureKnowledgeQuery } from '../models/FeatureKnowledgeQuery.js';
import type { FeatureKnowledgeExecutionPlan } from '../interfaces/IFeatureKnowledgePlanner.js';
import type { ResolvedRawSections } from '../interfaces/IFeatureKnowledgeResolver.js';
import type { FreshnessEvaluation } from '../interfaces/IFeatureKnowledgeFreshnessResolver.js';
import type { FeatureKnowledgeSection } from '../models/FeatureKnowledgeSection.js';
import type {
  FeatureKnowledgeCompleteness,
  CompletenessStatus,
} from '../models/FeatureKnowledgeCompleteness.js';
import type {
  FeatureKnowledgeConfidence,
  KnowledgeConfidenceLevel,
} from '../models/FeatureKnowledgeConfidence.js';
import type { FeatureKnowledgeReference } from '../models/FeatureKnowledgeReference.js';
import type { FeatureKnowledgeSummary } from '../models/FeatureKnowledgeSummary.js';
import type { FeatureKnowledgeContextPackage } from '../models/FeatureKnowledgeContextPackage.js';
import type { FeatureSummarySection } from '../sections/FeatureSummarySection.js';

export class FeatureKnowledgeAssembler implements IFeatureKnowledgeAssembler {
  public assembleProfile(
    featureId: string,
    sections: ResolvedRawSections,
    plan: FeatureKnowledgeExecutionPlan,
    query: FeatureKnowledgeQuery,
    freshnessEval: FreshnessEvaluation,
    explanations: Record<string, string>
  ): FeatureKnowledgeProfile {
    // 1. References gathering & deduplication
    const references = this.assembleReferences(sections, plan);

    // 2. Summary section assembly
    const summary = this.assembleSummarySection(featureId, sections, plan);

    // 3. Completeness calculation
    const completeness = this.calculateCompleteness(sections, plan);

    // 4. Confidence calculation
    const confidence = this.calculateConfidence(sections);

    // 5. Context package generation (if requested)
    let contextPackage: FeatureKnowledgeContextPackage | undefined = undefined;
    if (plan.resolvedSections.has('CONTEXT')) {
      contextPackage = this.buildContextPackage(
        featureId,
        sections,
        completeness,
        confidence,
        plan.options.tokenBudget
      );
    }

    return {
      featureId,
      identity: sections.identity,
      mappings: sections.mappings,
      dependencies: sections.dependencies,
      behavior: sections.behavior,
      health: sections.health,
      impact: sections.impact,
      history: sections.history,
      architecture: sections.architecture,
      summary,
      explanations,
      references,
      completeness,
      confidence,
      freshness: freshnessEval.freshness,
      contextPackage,
    };
  }

  private assembleReferences(
    sections: ResolvedRawSections,
    plan: FeatureKnowledgeExecutionPlan
  ): FeatureKnowledgeReference[] {
    const refMap = new Map<string, FeatureKnowledgeReference>();

    // From mappings
    if (sections.mappings.status === 'AVAILABLE' && sections.mappings.data) {
      for (const m of sections.mappings.data.mappings) {
        if (!refMap.has(m.resourceId)) {
          refMap.set(m.resourceId, {
            id: m.resourceId,
            name: m.resourceId,
            type: 'FILE',
            role: m.role,
            confidence: m.confidence,
            details: { sourceSubsystem: 'FeatureMappingEngine' },
          });
        }
      }
    }

    // From dependencies
    if (sections.dependencies.status === 'AVAILABLE' && sections.dependencies.data) {
      for (const dep of sections.dependencies.data.dependencies) {
        if (!refMap.has(dep.featureId)) {
          refMap.set(dep.featureId, {
            id: dep.featureId,
            name: dep.featureId,
            type: 'FEATURE',
            role: dep.relationshipType,
            confidence: dep.confidence,
            details: { sourceSubsystem: 'FeatureDependencyEngine' },
          });
        }
      }
    }

    // Sort deterministically by id
    let refs = Array.from(refMap.values()).sort((a, b) =>
      a.id.localeCompare(b.id)
    );

    if (plan.options.maxItemsPerSection && refs.length > plan.options.maxItemsPerSection) {
      refs = refs.slice(0, plan.options.maxItemsPerSection);
    }

    return refs;
  }

  private assembleSummarySection(
    featureId: string,
    sections: ResolvedRawSections,
    plan: FeatureKnowledgeExecutionPlan
  ): FeatureSummarySection {
    if (!plan.resolvedSections.has('SUMMARY')) {
      return { status: 'NOT_REQUESTED', itemCount: 0 };
    }

    const name = sections.identity.data?.name ?? featureId;
    const type = sections.identity.data?.type ?? 'USER_FACING';
    const status = sections.identity.data?.status ?? 'ACTIVE';
    const description = sections.identity.data?.description ?? '';

    const mappedResourceCount = sections.mappings.data?.totalMapped ?? sections.mappings.data?.mappings.length ?? 0;
    const dependencyCount = sections.dependencies.data?.dependencies.length ?? 0;
    const dependentCount = sections.dependencies.data?.dependents.length ?? 0;
    const flowCount = sections.behavior.data?.allFlows.length ?? 0;

    const healthScore = sections.health.data?.healthScore ?? 100;
    const riskScore =
      sections.health.data?.risks.reduce((acc, r) => acc + r.score, 0) ?? 0;
    const criticalityLevel = sections.health.data?.criticalityLevel ?? 'MEDIUM';
    const maturityLevel = sections.history.data?.maturityLevel ?? 'MATURE';

    const keyRisks = sections.health.data?.risks.map((r) => r.description) ?? [];
    const recentMilestones = sections.history.data?.milestones.map((m) => m.title) ?? [];

    const summaryData: FeatureKnowledgeSummary = {
      featureId,
      name,
      type,
      status,
      description,
      mappedResourceCount,
      dependencyCount,
      dependentCount,
      flowCount,
      healthScore,
      riskScore,
      criticalityLevel,
      maturityLevel,
      keyRisks,
      recentMilestones,
    };

    return {
      status: 'AVAILABLE',
      itemCount: 1,
      confidence: 1.0,
      knowledgeVersion: '1.0.0',
      lastUpdatedAt: Date.now(),
      sourceSubsystem: 'FeatureKnowledgeAPI',
      data: summaryData,
    };
  }

  private calculateCompleteness(
    sections: ResolvedRawSections,
    plan: FeatureKnowledgeExecutionPlan
  ): FeatureKnowledgeCompleteness {
    const requestedSections = Array.from(plan.resolvedSections);
    const availableSections: FeatureKnowledgeSection[] = [];
    const unavailableSections: FeatureKnowledgeSection[] = [];
    const staleSections: FeatureKnowledgeSection[] = [];
    const failedSections: FeatureKnowledgeSection[] = [];
    const notComputedSections: FeatureKnowledgeSection[] = [];
    const missingKnowledgeReasons: Record<string, string> = {};

    // Helper to evaluate section status
    const evalSection = (sec: FeatureKnowledgeSection, status: string, reason?: string) => {
      if (!plan.resolvedSections.has(sec)) return;

      if (status === 'AVAILABLE' || status === 'EMPTY') {
        availableSections.push(sec);
      } else if (status === 'STALE') {
        staleSections.push(sec);
        availableSections.push(sec); // Stale data is still available
      } else if (status === 'FAILED') {
        failedSections.push(sec);
        if (reason) missingKnowledgeReasons[sec] = reason;
      } else if (status === 'NOT_COMPUTED') {
        notComputedSections.push(sec);
        unavailableSections.push(sec);
        if (reason) missingKnowledgeReasons[sec] = reason;
      } else if (status === 'INACCESSIBLE' || status === 'UNKNOWN') {
        unavailableSections.push(sec);
        if (reason) missingKnowledgeReasons[sec] = reason;
      }
    };

    evalSection('IDENTITY', sections.identity.status, sections.identity.reason);
    evalSection('METADATA', sections.identity.status, sections.identity.reason);
    evalSection('MAPPINGS', sections.mappings.status, sections.mappings.reason);
    evalSection('DEPENDENCIES', sections.dependencies.status, sections.dependencies.reason);
    evalSection('DEPENDENTS', sections.dependencies.status, sections.dependencies.reason);
    evalSection('RELATIONSHIPS', sections.dependencies.status, sections.dependencies.reason);
    evalSection('ENTRY_POINTS', sections.behavior.status, sections.behavior.reason);
    evalSection('BEHAVIOR', sections.behavior.status, sections.behavior.reason);
    evalSection('FLOWS', sections.behavior.status, sections.behavior.reason);
    evalSection('HEALTH', sections.health.status, sections.health.reason);
    evalSection('RISKS', sections.health.status, sections.health.reason);
    evalSection('IMPACT', sections.impact.status, sections.impact.reason);
    evalSection('HISTORY', sections.history.status, sections.history.reason);
    evalSection('MILESTONES', sections.history.status, sections.history.reason);
    evalSection('TRENDS', sections.history.status, sections.history.reason);
    evalSection('MATURITY', sections.history.status, sections.history.reason);
    evalSection('ARCHITECTURE', sections.architecture.status, sections.architecture.reason);
    evalSection('SUMMARY', sections.identity.status, sections.identity.reason);
    evalSection('REFERENCES', sections.mappings.status, sections.mappings.reason);
    evalSection('EXPLANATION', sections.identity.status, sections.identity.reason);
    evalSection('CONTEXT', sections.identity.status, sections.identity.reason);

    const totalRequested = requestedSections.length;
    const completenessRatio = totalRequested > 0 ? availableSections.length / totalRequested : 1;

    let status: CompletenessStatus = 'UNKNOWN';
    if (completenessRatio >= 1.0) {
      status = 'COMPLETE';
    } else if (completenessRatio >= 0.75) {
      status = 'MOSTLY_COMPLETE';
    } else if (completenessRatio >= 0.4) {
      status = 'PARTIAL';
    } else if (completenessRatio > 0) {
      status = 'MINIMAL';
    }

    return {
      requestedSections,
      availableSections,
      unavailableSections,
      staleSections,
      failedSections,
      notComputedSections,
      completenessRatio,
      status,
      missingKnowledgeReasons,
    };
  }

  private calculateConfidence(sections: ResolvedRawSections): FeatureKnowledgeConfidence {
    const sectionConfidences: Record<string, number> = {};
    const factors: string[] = [];
    const limitations: string[] = [];

    const check = (name: string, status: string, confidence?: number) => {
      if (status === 'AVAILABLE' || status === 'EMPTY') {
        const conf = typeof confidence === 'number' ? confidence : 1.0;
        sectionConfidences[name] = conf;
        factors.push(`${name} verified with score ${conf.toFixed(2)}`);
      } else if (status === 'STALE') {
        const conf = (typeof confidence === 'number' ? confidence : 1.0) * 0.7;
        sectionConfidences[name] = conf;
        limitations.push(`${name} is stale; confidence discounted`);
      } else if (status === 'FAILED' || status === 'NOT_COMPUTED') {
        limitations.push(`${name} unavailable (${status})`);
      }
    };

    check('identity', sections.identity.status, sections.identity.confidence);
    check('mappings', sections.mappings.status, sections.mappings.confidence);
    check('dependencies', sections.dependencies.status, sections.dependencies.confidence);
    check('behavior', sections.behavior.status, sections.behavior.confidence);
    check('health', sections.health.status, sections.health.confidence);
    check('impact', sections.impact.status, sections.impact.confidence);
    check('history', sections.history.status, sections.history.confidence);

    const scores = Object.values(sectionConfidences);
    const overallScore =
      scores.length > 0 ? scores.reduce((acc, c) => acc + c, 0) / scores.length : 0.5;

    let level: KnowledgeConfidenceLevel = 'LOW';
    if (overallScore >= 0.85) {
      level = 'VERY_HIGH';
    } else if (overallScore >= 0.7) {
      level = 'HIGH';
    } else if (overallScore >= 0.5) {
      level = 'MEDIUM';
    }

    return {
      overallScore,
      level,
      sectionConfidences,
      factors,
      limitations,
    };
  }

  private buildContextPackage(
    featureId: string,
    sections: ResolvedRawSections,
    completeness: FeatureKnowledgeCompleteness,
    confidence: FeatureKnowledgeConfidence,
    tokenBudget?: number
  ): FeatureKnowledgeContextPackage {
    const name = sections.identity.data?.name ?? featureId;
    const description = sections.identity.data?.description ?? '';

    // Priority ordering for compact context (Section 19):
    // 1. Identity
    // 2. Entry points
    // 3. Primary implementation resources
    // 4. Direct dependencies
    // 5. Primary behavior flows
    // 6. High-severity risks
    // 7. Important health information
    // 8. Recent meaningful history
    // 9. Relevant impact

    const entryPoints = [...(sections.behavior.data?.entryPoints ?? [])].sort();
    const primaryResources = [...(sections.mappings.data?.primaryResources ?? [])].sort();
    const directDependencies = (sections.dependencies.data?.dependencies ?? [])
      .map((d) => d.featureId)
      .sort();
    const importantDependents = (sections.dependencies.data?.dependents ?? [])
      .map((d) => d.featureId)
      .sort();
    const primaryFlows = (sections.behavior.data?.primaryFlows ?? [])
      .map((f) => f.name)
      .sort();
    const highSeverityRisks = (sections.health.data?.risks ?? [])
      .filter((r) => r.severity === 'HIGH' || r.severity === 'CRITICAL')
      .map((r) => r.description)
      .sort();

    const healthSummary = {
      score: sections.health.data?.healthScore ?? 100,
      status: sections.health.data?.healthStatus ?? 'HEALTHY',
    };

    const recentHistory = (sections.history.data?.milestones ?? [])
      .map((m) => m.title)
      .slice(0, 5);

    const impactSummary = {
      radius: sections.impact.data?.impactRadius ?? 0,
      impactScore: sections.impact.data?.impactScore ?? 0,
      affectedCount: sections.impact.data?.impactedFeatures.length ?? 0,
    };

    // Budget enforcement
    let finalEntryPoints = entryPoints;
    let finalPrimaryResources = primaryResources;
    let finalDependencies = directDependencies;
    let finalFlows = primaryFlows;
    let finalRisks = highSeverityRisks;

    if (tokenBudget && tokenBudget < 500) {
      // Restrict items under tight budget
      finalEntryPoints = entryPoints.slice(0, 3);
      finalPrimaryResources = primaryResources.slice(0, 5);
      finalDependencies = directDependencies.slice(0, 3);
      finalFlows = primaryFlows.slice(0, 2);
      finalRisks = highSeverityRisks.slice(0, 2);
    }

    // Token estimation
    const serializedForTokens = JSON.stringify({
      featureId,
      name,
      description,
      finalEntryPoints,
      finalPrimaryResources,
      finalDependencies,
      finalFlows,
      finalRisks,
      healthSummary,
    });
    const estimatedTokens = Math.ceil(serializedForTokens.length / 4);

    return {
      featureId,
      name,
      description,
      identity: sections.identity.data ?? {},
      entryPoints: finalEntryPoints,
      primaryResources: finalPrimaryResources,
      directDependencies: finalDependencies,
      importantDependents,
      primaryFlows: finalFlows,
      highSeverityRisks: finalRisks,
      healthSummary,
      recentHistory,
      impactSummary,
      estimatedTokens,
      completeness: completeness.status,
      confidence: confidence.overallScore,
    };
  }
}
