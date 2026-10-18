import type { TaskIntent } from '../../context/models/TaskUnderstanding.js';
import type { SecurityContext } from '../../security/models/SecurityContext.js';

export type SemanticQueryType =
  | 'CODE'
  | 'FEATURE'
  | 'ARCHITECTURE'
  | 'DEBUGGING'
  | 'HISTORY'
  | 'DOCUMENTATION'
  | 'PROJECT_MEMORY'
  | 'TASK'
  | 'UNKNOWN';

export interface SemanticQueryFilters {
  readonly sources?: string[];
  readonly resourceTypes?: string[];
  readonly minScore?: number;
  readonly minAuthority?: number;
  readonly limit?: number;
  readonly validAt?: number;
}

export interface SemanticQuery {
  readonly queryId: string;
  readonly workspaceId: string;
  readonly projectId?: string | undefined;
  readonly repositoryId: string;
  readonly text: string;
  readonly queryType: SemanticQueryType;
  readonly taskIntent?: TaskIntent | undefined;
  readonly targetFeatures?: string[] | undefined;
  readonly targetResources?: string[] | undefined;
  readonly filters?: SemanticQueryFilters | undefined;
  readonly budget?: number | undefined;
  readonly timestamp: number;
  readonly securityScope?: SecurityContext | undefined;
  readonly provenance?: string | undefined;
}
