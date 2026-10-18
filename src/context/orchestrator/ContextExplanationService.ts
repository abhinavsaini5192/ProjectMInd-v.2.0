import type { IContextExplanationService } from '../interfaces/IContextExplanationService.js';
import type { ContextRequest } from '../models/ContextRequest.js';
import type { SelectedContextData } from '../interfaces/IContextSelector.js';
import type { ContextExplanation, SelectionExplanation } from '../models/ContextExplanation.js';

export class ContextExplanationService implements IContextExplanationService {
  public generateExplanation(
    request: ContextRequest,
    selected: SelectedContextData
  ): ContextExplanation {
    const taskSummary = request.taskText
      ? `Analyzed task: "${request.taskText}". Identified ${selected.features.length} features and ${selected.resources.length} resources.`
      : `Context planned based on explicit identifiers. Identified ${selected.features.length} features and ${selected.resources.length} resources.`;

    const featureReasons: Record<string, string> = {};
    const resourceReasons: Record<string, string> = {};
    const detailed: SelectionExplanation[] = [];

    for (const f of selected.features) {
      const reason = `Role: ${f.role}, score: ${f.relevance.score}. Reasons: ${f.relevance.reasons.join(' ')}`;
      featureReasons[f.featureId] = reason;

      detailed.push({
        targetId: f.featureId,
        targetType: 'FEATURE',
        reason,
        score: f.relevance.score,
        subsystemSource: 'FeatureKnowledgeAPI',
      });
    }

    for (const r of selected.resources) {
      const reason = `Role: ${r.role}, score: ${r.relevance.score}. Reasons: ${r.relevance.reasons.join(' ')}`;
      resourceReasons[r.resourceId] = reason;

      detailed.push({
        targetId: r.resourceId,
        targetType: 'RESOURCE',
        reason,
        score: r.relevance.score,
        subsystemSource: 'FeatureMappingRepository',
      });
    }

    return {
      taskAnalysisSummary: taskSummary,
      featureSelectionReasons: featureReasons,
      resourceSelectionReasons: resourceReasons,
      omissionReasons: {},
      detailedExplanations: detailed,
    };
  }
}
