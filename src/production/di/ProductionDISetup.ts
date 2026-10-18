/**
 * Production Readiness Dependency Injection Setup.
 */

import type { DIContainer } from '../../workspace/di/DIContainer.js';
import { ProductionTokens } from './ProductionTokens.js';
import { ProductionReadinessEngine } from '../engine/ProductionReadinessEngine.js';
import { CanonicalReleaseMetadata, type ReleaseMetadata } from '../models/ReleaseMetadata.js';

export interface ProductionServices {
  readonly engine: ProductionReadinessEngine;
  readonly releaseMetadata: ReleaseMetadata;
}

export class ProductionDISetup {
  public static registerProduction(
    container: DIContainer,
    overrides: Partial<ProductionServices> = {}
  ): ProductionServices {
    const engine = overrides.engine ?? new ProductionReadinessEngine();
    const releaseMetadata = overrides.releaseMetadata ?? CanonicalReleaseMetadata;

    container.registerInstance(ProductionTokens.ProductionReadinessEngine, engine);
    container.registerInstance(ProductionTokens.ReleaseMetadata, releaseMetadata);

    return {
      engine,
      releaseMetadata,
    };
  }
}
