import { InMemoryTaskStore } from '../../../src/agent/runtime/services/InMemoryTaskStore.js';
import { TaskManager } from '../../../src/agent/runtime/services/TaskManager.js';
import { TaskLifecycleManager } from '../../../src/agent/runtime/services/TaskLifecycleManager.js';
import { TaskCompletionValidator } from '../../../src/agent/runtime/services/TaskCompletionValidator.js';
import { TaskProgressTracker } from '../../../src/agent/runtime/services/TaskProgressTracker.js';
import { TaskExecutionCoordinator } from '../../../src/agent/runtime/services/TaskExecutionCoordinator.js';
import { TaskVerificationCoordinator } from '../../../src/agent/runtime/services/TaskVerificationCoordinator.js';
import { TaskRecoveryManager } from '../../../src/agent/runtime/services/TaskRecoveryManager.js';
import { TaskRuntime } from '../../../src/agent/runtime/services/TaskRuntime.js';
import type { IEventBus, EventHandler } from '../../../src/workspace/interfaces/IEventBus.js';
import type { IAgentContextSessionManager } from '../../../src/agent/context/interfaces/IAgentContextSessionManager.js';
import type { IAgentSessionManager } from '../../../src/agent/interfaces/IAgentSessionManager.js';
import type { AgentSession } from '../../../src/agent/models/AgentSession.js';

export class MockEventBus implements IEventBus {
  public readonly publishedEvents: { event: string; payload: unknown }[] = [];

  public publish<T>(event: string, payload: T): void {
    this.publishedEvents.push({ event, payload });
  }

  public subscribe<T>(_eventName: string, _handler: EventHandler<T>): void {}

  public unsubscribe<T>(_eventName: string, _handler: EventHandler<T>): void {}
}

export function createMockAgentSession(overrides: Partial<AgentSession> = {}): AgentSession {
  return {
    sessionId: overrides.sessionId ?? 'session-agent-123',
    agentId: overrides.agentId ?? 'agent-claude',
    workspaceId: overrides.workspaceId ?? 'ws-projectmind',
    repositoryId: overrides.repositoryId ?? 'repo-core',
    workingTreeState: overrides.workingTreeState ?? 'CLEAN',
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    lastActivityAt: overrides.lastActivityAt ?? new Date().toISOString(),
    status: overrides.status ?? 'ACTIVE',
    capabilities: overrides.capabilities ?? ([] as any),
    protocolVersion: overrides.protocolVersion ?? '1.0',
    metadata: overrides.metadata ?? {},
    ...overrides,
  };
}

export function createTestTaskRuntime(options: {
  eventBus?: IEventBus | undefined;
  contextSessionManager?: IAgentContextSessionManager | undefined;
  agentSessionManager?: IAgentSessionManager | undefined;
} = {}) {
  const store = new InMemoryTaskStore();
  const eventBus = options.eventBus ?? new MockEventBus();
  const taskManager = new TaskManager(store, eventBus);
  const lifecycleManager = new TaskLifecycleManager(store, eventBus);
  const completionValidator = new TaskCompletionValidator(store);
  const progressTracker = new TaskProgressTracker(store, completionValidator);
  const executionCoordinator = new TaskExecutionCoordinator({
    store,
    taskManager,
    lifecycleManager,
    contextSessionManager: options.contextSessionManager,
    eventBus,
  });
  const verificationCoordinator = new TaskVerificationCoordinator({
    store,
    taskManager,
    lifecycleManager,
    eventBus,
  });
  const recoveryManager = new TaskRecoveryManager({
    store,
    taskManager,
    lifecycleManager,
    contextSessionManager: options.contextSessionManager,
  });

  const taskRuntime = new TaskRuntime({
    taskManager,
    lifecycleManager,
    executionCoordinator,
    verificationCoordinator,
    progressTracker,
    completionValidator,
    recoveryManager,
    contextSessionManager: options.contextSessionManager,
    agentSessionManager: options.agentSessionManager,
  });

  return {
    store,
    eventBus,
    taskManager,
    lifecycleManager,
    completionValidator,
    progressTracker,
    executionCoordinator,
    verificationCoordinator,
    recoveryManager,
    taskRuntime,
  };
}
