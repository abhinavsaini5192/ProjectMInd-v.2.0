import type { FeatureTimeline } from '../models/FeatureTimeline.js';
import type { FeatureSnapshot } from '../models/FeatureSnapshot.js';
import type { FeatureVersionSnapshot } from '../models/FeatureVersionSnapshot.js';

export interface IFeatureVersionResolver {
  resolveVersions(
    featureId: string,
    timeline: FeatureTimeline,
    snapshots: FeatureSnapshot[]
  ): FeatureVersionSnapshot[];
}
