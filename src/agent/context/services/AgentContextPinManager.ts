import type { IAgentContextPinManager } from '../interfaces/IAgentContextPinManager.js';
import type { IAgentContextStore } from '../interfaces/IAgentContextStore.js';
import type { ContextPin, CreatePinParams } from '../models/ContextPin.js';
import type { AgentContextSession } from '../models/AgentContextSession.js';
import { ContextPinError } from '../errors/AgentContextError.js';

export class AgentContextPinManager implements IAgentContextPinManager {
  constructor(private readonly store: IAgentContextStore) {}

  public async pin(session: AgentContextSession, params: CreatePinParams): Promise<ContextPin> {
    if (!params.targetId || params.targetId.trim().length === 0) {
      throw new ContextPinError('Cannot pin empty target identifier', session.contextSessionId);
    }

    // Security & Scope validation: prevent path traversal or malicious targets
    if (params.type === 'RESOURCE') {
      if (params.targetId.includes('..') || params.targetId.includes('\0')) {
        throw new ContextPinError(
          `Security violation: Cannot pin invalid or out-of-scope resource path '${params.targetId}'`,
          session.contextSessionId
        );
      }
    }

    const existingPins = await this.store.listPins(session.contextSessionId);
    const alreadyPinned = existingPins.find(
      (p) => p.type === params.type && p.targetId === params.targetId
    );

    if (alreadyPinned) {
      return alreadyPinned;
    }

    const pinId = `pin_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const pin: ContextPin = {
      pinId,
      contextSessionId: session.contextSessionId,
      type: params.type,
      targetId: params.targetId,
      pinnedAt: new Date(),
      pinnedBy: params.pinnedBy ?? session.agentSessionId,
      reason: params.reason,
    };

    await this.store.savePin(pin);
    return pin;
  }

  public async unpin(session: AgentContextSession, pinId: string): Promise<boolean> {
    const existingPins = await this.store.listPins(session.contextSessionId);
    const match = existingPins.find((p) => p.pinId === pinId);
    if (!match) {
      return false;
    }
    return this.store.removePin(pinId);
  }

  public async listPins(contextSessionId: string): Promise<readonly ContextPin[]> {
    return this.store.listPins(contextSessionId);
  }

  public async getPinnedFeatureIds(contextSessionId: string): Promise<readonly string[]> {
    const pins = await this.store.listPins(contextSessionId);
    return pins.filter((p) => p.type === 'FEATURE').map((p) => p.targetId);
  }

  public async getPinnedResourceIds(contextSessionId: string): Promise<readonly string[]> {
    const pins = await this.store.listPins(contextSessionId);
    return pins.filter((p) => p.type === 'RESOURCE').map((p) => p.targetId);
  }

  public async getPinnedSections(contextSessionId: string): Promise<readonly string[]> {
    const pins = await this.store.listPins(contextSessionId);
    return pins.filter((p) => p.type === 'SECTION').map((p) => p.targetId);
  }
}
