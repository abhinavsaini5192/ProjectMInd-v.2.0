import type { IProjectMemoryManager } from '../interfaces/IProjectMemoryManager.js';
import type { IProjectMemoryStore, ProjectMemoryQueryOptions } from '../interfaces/IProjectMemoryStore.js';
import type { ProjectMemory, ProjectMemoryCandidate } from '../models/ProjectMemory.js';
import type { MemoryAuthority, MemoryStatus } from '../models/MemoryEnums.js';
import crypto from 'node:crypto';

export class ProjectMemoryManager implements IProjectMemoryManager {
  constructor(private readonly store: IProjectMemoryStore) {}

  public async proposeCandidate(
    candidateData: Omit<ProjectMemoryCandidate, 'candidateId' | 'proposedAt'>
  ): Promise<ProjectMemoryCandidate> {
    const candidateId = `cand_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const candidate: ProjectMemoryCandidate = {
      ...candidateData,
      candidateId,
      proposedAt: Date.now(),
    };

    await this.store.saveCandidate(candidate);
    return candidate;
  }

  public async promoteCandidate(
    candidateId: string,
    overrideAuthority?: MemoryAuthority
  ): Promise<ProjectMemory> {
    const candidate = await this.store.getCandidate(candidateId);
    if (!candidate) {
      throw new Error(`Memory candidate '${candidateId}' not found for promotion.`);
    }

    // Determine authority according to strict ProjectMind provenance rules:
    // AGENT provenance can NEVER automatically become AUTHORITATIVE without human or verification backing.
    let authority: MemoryAuthority = overrideAuthority ?? candidate.authority;
    if (!overrideAuthority && candidate.provenance === 'AGENT') {
      authority = 'NON_AUTHORITATIVE';
    } else if (!overrideAuthority && candidate.provenance === 'DEVELOPER') {
      authority = 'AUTHORITATIVE';
    } else if (!overrideAuthority && (candidate.provenance === 'VERIFICATION' || candidate.provenance === 'REPOSITORY')) {
      authority = 'VERIFIED';
    }

    const memoryId = `mem_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const now = Date.now();

    // Check for existing memories to supersede (e.g., matching feature, resource, or title conflict)
    const existing = await this.store.find({
      repositoryId: candidate.repositoryId,
      workspaceId: candidate.workspaceId,
      projectId: candidate.projectId,
      types: [candidate.type],
      status: ['ACTIVE'],
    });

    const supersededIds: string[] = [];
    for (const oldMem of existing) {
      // If same title or explicitly mentions migration/superseding of the older concept
      const titleMatch = oldMem.title.toLowerCase() === candidate.title.toLowerCase();
      const contentMentionsOld = candidate.content.toLowerCase().includes(oldMem.title.toLowerCase());
      const sharePrimaryResource =
        candidate.relatedResources.length > 0 &&
        oldMem.relatedResources.some((r) => candidate.relatedResources.includes(r));

      if ((titleMatch || contentMentionsOld) && sharePrimaryResource) {
        await this.supersedeMemory(oldMem.memoryId, memoryId);
        supersededIds.push(oldMem.memoryId);
      }
    }

    const memory: ProjectMemory = {
      memoryId,
      workspaceId: candidate.workspaceId,
      projectId: candidate.projectId,
      repositoryId: candidate.repositoryId,
      type: candidate.type,
      title: candidate.title,
      content: candidate.content,
      structuredData: candidate.structuredData,
      source: candidate.source,
      provenance: candidate.provenance,
      confidence: candidate.confidence,
      authority,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
      validFrom: now,
      version: 1,
      evidence: [...candidate.evidence],
      relatedResources: [...candidate.relatedResources],
      relatedFeatures: [...candidate.relatedFeatures],
      relatedTasks: [...candidate.relatedTasks],
      supersedes: supersededIds.length > 0 ? supersededIds : undefined,
    };

    await this.store.save(memory);
    await this.store.deleteCandidate(candidateId);
    return memory;
  }

  public async rejectCandidate(candidateId: string, reason: string): Promise<boolean> {
    const candidate = await this.store.getCandidate(candidateId);
    if (!candidate) return false;
    return this.store.deleteCandidate(candidateId);
  }

  public async recordMemory(
    memoryData: Omit<ProjectMemory, 'memoryId' | 'createdAt' | 'updatedAt' | 'version'>
  ): Promise<ProjectMemory> {
    const memoryId = `mem_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const now = Date.now();

    const memory: ProjectMemory = {
      ...memoryData,
      memoryId,
      createdAt: now,
      updatedAt: now,
      validFrom: memoryData.validFrom ?? now,
      version: 1,
    };

    await this.store.save(memory);
    return memory;
  }

  public async supersedeMemory(oldMemoryId: string, newMemoryId: string): Promise<void> {
    const oldMem = await this.store.get(oldMemoryId);
    if (oldMem && oldMem.status === 'ACTIVE') {
      const updated: ProjectMemory = {
        ...oldMem,
        status: 'SUPERSEDED',
        supersededBy: newMemoryId,
        validUntil: Date.now(),
        updatedAt: Date.now(),
        version: oldMem.version + 1,
      };
      await this.store.save(updated);
    }
  }

  public async invalidateMemory(memoryId: string, reason: string): Promise<void> {
    const mem = await this.store.get(memoryId);
    if (mem && mem.status !== 'INVALIDATED') {
      const updated: ProjectMemory = {
        ...mem,
        status: 'INVALIDATED',
        validUntil: Date.now(),
        updatedAt: Date.now(),
        evidence: [...mem.evidence, `Invalidated: ${reason}`],
        version: mem.version + 1,
      };
      await this.store.save(updated);
    }
  }

  public async queryMemories(options: ProjectMemoryQueryOptions): Promise<ProjectMemory[]> {
    return this.store.find(options);
  }
}
