import type { IFeatureKnowledgeExplainer } from '../interfaces/IFeatureKnowledgeExplainer.js';
import type { ResolvedRawSections } from '../interfaces/IFeatureKnowledgeResolver.js';
import type { FeatureKnowledgeQuery } from '../models/FeatureKnowledgeQuery.js';

export class FeatureKnowledgeExplainer implements IFeatureKnowledgeExplainer {
  public generateExplanations(
    featureId: string,
    sections: ResolvedRawSections,
    _query: FeatureKnowledgeQuery
  ): Record<string, string> {
    const explanations: Record<string, string> = {};

    // 1. Identity explanation
    if (sections.identity.status === 'AVAILABLE' && sections.identity.data) {
      explanations['identity'] = `Feature '${sections.identity.data.name}' (${featureId}) is an active ${sections.identity.data.type} feature registered in FeatureRegistry.`;
    }

    // 2. Mapping explanation
    if (sections.mappings.status === 'AVAILABLE' && sections.mappings.data) {
      const count = sections.mappings.data.mappings.length;
      explanations['mappings'] = `Feature has ${count} mapped resource(s) verified by FeatureMappingEngine based on AST and endpoint analysis.`;
    } else if (sections.mappings.status !== 'NOT_REQUESTED') {
      explanations['mappings'] = `Mappings are ${sections.mappings.status}${sections.mappings.reason ? `: ${sections.mappings.reason}` : ''}.`;
    }

    // 3. Dependencies explanation
    if (sections.dependencies.status === 'AVAILABLE' && sections.dependencies.data) {
      const depCount = sections.dependencies.data.dependencies.length;
      const dependentCount = sections.dependencies.data.dependents.length;
      explanations['dependencies'] = `Feature depends on ${depCount} feature(s) and has ${dependentCount} dependent(s) verified by FeatureDependencyEngine.`;
    } else if (sections.dependencies.status !== 'NOT_REQUESTED') {
      explanations['dependencies'] = `Dependencies are ${sections.dependencies.status}${sections.dependencies.reason ? `: ${sections.dependencies.reason}` : ''}.`;
    }

    // 4. Behavior explanation
    if (sections.behavior.status === 'AVAILABLE' && sections.behavior.data) {
      const flowCount = sections.behavior.data.allFlows.length;
      const entryCount = sections.behavior.data.entryPoints.length;
      explanations['behavior'] = `Feature behavior contains ${flowCount} execution flow(s) and ${entryCount} entry point(s) traced by FeatureBehaviorEngine.`;
    } else if (sections.behavior.status !== 'NOT_REQUESTED') {
      explanations['behavior'] = `Behavior is ${sections.behavior.status}${sections.behavior.reason ? `: ${sections.behavior.reason}` : ''}.`;
    }

    // 5. Health explanation
    if (sections.health.status === 'AVAILABLE' && sections.health.data) {
      const riskCount = sections.health.data.risks.length;
      const score = sections.health.data.healthScore;
      explanations['health'] = `Health status is ${sections.health.data.healthStatus} (score: ${score}) with ${riskCount} risk(s) identified by FeatureHealthEngine.`;
    } else if (sections.health.status !== 'NOT_REQUESTED') {
      explanations['health'] = `Health is ${sections.health.status}${sections.health.reason ? `: ${sections.health.reason}` : ''}.`;
    }

    // 6. Impact explanation
    if (sections.impact.status === 'AVAILABLE' && sections.impact.data) {
      const affectedCount = sections.impact.data.impactedFeatures.length;
      explanations['impact'] = `Change impact profile identifies ${affectedCount} downstream feature(s) and impact score ${sections.impact.data.impactScore} from FeatureImpactEngine.`;
    } else if (sections.impact.status !== 'NOT_REQUESTED') {
      explanations['impact'] = `Impact is ${sections.impact.status}${sections.impact.reason ? `: ${sections.impact.reason}` : ''}.`;
    }

    // 7. History explanation
    if (sections.history.status === 'AVAILABLE' && sections.history.data) {
      const milestoneCount = sections.history.data.milestones.length;
      const eventCount = sections.history.data.recentEventsCount;
      explanations['history'] = `Feature evolution records ${milestoneCount} milestone(s) and ${eventCount} recent history event(s) tracked by FeatureHistoryEngine.`;
    } else if (sections.history.status !== 'NOT_REQUESTED') {
      explanations['history'] = `History is ${sections.history.status}${sections.history.reason ? `: ${sections.history.reason}` : ''}.`;
    }

    return explanations;
  }
}
