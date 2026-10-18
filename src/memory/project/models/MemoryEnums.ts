export type MemoryCategory =
  | 'TECHNICAL'
  | 'ARCHITECTURE'
  | 'DECISION'
  | 'FEATURE'
  | 'TASK'
  | 'BUG'
  | 'INCIDENT'
  | 'DEPENDENCY'
  | 'CONFIGURATION'
  | 'SECURITY'
  | 'PERFORMANCE'
  | 'MIGRATION'
  | 'DEPRECATION'
  | 'TEAM'
  | 'OPERATIONAL'
  | 'UNKNOWN';

export type MemoryStatus =
  | 'CANDIDATE'
  | 'ACTIVE'
  | 'SUPERSEDED'
  | 'DEPRECATED'
  | 'INVALIDATED'
  | 'CONFLICTED'
  | 'ARCHIVED';

export type MemoryProvenance =
  | 'DEVELOPER'
  | 'REPOSITORY'
  | 'DOCUMENTATION'
  | 'AGENT'
  | 'VERIFICATION'
  | 'SYSTEM'
  | 'HISTORY'
  | 'IMPORTED'
  | 'INFERRED'
  | 'UNKNOWN';

export type MemoryAuthority =
  | 'AUTHORITATIVE'      // Formally approved, verified by human or system truth
  | 'VERIFIED'           // Verified against code or automated test run
  | 'NON_AUTHORITATIVE'  // Unverified observation or agent claim
  | 'HYPOTHETICAL';      // Proposed speculative reasoning
