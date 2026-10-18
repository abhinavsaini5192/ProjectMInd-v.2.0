import { describe, it, expect, beforeEach } from 'vitest';
import { DIContainer } from '../../src/workspace/di/DIContainer.js';
import type { IEventBus, EventHandler } from '../../src/workspace/interfaces/IEventBus.js';
import { IEventBusToken } from '../../src/workspace/interfaces/IEventBus.js';
import {
  JobDISetup,
  JobTokens,
  KnowledgeUpdateJobHandler,
  ContextRefreshJobHandler,
  VerificationJobHandler,
  MaintenanceJobHandler,
  EventJobRouter,
  type JobServices,
} from '../../src/jobs/index.js';

class MockEventBus implements IEventBus {
  public published: Array<{ eventName: string; payload: any }> = [];
  private handlers = new Map<string, EventHandler[]>();

  publish<T>(eventName: string, payload: T): void {
    this.published.push({ eventName, payload });
    const list = this.handlers.get(eventName) ?? [];
    for (const h of list) {
      h({
        name: eventName as any,
        timestamp: new Date().toISOString(),
        payload,
      });
    }
  }

  subscribe<T>(eventName: string, handler: EventHandler<T>): void {
    const list = this.handlers.get(eventName) ?? [];
    list.push(handler);
    this.handlers.set(eventName, list);
  }

  unsubscribe<T>(eventName: string, handler: EventHandler<T>): void {
    const list = this.handlers.get(eventName) ?? [];
    this.handlers.set(eventName, list.filter((h) => h !== handler));
  }
}

describe('Jobs - End-to-End Integration, Event Routing, and Domain Handlers', () => {
  let container: DIContainer;
  let mockEventBus: MockEventBus;
  let jobServices: JobServices;

  beforeEach(() => {
    container = new DIContainer();
    mockEventBus = new MockEventBus();
    container.registerFactory(IEventBusToken, () => mockEventBus, 'Singleton');

    jobServices = JobDISetup.registerJobs(container);
  });

  it('correctly registers all job services in DI container', () => {
    expect(container.resolve(JobTokens.JobQueue)).toBe(jobServices.queue);
    expect(container.resolve(JobTokens.JobRepository)).toBe(jobServices.repository);
    expect(container.resolve(JobTokens.JobRegistry)).toBe(jobServices.registry);
    expect(container.resolve(JobTokens.JobDispatcher)).toBe(jobServices.dispatcher);
    expect(container.resolve(JobTokens.WorkerPool)).toBe(jobServices.workerPool);
    expect(container.resolve(JobTokens.Scheduler)).toBe(jobServices.scheduler);
  });

  it('executes end-to-end KnowledgeUpdateJobHandler through dispatcher and worker', async () => {
    let coordinatorCalledWith: any = null;
    const mockCoordinator: any = {
      processKnowledgeUpdate: async (params: any) => {
        coordinatorCalledWith = params;
        return {
          updateId: 'up-123',
          status: 'APPLIED',
          durationMs: 45,
        };
      },
    };

    jobServices.registry.register('KNOWLEDGE_UPDATE', new KnowledgeUpdateJobHandler(mockCoordinator));

    const job = await jobServices.dispatcher.dispatch({
      type: 'KNOWLEDGE_UPDATE',
      workspaceId: 'ws-mind',
      repositoryId: 'repo-mind',
      payload: {
        updateType: 'symbol_delta',
        source: 'compiler',
        repositoryId: 'repo-mind',
      },
    });

    const processed = await jobServices.workerPool['workers'][0]!.processNext();
    expect(processed).toBe(true);
    expect(coordinatorCalledWith).toBeDefined();
    expect(coordinatorCalledWith.repositoryId).toBe('repo-mind');

    const finished = await jobServices.repository.getById(job.jobId);
    expect(finished?.status).toBe('COMPLETED');
    expect(finished?.result?.data?.['status']).toBe('APPLIED');
  });

  it('executes ContextRefreshJobHandler delegating to context orchestrator', async () => {
    let orchestratorCalled = false;
    const mockOrchestrator: any = {
      orchestrateContext: async (_req: any) => {
        orchestratorCalled = true;
        return {
          success: true,
          package: {
            packageId: 'pkg-99',
            features: [{ id: '1' }],
            resources: [{ id: '2' }],
            estimatedTokens: 1500,
          },
          durationMs: 25,
        };
      },
    };

    jobServices.registry.register('CONTEXT_REFRESH', new ContextRefreshJobHandler(mockOrchestrator));

    const job = await jobServices.dispatcher.dispatch({
      type: 'CONTEXT_REFRESH',
      workspaceId: 'ws-mind',
      payload: {
        workspaceId: 'ws-mind',
        intent: 'feature_query',
      },
    });

    await jobServices.workerPool['workers'][0]!.processNext();
    expect(orchestratorCalled).toBe(true);

    const finished = await jobServices.repository.getById(job.jobId);
    expect(finished?.status).toBe('COMPLETED');
    expect(finished?.result?.data?.['packageId']).toBe('pkg-99');
  });

  it('routes EventBus events into background jobs via EventJobRouter', async () => {
    // Publish observation event on canonical EventBus
    mockEventBus.publish('knowledge.observation.created', {
      workspaceId: 'ws-auto',
      repositoryId: 'repo-auto',
      observationId: 'obs-777',
      data: { key: 'val' },
    });

    // Wait for async dispatch to settle
    await new Promise((r) => setTimeout(r, 30));

    // Check queue depth
    expect(await jobServices.queue.getDepth()).toBe(1);

    const msg = await jobServices.queue.dequeue();
    expect(msg).toBeDefined();

    const job = await jobServices.repository.getById(msg!.jobId);
    expect(job?.type).toBe('AGENT_OBSERVATION_PROCESSING');
    expect(job?.workspaceId).toBe('ws-auto');

    jobServices.router?.stop();
  });
});
