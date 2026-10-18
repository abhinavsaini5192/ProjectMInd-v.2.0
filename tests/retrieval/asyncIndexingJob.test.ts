import { describe, it, expect, beforeEach } from 'vitest';
import { SemanticIndexJobHandler, type SemanticIndexJobPayload } from '../../src/jobs/handlers/SemanticIndexJobHandler.js';
import { SemanticIndex } from '../../src/retrieval/index/SemanticIndex.js';
import { LocalSemanticEmbeddingProvider } from '../../src/retrieval/embeddings/LocalSemanticEmbeddingProvider.js';
import type { Job } from '../../src/jobs/models/Job.js';
import type { JobExecutionContext } from '../../src/jobs/registry/IJobHandler.js';
import { JobError } from '../../src/jobs/models/JobError.js';

describe('Async Semantic Indexing Job Tests (Phase 9.4 Section 37)', () => {
  let semanticIndex: SemanticIndex;
  let embeddingProvider: LocalSemanticEmbeddingProvider;
  let handler: SemanticIndexJobHandler;

  beforeEach(() => {
    semanticIndex = new SemanticIndex();
    embeddingProvider = new LocalSemanticEmbeddingProvider();
    handler = new SemanticIndexJobHandler(semanticIndex, embeddingProvider);
  });

  const createDummyContext = (signal?: AbortSignal): JobExecutionContext & { progressUpdates: Array<{ current: number; total: number; message?: string }> } => {
    const progressUpdates: Array<{ current: number; total: number; message?: string }> = [];
    return {
      workerId: 'worker-1',
      signal: signal ?? new AbortController().signal,
      updateProgress: async (current: number, total: number, message?: string) => {
        progressUpdates.push({ current, total, message });
      },
      log: () => {},
      progressUpdates,
    };
  };

  it('1. Validation enforces required repositoryId and non-empty chunks', () => {
    // Missing chunks
    expect(() =>
      handler.validate({
        jobId: 'job_1',
        type: 'SEMANTIC_INDEX_UPDATE' as any,
        workspaceId: 'ws_test',
        repositoryId: 'repo_test',
        payload: {
          workspaceId: 'ws_test',
          repositoryId: 'repo_test',
          chunks: [],
        },
      } as any)
    ).toThrow(JobError);

    // Valid job passes
    expect(() =>
      handler.validate({
        jobId: 'job_2',
        type: 'SEMANTIC_INDEX_UPDATE' as any,
        workspaceId: 'ws_test',
        repositoryId: 'repo_test',
        payload: {
          workspaceId: 'ws_test',
          repositoryId: 'repo_test',
          chunks: [
            {
              resourceId: 'src/payment/StripeGateway.ts',
              resourceType: 'FILE',
              title: 'StripeGateway',
              content: 'class StripeGateway implements PaymentGateway { charge() {} }',
            },
          ],
        },
      } as any)
    ).not.toThrow();
  });

  it('2. Execution embeds chunks and populates semantic index with progress tracking', async () => {
    const context = createDummyContext();

    const job: Job<SemanticIndexJobPayload> = {
      jobId: 'job_idx_001',
      type: 'SEMANTIC_INDEX_UPDATE' as any,
      status: 'RUNNING' as any,
      workspaceId: 'ws_pay',
      repositoryId: 'repo_payments',
      payload: {
        workspaceId: 'ws_pay',
        projectId: 'proj_checkout',
        repositoryId: 'repo_payments',
        chunks: [
          {
            resourceId: 'src/checkout/CartService.ts',
            resourceType: 'CLASS',
            title: 'CartService',
            content: 'export class CartService { addItem(item: CartItem) { ... } checkout() { ... } }',
            sourceVersion: 'v1.2.0',
            metadata: { module: 'checkout' },
          },
          {
            resourceId: 'src/checkout/OrderProcessor.ts',
            resourceType: 'CLASS',
            title: 'OrderProcessor',
            content: 'export class OrderProcessor { processOrder(orderId: string) { ... } }',
            sourceVersion: 'v1.2.0',
            metadata: { module: 'orders' },
          },
        ],
      },
      priority: 'NORMAL' as any,
      retryCount: 0,
      maxRetries: 3,
      timeoutMs: 60000,
      version: 1,
      createdAt: new Date().toISOString(),
    };

    const result = await handler.execute(job, context);

    expect(result.affectedResources).toEqual(['src/checkout/CartService.ts', 'src/checkout/OrderProcessor.ts']);
    expect((result.data as Record<string, unknown>)?.['chunksIndexed']).toBe(2);
    expect(context.progressUpdates.length).toBeGreaterThanOrEqual(3);
    expect(context.progressUpdates[context.progressUpdates.length - 1]!.current).toBe(100);

    // Verify search works on the asynchronously indexed items
    const queryVector = await embeddingProvider.embedText('CartService checkout process');
    const searchResults = await semanticIndex.search(queryVector, {
      workspaceId: 'ws_pay',
      projectId: 'proj_checkout',
      repositoryId: 'repo_payments',
    });

    expect(searchResults.length).toBeGreaterThan(0);
    expect(searchResults[0]!.entry.resourceId).toBe('src/checkout/CartService.ts');
  });

  it('3. Cancellation signal halts job execution immediately', async () => {
    const controller = new AbortController();
    controller.abort(); // Pre-cancelled
    const context = createDummyContext(controller.signal);

    const job: Job<SemanticIndexJobPayload> = {
      jobId: 'job_idx_cancelled',
      type: 'SEMANTIC_INDEX_UPDATE' as any,
      status: 'RUNNING' as any,
      workspaceId: 'ws_pay',
      repositoryId: 'repo_payments',
      payload: {
        workspaceId: 'ws_pay',
        repositoryId: 'repo_payments',
        chunks: [
          {
            resourceId: 'src/file.ts',
            resourceType: 'FILE',
            title: 'File',
            content: 'content',
          },
        ],
      },
      priority: 'NORMAL' as any,
      retryCount: 0,
      maxRetries: 3,
      timeoutMs: 60000,
      version: 1,
      createdAt: new Date().toISOString(),
    };

    await expect(handler.execute(job, context)).rejects.toThrow(JobError);
  });
});
