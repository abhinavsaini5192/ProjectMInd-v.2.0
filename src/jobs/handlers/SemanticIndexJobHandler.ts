import type { IJobHandler, JobExecutionContext } from '../registry/IJobHandler.js';
import type { Job } from '../models/Job.js';
import type { JobResult } from '../models/JobResult.js';
import { JobError } from '../models/JobError.js';
import type { ISemanticIndex } from '../../retrieval/interfaces/ISemanticIndex.js';
import type { IEmbeddingProvider } from '../../retrieval/interfaces/IEmbeddingProvider.js';

export interface SemanticChunkInput {
  readonly resourceId: string;
  readonly resourceType: string;
  readonly title: string;
  readonly content: string;
  readonly sourceVersion?: string | number | undefined;
  readonly metadata?: Record<string, any> | undefined;
}

export interface SemanticIndexJobPayload {
  readonly workspaceId: string;
  readonly projectId?: string | undefined;
  readonly repositoryId: string;
  readonly chunks: readonly SemanticChunkInput[];
}

export class SemanticIndexJobHandler implements IJobHandler<SemanticIndexJobPayload> {
  constructor(
    private readonly semanticIndex: ISemanticIndex,
    private readonly embeddingProvider: IEmbeddingProvider
  ) {}

  public validate(job: Job<SemanticIndexJobPayload>): void {
    if (!job.payload) {
      throw new JobError('JOB_PAYLOAD_INVALID', 'Semantic index job requires a valid payload', false);
    }
    if (!job.payload.repositoryId && !job.repositoryId) {
      throw new JobError('JOB_PAYLOAD_INVALID', 'Semantic index job requires a repositoryId', false);
    }
    if (!Array.isArray(job.payload.chunks) || job.payload.chunks.length === 0) {
      throw new JobError('JOB_PAYLOAD_INVALID', 'Semantic index job requires at least one chunk to index', false);
    }
  }

  public async execute(
    job: Job<SemanticIndexJobPayload>,
    context: JobExecutionContext
  ): Promise<Omit<JobResult, 'jobId' | 'status' | 'completedAt'>> {
    if (context.signal.aborted) {
      throw new JobError('JOB_CANCELLED', 'Job cancelled before execution', false);
    }

    const { workspaceId, projectId, repositoryId, chunks } = job.payload;
    const startTime = Date.now();
    await context.updateProgress(10, 100, `Starting semantic indexing of ${chunks.length} chunks`);

    const affectedResources: string[] = [];
    const total = chunks.length;

    for (let i = 0; i < total; i++) {
      if (context.signal.aborted) {
        throw new JobError('JOB_CANCELLED', 'Job cancelled during execution', false);
      }

      const chunk = chunks[i]!;
      const embedding = await this.embeddingProvider.embedText(chunk.content);

      await this.semanticIndex.index({
        resourceId: chunk.resourceId,
        resourceType: chunk.resourceType,
        workspaceId,
        projectId,
        repositoryId,
        title: chunk.title,
        snippet: chunk.content.slice(0, 300),
        embedding,
        embeddingVersion: this.embeddingProvider.metadata.version,
        sourceVersion: chunk.sourceVersion ?? 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: chunk.metadata,
      });

      affectedResources.push(chunk.resourceId);
      const progressPercent = Math.min(95, Math.floor(10 + ((i + 1) / total) * 85));
      await context.updateProgress(progressPercent, 100, `Indexed chunk ${i + 1}/${total}`);
    }

    await context.updateProgress(100, 100, 'Semantic indexing complete');
    const durationMs = Date.now() - startTime;

    return {
      affectedResources,
      data: {
        chunksIndexed: total,
        indexVersion: this.semanticIndex.getVersion(),
      },
      metrics: {
        durationMs,
        resourcesAffected: affectedResources.length,
      },
    };
  }
}
