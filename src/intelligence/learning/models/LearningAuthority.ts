export type LearningAuthority =
  | 'OBSERVED'
  | 'AGENT_REPORTED'
  | 'USER_REPORTED'
  | 'DERIVED'
  | 'VERIFIED'
  | 'APPROVED'
  | 'DEPLOYED';

export const AUTHORITY_PRECEDENCE: Record<LearningAuthority, number> = {
  OBSERVED: 10,
  AGENT_REPORTED: 20,
  DERIVED: 30,
  USER_REPORTED: 50,
  VERIFIED: 70,
  APPROVED: 85,
  DEPLOYED: 100,
};
