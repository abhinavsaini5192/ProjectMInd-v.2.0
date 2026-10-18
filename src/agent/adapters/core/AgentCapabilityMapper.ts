import type { IAgentCapabilityMapper } from '../interfaces/IAgentCapabilityMapper.js';
import type { AdapterCapability } from '../models/AdapterCapability.js';
import type { AdapterMetadata } from '../models/AdapterMetadata.js';
import type { AdapterCompatibilityResult, AdapterCompatibilityStatus } from '../models/AdapterCompatibilityResult.js';
import { AgentProtocolVersion } from '../models/AgentProtocolVersion.js';

export class AgentCapabilityMapper implements IAgentCapabilityMapper {
  public assessCompatibility(
    metadata: AdapterMetadata,
    requestedVersion: string,
    requestedCapabilities: readonly AdapterCapability[] = []
  ): AdapterCompatibilityResult {
    const warnings: string[] = [];
    const errors: string[] = [];

    // 1. Check protocol version compatibility
    const isVersionCompatible = AgentProtocolVersion.isCompatible(
      metadata.protocolVersion,
      requestedVersion
    );

    if (!isVersionCompatible) {
      errors.push(
        `Version mismatch: adapter supports '${metadata.protocolVersion}' but requested '${requestedVersion}'`
      );
    }

    // 2. Check capabilities
    const supported: AdapterCapability[] = [];
    const unsupported: AdapterCapability[] = [];
    const degraded: AdapterCapability[] = [];

    const adapterCaps = new Set<AdapterCapability>(metadata.capabilities ?? []);

    for (const cap of requestedCapabilities) {
      if (adapterCaps.has(cap)) {
        supported.push(cap);
      } else {
        unsupported.push(cap);
        warnings.push(`Capability '${cap}' is not natively supported by adapter '${metadata.adapterId}'`);
      }
    }

    // 3. Determine overall status
    let status: AdapterCompatibilityStatus;
    if (errors.length > 0) {
      status = 'INCOMPATIBLE';
    } else if (unsupported.length === 0) {
      status = 'FULL';
    } else if (supported.length > 0) {
      status = 'PARTIAL';
    } else {
      status = 'UNSUPPORTED';
    }

    return {
      status,
      supportedCapabilities: supported,
      unsupportedCapabilities: unsupported,
      degradedCapabilities: degraded,
      negotiatedProtocolVersion: isVersionCompatible ? requestedVersion : undefined,
      adapterVersion: metadata.adapterVersion,
      warnings,
      errors,
    };
  }

  public isSupported(metadata: AdapterMetadata, capability: AdapterCapability): boolean {
    return (metadata.capabilities ?? []).includes(capability);
  }

  public getMissingCapabilities(
    metadata: AdapterMetadata,
    requiredCapabilities: readonly AdapterCapability[]
  ): AdapterCapability[] {
    const adapterCaps = new Set<AdapterCapability>(metadata.capabilities ?? []);
    return requiredCapabilities.filter((cap) => !adapterCaps.has(cap));
  }
}
