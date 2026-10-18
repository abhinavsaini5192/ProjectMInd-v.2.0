import type { FeatureKnowledgeProfile } from '../models/FeatureKnowledgeProfile.js';

export class FeatureKnowledgeSerializer {
  private static readonly SENSITIVE_KEYS = new Set([
    'password',
    'secret',
    'token',
    'apiKey',
    'apikey',
    'credentials',
    'privateKey',
    'authorization',
  ]);

  public static serializeProfile(profile: FeatureKnowledgeProfile): Record<string, any> {
    const raw = {
      featureId: profile.featureId,
      identity: this.sanitizeObject(profile.identity),
      mappings: {
        ...profile.mappings,
        data: profile.mappings.data
          ? {
              ...profile.mappings.data,
              mappings: [...profile.mappings.data.mappings].sort((a, b) =>
                a.resourceId.localeCompare(b.resourceId)
              ),
              primaryResources: [...profile.mappings.data.primaryResources].sort(),
            }
          : undefined,
      },
      dependencies: {
        ...profile.dependencies,
        data: profile.dependencies.data
          ? {
              ...profile.dependencies.data,
              dependencies: [...profile.dependencies.data.dependencies].sort((a, b) =>
                a.featureId.localeCompare(b.featureId)
              ),
              dependents: [...profile.dependencies.data.dependents].sort((a, b) =>
                a.featureId.localeCompare(b.featureId)
              ),
            }
          : undefined,
      },
      behavior: {
        ...profile.behavior,
        data: profile.behavior.data
          ? {
              ...profile.behavior.data,
              entryPoints: [...profile.behavior.data.entryPoints].sort(),
              primaryFlows: [...profile.behavior.data.primaryFlows].sort((a, b) =>
                a.flowId.localeCompare(b.flowId)
              ),
              failureFlows: [...profile.behavior.data.failureFlows].sort((a, b) =>
                a.flowId.localeCompare(b.flowId)
              ),
              allFlows: [...profile.behavior.data.allFlows].sort((a, b) =>
                a.flowId.localeCompare(b.flowId)
              ),
            }
          : undefined,
      },
      health: this.sanitizeObject(profile.health),
      impact: this.sanitizeObject(profile.impact),
      history: this.sanitizeObject(profile.history),
      architecture: this.sanitizeObject(profile.architecture),
      summary: this.sanitizeObject(profile.summary),
      explanations: profile.explanations,
      references: [...profile.references].sort((a, b) => a.id.localeCompare(b.id)),
      completeness: profile.completeness,
      confidence: profile.confidence,
      freshness: profile.freshness,
      contextPackage: profile.contextPackage ? this.sanitizeObject(profile.contextPackage) : undefined,
    };

    return JSON.parse(JSON.stringify(raw));
  }

  public static serialize(profile: FeatureKnowledgeProfile, pretty = false): string {
    const raw = this.serializeProfile(profile);
    return JSON.stringify(raw, null, pretty ? 2 : undefined);
  }

  public static deserialize(json: string): FeatureKnowledgeProfile {
    return JSON.parse(json) as FeatureKnowledgeProfile;
  }

  public static sanitize(obj: any): any {
    return this.sanitizeObject(obj);
  }

  public static sanitizeObject(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeObject(item));
    }

    const sanitized: Record<string, any> = {};
    for (const [key, val] of Object.entries(obj)) {
      const lower = key.toLowerCase();
      const isSensitive =
        this.SENSITIVE_KEYS.has(lower) ||
        lower.includes('password') ||
        lower.includes('secret') ||
        lower.includes('apikey') ||
        lower.includes('privatekey');

      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof val === 'object' && val !== null) {
        sanitized[key] = this.sanitizeObject(val);
      } else {
        sanitized[key] = val;
      }
    }
    return sanitized;
  }
}
