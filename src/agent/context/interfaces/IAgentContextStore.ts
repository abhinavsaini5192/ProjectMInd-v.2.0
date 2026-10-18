import type { AgentContextSession } from '../models/AgentContextSession.js';
import type { AgentTask } from '../models/AgentTask.js';
import type { AgentContextState } from '../models/AgentContextState.js';
import type { ContextPin } from '../models/ContextPin.js';
import type { ContextFeedback } from '../models/ContextFeedback.js';
import type { ContextDelta } from '../models/ContextDelta.js';
import type { ContextPackage } from '../../../context/models/ContextPackage.js';

export interface IAgentContextStore {
  // Sessions
  saveSession(session: AgentContextSession): Promise<void>;
  getSession(contextSessionId: string): Promise<AgentContextSession | undefined>;
  listSessionsForAgentSession(agentSessionId: string): Promise<AgentContextSession[]>;
  deleteSession(contextSessionId: string): Promise<boolean>;

  // Tasks
  saveTask(task: AgentTask): Promise<void>;
  getTask(taskId: string): Promise<AgentTask | undefined>;
  getTaskForContextSession(contextSessionId: string): Promise<AgentTask | undefined>;

  // Context State
  saveState(contextSessionId: string, state: AgentContextState): Promise<void>;
  getState(contextSessionId: string): Promise<AgentContextState | undefined>;

  // Context Packages (cached/active per session)
  saveContextPackage(contextSessionId: string, version: number, pkg: ContextPackage): Promise<void>;
  getContextPackage(contextSessionId: string, version?: number | undefined): Promise<ContextPackage | undefined>;

  // Pins
  savePin(pin: ContextPin): Promise<void>;
  removePin(pinId: string): Promise<boolean>;
  listPins(contextSessionId: string): Promise<ContextPin[]>;

  // Feedback
  saveFeedback(feedback: ContextFeedback): Promise<void>;
  listFeedback(contextSessionId: string): Promise<ContextFeedback[]>;

  // Deltas
  saveDelta(delta: ContextDelta): Promise<void>;
  getDelta(deltaId: string): Promise<ContextDelta | undefined>;
  getDeltaForVersions(contextSessionId: string, baseVersion: number, targetVersion: number): Promise<ContextDelta | undefined>;
}
