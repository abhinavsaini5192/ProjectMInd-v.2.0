import type { IFeatureMappingRepository } from '../../knowledge/features/mapping/interfaces/IFeatureMappingRepository.js';
import type { IFeatureRepository } from '../../knowledge/features/interfaces/IFeatureRepository.js';

export class ResourceContextRetriever {
  constructor(
    private readonly mappingRepository?: IFeatureMappingRepository | undefined,
    private readonly featureRepository?: IFeatureRepository | undefined
  ) {}

  public async resolveFeaturesFromResources(
    resources: string[]
  ): Promise<string[]> {
    if (!resources || resources.length === 0) {
      return [];
    }

    const matchedFeatures = new Set<string>();

    for (const res of resources) {
      if (!res) continue;

      if (this.mappingRepository) {
        try {
          const featureIds = await this.mappingRepository.getResourceFeatures(res);
          for (const fid of featureIds) {
            matchedFeatures.add(fid);
          }
        } catch {
          // Fall back gracefully if individual query fails
        }
      }

      if (this.featureRepository) {
        try {
          const features = await this.featureRepository.findByReference(res);
          for (const f of features) {
            matchedFeatures.add(f.id);
          }
        } catch {
          // Fall back gracefully
        }
      }
    }

    return Array.from(matchedFeatures);
  }
}
