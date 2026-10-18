import type {
  IFeatureHistorySource,
  FeatureHistorySourceContext,
} from '../interfaces/IFeatureHistorySource.js';
import type { FeatureHistoryEvent } from '../models/FeatureHistoryEvent.js';
import { DiscoveryHistorySource } from '../sources/DiscoveryHistorySource.js';
import { FeatureChangeHistorySource } from '../sources/FeatureChangeHistorySource.js';
import { MappingHistorySource } from '../sources/MappingHistorySource.js';
import { DependencyHistorySource } from '../sources/DependencyHistorySource.js';
import { BehaviorHistorySource } from '../sources/BehaviorHistorySource.js';
import { HealthHistorySource } from '../sources/HealthHistorySource.js';
import { RiskHistorySource } from '../sources/RiskHistorySource.js';
import { ImpactHistorySource } from '../sources/ImpactHistorySource.js';
import { ArchitectureHistorySource } from '../sources/ArchitectureHistorySource.js';
import { StatusHistorySource } from '../sources/StatusHistorySource.js';
import { RepositoryHistorySource } from '../sources/RepositoryHistorySource.js';

export interface CoordinatorSources {
  discovery?: DiscoveryHistorySource;
  lifecycle?: FeatureChangeHistorySource;
  mapping?: MappingHistorySource;
  dependency?: DependencyHistorySource;
  behavior?: BehaviorHistorySource;
  health?: HealthHistorySource;
  risk?: RiskHistorySource;
  impact?: ImpactHistorySource;
  architecture?: ArchitectureHistorySource;
  status?: StatusHistorySource;
  repository?: RepositoryHistorySource;
}

export class FeatureHistoryCoordinator {
  private sources: IFeatureHistorySource[] = [];

  constructor(customSources?: CoordinatorSources) {
    if (customSources) {
      if (customSources.discovery) this.sources.push(customSources.discovery);
      if (customSources.lifecycle) this.sources.push(customSources.lifecycle);
      if (customSources.mapping) this.sources.push(customSources.mapping);
      if (customSources.dependency) this.sources.push(customSources.dependency);
      if (customSources.behavior) this.sources.push(customSources.behavior);
      if (customSources.health) this.sources.push(customSources.health);
      if (customSources.risk) this.sources.push(customSources.risk);
      if (customSources.impact) this.sources.push(customSources.impact);
      if (customSources.architecture) this.sources.push(customSources.architecture);
      if (customSources.status) this.sources.push(customSources.status);
      if (customSources.repository) this.sources.push(customSources.repository);
    } else {
      this.sources = [
        new DiscoveryHistorySource(),
        new FeatureChangeHistorySource(),
        new MappingHistorySource(),
        new DependencyHistorySource(),
        new BehaviorHistorySource(),
        new HealthHistorySource(),
        new RiskHistorySource(),
        new ImpactHistorySource(),
        new ArchitectureHistorySource(),
        new StatusHistorySource(),
        new RepositoryHistorySource(),
      ];
    }
  }

  public registerSource(source: IFeatureHistorySource): void {
    this.sources.push(source);
  }

  public getSources(): IFeatureHistorySource[] {
    return [...this.sources];
  }

  public async collectEvents(
    context: FeatureHistorySourceContext
  ): Promise<FeatureHistoryEvent[]> {
    const eventPromises = this.sources.map(async (src) => {
      try {
        return await src.fetchEvents(context);
      } catch (err) {
        console.warn(`[FeatureHistoryCoordinator] Error fetching from ${src.sourceType}:`, err);
        return [];
      }
    });

    const results = await Promise.all(eventPromises);
    return results.flat();
  }
}
