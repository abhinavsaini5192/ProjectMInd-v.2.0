import type { DIContainer } from '../../../../workspace/di/DIContainer.js';
import { FeatureKnowledgePlanner } from '../core/FeatureKnowledgePlanner.js';
import { FeatureKnowledgeFreshnessResolver } from '../core/FeatureKnowledgeFreshnessResolver.js';
import { FeatureKnowledgeExplainer } from '../core/FeatureKnowledgeExplainer.js';
import { FeatureKnowledgeAssembler } from '../core/FeatureKnowledgeAssembler.js';
import {
  FeatureKnowledgeResolver,
  type FeatureKnowledgeResolverDependencies,
} from '../core/FeatureKnowledgeResolver.js';
import { FeatureKnowledgeQueryService } from '../core/FeatureKnowledgeQueryService.js';
import { FeatureKnowledgeAPI } from '../core/FeatureKnowledgeAPI.js';
import { FeatureKnowledgeReadRepository } from '../repository/FeatureKnowledgeReadRepository.js';
import { FeatureKnowledgeCache } from '../cache/FeatureKnowledgeCache.js';

export const FeatureKnowledgeTokens = {
  Planner: Symbol('FeatureKnowledgePlanner'),
  FreshnessResolver: Symbol('FeatureKnowledgeFreshnessResolver'),
  Explainer: Symbol('FeatureKnowledgeExplainer'),
  Assembler: Symbol('FeatureKnowledgeAssembler'),
  Resolver: Symbol('FeatureKnowledgeResolver'),
  QueryService: Symbol('FeatureKnowledgeQueryService'),
  API: Symbol('FeatureKnowledgeAPI'),
  ReadRepository: Symbol('FeatureKnowledgeReadRepository'),
  Cache: Symbol('FeatureKnowledgeCache'),
};

export interface FeatureKnowledgeRegistrationOptions extends FeatureKnowledgeResolverDependencies {
  cache?: FeatureKnowledgeCache | undefined;
}

export function registerFeatureKnowledgeServices(
  container: DIContainer,
  options: FeatureKnowledgeRegistrationOptions
): void {
  const cache = options.cache ?? new FeatureKnowledgeCache();

  container.registerFactory(FeatureKnowledgeTokens.Cache, () => cache, 'Singleton');
  container.registerFactory(
    FeatureKnowledgeTokens.Planner,
    () => new FeatureKnowledgePlanner(),
    'Singleton'
  );
  container.registerFactory(
    FeatureKnowledgeTokens.FreshnessResolver,
    () => new FeatureKnowledgeFreshnessResolver(),
    'Singleton'
  );
  container.registerFactory(
    FeatureKnowledgeTokens.Explainer,
    () => new FeatureKnowledgeExplainer(),
    'Singleton'
  );
  container.registerFactory(
    FeatureKnowledgeTokens.Assembler,
    () => new FeatureKnowledgeAssembler(),
    'Singleton'
  );

  container.registerFactory(
    FeatureKnowledgeTokens.Resolver,
    () => new FeatureKnowledgeResolver(options),
    'Singleton'
  );

  container.registerFactory(
    FeatureKnowledgeTokens.QueryService,
    (c) =>
      new FeatureKnowledgeQueryService({
        planner: c.resolve(FeatureKnowledgeTokens.Planner),
        resolver: c.resolve(FeatureKnowledgeTokens.Resolver),
        freshnessResolver: c.resolve(FeatureKnowledgeTokens.FreshnessResolver),
        explainer: c.resolve(FeatureKnowledgeTokens.Explainer),
        assembler: c.resolve(FeatureKnowledgeTokens.Assembler),
        cache: c.resolve(FeatureKnowledgeTokens.Cache),
      }),
    'Singleton'
  );

  container.registerFactory(
    FeatureKnowledgeTokens.API,
    (c) => new FeatureKnowledgeAPI(c.resolve(FeatureKnowledgeTokens.QueryService)),
    'Singleton'
  );

  container.registerFactory(
    FeatureKnowledgeTokens.ReadRepository,
    (c) => new FeatureKnowledgeReadRepository(c.resolve(FeatureKnowledgeTokens.QueryService)),
    'Singleton'
  );
}
