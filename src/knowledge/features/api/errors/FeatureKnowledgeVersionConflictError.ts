import { FeatureKnowledgeError } from './FeatureKnowledgeError.js';

export class FeatureKnowledgeVersionConflictError extends FeatureKnowledgeError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, details);
    this.name = 'FeatureKnowledgeVersionConflictError';
  }
}
