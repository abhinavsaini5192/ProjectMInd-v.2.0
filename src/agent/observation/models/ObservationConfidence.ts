export type ObservationConfidence =
  | 'CONFIRMED'
  | 'HIGH'
  | 'MEDIUM'
  | 'LOW'
  | 'UNKNOWN';

export const OBSERVATION_CONFIDENCE_LEVELS: readonly ObservationConfidence[] = [
  'CONFIRMED',
  'HIGH',
  'MEDIUM',
  'LOW',
  'UNKNOWN',
] as const;

export function isObservationConfidence(value: unknown): value is ObservationConfidence {
  return typeof value === 'string' && OBSERVATION_CONFIDENCE_LEVELS.includes(value as ObservationConfidence);
}
