import type { FeatureKnowledgeResponse } from '../models/FeatureKnowledgeResponse.js';
import { FeatureKnowledgeSerializer } from './FeatureKnowledgeSerializer.js';

export class FeatureKnowledgeResponseSerializer {
  public static serialize(response: FeatureKnowledgeResponse, pretty = false): string {
    return this.toJSON(response, pretty);
  }

  public static deserialize(json: string): FeatureKnowledgeResponse {
    return JSON.parse(json) as FeatureKnowledgeResponse;
  }

  public static toJSON(response: FeatureKnowledgeResponse, pretty = false): string {
    const serialized = {
      success: response.success,
      profile: FeatureKnowledgeSerializer.serializeProfile(response.profile),
      metadata: response.metadata,
      errors: response.errors,
    };
    return JSON.stringify(serialized, null, pretty ? 2 : undefined);
  }
}
