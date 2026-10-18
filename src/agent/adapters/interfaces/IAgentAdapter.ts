import type { AdapterMetadata } from '../models/AdapterMetadata.js';
import type { AgentAdapterStatus } from '../models/AgentAdapterStatus.js';
import type { AdapterCapability } from '../models/AdapterCapability.js';
import type { AdapterCompatibilityResult } from '../models/AdapterCompatibilityResult.js';
import type { AdapterRequest } from '../models/AdapterRequest.js';
import type { AdapterResponse } from '../models/AdapterResponse.js';
import type { AdapterContext } from '../models/AdapterContext.js';
import type { AdapterSession } from '../models/AdapterSession.js';
import type { AgentRequest } from '../../models/AgentRequest.js';
import type { AgentResponse } from '../../models/AgentResponse.js';
import type { AgentType } from '../../models/AgentType.js';
import type { AgentTool } from '../../protocol/models/AgentTool.js';
import type { ContextPackage } from '../../../context/models/ContextPackage.js';

/**
 * Foundation contract for external agent adapters.
 * Translates external agent / IDE / CLI / protocol calls to ProjectMind canonical models.
 */
export interface IAgentAdapter<TNativeRequest = unknown, TNativeResponse = unknown> {
  readonly metadata: AdapterMetadata;
  readonly status: AgentAdapterStatus;

  // Convenience getters aligned with AdapterMetadata & legacy IAgentAdapter
  readonly id: string;
  readonly name: string;
  readonly targetAgentType?: AgentType | undefined;
  readonly supportedProtocolVersions: readonly string[];

  // Lifecycle
  initialize(): Promise<void>;
  shutdown(): Promise<void>;

  // Compatibility & Validation
  checkCompatibility(protocolVersion: string, capabilities?: readonly AdapterCapability[]): AdapterCompatibilityResult;

  // Translation
  translateRequest(rawRequest: TNativeRequest): Promise<AdapterRequest>;
  translateResponse(canonicalResponse: AgentResponse, requestEnvelope?: AdapterRequest): Promise<AdapterResponse<TNativeResponse>>;

  // Domain Mapping
  mapTool?(tool: AgentTool): unknown;
  mapContext?(context: ContextPackage, targetFormat?: string): AdapterContext;
  mapSession?(providerSessionId: string, canonicalSessionId?: string): AdapterSession;

  // Backward compatibility with Phase 7.1 contract
  adaptRequest(input: TNativeRequest): Promise<AgentRequest>;
  adaptResponse(response: AgentResponse): Promise<TNativeResponse>;
}
