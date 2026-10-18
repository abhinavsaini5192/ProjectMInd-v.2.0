import type { ProjectMemory, ProjectMemoryCandidate } from '../models/ProjectMemory.js';
import type { MemoryCategory, MemoryStatus } from '../models/MemoryEnums.js';

export interface ProjectMemoryQueryOptions {
  readonly workspaceId?: string | undefined;
  readonly projectId?: string | undefined;
  readonly repositoryId?: string | undefined;
  readonly types?: MemoryCategory[] | undefined;
  readonly status?: MemoryStatus[] | undefined;
  readonly relatedFeature?: string | undefined;
  readonly relatedResource?: string | undefined;
  readonly validAt?: number | undefined;
  readonly limit?: number | undefined;
}

export interface IProjectMemoryStore {
  save(memory: ProjectMemory): Promise<void>;
  get(memoryId: string): Promise<ProjectMemory | undefined>;
  find(options: ProjectMemoryQueryOptions): Promise<ProjectMemory[]>;
  saveCandidate(candidate: ProjectMemoryCandidate): Promise<void>;
  getCandidate(candidateId: string): Promise<ProjectMemoryCandidate | undefined>;
  listCandidates(repositoryId: string, projectId?: string): Promise<ProjectMemoryCandidate[]>;
  deleteCandidate(candidateId: string): Promise<boolean>;
}
