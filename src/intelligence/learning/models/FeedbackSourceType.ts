export type FeedbackSourceType =
  | 'USER'
  | 'AGENT'
  | 'TASK'
  | 'PLAN'
  | 'CONTEXT'
  | 'RETRIEVAL'
  | 'VERIFICATION'
  | 'EXECUTION'
  | 'COLLABORATION'
  | 'SYSTEM'
  | 'REVIEW'
  | 'UNKNOWN';

export const ALL_FEEDBACK_SOURCE_TYPES: readonly FeedbackSourceType[] = [
  'USER',
  'AGENT',
  'TASK',
  'PLAN',
  'CONTEXT',
  'RETRIEVAL',
  'VERIFICATION',
  'EXECUTION',
  'COLLABORATION',
  'SYSTEM',
  'REVIEW',
  'UNKNOWN',
];
