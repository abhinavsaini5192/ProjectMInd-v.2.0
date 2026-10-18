/**
 * Diagnostic or client environmental metadata sent by the calling agent client.
 */
export interface AgentEnvironment {
  readonly runtime?: string | undefined;
  readonly platform?: string | undefined;
  readonly editor?: string | undefined;
  readonly extensionVersion?: string | undefined;
  readonly customAttributes?: Record<string, unknown> | undefined;
}
