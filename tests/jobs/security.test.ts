import { describe, it, expect, beforeEach } from 'vitest';
import {
  JobAuthorizationValidator,
  JobDispatcher,
  InMemoryJobQueue,
  InMemoryJobRepository,
  JobError,
  type Job,
} from '../../src/jobs/index.js';

describe('Jobs - Security, Workspace Isolation & Secret Rejection', () => {
  let queue: InMemoryJobQueue;
  let repository: InMemoryJobRepository;
  let dispatcher: JobDispatcher;

  beforeEach(() => {
    queue = new InMemoryJobQueue();
    repository = new InMemoryJobRepository();
    dispatcher = new JobDispatcher(queue, repository);
  });

  it('rejects job submission if payload contains secret credentials', async () => {
    await expect(
      dispatcher.dispatch({
        type: 'KNOWLEDGE_UPDATE',
        workspaceId: 'ws-1',
        payload: {
          repoName: 'mind',
          password: 'plain-text-secret',
        },
      })
    ).rejects.toThrowError(JobError);

    await expect(
      dispatcher.dispatch({
        type: 'KNOWLEDGE_UPDATE',
        workspaceId: 'ws-1',
        payload: {
          config: {
            api_key: 'sk-1234567890abcdef',
          },
        },
      })
    ).rejects.toThrowError(JobError);
  });

  it('enforces workspace boundary against security context mismatch', () => {
    const job: Job = {
      jobId: 'job-sec-1',
      type: 'KNOWLEDGE_UPDATE',
      status: 'QUEUED',
      priority: 'NORMAL',
      workspaceId: 'workspace-TENANT-A',
      createdAt: new Date().toISOString(),
      retryCount: 0,
      maxRetries: 3,
      timeoutMs: 30000,
      payload: {},
      version: 1,
    };

    expect(() => {
      JobAuthorizationValidator.validate(job, {
        principalId: 'user-b',
        workspaceId: 'workspace-TENANT-B', // Wrong tenant!
      });
    }).toThrowError(JobError);
  });

  it('allows job execution when security context workspace and repository match', () => {
    const job: Job = {
      jobId: 'job-sec-2',
      type: 'KNOWLEDGE_UPDATE',
      status: 'QUEUED',
      priority: 'NORMAL',
      workspaceId: 'workspace-TENANT-A',
      repositoryId: 'repo-1',
      createdAt: new Date().toISOString(),
      retryCount: 0,
      maxRetries: 3,
      timeoutMs: 30000,
      payload: { repo: 'clean' },
      version: 1,
    };

    expect(() => {
      JobAuthorizationValidator.validate(job, {
        principalId: 'user-a',
        workspaceId: 'workspace-TENANT-A',
        repositoryId: 'repo-1',
      });
    }).not.toThrow();
  });
});
