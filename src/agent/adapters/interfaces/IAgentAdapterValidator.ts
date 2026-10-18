import type { AdapterRequest } from '../models/AdapterRequest.js';
import type { AdapterResponse } from '../models/AdapterResponse.js';
import type { AdapterMetadata } from '../models/AdapterMetadata.js';

export interface IAgentAdapterValidator {
  validateAdapter(adapter: AdapterMetadata): void;
  validateRequest(request: AdapterRequest, expectedWorkspace?: { workspaceId: string; repositoryId: string }): void;
  validateResponse(response: AdapterResponse): void;
}
