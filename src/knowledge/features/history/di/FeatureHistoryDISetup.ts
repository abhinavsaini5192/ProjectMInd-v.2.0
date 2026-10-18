import type { DIContainer } from '../../../../workspace/di/DIContainer.js';
import { FeatureHistoryRepository } from '../repository/FeatureHistoryRepository.js';
import { FeatureHistoryCoordinator } from '../core/FeatureHistoryCoordinator.js';
import { FeatureHistoryAnalyzer } from '../core/FeatureHistoryAnalyzer.js';
import { FeatureHistoryExplainer } from '../core/FeatureHistoryExplainer.js';
import { FeatureHistoryEngine } from '../core/FeatureHistoryEngine.js';
import { FeatureHistoryAPI } from '../api/FeatureHistoryAPI.js';

export const FeatureHistoryTokens = {
  Repository: Symbol('FeatureHistoryRepository'),
  Coordinator: Symbol('FeatureHistoryCoordinator'),
  Analyzer: Symbol('FeatureHistoryAnalyzer'),
  Explainer: Symbol('FeatureHistoryExplainer'),
  Engine: Symbol('FeatureHistoryEngine'),
  API: Symbol('FeatureHistoryAPI'),
};

export function registerFeatureHistoryServices(
  container: DIContainer,
  repositoryInstance?: FeatureHistoryRepository
): void {
  const repo = repositoryInstance || new FeatureHistoryRepository();

  container.registerFactory(FeatureHistoryTokens.Repository, () => repo, 'Singleton');
  container.registerFactory(FeatureHistoryTokens.Coordinator, () => new FeatureHistoryCoordinator(), 'Singleton');
  container.registerFactory(FeatureHistoryTokens.Analyzer, () => new FeatureHistoryAnalyzer(), 'Singleton');
  container.registerFactory(FeatureHistoryTokens.Explainer, () => new FeatureHistoryExplainer(), 'Singleton');

  container.registerFactory(
    FeatureHistoryTokens.Engine,
    (c) =>
      new FeatureHistoryEngine(c.resolve(FeatureHistoryTokens.Repository), {
        coordinator: c.resolve(FeatureHistoryTokens.Coordinator),
        analyzer: c.resolve(FeatureHistoryTokens.Analyzer),
        explainer: c.resolve(FeatureHistoryTokens.Explainer),
      }),
    'Singleton'
  );

  container.registerFactory(
    FeatureHistoryTokens.API,
    (c) =>
      new FeatureHistoryAPI(
        c.resolve(FeatureHistoryTokens.Engine),
        c.resolve(FeatureHistoryTokens.Repository)
      ),
    'Singleton'
  );
}
