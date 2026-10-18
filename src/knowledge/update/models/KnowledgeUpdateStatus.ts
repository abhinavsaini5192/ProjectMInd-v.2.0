export type KnowledgeUpdateStatus =
  | 'RECEIVED'
  | 'VALIDATED'
  | 'PLANNED'
  | 'PROCESSING'
  | 'PARTIALLY_APPLIED'
  | 'APPLIED'
  | 'CONFLICTED'
  | 'FAILED'
  | 'RETRY_PENDING'
  | 'SUPERSEDED'
  | 'REJECTED';

const VALID_TRANSITIONS: Record<KnowledgeUpdateStatus, readonly KnowledgeUpdateStatus[]> = {
  RECEIVED: ['VALIDATED', 'REJECTED', 'SUPERSEDED'],
  VALIDATED: ['PLANNED', 'REJECTED', 'SUPERSEDED'],
  PLANNED: ['PROCESSING', 'REJECTED', 'SUPERSEDED'],
  PROCESSING: ['APPLIED', 'PARTIALLY_APPLIED', 'CONFLICTED', 'FAILED', 'SUPERSEDED'],
  PARTIALLY_APPLIED: ['RETRY_PENDING', 'PROCESSING', 'APPLIED', 'FAILED', 'SUPERSEDED'],
  APPLIED: ['SUPERSEDED'],
  CONFLICTED: ['PROCESSING', 'RETRY_PENDING', 'SUPERSEDED', 'REJECTED'],
  FAILED: ['RETRY_PENDING', 'PROCESSING', 'SUPERSEDED', 'REJECTED'],
  RETRY_PENDING: ['PROCESSING', 'REJECTED', 'SUPERSEDED'],
  SUPERSEDED: [],
  REJECTED: [],
};

export function isValidKnowledgeUpdateTransition(
  from: KnowledgeUpdateStatus,
  to: KnowledgeUpdateStatus
): boolean {
  if (from === to) return true;
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
