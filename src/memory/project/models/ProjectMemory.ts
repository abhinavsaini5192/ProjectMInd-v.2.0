import type {
  MemoryCategory,
  MemoryStatus,
  MemoryProvenance,
  MemoryAuthority,
} from './MemoryEnums.js';

export interface ProjectMemoryCandidate {
  readonly candidateId: string;
  readonly workspaceId: string;
  readonly projectId?: string | undefined;
  readonly repositoryId: string;
  readonly type: MemoryCategory;
  readonly title: string;
  readonly content: string;
  readonly structuredData?: Record<string, any> | undefined;
  readonly source: string;
  readonly provenance: MemoryProvenance;
  readonly confidence: number;
  readonly authority: MemoryAuthority;
  readonly proposedAt: number;
  readonly evidence: string[];
  readonly relatedResources: string[];
  readonly relatedFeatures: string[];
  readonly relatedTasks: string[];
}

export interface ProjectMemory {
  readonly memoryId: string;
  readonly workspaceId: string;
  readonly projectId?: string | undefined;
  readonly repositoryId: string;
  readonly type: MemoryCategory;
  readonly title: string;
  readonly content: string;
  readonly structuredData?: Record<string, any> | undefined;
  readonly source: string;
  readonly provenance: MemoryProvenance;
  readonly confidence: number;
  readonly authority: MemoryAuthority;
  readonly status: MemoryStatus;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly validFrom?: number | undefined;
  readonly validUntil?: number | undefined;
  readonly version: number;
  readonly evidence: string[];
  readonly relatedResources: string[];
  readonly relatedFeatures: string[];
  readonly relatedTasks: string[];
  readonly supersedes?: string[] | undefined;
  readonly supersededBy?: string | undefined;
}
