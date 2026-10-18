import type {
  IProjectMemoryStore,
  ProjectMemoryQueryOptions,
} from '../interfaces/IProjectMemoryStore.js';
import type { ProjectMemory, ProjectMemoryCandidate } from '../models/ProjectMemory.js';

export class InMemoryProjectMemoryStore implements IProjectMemoryStore {
  private readonly memories = new Map<string, ProjectMemory>();
  private readonly candidates = new Map<string, ProjectMemoryCandidate>();

  public async save(memory: ProjectMemory): Promise<void> {
    this.memories.set(memory.memoryId, memory);
  }

  public async get(memoryId: string): Promise<ProjectMemory | undefined> {
    return this.memories.get(memoryId);
  }

  public async find(options: ProjectMemoryQueryOptions): Promise<ProjectMemory[]> {
    const results: ProjectMemory[] = [];

    for (const mem of this.memories.values()) {
      // 1. Workspace scope
      if (options.workspaceId && mem.workspaceId !== options.workspaceId) {
        continue;
      }
      // 2. Project scope
      if (options.projectId && mem.projectId && mem.projectId !== options.projectId) {
        continue;
      }
      // 3. Repository scope
      if (options.repositoryId && mem.repositoryId !== options.repositoryId) {
        continue;
      }
      // 4. Status filter
      if (options.status && options.status.length > 0) {
        if (!options.status.includes(mem.status)) {
          continue;
        }
      }
      // 5. Types filter
      if (options.types && options.types.length > 0) {
        if (!options.types.includes(mem.type)) {
          continue;
        }
      }
      // 6. Related Feature filter
      if (options.relatedFeature) {
        if (!mem.relatedFeatures.includes(options.relatedFeature)) {
          continue;
        }
      }
      // 7. Related Resource filter
      if (options.relatedResource) {
        if (!mem.relatedResources.some((r) => r.includes(options.relatedResource!))) {
          continue;
        }
      }
      // 8. Temporal validity check
      if (options.validAt !== undefined) {
        if (mem.validFrom !== undefined && mem.validFrom > options.validAt) {
          continue;
        }
        if (mem.validUntil !== undefined && mem.validUntil <= options.validAt) {
          continue;
        }
      }

      results.push(mem);
      if (options.limit && results.length >= options.limit) {
        break;
      }
    }

    return results;
  }

  public async saveCandidate(candidate: ProjectMemoryCandidate): Promise<void> {
    this.candidates.set(candidate.candidateId, candidate);
  }

  public async getCandidate(candidateId: string): Promise<ProjectMemoryCandidate | undefined> {
    return this.candidates.get(candidateId);
  }

  public async listCandidates(
    repositoryId: string,
    projectId?: string
  ): Promise<ProjectMemoryCandidate[]> {
    const list: ProjectMemoryCandidate[] = [];
    for (const cand of this.candidates.values()) {
      if (cand.repositoryId === repositoryId) {
        if (!projectId || cand.projectId === projectId) {
          list.push(cand);
        }
      }
    }
    return list;
  }

  public async deleteCandidate(candidateId: string): Promise<boolean> {
    return this.candidates.delete(candidateId);
  }
}
