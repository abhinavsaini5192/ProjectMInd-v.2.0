export type ObservationOrderingStatus =
  | 'ORDERED'
  | 'OUT_OF_ORDER'
  | 'DUPLICATE'
  | 'LATE'
  | 'UNKNOWN';

export const OBSERVATION_ORDERING_STATUSES: readonly ObservationOrderingStatus[] = [
  'ORDERED',
  'OUT_OF_ORDER',
  'DUPLICATE',
  'LATE',
  'UNKNOWN',
] as const;
