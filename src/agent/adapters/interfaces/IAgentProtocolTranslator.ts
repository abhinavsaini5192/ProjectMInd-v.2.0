import type { AdapterRequest } from '../models/AdapterRequest.js';
import type { AdapterResponse } from '../models/AdapterResponse.js';
import type { AgentRequest } from '../../models/AgentRequest.js';
import type { AgentResponse } from '../../models/AgentResponse.js';

export interface IAgentProtocolTranslator {
  toCanonicalRequest(adapterRequest: AdapterRequest): AgentRequest;
  fromCanonicalResponse(canonicalResponse: AgentResponse, originalRequest?: AdapterRequest): AdapterResponse;
}
