import type { IAgentAdapter } from '../interfaces/IAgentAdapter.js';
import type { IAgentAdapterRegistry } from '../interfaces/IAgentAdapterRegistry.js';
import type { AgentProvider } from '../models/AgentProvider.js';
import type { AgentProtocol } from '../models/AgentProtocol.js';
import type { AgentType } from '../../models/AgentType.js';
import { AGENT_ADAPTER_EVENTS } from '../events/AgentAdapterEvents.js';

export interface IAdapterEventPublisher {
  publish(event: string, payload: unknown): void;
}

/**
 * Registry storing all active provider and protocol adapters.
 * Thread-safe in-memory registry maintaining full backward compatibility.
 */
export class AgentAdapterRegistry implements IAgentAdapterRegistry {
  private readonly adapters = new Map<string, IAgentAdapter>();

  constructor(private readonly eventPublisher?: IAdapterEventPublisher | undefined) {}

  public register(adapter: IAgentAdapter): void {
    if (!adapter || !adapter.id) {
      throw new Error('Invalid adapter: adapter must have an id');
    }

    this.adapters.set(adapter.id, adapter);

    if (this.eventPublisher && adapter.metadata) {
      this.eventPublisher.publish(AGENT_ADAPTER_EVENTS.REGISTERED, {
        eventName: AGENT_ADAPTER_EVENTS.REGISTERED,
        adapter: adapter.metadata,
        timestamp: Date.now(),
      });
    }
  }

  public unregister(id: string): boolean {
    return this.adapters.delete(id);
  }

  public get(id: string): IAgentAdapter | undefined {
    return this.adapters.get(id);
  }

  public getByProvider(provider: AgentProvider): IAgentAdapter[] {
    return Array.from(this.adapters.values()).filter(
      (a) => a.metadata?.provider === provider
    );
  }

  public getByProtocol(protocol: AgentProtocol): IAgentAdapter[] {
    return Array.from(this.adapters.values()).filter(
      (a) => a.metadata?.protocol === protocol
    );
  }

  public getByAgentType(type: AgentType): IAgentAdapter[] {
    return Array.from(this.adapters.values()).filter((a) => {
      if (a.targetAgentType === type) return true;
      if (a.metadata?.supportedAgentType === type) return true;
      return false;
    });
  }

  public list(): IAgentAdapter[] {
    return Array.from(this.adapters.values());
  }

  public has(id: string): boolean {
    return this.adapters.has(id);
  }

  public clear(): void {
    this.adapters.clear();
  }
}
