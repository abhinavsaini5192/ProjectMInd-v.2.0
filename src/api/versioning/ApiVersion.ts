export const API_VERSION_V1 = 'v1';

export const SUPPORTED_API_VERSIONS = [API_VERSION_V1] as const;
export type SupportedApiVersion = (typeof SUPPORTED_API_VERSIONS)[number];

export const DEFAULT_API_VERSION: SupportedApiVersion = API_VERSION_V1;

export const DEPRECATED_API_VERSIONS: readonly string[] = [];

export function isSupportedVersion(version: string): version is SupportedApiVersion {
  return SUPPORTED_API_VERSIONS.includes(version as SupportedApiVersion);
}

export function isDeprecatedVersion(version: string): boolean {
  return DEPRECATED_API_VERSIONS.includes(version);
}

export function normalizeVersion(versionStr: string): string {
  const cleaned = versionStr.trim().toLowerCase();
  if (cleaned.startsWith('v')) {
    return cleaned;
  }
  return `v${cleaned}`;
}
