import type { ProjectMemory, ProjectMemoryCandidate } from '../models/ProjectMemory.js';
import type { MemoryAuthority } from '../models/MemoryEnums.js';
import type { ProjectMemoryQueryOptions } from './IProjectMemoryStore.js';

export interface IProjectMemoryManager {
  proposeCandidate(
    candidate: Omit<ProjectMemoryCandidate, 'candidateId' | 'proposedAt'>
  ): Promise<ProjectMemoryCandidate>;
  promoteCandidate(candidateId: string, overrideAuthority?: MemoryAuthority): Promise<ProjectMemory>;
  rejectCandidate(candidateId: string, reason: string): Promise<boolean>;
  recordMemory(memory: Omit<ProjectMemory, 'memoryId' | 'createdAt' | 'updatedAt' | 'version'>): Promise<ProjectMemory>;
  supersedeMemory(oldMemoryId: string, newMemoryId: string): Promise<void>;
  invalidateMemory(memoryId: string, reason: string): Promise<void>;
  queryMemories(options: ProjectMemoryQueryOptions): Promise<ProjectMemory[]>;
}
