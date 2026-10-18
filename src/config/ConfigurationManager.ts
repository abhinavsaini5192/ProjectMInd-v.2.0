import { z } from 'zod';
import { ConfigurationError } from '../errors';

/**
 * Zod schema defining the expected shape of ProjectMind configuration.
 */
export const ConfigSchema = z.object({
  /** Enable debug logging */
  debug: z.boolean().default(false),
  
  /** The maximum size of the history log before snapshotting */
  maxHistorySizeMB: z.number().positive().default(5),
  
  /** Paths to explicitly ignore during structural parsing */
  ignoredPaths: z.array(z.string()).default(['node_modules', '.venv', 'vendor', '.git']),
  
  /** Which parser plugins should be loaded by default */
  parsers: z.array(z.string()).default(['tree-sitter-typescript', 'tree-sitter-python']),

  /** MCP server settings */
  mcpEnabled: z.boolean().default(true),
  mcpServerName: z.string().default('projectmind-mcp-server'),
  mcpServerVersion: z.string().default('1.0.0'),
  mcpMaxPayloadBytes: z.number().positive().default(512 * 1024),
  mcpRequestTimeoutMs: z.number().positive().default(15000),
  mcpSessionTimeoutMs: z.number().positive().default(30 * 60 * 1000),
});

/**
 * Type representing the validated Configuration.
 */
export type ProjectMindConfig = z.infer<typeof ConfigSchema>;

/**
 * Manages loading, validating, and serving the global configuration.
 */
export class ConfigurationManager {
  private config: ProjectMindConfig;

  constructor(initialConfig?: Partial<ProjectMindConfig>) {
    this.config = this.validateAndApplyDefaults(initialConfig || {});
  }

  /**
   * Validates raw config object against the Zod schema and applies defaults.
   */
  private validateAndApplyDefaults(rawConfig: unknown): ProjectMindConfig {
    const result = ConfigSchema.safeParse(rawConfig);
    if (!result.success) {
      throw new ConfigurationError(
        `Invalid configuration: ${result.error.message}`,
        'CONFIG_VALIDATION_FAILED',
        'Check your projectmind.config.json for schema errors.'
      );
    }
    return result.data;
  }

  /**
   * Loads configuration from a JSON string.
   */
  public loadFromJson(jsonString: string): void {
    try {
      const parsed = JSON.parse(jsonString);
      this.config = this.validateAndApplyDefaults(parsed);
    } catch (err) {
      if (err instanceof ConfigurationError) {
        throw err;
      }
      throw new ConfigurationError('Failed to parse configuration JSON.', 'CONFIG_PARSE_FAILED');
    }
  }

  /**
   * Gets the active configuration.
   */
  public getConfig(): ProjectMindConfig {
    return this.config;
  }

  /**
   * Updates the configuration on the fly.
   */
  public updateConfig(newConfig: Partial<ProjectMindConfig>): void {
    this.config = this.validateAndApplyDefaults({ ...this.config, ...newConfig });
  }
}
