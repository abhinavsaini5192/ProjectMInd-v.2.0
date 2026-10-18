export class FeatureHistoryError extends Error {
  constructor(message: string, public readonly details?: Record<string, any>) {
    super(message);
    this.name = 'FeatureHistoryError';
  }
}
