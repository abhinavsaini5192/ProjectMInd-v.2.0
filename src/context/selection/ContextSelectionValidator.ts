import type { SelectedContextData } from '../interfaces/IContextSelector.js';
import type { RetrievedContextData } from '../interfaces/IContextRetriever.js';
import { ContextPlanningError } from '../errors/ContextPlanningError.js';

export class ContextSelectionValidator {
  public static validate(
    selected: SelectedContextData,
    retrieved: RetrievedContextData
  ): void {
    if (retrieved.featureKnowledgeMap.size > 0 && selected.features.length === 0) {
      throw new ContextPlanningError(
        'Context selection produced 0 features despite retrieved feature knowledge.'
      );
    }

    for (const r of selected.resources) {
      if (!r.resourceId || typeof r.resourceId !== 'string') {
        throw new ContextPlanningError(`Selected resource has invalid resourceId: ${String(r.resourceId)}`);
      }
    }
  }
}
