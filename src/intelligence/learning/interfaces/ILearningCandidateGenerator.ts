import type { LearningSignal } from '../models/LearningSignal.js';
import type { LearningCandidate } from '../models/LearningCandidate.js';

export interface ILearningCandidateGenerator {
  generateCandidates(signals: readonly LearningSignal[]): Promise<LearningCandidate[]>;
}
