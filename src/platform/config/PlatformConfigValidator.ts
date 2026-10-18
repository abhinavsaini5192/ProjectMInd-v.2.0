import { PlatformConfigSchema, type PlatformConfig } from './PlatformConfig.js';
import { ConfigurationError } from '../../errors/index.js';
import { ConfigRedactor } from './ConfigRedactor.js';

export class PlatformConfigurationError extends ConfigurationError {
  constructor(
    message: string,
    public readonly validationErrors?: readonly string[] | undefined,
    suggestedRecovery?: string
  ) {
    super(
      ConfigRedactor.redactString(message),
      'CONFIG_VALIDATION_FAILED',
      suggestedRecovery ?? 'Review environment variables and configuration files.'
    );
    this.name = 'PlatformConfigurationError';
  }
}

export const KNOWN_INSECURE_KEYS = new Set<string>([
  'default-development-key',
  'development-secret-key',
  'placeholder-secret',
  'placeholder-api-key',
  'change-me-in-production',
  'projectmind-dev-key',
  'dev_secret_key',
  'dev_master_key',
  'secret',
  'password',
  '12345678901234567890123456789012',
]);

export class PlatformConfigValidator {
  public static validate(rawConfig: unknown): PlatformConfig {
    const result = PlatformConfigSchema.safeParse(rawConfig);
    if (!result.success) {
      const errorDetails = result.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`
      );
      throw new PlatformConfigurationError(
        `Configuration validation failed with ${errorDetails.length} errors: ${errorDetails.join('; ')}`,
        errorDetails.map((err) => ConfigRedactor.redactString(err))
      );
    }

    const config = result.data;

    // Cross-field validation
    if (config.redis.enabled && (!config.redis.url || config.redis.url.trim() === '')) {
      throw new PlatformConfigurationError(
        'Redis configuration error: redis.url must be specified when redis is enabled.',
        ['redis.url: Required when redis.enabled is true'],
        'Set PROJECTMIND_REDIS_URL or disable redis coordination.'
      );
    }

    // Production strictness validation
    if (config.app.env === 'production') {
      const prodErrors: string[] = [];

      const masterKey = config.security.masterKey?.trim();
      if (!masterKey || masterKey.length === 0) {
        prodErrors.push('PROJECTMIND_MASTER_KEY is required in production environments but was not supplied.');
      } else if (KNOWN_INSECURE_KEYS.has(masterKey.toLowerCase())) {
        prodErrors.push('PROJECTMIND_MASTER_KEY matches a known insecure development default and cannot be used in production.');
      } else if (masterKey.length < 32) {
        prodErrors.push(`PROJECTMIND_MASTER_KEY must be at least 32 characters (256 bits) for cryptographic security in production (got ${masterKey.length} characters).`);
      }

      if (config.security.allowUnsafeDevDefaults) {
        prodErrors.push('security.allowUnsafeDevDefaults must not be enabled in production.');
      }

      if (config.storage.type === 'sqlite' && (!config.storage.location || config.storage.location === ':memory:')) {
        prodErrors.push('Persistent storage location is required for SQLite in production.');
      }

      if (config.server.port < 0 || config.server.port > 65535) {
        prodErrors.push(`server.port must be between 0 and 65535 (got ${config.server.port}).`);
      }

      if (config.worker.concurrency < 1) {
        prodErrors.push(`worker.concurrency must be at least 1 (got ${config.worker.concurrency}).`);
      }

      if (prodErrors.length > 0) {
        throw new PlatformConfigurationError(
          `Production configuration check failed: ${prodErrors.join('; ')}`,
          prodErrors,
          'Ensure production environment variables and storage configurations are properly set.'
        );
      }
    }

    return config;
  }
}
