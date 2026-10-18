import type { ContextPin, CreatePinParams } from '../models/ContextPin.js';
import type { AgentContextSession } from '../models/AgentContextSession.js';

export interface IAgentContextPinManager {
  pin(session: AgentContextSession, params: CreatePinParams): Promise<ContextPin>;
  unpin(session: AgentContextSession, pinId: string): Promise<boolean>;
  listPins(contextSessionId: string): Promise<readonly ContextPin[]>;
  getPinnedFeatureIds(contextSessionId: string): Promise<readonly string[]>;
  getPinnedResourceIds(contextSessionId: string): Promise<readonly string[]>;
  getPinnedSections(contextSessionId: string): Promise<readonly string[]>;
}
