import type { FeatureKnowledgeFreshness } from './FeatureKnowledgeFreshness.js';
import type { FeatureKnowledgeVersion } from './FeatureKnowledgeVersion.js';

export interface FeatureKnowledgeMetadata {
  requestId: string;
  generatedAt: number;
  durationMs: number;
  workspaceId: string;
  repositoryId: string;
  knowledgeVersion: string;
  freshness: FeatureKnowledgeFreshness;
  versionStatus: FeatureKnowledgeVersion;
}
