import type { IKnowledgeUpdateExplainer } from '../interfaces/IKnowledgeUpdateExplainer.js';
import type { KnowledgeUpdate } from '../models/KnowledgeUpdate.js';
import type { KnowledgeUpdatePlan } from '../models/KnowledgeUpdatePlan.js';
import type { KnowledgeUpdateResult } from '../models/KnowledgeUpdateResult.js';

export class KnowledgeUpdateExplainer implements IKnowledgeUpdateExplainer {
  public explain(
    update: KnowledgeUpdate,
    plan?: KnowledgeUpdatePlan | undefined,
    result?: KnowledgeUpdateResult | undefined
  ): string {
    const parts: string[] = [];

    parts.push(
      `Update ${update.updateId} (${update.updateType}) received from source ${update.source} with provenance ${update.provenance} for repository '${update.repositoryId}'.`
    );

    if (update.affectedResources.length > 0) {
      parts.push(`Affected resources: [${update.affectedResources.join(', ')}].`);
    } else {
      parts.push('No direct resources targeted.');
    }

    if (result) {
      if (result.affectedFeatures.length > 0) {
        parts.push(`Targeted features: [${result.affectedFeatures.join(', ')}].`);
      }
      if (result.appliedAreas.length > 0) {
        parts.push(`Applied knowledge areas: [${result.appliedAreas.join(', ')}].`);
      }
      if (result.failedAreas.length > 0) {
        parts.push(`Failed knowledge areas: [${result.failedAreas.join(', ')}].`);
      }
      if (result.newKnowledgeVersion) {
        const prev = result.previousKnowledgeVersion ? `from ${result.previousKnowledgeVersion} ` : '';
        parts.push(`Knowledge version advanced ${prev}to ${result.newKnowledgeVersion}.`);
      }
      if (result.invalidations.length > 0) {
        const invSummary = result.invalidations.map((i) => `${i.targetType}:${i.targetId}`).join(', ');
        parts.push(`Invalidations issued for: [${invSummary}].`);
      }
      if (result.refreshDecisions.length > 0) {
        const policies = result.refreshDecisions.map((d) => d.policy).join(', ');
        parts.push(`Context refresh policy: [${policies}].`);
      }
      if (result.conflicts.length > 0) {
        parts.push(`Active conflicts detected: ${result.conflicts.length}.`);
      }
    } else if (plan) {
      if (plan.targetFeatures.length > 0) {
        parts.push(`Planned feature targets: [${plan.targetFeatures.join(', ')}].`);
      }
      parts.push(`Planned operations count: ${plan.operations.length}.`);
    }

    return parts.join(' ');
  }
}
