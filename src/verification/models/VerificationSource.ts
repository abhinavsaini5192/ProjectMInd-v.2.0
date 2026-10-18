export type VerificationSource =
  | 'AGENT'
  | 'CI'
  | 'BUILD_SYSTEM'
  | 'TEST_RUNNER'
  | 'IDE'
  | 'MCP'
  | 'SYSTEM'
  | 'MANUAL'
  | 'UNKNOWN';

export const VERIFICATION_SOURCES: readonly VerificationSource[] = [
  'AGENT',
  'CI',
  'BUILD_SYSTEM',
  'TEST_RUNNER',
  'IDE',
  'MCP',
  'SYSTEM',
  'MANUAL',
  'UNKNOWN',
];
