import { z } from 'zod';
import { SLMResponse } from '../models/SLMResponse.js';
import { SLMError } from '../models/SLMError.js';

// Ensure the SLM output matches our expected schema
const slmPredictionSchema = z.object({
  intent: z.string(),
  relevantFeatures: z.array(z.string()),
  recommendedContext: z.array(z.string()),
  reasoningSummary: z.string(),
  confidence: z.number().min(0).max(1)
});

export class SLMOutputValidator {
  constructor(private knownRepositoryEntities: Set<string>) {}

  public validate(response: SLMResponse): void {
    if (!response.prediction) {
      throw new SLMError('SCHEMA_ERROR', 'SLM response does not contain prediction', response.requestId, response.metadata?.provider || 'unknown');
    }

    // 1. Schema Validation
    const parseResult = slmPredictionSchema.safeParse(response.prediction);
    if (!parseResult.success) {
      throw new SLMError('SCHEMA_ERROR', `Invalid SLM output schema: ${parseResult.error.message}`, response.requestId, response.metadata?.provider || 'unknown');
    }

    // 2. Hallucination Check (Security/Safety)
    // The SLM must not invent features or context that do not exist in the repository's known knowledge graph.
    for (const feature of response.prediction.relevantFeatures) {
       if (!this.knownRepositoryEntities.has(feature)) {
          throw new SLMError('HALLUCINATION', `SLM hallucinated non-existent feature: ${feature}`, response.requestId, response.metadata?.provider || 'unknown');
       }
    }

    for (const ctx of response.prediction.recommendedContext) {
       if (!this.knownRepositoryEntities.has(ctx)) {
          throw new SLMError('HALLUCINATION', `SLM hallucinated non-existent context: ${ctx}`, response.requestId, response.metadata?.provider || 'unknown');
       }
    }
  }
}
