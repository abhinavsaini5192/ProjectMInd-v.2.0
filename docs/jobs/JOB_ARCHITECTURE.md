# Job Architecture & Handler Dispatch (Phase 8.6)

This document describes the architectural flow of background jobs in ProjectMind, how handlers are registered, and how jobs are dispatched from application triggers or the EventBus.

---

## 1. Architectural Flow

The background jobs platform decouples job submission from job processing:

1. **Submission:**
   An API controller, event listener, or application service calls `IJobDispatcher.dispatch(params)`.
   - The dispatcher checks `idempotencyKey` + `workspaceId`. If a non-terminal job with the same key exists, it returns the existing record.
   - `JobAuthorizationValidator` verifies workspace scope and ensures no secret credentials exist in the payload.
   - The job is persisted to `IJobRepository` in `QUEUED` (or `SCHEDULED`) status.
   - A `QueueMessage` is pushed to `IJobQueue`.
2. **Worker Processing:**
   A free `Worker` in `WorkerPool` dequeues the message.
   - Predecessor dependencies (`job.dependencies`) are verified. If predecessors have not reached `COMPLETED`, the job is requeued.
   - An exclusive lease is acquired via `IJobLeaseManager`.
   - The job transitions to `RUNNING` in persistence.
   - The worker locates the registered `IJobHandler` from `IJobRegistry`.
   - The handler's `validate()` and `execute()` methods run within a cooperative cancellation timeout.
3. **Completion / Failure:**
   - On success: status transitions to `COMPLETED`, result is recorded, queue message acknowledged, lease released.
   - On retryable failure: status transitions to `RETRY_PENDING`, message is requeued with backoff delay, lease released.
   - On permanent failure / retry exhaustion: status transitions to `DEAD_LETTERED`, message is acknowledged from queue and recorded into `IDeadLetterQueue`.

---

## 2. Event-to-Job Dispatch (`EventJobRouter`)

`EventJobRouter` listens to domain events on the canonical `IEventBus` and translates them into asynchronous background jobs:

```
  IEventBus ('knowledge.observation.created')
            │
            ▼
     EventJobRouter
            │
            ├── Deduplicates by eventId
            ├── Extracts workspaceId, repositoryId, payload
            │
            ▼
     IJobDispatcher.dispatch({
       type: 'AGENT_OBSERVATION_PROCESSING',
       workspaceId,
       payload
     })
```

---

## 3. Adding a New Job Type

To introduce a new background job type in ProjectMind:

### Step 1: Register in `JobType.ts`
Add the new job type identifier to `JobType`:
```typescript
export type JobType =
  | 'KNOWLEDGE_UPDATE'
  | 'MY_NEW_CUSTOM_OPERATION'
  // ...
```

### Step 2: Implement `IJobHandler`
Create a typed handler in `src/jobs/handlers/` delegating to your domain service:
```typescript
import type { IJobHandler, JobExecutionContext, Job, JobResult } from '../index.js';

export interface MyJobPayload {
  readonly resourceId: string;
}

export class MyNewJobHandler implements IJobHandler<MyJobPayload> {
  constructor(private readonly myDomainService: IMyDomainService) {}

  public validate(job: Job<MyJobPayload>): void {
    if (!job.payload.resourceId) {
      throw new JobError('JOB_PAYLOAD_INVALID', 'resourceId is required', false);
    }
  }

  public async execute(
    job: Job<MyJobPayload>,
    context: JobExecutionContext
  ): Promise<Omit<JobResult, 'jobId' | 'status' | 'completedAt'>> {
    if (context.signal.aborted) {
      throw new JobError('JOB_CANCELLED', 'Job cancelled', false);
    }

    await context.updateProgress(50, 100, 'Processing domain operation');
    const result = await this.myDomainService.executeOperation(job.payload.resourceId);

    return {
      affectedResources: [job.payload.resourceId],
      data: { result },
    };
  }
}
```

### Step 3: Register in `JobRegistry`
Register the handler during application startup or DI wiring:
```typescript
jobServices.registry.register('MY_NEW_CUSTOM_OPERATION', new MyNewJobHandler(domainService));
```
