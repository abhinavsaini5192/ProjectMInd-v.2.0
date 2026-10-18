import { FeatureKnowledgeError } from './FeatureKnowledgeError.js';

export class FeatureKnowledgeNotFoundError extends FeatureKnowledgeError {
  constructor(featureId: string, details?: Record<string, any>) {
    super(`Feature not found: ${featureId}`, details);
    this.name = 'FeatureKnowledgeNotFoundError';
  }
}
