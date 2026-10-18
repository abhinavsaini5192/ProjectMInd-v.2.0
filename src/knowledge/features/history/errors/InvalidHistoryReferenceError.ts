import { FeatureHistoryError } from './FeatureHistoryError.js';

export class InvalidHistoryReferenceError extends FeatureHistoryError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, details);
    this.name = 'InvalidHistoryReferenceError';
  }
}
