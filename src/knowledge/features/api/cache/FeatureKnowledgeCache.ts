import type { FeatureKnowledgeResponse } from '../models/FeatureKnowledgeResponse.js';

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
}

export class FeatureKnowledgeCache {
  private cache = new Map<string, { response: FeatureKnowledgeResponse; cachedAt: number }>();
  private hits = 0;
  private misses = 0;

  public get(key: string): FeatureKnowledgeResponse | null {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }
    this.hits++;
    return entry.response;
  }

  public set(key: string, response: FeatureKnowledgeResponse): void {
    this.cache.set(key, { response, cachedAt: Date.now() });
  }

  public invalidateFeature(featureId: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(`:${featureId}:`)) {
        this.cache.delete(key);
      }
    }
  }

  public invalidateAll(): void {
    this.cache.clear();
  }

  public getStats(): CacheStats {
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.cache.size,
    };
  }
}
