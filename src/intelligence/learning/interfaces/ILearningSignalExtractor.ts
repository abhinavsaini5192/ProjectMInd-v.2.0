import type { Feedback } from '../models/Feedback.js';
import type { LearningSignal } from '../models/LearningSignal.js';

export interface ILearningSignalExtractor {
  extractSignals(feedbackItems: readonly Feedback[]): Promise<LearningSignal[]>;
}
