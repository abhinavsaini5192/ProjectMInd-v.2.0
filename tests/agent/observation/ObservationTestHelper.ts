import type { IEventBus, EventSubscription } from '../../../src/workspace/interfaces/IEventBus.js';
import type { ITaskRuntime } from '../../../src/agent/runtime/interfaces/ITaskRuntime.js';
import type { IAgentContextSessionManager } from '../../../src/agent/context/interfaces/IAgentContextSessionManager.js';
import type { AgentTask } from '../../../src/agent/runtime/models/AgentTask.js';
import { InMemoryObservationStore } from '../../../src/agent/observation/services/InMemoryObservationStore.js';
import { ObservationValidator } from '../../../src/agent/observation/validators/ObservationValidator.js';
import { ObservationNormalizer } from '../../../src/agent/observation/normalizers/ObservationNormalizer.js';
import { ObservationClassifier } from '../../../src/agent/observation/classifiers/ObservationClassifier.js';
import { ObservationConflictResolver } from '../../../src/agent/observation/services/ObservationConflictResolver.js';
import { ObservationCorrelator } from '../../../src/agent/observation/correlators/ObservationCorrelator.js';
import { ObservationProcessor } from '../../../src/agent/observation/processors/ObservationProcessor.js';
import { ObservationQueryService } from '../../../src/agent/observation/services/ObservationQueryService.js';
import type { ExecutionObservation } from '../../../src/agent/observation/models/ExecutionObservation.js';
import type { ObservationType } from '../../../src/agent/observation/models/ObservationType.js';

export interface RecordedEvent {
  readonly eventName: string;
  readonly payload: unknown;
  readonly timestamp: number;
}

export class MockEventBus implements IEventBus {
  public readonly events: RecordedEvent[] = [];
  private readonly handlers = new Map<string, Set<(payload: any) => void>>();

  public async publish(eventName: string, payload: unknown): Promise<void> {
    this.events.push({
      eventName,
      payload,
      timestamp: Date.now(),
    });
    const listeners = this.handlers.get(eventName);
    if (listeners) {
      for (const listener of listeners) {
        listener(payload);
      }
    }
  }

  public subscribe(eventName: string, handler: (payload: any) => void): EventSubscription {
    let set = this.handlers.get(eventName);
    if (!set) {
      set = new Set();
      this.handlers.set(eventName, set);
    }
    set.add(handler);
    return {
      unsubscribe: () => {
        set?.delete(handler);
      },
    };
  }

  public unsubscribe(eventName: string, handler: (payload: any) => void): void {
    const listeners = this.handlers.get(eventName);
    if (listeners) {
      listeners.delete(handler);
    }
  }

  public getEvents(eventName?: string): RecordedEvent[] {
    if (!eventName) return [...this.events];
    return this.events.filter((e) => e.eventName === eventName);
  }

  public clear(): void {
    this.events.length = 0;
  }
}

export class MockTaskRuntime implements Partial<ITaskRuntime> {
  public tasks = new Map<string, AgentTask>();
  public updatedExecutions: { taskId: string; payload: any }[] = [];
  public updatedVerifications: { taskId: string; payload: any }[] = [];
  public updatedStatuses: { taskId: string; status: string; reason?: string }[] = [];

  public async getTask(taskId: string): Promise<AgentTask | undefined> {
    return this.tasks.get(taskId);
  }

  public async updateExecution(taskId: string, payload: any): Promise<AgentTask> {
    this.updatedExecutions.push({ taskId, payload });
    const task = this.tasks.get(taskId);
    if (task) {
      const updated = {
        ...task,
        executionPayload: payload,
        modifiedFiles: Array.from(new Set([...(task.modifiedFiles ?? []), ...(payload.modifiedFiles ?? [])])),
      };
      this.tasks.set(taskId, updated as AgentTask);
      return updated as AgentTask;
    }
    return { taskId, modifiedFiles: payload.modifiedFiles ?? [] } as any;
  }

  public async updateVerification(taskId: string, payload: any): Promise<AgentTask> {
    this.updatedVerifications.push({ taskId, payload });
    const task = this.tasks.get(taskId);
    if (task) {
      const updated = {
        ...task,
        verificationStatus: payload.passed ? 'VERIFIED' : 'FAILED',
        verificationPassed: payload.passed,
      };
      this.tasks.set(taskId, updated as AgentTask);
      return updated as AgentTask;
    }
    return { taskId, verificationPassed: payload.passed } as any;
  }

