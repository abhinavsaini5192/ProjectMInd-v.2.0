import type { AdapterCapability } from '../models/AdapterCapability.js';
import type { AdapterMetadata } from '../models/AdapterMetadata.js';
import type { AdapterCompatibilityResult } from '../models/AdapterCompatibilityResult.js';

export interface IAgentCapabilityMapper {
  assessCompatibility(
    metadata: AdapterMetadata,
    requestedVersion: string,
    requestedCapabilities?: readonly AdapterCapability[]
  ): AdapterCompatibilityResult;

  isSupported(metadata: AdapterMetadata, capability: AdapterCapability): boolean;
  getMissingCapabilities(metadata: AdapterMetadata, requiredCapabilities: readonly AdapterCapability[]): AdapterCapability[];
}
