export interface ApiEndpointCapability {
  readonly path: string;
  readonly method: string;
  readonly description: string;
  readonly requiredPermission?: string | undefined;
  readonly idempotent?: boolean | undefined;
}

export interface CapabilitiesApiResponse {
  readonly version: string;
  readonly supportedVersions: readonly string[];
  readonly authMethods: readonly string[];
  readonly endpoints: readonly ApiEndpointCapability[];
  readonly rateLimits: {
    readonly defaultLimit: number;
    readonly windowMs: number;
  };
}
