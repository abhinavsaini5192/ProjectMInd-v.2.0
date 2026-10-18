import type { IFeatureRepository } from '../../knowledge/features/interfaces/IFeatureRepository.js';

export class TaskContextRetriever {
  constructor(private readonly featureRepository?: IFeatureRepository | undefined) {}

  public async resolveFeaturesFromTask(
    taskText?: string,
    taskIntent?: Record<string, any>,
    repositoryId?: string
  ): Promise<string[]> {
    if (!this.featureRepository) {
      return [];
    }

    const matchedIds = new Set<string>();

    // 1. Check taskIntent for explicit feature suggestions
    if (taskIntent) {
      if (typeof taskIntent['featureId'] === 'string') {
        matchedIds.add(taskIntent['featureId']);
      }
      if (Array.isArray(taskIntent['featureIds'])) {
        for (const id of taskIntent['featureIds']) {
          if (typeof id === 'string') matchedIds.add(id);
        }
      }
      if (typeof taskIntent['featureName'] === 'string') {
        const found = await this.featureRepository.findByName(taskIntent['featureName'], repositoryId);
        for (const f of found) {
          matchedIds.add(f.id);
        }
      }
    }

    // 2. Keyword match against feature names in repository
    if (taskText && taskText.trim().length > 0) {
      const allFeatures = await this.featureRepository.list(repositoryId);
      const textLower = taskText.toLowerCase();

      for (const feature of allFeatures) {
        const nameLower = feature.name.toLowerCase();
        if (textLower.includes(nameLower)) {
          matchedIds.add(feature.id);
        } else if (
          feature.metadata?.tags &&
          feature.metadata.tags.some((t: string) => textLower.includes(t.toLowerCase()))
        ) {
          matchedIds.add(feature.id);
        }
      }
    }

    return Array.from(matchedIds);
  }
}
