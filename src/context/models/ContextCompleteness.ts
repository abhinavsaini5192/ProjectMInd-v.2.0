export type ContextCompletenessLevel = 'FULL' | 'HIGH' | 'PARTIAL' | 'MINIMAL';

export interface ContextCompleteness {
  level: ContextCompletenessLevel;
  score: number; // 0 to 1
  requestedSectionsCount: number;
  providedSectionsCount: number;
  missingSections: string[];
  missingReasons: Record<string, string>;
}
