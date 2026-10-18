import { FeatureId } from './FeatureId';
import { FeatureType } from './FeatureType';
import { FeatureStatus } from './FeatureStatus';
import { FeatureConfidence, FeatureConfidenceLevel } from './FeatureConfidence';
import { FeatureScope } from './FeatureScope';
import { FeatureOrigin } from './FeatureOrigin';
import { FeatureMetadata } from './FeatureMetadata';
import { FeatureReference } from './FeatureReference';
import { FeatureRelationship } from './FeatureRelationship';
import { FeatureEvidence } from './FeatureEvidence';

export interface Feature {
  id: FeatureId;
  featureId: FeatureId;
  name: string;
  description: string;
  type: FeatureType;
  status: FeatureStatus;
  origin: FeatureOrigin;
  confidence: FeatureConfidence;
  scope: FeatureScope;
  metadata: FeatureMetadata;
  references: FeatureReference[];
  relationships: FeatureRelationship[];
  evidence?: FeatureEvidence[];
  symbolIds?: string[];
  version: number;
  createdAt: number;
  updatedAt: number;
}

export function createDefaultFeature(
  id: FeatureId,
  name: string,
  scope: FeatureScope,
  options: Partial<Feature> = {}
): Feature {
  const now = Date.now();
  return {
    id,
    featureId: id,
    name,
    description: options.description || '',
    type: options.type || FeatureType.UNKNOWN,
    status: options.status || FeatureStatus.DISCOVERED,
    origin: options.origin || FeatureOrigin.MANUAL,
    confidence: options.confidence || { level: FeatureConfidenceLevel.UNKNOWN, score: 0.5 },
    scope,
    metadata: options.metadata || {},
    references: options.references || [],
    relationships: options.relationships || [],
    evidence: options.evidence || [],
    version: options.version || 1,
    createdAt: options.createdAt || now,
    updatedAt: options.updatedAt || now
  };
}
