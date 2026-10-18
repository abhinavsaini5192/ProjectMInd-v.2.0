import type { IAgentContextStore } from '../interfaces/IAgentContextStore.js';
import type { AgentContextSession } from '../models/AgentContextSession.js';
import type { AgentTask } from '../models/AgentTask.js';
import type { AgentContextState } from '../models/AgentContextState.js';
import type { ContextPin } from '../models/ContextPin.js';
import type { ContextFeedback } from '../models/ContextFeedback.js';
import type { ContextDelta } from '../models/ContextDelta.js';
import type { ContextPackage } from '../../../context/models/ContextPackage.js';

export class InMemoryAgentContextStore implements IAgentContextStore {
  private readonly sessions = new Map<string, AgentContextSession>();
  private readonly tasks = new Map<string, AgentTask>();
  private readonly taskByContextSession = new Map<string, string>(); // contextSessionId -> taskId
  private readonly states = new Map<string, AgentContextState>();
  private readonly packages = new Map<string, Map<number, ContextPackage>>(); // contextSessionId -> (version -> pkg)
  private readonly pins = new Map<string, ContextPin>(); // pinId -> pin
  private readonly feedbackList: ContextFeedback[] = [];
  private readonly deltas = new Map<string, ContextDelta>(); // deltaId -> delta

  // Sessions
  public async saveSession(session: AgentContextSession): Promise<void> {
    this.sessions.set(session.contextSessionId, session);
  }

  public async getSession(contextSessionId: string): Promise<AgentContextSession | undefined> {
    return this.sessions.get(contextSessionId);
  }

  public async listSessionsForAgentSession(agentSessionId: string): Promise<AgentContextSession[]> {
    const results: AgentContextSession[] = [];
    for (const session of this.sessions.values()) {
      if (session.agentSessionId === agentSessionId) {
        results.push(session);
      }
    }
    return results;
  }

  public async deleteSession(contextSessionId: string): Promise<boolean> {
    return this.sessions.delete(contextSessionId);
  }

  // Tasks
  public async saveTask(task: AgentTask): Promise<void> {
    this.tasks.set(task.taskId, task);
    this.taskByContextSession.set(task.contextSessionId, task.taskId);
  }

  public async getTask(taskId: string): Promise<AgentTask | undefined> {
    return this.tasks.get(taskId);
  }

  public async getTaskForContextSession(contextSessionId: string): Promise<AgentTask | undefined> {
    const taskId = this.taskByContextSession.get(contextSessionId);
    if (!taskId) return undefined;
    return this.tasks.get(taskId);
  }

  // Context State
  public async saveState(contextSessionId: string, state: AgentContextState): Promise<void> {
    this.states.set(contextSessionId, state);
  }

  public async getState(contextSessionId: string): Promise<AgentContextState | undefined> {
    return this.states.get(contextSessionId);
  }

  // Context Packages
  public async saveContextPackage(
    contextSessionId: string,
    version: number,
    pkg: ContextPackage
  ): Promise<void> {
    let versionMap = this.packages.get(contextSessionId);
    if (!versionMap) {
      versionMap = new Map<number, ContextPackage>();
      this.packages.set(contextSessionId, versionMap);
    }
    versionMap.set(version, pkg);
  }

  public async getContextPackage(
    contextSessionId: string,
    version?: number | undefined
  ): Promise<ContextPackage | undefined> {
    const versionMap = this.packages.get(contextSessionId);
    if (!versionMap || versionMap.size === 0) return undefined;

    if (version !== undefined) {
      return versionMap.get(version);
    }

    // Return the latest version
    const maxVersion = Math.max(...Array.from(versionMap.keys()));
    return versionMap.get(maxVersion);
  }

  // Pins
  public async savePin(pin: ContextPin): Promise<void> {
    this.pins.set(pin.pinId, pin);
  }

  public async removePin(pinId: string): Promise<boolean> {
    return this.pins.delete(pinId);
  }

  public async listPins(contextSessionId: string): Promise<ContextPin[]> {
    const results: ContextPin[] = [];
    for (const pin of this.pins.values()) {
      if (pin.contextSessionId === contextSessionId) {
        results.push(pin);
      }
    }
    return results;
  }

  // Feedback
  public async saveFeedback(feedback: ContextFeedback): Promise<void> {
    this.feedbackList.push(feedback);
  }

  public async listFeedback(contextSessionId: string): Promise<ContextFeedback[]> {
    return this.feedbackList.filter((f) => f.contextSessionId === contextSessionId);
  }

  // Deltas
  public async saveDelta(delta: ContextDelta): Promise<void> {
    this.deltas.set(delta.deltaId, delta);
  }

  public async getDelta(deltaId: string): Promise<ContextDelta | undefined> {
    return this.deltas.get(deltaId);
  }

  public async getDeltaForVersions(
    contextSessionId: string,
    baseVersion: number,
    targetVersion: number
  ): Promise<ContextDelta | undefined> {
    for (const delta of this.deltas.values()) {
      if (
        delta.contextSessionId === contextSessionId &&
        delta.baseContextVersion === baseVersion &&
        delta.targetContextVersion === targetVersion
      ) {
        return delta;
      }
    }
    return undefined;
  }
}
