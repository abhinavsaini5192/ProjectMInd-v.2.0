import type { FeatureId } from '../../models/FeatureId';
import type { FeatureScope } from '../../models/FeatureScope';
import type { FeatureRelationshipType } from './FeatureRelationshipType';
import type { FeatureRelationshipDirection } from './FeatureRelationshipDirection';
import type { FeatureRelationshipConfidence } from './FeatureRelationshipConfidence';
import type { FeatureRelationshipEvidence } from './FeatureRelationshipEvidence';

export type RelationshipSource = 'MANUAL' | 'DISCOVERED' | 'INFERRED' | 'IMPORTED';

export interface FeatureRelationship {
  relationshipId: string;
  sourceFeatureId: FeatureId;
  targetFeatureId: FeatureId;
  relationshipType: FeatureRelationshipType;
  type?: FeatureRelationshipType;
  direction: FeatureRelationshipDirection;
  confidence: FeatureRelationshipConfidence;
  score: number;
  strength?: number;
  evidence: FeatureRelationshipEvidence[];
  source: RelationshipSource;
  scope: FeatureScope;
  createdAt: number;
  updatedAt: number;
  knowledgeVersion: string;
  relationshipVersion: number;
  active: boolean;
  deactivationReason?: string;
}
