export type ObservationSource =
  | 'AGENT'
  | 'SYSTEM'
  | 'REPOSITORY'
  | 'VERIFICATION'
  | 'TOOL'
  | 'MCP'
  | 'UNKNOWN';

export const OBSERVATION_SOURCES: readonly ObservationSource[] = [
  'AGENT',
  'SYSTEM',
  'REPOSITORY',
  'VERIFICATION',
  'TOOL',
  'MCP',
  'UNKNOWN',
] as const;

export function isObservationSource(value: unknown): value is ObservationSource {
  return typeof value === 'string' && OBSERVATION_SOURCES.includes(value as ObservationSource);
}

/**
 * Deterministic source precedence rank: higher number = higher trust precedence.
 */
export const SOURCE_PRECEDENCE_RANK: Readonly<Record<ObservationSource, number>> = {
  VERIFICATION: 50,
  SYSTEM: 40,
  REPOSITORY: 30,
  AGENT: 20,
  TOOL: 15,
  MCP: 10,
  UNKNOWN: 0,
};