  public async updateTaskStatus(taskId: string, status: any, reason?: string): Promise<AgentTask> {
    this.updatedStatuses.push({ taskId, status: String(status), reason });
    const task = this.tasks.get(taskId);
    if (task) {
      const updated = {
        ...task,
        state: status,
      };
      this.tasks.set(taskId, updated as AgentTask);
      return updated as AgentTask;
    }
    return { taskId, state: status } as any;
  }
}

export class MockContextSessionManager implements Partial<IAgentContextSessionManager> {
  public invalidatedSessions: { sessionId: string; reason: string; changedFiles?: string[] }[] = [];

  public async invalidateSession(sessionId: string, reason: string, changedFiles?: string[]): Promise<void> {
    this.invalidatedSessions.push({ sessionId, reason, changedFiles });
  }

  public async getContextSession(contextSessionId: string): Promise<any> {
    return this.getSession(contextSessionId);
  }

  public async getSession(sessionId: string): Promise<any> {
    return {
      sessionId,
      workspaceId: 'ws-default',
      repositoryId: 'repo-default',
      pinnedResources: [],
      currentPackage: {
        packageId: 'pkg-1',
        resources: [
          { path: 'src/auth/AuthService.ts' },
          { path: 'src/session/SessionService.ts' },
        ],
      },
    };
  }
}

export interface ObservationTestHarness {
  store: InMemoryObservationStore;
  validator: ObservationValidator;
  normalizer: ObservationNormalizer;
  classifier: ObservationClassifier;
  conflictResolver: ObservationConflictResolver;
  correlator: ObservationCorrelator;
  eventBus: MockEventBus;
  taskRuntime: MockTaskRuntime;
  contextSessionManager: MockContextSessionManager;
  processor: ObservationProcessor;
  queryService: ObservationQueryService;
}

export function createObservationTestHarness(): ObservationTestHarness {
  const store = new InMemoryObservationStore();
  const validator = new ObservationValidator();
  const normalizer = new ObservationNormalizer(validator);
  const classifier = new ObservationClassifier();
  const conflictResolver = new ObservationConflictResolver();
  const correlator = new ObservationCorrelator(conflictResolver);
  const eventBus = new MockEventBus();
  const taskRuntime = new MockTaskRuntime();
  const contextSessionManager = new MockContextSessionManager();

  const processor = new ObservationProcessor({
    store,
    normalizer,
    validator,
    classifier,
    correlator,
    eventBus,
    taskRuntime: taskRuntime as unknown as ITaskRuntime,
    contextSessionManager: contextSessionManager as unknown as IAgentContextSessionManager,
  });

  const queryService = new ObservationQueryService(store, validator);

  return {
    store,
    validator,
    normalizer,
    classifier,
    conflictResolver,
    correlator,
    eventBus,
    taskRuntime,
    contextSessionManager,
    processor,
    queryService,
  };
}

export function createMockObservation(overrides?: Partial<ExecutionObservation>): ExecutionObservation {
  const now = new Date().toISOString();
  return {
    observationId: overrides?.observationId ?? `obs_${Math.random().toString(36).slice(2, 10)}`,
    taskId: overrides?.taskId ?? 'task-100',
    sessionId: overrides?.sessionId ?? 'session-100',
    workspaceId: overrides?.workspaceId ?? 'ws-default',
    repositoryId: overrides?.repositoryId ?? 'repo-default',
    source: overrides?.source ?? 'AGENT',
    type: overrides?.type ?? 'COMMAND_EXECUTION',
    category: overrides?.category ?? 'COMMAND',
    provenance: overrides?.provenance ?? 'AGENT_REPORTED',
    confidence: overrides?.confidence ?? 'HIGH',
    ordering: overrides?.ordering ?? 'ORDERED',
    retention: overrides?.retention ?? 'TASK_SCOPED',
    timestamp: overrides?.timestamp ?? now,
    observedAt: overrides?.observedAt ?? now,
    sequenceNumber: overrides?.sequenceNumber ?? 1,
    summary: overrides?.summary ?? 'Executed command successfully',
    payload: overrides?.payload ?? {
      command: 'npm test',
      exitCode: 0,
      executionDurationMs: 120,
    },
    affectedResources: overrides?.affectedResources ?? ['src/auth/AuthService.ts'],
    operationId: overrides?.operationId,
    parentObservationId: overrides?.parentObservationId,
    targetTaskState: overrides?.targetTaskState,
    status: overrides?.status ?? 'PROCESSED',
    orderingStatus: overrides?.orderingStatus ?? 'ORDERED',
    metadata: overrides?.metadata ?? {},
  };
}
