export type ContextFeedbackRating =
  | 'USEFUL'
  | 'PARTIALLY_USEFUL'
  | 'INSUFFICIENT'
  | 'IRRELEVANT'
  | 'STALE';

export interface ContextFeedback {
  readonly feedbackId: string;
  readonly contextSessionId: string;
  readonly agentSessionId: string;
  readonly rating: ContextFeedbackRating;
  readonly missingFeatures?: readonly string[] | undefined;
  readonly missingResources?: readonly string[] | undefined;
  readonly unnecessaryResources?: readonly string[] | undefined;
  readonly missingSections?: readonly string[] | undefined;
  readonly comments?: string | undefined;
  readonly recordedAt: Date;
}

export interface ContextFeedbackParams {
  readonly contextSessionId: string;
  readonly rating: ContextFeedbackRating;
  readonly missingFeatures?: readonly string[] | undefined;
  readonly missingResources?: readonly string[] | undefined;
  readonly unnecessaryResources?: readonly string[] | undefined;
  readonly missingSections?: readonly string[] | undefined;
  readonly comments?: string | undefined;
}
