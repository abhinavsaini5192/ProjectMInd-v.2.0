import type { ContextFeature } from '../models/ContextFeature.js';
import type { ContextResource } from '../models/ContextResource.js';

export class ContextDeduplicator {
  public static deduplicateFeatures(features: ContextFeature[]): ContextFeature[] {
    const map = new Map<string, ContextFeature>();

    for (const f of features) {
      const existing = map.get(f.featureId);
      if (!existing || f.relevance.score > existing.relevance.score) {
        map.set(f.featureId, f);
      }
    }

    return Array.from(map.values());
  }

  public static deduplicateResources(resources: ContextResource[]): ContextResource[] {
    const map = new Map<string, ContextResource>();

    for (const r of resources) {
      const key = r.filePath ?? r.resourceId;
      const existing = map.get(key);
      if (!existing || r.relevance.score > existing.relevance.score) {
        map.set(key, r);
      }
    }

    return Array.from(map.values());
  }

  public static deduplicateItems<T extends { id?: string; name?: string; description?: string }>(
    items: T[]
  ): T[] {
    const seen = new Set<string>();
    const result: T[] = [];

    for (const item of items) {
      const key = item.id ?? item.name ?? item.description ?? JSON.stringify(item);
      if (!seen.has(key)) {
        seen.add(key);
        result.push(item);
      }
    }

    return result;
  }
}
