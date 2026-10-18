import { FeatureKnowledgeError } from './FeatureKnowledgeError.js';

export class FeatureKnowledgeAccessError extends FeatureKnowledgeError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, details);
    this.name = 'FeatureKnowledgeAccessError';
  }
}
