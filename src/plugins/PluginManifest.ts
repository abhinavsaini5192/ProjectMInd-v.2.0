import { z } from 'zod';

/**
 * Validates a semver string roughly.
 */
const SemverRegex = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-zA-Z0-9-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-zA-Z0-9-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

/**
 * Zod schema for Plugin Manifest.
 */
export const PluginManifestSchema = z.object({
  /**
   * Human-readable plugin name.
   */
  name: z.string().min(1),

  /**
   * Unique identifier (e.g., org.projectmind.parser).
   */
  id: z.string().min(1),

  /**
   * Description of what the plugin does.
   */
  description: z.string(),

  /**
   * Author information.
   */
  author: z.string(),

  /**
   * Semantic version of the plugin.
   */
  version: z.string().regex(SemverRegex, 'Invalid semantic version format.'),

  /**
   * Compatibility with ProjectMind Kernel (e.g., "^1.0.0").
   */
  projectMindVersion: z.string(),

  /**
   * Other plugins this plugin depends on (Record<pluginId, versionRange>).
   */
  dependencies: z.record(z.string(), z.string()).optional(),

  /**
   * Optional dependencies.
   */
  optionalDependencies: z.record(z.string(), z.string()).optional(),

  /**
   * Capabilities provided by this plugin (e.g., ['ProvidesParser', 'ProvidesAIAdapter']).
   */
  capabilities: z.array(z.string()).optional(),

  /**
   * Permissions requested by this plugin (e.g., ['ReadRepository', 'WriteMemory']).
   */
  permissions: z.array(z.string()).optional(),

  /**
   * Entry point path for the plugin.
   */
  entryPoint: z.string(),

  /**
   * Open source license.
   */
  license: z.string().optional(),

  /**
   * Plugin repository URL.
   */
  repository: z.string().optional(),

  /**
   * Plugin documentation URL.
   */
  documentation: z.string().optional(),
});

export type PluginManifest = z.infer<typeof PluginManifestSchema>;

export class ManifestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ManifestValidationError';
  }
}

/**
 * Validates a raw JSON object against the PluginManifest schema.
 * @param manifestRaw The parsed JSON object.
 * @returns Validated PluginManifest.
 */
export function validateManifest(manifestRaw: unknown): PluginManifest {
  const result = PluginManifestSchema.safeParse(manifestRaw);
  if (!result.success) {
    throw new ManifestValidationError(
      `Manifest validation failed: ${result.error.issues.map((e) => e.message).join(', ')}`
    );
  }
  return result.data;
}
