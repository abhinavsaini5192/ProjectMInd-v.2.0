import type { FeatureScope } from '../../models/FeatureScope';
import type { MappingResourceType } from './MappingResourceType';
import type { MappingRole } from './MappingRole';
import type { MappingConfidence } from './MappingConfidence';
import type { MappingEvidence } from './MappingEvidence';
import type { MappingSourceType } from './MappingSource';

export interface FeatureResourceMapping {
  mappingId: string;
  featureId: string;
  resourceId: string;
  resourceType: MappingResourceType;
  role: MappingRole;
  confidence: MappingConfidence;
  score: number;
  evidence: MappingEvidence[];
  source: MappingSourceType;
  scope: FeatureScope;
  createdAt: number;
  updatedAt: number;
  knowledgeVersion: string;
  mappingVersion: number;
  active: boolean;
  metadata?: Record<string, any>;
  path?: string;
  deactivationReason?: string;
}
