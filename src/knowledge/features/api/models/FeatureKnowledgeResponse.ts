import type { FeatureKnowledgeProfile } from './FeatureKnowledgeProfile.js';
import type { FeatureKnowledgeMetadata } from './FeatureKnowledgeMetadata.js';
import type { FeatureKnowledgeErrorInfo } from './FeatureKnowledgeErrorInfo.js';

export interface FeatureKnowledgeResponse {
  success: boolean;
  profile: FeatureKnowledgeProfile;
  metadata: FeatureKnowledgeMetadata;
  errors?: FeatureKnowledgeErrorInfo[] | undefined;
}

export type FeatureKnowledgeQueryResult = FeatureKnowledgeResponse;
