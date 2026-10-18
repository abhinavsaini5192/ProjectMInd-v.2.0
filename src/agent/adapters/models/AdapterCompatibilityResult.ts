import type { AdapterCapability } from './AdapterCapability.js';

export type AdapterCompatibilityStatus =
  | 'FULL'
  | 'PARTIAL'
  | 'DEGRADED'
  | 'UNSUPPORTED'
  | 'INCOMPATIBLE';

export interface AdapterCompatibilityRequirements {
  readonly protocol?: string | undefined;
  readonly protocolVersion?: string | undefined;
  readonly requiredCapabilities?: readonly AdapterCapability[] | undefined;
  readonly optionalCapabilities?: readonly AdapterCapability[] | undefined;
}

export interface AdapterCompatibilityResult {
  readonly status: AdapterCompatibilityStatus;
  readonly supportedCapabilities: readonly AdapterCapability[];
  readonly unsupportedCapabilities: readonly AdapterCapability[];
  readonly degradedCapabilities: readonly AdapterCapability[];
  readonly negotiatedProtocolVersion?: string | undefined;
  readonly adapterVersion: string;
  readonly warnings: readonly string[];
  readonly errors: readonly string[];
}
