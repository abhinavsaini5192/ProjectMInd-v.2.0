import { FeatureHistoryError } from './FeatureHistoryError.js';

export class FeatureEvolutionError extends FeatureHistoryError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, details);
    this.name = 'FeatureEvolutionError';
  }
}
