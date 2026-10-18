import type { Feedback, RawFeedbackInput } from '../models/Feedback.js';

export interface IFeedbackNormalizer {
  normalize(input: RawFeedbackInput): Promise<Feedback>;
}
