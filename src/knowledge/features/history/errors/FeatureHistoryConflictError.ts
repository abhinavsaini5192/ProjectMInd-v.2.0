import { FeatureHistoryError } from './FeatureHistoryError.js';

export class FeatureHistoryConflictError extends FeatureHistoryError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, details);
    this.name = 'FeatureHistoryConflictError';
  }
}
