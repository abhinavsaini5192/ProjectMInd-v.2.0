import type { IAgentAdapter } from '../interfaces/IAgentAdapter.js';
import type { IAgentAdapterRegistry } from '../interfaces/IAgentAdapterRegistry.js';
import type { IAgentAdapterResolver, AdapterResolutionCriteria } from '../interfaces/IAgentAdapterResolver.js';
import type { IAgentCapabilityMapper } from '../interfaces/IAgentCapabilityMapper.js';
import type { IAdapterEventPublisher } from './AgentAdapterRegistry.js';
import { AgentAdapterNotFoundError } from '../errors/AgentAdapterError.js';
import { AgentProtocolVersion } from '../models/AgentProtocolVersion.js';
import { AgentCapabilityMapper } from './AgentCapabilityMapper.js';
import { AGENT_ADAPTER_EVENTS } from '../events/AgentAdapterEvents.js';

export class AgentAdapterResolver implements IAgentAdapterResolver {
  private readonly capabilityMapper: IAgentCapabilityMapper;

  constructor(
    private readonly registry: IAgentAdapterRegistry,
    capabilityMapper?: IAgentCapabilityMapper,
    private readonly eventPublisher?: IAdapterEventPublisher | undefined
  ) {
    this.capabilityMapper = capabilityMapper ?? new AgentCapabilityMapper();
  }

  public resolve(criteria: AdapterResolutionCriteria): IAgentAdapter {
    const adapter = this.resolveOptional(criteria);
    if (!adapter) {
      throw new AgentAdapterNotFoundError(
        criteria.adapterId ?? `criteria-${JSON.stringify(criteria)}`,
        `No compatible agent adapter found matching resolution criteria: ${JSON.stringify(criteria)}`
      );
    }
    return adapter;
  }

  public resolveOptional(criteria: AdapterResolutionCriteria): IAgentAdapter | undefined {
    // 1. Direct ID lookup if adapterId is provided
    if (criteria.adapterId) {
      const direct = this.registry.get(criteria.adapterId);
      if (direct) {
        this.emitResolved(direct);
        return direct;
      }
      return undefined;
    }

    // 2. Candidate collection
    let candidates = this.registry.list();

    // Filter by provider if specified
    if (criteria.provider) {
      candidates = candidates.filter((a) => a.metadata.provider === criteria.provider);
    }

    // Filter by protocol if specified
    if (criteria.protocol) {
      candidates = candidates.filter((a) => a.metadata.protocol === criteria.protocol);
    }

    if (candidates.length === 0) {
      return undefined;
    }

    // 3. Filter/Score by protocol version
    if (criteria.protocolVersion) {
      candidates = candidates.filter((a) =>
        AgentProtocolVersion.isCompatible(a.metadata.protocolVersion, criteria.protocolVersion!)
      );
    }

    if (candidates.length === 0) {
      return undefined;
    }

    // 4. Rank candidates by capabilities & deterministic tie-breaker
    const scoredCandidates = candidates.map((adapter) => {
      let capScore = 0;
      if (criteria.requiredCapabilities && criteria.requiredCapabilities.length > 0) {
        const supported = criteria.requiredCapabilities.filter((cap) =>
          this.capabilityMapper.isSupported(adapter.metadata, cap)
        );
        capScore = supported.length / criteria.requiredCapabilities.length;
      }

      const versionObj = AgentProtocolVersion.parse(adapter.metadata.adapterVersion);
      const versionWeight = (versionObj?.major ?? 0) * 1000 + (versionObj?.minor ?? 0);

      return {
        adapter,
        capScore,
        versionWeight,
      };
    });

    // If requiredCapabilities were specified, only keep candidates with all required capabilities if possible
    if (criteria.requiredCapabilities && criteria.requiredCapabilities.length > 0) {
      const fullMatches = scoredCandidates.filter((s) => s.capScore === 1.0);
      if (fullMatches.length > 0) {
        fullMatches.sort((a, b) => {
          if (b.versionWeight !== a.versionWeight) return b.versionWeight - a.versionWeight;
          return a.adapter.id.localeCompare(b.adapter.id);
        });
        const selected = fullMatches[0]!.adapter;
        this.emitResolved(selected);
        return selected;
      }
    }

    // Deterministic sort: capScore (desc), versionWeight (desc), adapterId (asc)
    scoredCandidates.sort((a, b) => {
      if (b.capScore !== a.capScore) return b.capScore - a.capScore;
      if (b.versionWeight !== a.versionWeight) return b.versionWeight - a.versionWeight;
      return a.adapter.id.localeCompare(b.adapter.id);
    });

    const chosen = scoredCandidates[0]?.adapter;
    if (chosen) {
      this.emitResolved(chosen);
    }
    return chosen;
  }

  private emitResolved(adapter: IAgentAdapter): void {
    if (this.eventPublisher && adapter.metadata) {
      this.eventPublisher.publish(AGENT_ADAPTER_EVENTS.RESOLVED, {
        eventName: AGENT_ADAPTER_EVENTS.RESOLVED,
        adapterId: adapter.id,
        provider: adapter.metadata.provider,
        protocol: adapter.metadata.protocol,
        timestamp: Date.now(),
      });
    }
  }
}
