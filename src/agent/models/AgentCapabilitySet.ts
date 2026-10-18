import type { AgentCapability } from './AgentCapability.js';
import { isAgentCapability } from './AgentCapability.js';

export class AgentCapabilitySet {
  private readonly capabilities: Set<AgentCapability>;

  constructor(capabilities: Iterable<AgentCapability | string> = []) {
    this.capabilities = new Set<AgentCapability>();
    for (const cap of capabilities) {
      if (isAgentCapability(cap)) {
        this.capabilities.add(cap);
      }
    }
  }

  public has(capability: AgentCapability): boolean {
    return this.capabilities.has(capability);
  }

  public hasAll(required: readonly AgentCapability[]): boolean {
    for (const cap of required) {
      if (!this.capabilities.has(cap)) return false;
    }
    return true;
  }

  public hasAny(candidates: readonly AgentCapability[]): boolean {
    for (const cap of candidates) {
      if (this.capabilities.has(cap)) return true;
    }
    return false;
  }

  public add(capability: AgentCapability): this {
    this.capabilities.add(capability);
    return this;
  }

  public remove(capability: AgentCapability): this {
    this.capabilities.delete(capability);
    return this;
  }

  public toArray(): AgentCapability[] {
    return Array.from(this.capabilities);
  }

  public getCapabilities(): AgentCapability[] {
    return Array.from(this.capabilities);
  }

  public intersection(other: AgentCapabilitySet): AgentCapabilitySet {
    const common: AgentCapability[] = [];
    for (const cap of this.capabilities) {
      if (other.has(cap)) {
        common.push(cap);
      }
    }
    return new AgentCapabilitySet(common);
  }

  public validateRequired(required: readonly AgentCapability[]): {
    satisfied: boolean;
    missing: AgentCapability[];
  } {
    const missing: AgentCapability[] = [];
    for (const cap of required) {
      if (!this.capabilities.has(cap)) {
        missing.push(cap);
      }
    }
    return {
      satisfied: missing.length === 0,
      missing,
    };
  }

  public clone(): AgentCapabilitySet {
    return new AgentCapabilitySet(this.capabilities);
  }
}
